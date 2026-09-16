import { agentProviderSessionsEqual } from '../../shared/agent-session-resume'
import type { LocalTask, LocalTaskSession } from '../../shared/local-task-types'
import type { AgentStatusIpcPayload } from '../../shared/agent-status-types'
import { agentHookServer } from '../agent-hooks/server'
import { watchCodexSessionRetry, type CodexSessionRetryWatch } from './codex-session-retry-watch'
import type { Store } from '../persistence'
import type { OrcaRuntimeService } from '../runtime/orca-runtime'
import { isLocalTaskHost } from '../runtime/rpc/methods/local-task-host-scope'
import { getLocalTaskStore } from './store'

type WatchedSession = {
  key: string
  watch: CodexSessionRetryWatch | null
}

export function startLocalTaskSessionRetryMonitor(
  profile: Store,
  runtime: OrcaRuntimeService
): {
  stopSession: (sessionId: string) => LocalTask
  dispose: () => void
} {
  const monitorStartedAt = Date.now()
  const tasks = getLocalTaskStore(profile)
  const watched = new Map<string, WatchedSession>()
  let disposed = false
  let reconciling = false
  const bindingKey = (session: LocalTaskSession): string =>
    JSON.stringify([session.tabId ?? session.id, session.agentId, session.providerSession])
  const currentSession = (taskId: string, sessionId: string): LocalTaskSession | undefined =>
    tasks.get(taskId)?.sessions.find((session) => session.id === sessionId)
  const currentHook = (session: LocalTaskSession): AgentStatusIpcPayload | undefined =>
    agentHookServer
      .getStatusSnapshot()
      .filter((row) => row.tabId === (session.tabId ?? session.id) && !row.connectionId)
      .sort((a, b) => b.receivedAt - a.receivedAt)[0]

  async function install(task: LocalTask, session: LocalTaskSession): Promise<void> {
    const key = bindingKey(session)
    const eligible = (): boolean => {
      const current = tasks.get(task.id)
      const row = currentSession(task.id, session.id)
      if (
        disposed ||
        !current ||
        current.archivedAt !== null ||
        current.status === 'Done' ||
        !row ||
        bindingKey(row) !== key ||
        !isLocalTaskHost(runtime, current)
      ) {
        return false
      }
      const hook = currentHook(row)
      return Boolean(
        hook?.agentType === 'codex' &&
        agentProviderSessionsEqual('codex', row.providerSession, hook.providerSession) &&
        runtime.getAgentStatusTerminalHandleForPaneKey(hook.paneKey)
      )
    }
    const entry: WatchedSession = { key, watch: null }
    watched.set(session.id, entry)
    try {
      const watch = await watchCodexSessionRetry({
        profile, runtime, providerSession: session.providerSession!, monitorStartedAt,
        currentHook: () => currentHook(session),
        read: () => currentSession(task.id, session.id)?.retry ?? null,
        save: (retry, working) => {
          if (!disposed && watched.get(session.id) === entry && tasks.get(task.id) && bindingKey(currentSession(task.id, session.id) ?? session) === key) {
            tasks.setSessionRetry(task.id, session.id, retry, working)
          }
        },
        eligible
      })
      if (disposed || watched.get(session.id) !== entry) watch.dispose()
      else entry.watch = watch
    } catch {
      if (watched.get(session.id) === entry) watched.delete(session.id)
    }
  }

  async function reconcile(): Promise<void> {
    if (disposed || reconciling) {
      return
    }
    reconciling = true
    try {
      const candidates = new Map<string, { task: LocalTask; session: LocalTaskSession }>()
      for (const task of tasks.list()) {
        if (task.status === 'Done' || !isLocalTaskHost(runtime, task)) {
          continue
        }
        for (const session of task.sessions) {
          const hook = currentHook(session)
          if (
            hook?.agentType === 'codex' &&
            hook.providerSession &&
            (!session.providerSession ||
              agentProviderSessionsEqual('codex', session.providerSession, hook.providerSession)) &&
            (!session.agentId || !session.providerSession)
          ) {
            tasks.updateSessionOutput({
              sessionId: session.id,
              agentId: 'codex',
              providerSession: hook.providerSession
            })
          }
          const current = currentSession(task.id, session.id)!
          if (current.agentId === 'codex' && current.providerSession) {
            candidates.set(current.id, { task, session: current })
          }
        }
      }
      for (const [id, entry] of watched) {
        const candidate = candidates.get(id)
        if (!candidate || bindingKey(candidate.session) !== entry.key) {
          entry.watch?.stop('任务已关闭或原会话绑定已变化。')
          entry.watch?.dispose()
          watched.delete(id)
        }
      }
      for (const [id, candidate] of candidates) {
        if (!watched.has(id)) {
          await install(candidate.task, candidate.session)
        }
      }
    } finally {
      reconciling = false
    }
  }
  const tick = (): void => {
    void reconcile().catch(() => {})
  }
  const timer = setInterval(tick, 5_000)
  timer.unref?.()
  tick()
  return {
    stopSession: (sessionId) => {
      const task = tasks
        .list(undefined, undefined, { includeArchived: true })
        .find((task) => task.sessions.some((session) => session.id === sessionId))
      if (!task) {
        throw new Error('未找到任务会话')
      }
      const retry = task.sessions.find((session) => session.id === sessionId)?.retry
      watched.get(sessionId)?.watch?.stop()
      if (retry && !watched.has(sessionId)) {
        tasks.setSessionRetry(
          task.id,
          sessionId,
          { ...retry, phase: 'stopped', nextRetryAt: null, reason: '用户已停止自动重试。' },
          false
        )
      }
      return tasks.get(task.id)!
    },
    dispose: () => {
      disposed = true
      clearInterval(timer)
      for (const entry of watched.values()) {
        entry.watch?.dispose()
      }
      watched.clear()
    }
  }
}
