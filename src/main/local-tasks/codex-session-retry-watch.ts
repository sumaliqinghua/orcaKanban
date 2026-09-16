import type { AgentProviderSessionMetadata } from '../../shared/agent-session-resume'
import type { AgentStatusIpcPayload } from '../../shared/agent-status-types'
import type { LocalTaskSessionRetry } from '../../shared/local-task-session-retry'
import type { NativeChatTurnLifecycle } from '../../shared/native-chat-types'
import { readNativeChatTranscriptTail, subscribeNativeChatTranscript } from '../native-chat/transcript-watch'
import type { Store } from '../persistence'
import type { OrcaRuntimeService } from '../runtime/orca-runtime'
import { LocalTaskSessionRetryController } from './session-retry-controller'

export type CodexSessionRetryWatch = { dispose: () => void; stop: (reason?: string) => void }

type RetryWatchArgs = {
  profile: Store
  runtime: OrcaRuntimeService
  providerSession: AgentProviderSessionMetadata
  currentHook: () => AgentStatusIpcPayload | undefined
  eligible: () => boolean
  read: () => LocalTaskSessionRetry | null
  save: (retry: LocalTaskSessionRetry | null, working: boolean) => void
  monitorStartedAt: number
}

export async function watchCodexSessionRetry(args: RetryWatchArgs): Promise<CodexSessionRetryWatch> {
  const { profile, runtime, providerSession } = args
  const controller = new LocalTaskSessionRetryController({
    read: args.read,
    save: args.save,
    eligible: args.eligible,
    send: async (turn, beforeWrite, signal) => {
      const hook = args.currentHook()
      const handle = hook && runtime.getAgentStatusTerminalHandleForPaneKey(hook.paneKey)
      if (!handle) throw new Error('原会话终端不可用')
      await profile.flushPendingOrThrowAsync()
      const verify = async (): Promise<void> => {
        beforeWrite()
        const latestHook = args.currentHook()
        if (!latestHook || latestHook.paneKey !== hook!.paneKey || runtime.getAgentStatusTerminalHandleForPaneKey(latestHook.paneKey) !== handle) {
          throw new Error('原会话身份已变化')
        }
        const [status, tail] = await Promise.all([
          runtime.getTerminalAgentStatus(handle),
          readNativeChatTranscriptTail({ agent: 'codex', sessionId: providerSession.id, transcriptPath: providerSession.transcriptPath, limit: 2 }, signal)
        ])
        if (!status.isRunningAgent || status.status !== 'idle' || 'error' in tail || tail.lifecycle?.turnId !== turn.turnId || tail.lifecycle.state !== 'completed' || tail.lifecycle.error !== turn.error || tail.messages.some(message => message.role === 'user' && (message.timestamp ?? 0) > (turn.timestamp ?? Infinity))) {
          throw new Error('会话已开始新一轮或执行状态无法确认')
        }
        beforeWrite()
      }
      await verify()
      const sent = await runtime.sendTerminalAgentPrompt(handle, '继续', { beforeWrite: verify, signal })
      if (!sent.accepted) throw new Error('继续未确认提交')
    }
  })
  const receive = (lifecycle: NativeChatTurnLifecycle | undefined, initial: boolean): void => {
    if (!lifecycle) return
    // 首次扫描前发生的新失败仍可重试，启动前的历史失败只展示。
    const historical = initial && (lifecycle.timestamp === null || lifecycle.timestamp < args.monitorStartedAt)
    controller.observe(lifecycle, historical)
  }
  try {
    const subscription = await subscribeNativeChatTranscript({
      agent: 'codex', sessionId: providerSession.id, transcriptPath: providerSession.transcriptPath, initialLimit: 2,
      onInitialSnapshot: (_messages, _more, _offset, error, lifecycle) => {
        if (error) controller.stop('无法读取原会话记录，自动重试已停止。')
        else receive(lifecycle, true)
      },
      onReplace: (_messages, _more, _offset, lifecycle) => receive(lifecycle, true),
      onAppend: (_messages, lifecycle) => receive(lifecycle, false)
    })
    return {
      stop: (reason) => controller.stop(reason),
      dispose: () => { controller.dispose(); subscription.unsubscribe() }
    }
  } catch (error) {
    controller.stop('无法监听原会话记录，自动重试已停止。')
    controller.dispose()
    throw error
  }
}
