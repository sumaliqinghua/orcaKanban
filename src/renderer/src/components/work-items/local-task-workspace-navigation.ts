import { activateTabAndFocusPane } from '@/lib/activate-tab-and-focus-pane'
import { activateWorktreeFromSidebar } from '@/lib/sidebar-worktree-activation'
import { useAppStore } from '@/store'
import type { DashboardRevealAgentArgs } from '../../../../shared/dashboard-snapshot'
import { parseWorkspaceKey } from '../../../../shared/workspace-scope'
import type { WorkItem } from './mock-data'
import { localTaskSessionMatchesTab } from './local-task-session-identity'

export function openLocalTaskWorkspace(args: {
  item: WorkItem
  request?: string | DashboardRevealAgentArgs
  setLoadError: (message: string) => void
}): void {
  const state = useAppStore.getState()
  const sessionId = typeof args.request === 'string' ? args.request : undefined
  const session = args.item.sessionsList.find((row) => row.id === sessionId)
  const reveal = typeof args.request === 'object' && args.request ? args.request : undefined
  const requestedId = reveal?.worktreeId ?? session?.workspaceId ?? args.item.workspaceId
  const knownWorkspace = requestedId ? state.getKnownWorktreeById(requestedId) : undefined
  const workspaceByPath = args.item.projectPath
    ? state.allWorktrees().find((worktree) => worktree.path === args.item.projectPath)
    : undefined
  const target =
    requestedId === 'local'
      ? state.activeWorktreeId
      : (knownWorkspace?.id ??
        workspaceByPath?.id ??
        (requestedId && parseWorkspaceKey(requestedId) ? requestedId : null))
  if (!target) {
    args.setLoadError('当前任务没有可激活的 workspace')
    return
  }
  const activation = reveal?.executionHostId
    ? activateWorktreeFromSidebar(target, reveal.executionHostId)
    : activateWorktreeFromSidebar(target)
  void activation
    .then((activated) => {
      if (activated === false) {
        args.setLoadError('当前任务的 workspace 不可用')
        return
      }
      if (sessionId) {
        const currentTabs = useAppStore.getState().tabsByWorktree?.[target] ?? []
        const tabId = session?.tabId ?? sessionId
        if (
          !currentTabs.some((tab) => tab.id === tabId) ||
          (session && !localTaskSessionMatchesTab(session, useAppStore.getState()))
        ) {
          args.setLoadError('原会话终端已不可用，请从会话历史恢复原会话。')
          return
        }
        activateTabAndFocusPane(tabId, null)
      }
      if (reveal) {
        activateTabAndFocusPane(reveal.tabId, reveal.leafId)
      }
      // 跳转应显示目标终端，不能恢复进入任务中心前的其他页面。
      useAppStore.getState().setActiveView('terminal')
    })
    .catch((error: unknown) =>
      args.setLoadError(error instanceof Error ? error.message : 'workspace 打开失败')
    )
}
