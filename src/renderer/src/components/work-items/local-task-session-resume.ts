import { toRemoteRuntimePtyId } from '../../../../shared/remote-runtime-pty-id'
import { parsePaneKey } from '../../../../shared/stable-pane-id'
import {
  waitForLocalTaskTerminalBinding,
  hasLocalTaskTerminalBinding
} from './local-task-terminal-binding'
import { useAppStore } from '@/store'
import { callRuntimeRpc } from '@/runtime/runtime-rpc-client'
import { refreshWebRuntimeSessionTabsSnapshot } from '@/runtime/web-runtime-session'
import { toRuntimeWorktreeSelector } from '@/runtime/runtime-worktree-selector'
import { getAiVaultResumeWorkspaceExecutionHostId } from '@/lib/ai-vault-resume-target'
import { isResumableTuiAgent } from '../../../../shared/agent-session-resume'
import { parseExecutionHostId } from '../../../../shared/execution-host'
import type {
  RuntimeEnsureAgentSessionRequest,
  RuntimeEnsureAgentSessionResult
} from '../../../../shared/agent-session-host-authority'
import type { DashboardRevealAgentArgs } from '../../../../shared/dashboard-snapshot'
import type { LocalTask } from '../../../../shared/local-task-types'
import type { WorkItem } from './mock-data'

export async function resumeLocalTaskSession(args: {
  sessionId: string
  session: WorkItem['sessionsList'][number]
  workspaceId: string
  onTaskChanged: (task: LocalTask) => void
}): Promise<DashboardRevealAgentArgs> {
  const { session, sessionId } = args
  if (!session.providerSession || !isResumableTuiAgent(session.agentId)) {
    throw new Error('此记录缺少原始会话标识，无法自动恢复。请在会话历史中确认原会话。')
  }
  const workspaceId = session.workspaceId ?? args.workspaceId
  const hostId = getAiVaultResumeWorkspaceExecutionHostId(useAppStore.getState(), workspaceId)
  const host = parseExecutionHostId(hostId)
  if (!host || workspaceId === 'local') {
    throw new Error('无法确认原会话所属工作区和执行主机。')
  }
  // 由执行主机查找或恢复原始会话，避免客户端按提示词猜测或重复启动。
  const result = await callRuntimeRpc<RuntimeEnsureAgentSessionResult>(
    host.kind === 'runtime'
      ? { kind: 'environment', environmentId: host.environmentId }
      : { kind: 'local' },
    'terminal.ensureAgentSession',
    {
      kind: 'explicit',
      worktree: toRuntimeWorktreeSelector(workspaceId),
      agent: session.agentId,
      providerSession: session.providerSession,
      presentation: host.kind === 'runtime' ? 'background' : 'focused'
    } satisfies RuntimeEnsureAgentSessionRequest,
    { timeoutMs: 30_000 }
  )
  const tabId = result.terminal.tabId
  if (!tabId) {
    throw new Error('执行主机未返回原会话的终端标识。')
  }
  if (host.kind === 'runtime') {
    await refreshWebRuntimeSessionTabsSnapshot(host.environmentId, result.terminal.worktreeId, {
      afterCurrentInFlight: true,
      errorMode: 'throw'
    })
  }
  const pane = result.terminal.paneKey ? parsePaneKey(result.terminal.paneKey) : null
  if (!pane || pane.tabId !== tabId || !result.terminal.ptyId) {
    throw new Error('执行主机未返回可验证的原会话窗格，请更新执行主机后重试。')
  }
  const terminalBinding = {
    paneKey: result.terminal.paneKey!,
    ptyId:
      host.kind === 'runtime'
        ? toRemoteRuntimePtyId(result.terminal.handle, host.environmentId)
        : result.terminal.ptyId,
    executionHostId:
      host.kind === 'runtime' ? host.id : (result.terminal.executionHostId ?? host.id)
  }
  if (
    host.kind !== 'runtime' &&
    !hasLocalTaskTerminalBinding(
      useAppStore.getState(),
      result.terminal.worktreeId,
      tabId,
      terminalBinding
    )
  ) {
    // 本机 RPC 也可后台创建；按返回的终端句柄挂载界面，不能借用当前活动标签。
    await callRuntimeRpc({ kind: 'local' }, 'terminal.focus', {
      terminal: result.terminal.handle,
      navigation: 'host'
    })
  }
  await waitForLocalTaskTerminalBinding(result.terminal.worktreeId, tabId, terminalBinding)
  const task = await window.api.localTasks.rebindSessionTab({ sessionId, tabId, terminalBinding })
  args.onTaskChanged(task)
  return {
    repoId: task.projectId,
    worktreeId: result.terminal.worktreeId,
    executionHostId: terminalBinding.executionHostId,
    tabId,
    leafId: pane.leafId
  }
}
