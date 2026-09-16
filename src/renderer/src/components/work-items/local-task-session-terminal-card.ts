import { hasLocalTaskTerminalBinding } from './local-task-terminal-binding'
import type { AppState } from '@/store/types'
import { getAiVaultResumeWorkspaceExecutionHostId } from '@/lib/ai-vault-resume-target'
import { parsePaneKey } from '../../../../shared/stable-pane-id'
import { isResumableTuiAgent } from '../../../../shared/agent-session-resume'
import type { DashboardCard } from '../../../../shared/dashboard-snapshot'
import { readDashboardClientHost } from '../dashboard/dashboard-client-host'
import { resolveDashboardCardTerminalInput } from '../dashboard/dashboard-card-terminal-input'
import { localTaskSessionMatchesTab } from './local-task-session-identity'
import type { WorkItem } from './mock-data'

export function localTaskSessionTerminalCard(
  session: WorkItem['sessionsList'][number],
  state: AppState
): DashboardCard | null {
  const binding = session.terminalBinding
  const tabId = session.tabId ?? session.id
  const workspaceId = session.workspaceId
  const pane = binding ? parsePaneKey(binding.paneKey) : null
  if (
    !binding ||
    !tabId ||
    !workspaceId ||
    !pane ||
    session.livenessUnverifiable ||
    !hasLocalTaskTerminalBinding(state, workspaceId, tabId, binding) ||
    !localTaskSessionMatchesTab(session, state, binding.paneKey) ||
    !state.ptyIdsByTabId[tabId]?.includes(binding.ptyId) ||
    getAiVaultResumeWorkspaceExecutionHostId(state, workspaceId) !== binding.executionHostId
  ) {
    return null
  }

  const workspace = state.getKnownWorktreeById(workspaceId)
  const client = readDashboardClientHost()
  // 恢复绑定只证明终端归属，不据此推断智能体正在工作或已完成。
  return {
    paneKey: binding.paneKey,
    ptyId: binding.ptyId,
    agentType: session.agentId ?? 'unknown',
    bucket: 'idle',
    dotState: 'idle',
    task: session.title,
    conversationName: session.title,
    repoId: workspace?.repoId ?? '',
    worktreeId: workspaceId,
    tabId,
    leafId: pane.leafId,
    executionHostId: binding.executionHostId,
    repoName: '',
    worktreeName: workspace?.path ?? workspaceId,
    startedAt: 0,
    finishedAt: null,
    stateChangedAt: 0,
    unseen: false,
    terminalInput: resolveDashboardCardTerminalInput(state, {
      ptyId: binding.ptyId,
      worktreeId: workspaceId,
      paneKey: binding.paneKey,
      cwd: workspace?.path ?? '',
      shellOverride: undefined,
      launchAgent: isResumableTuiAgent(session.agentId) ? session.agentId : null,
      clientPlatform: client.platform,
      userAgent: client.userAgent,
      osRelease: client.osRelease
    })
  }
}
