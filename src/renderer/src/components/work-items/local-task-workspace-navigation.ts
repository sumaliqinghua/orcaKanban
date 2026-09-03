import { activateTabAndFocusPane } from '@/lib/activate-tab-and-focus-pane'
import { activateWorktreeFromSidebar } from '@/lib/sidebar-worktree-activation'
import { useAppStore } from '@/store'
import type { DashboardRevealAgentArgs } from '../../../../shared/dashboard-snapshot'
import { parseWorkspaceKey } from '../../../../shared/workspace-scope'
import type { WorkItem } from './mock-data'

export function openLocalTaskWorkspace(args: {
  item: WorkItem
  request?: string | DashboardRevealAgentArgs
  setLoadError: (message: string) => void
  rebindSessionTab: (sessionId: string, tabId: string) => void
}): void {
  const state = useAppStore.getState()
  const sessionId = typeof args.request === 'string' ? args.request : undefined
  const reveal = typeof args.request === 'object' && args.request ? args.request : undefined
  const requestedId = reveal?.worktreeId ?? args.item.workspaceId
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
  const beforeTabIds = new Set((state.tabsByWorktree?.[target] ?? []).map((tab) => tab.id))
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
        const newTabIds = currentTabs.map((tab) => tab.id).filter((id) => !beforeTabIds.has(id))
        const actualTabId = newTabIds.length === 1 ? newTabIds[0] : null
        if (actualTabId && actualTabId !== sessionId) {
          args.rebindSessionTab(sessionId, actualTabId)
        }
      }
      if (reveal) {
        activateTabAndFocusPane(reveal.tabId, reveal.leafId)
      }
      useAppStore.getState().closeWorkItemsPage()
    })
    .catch((error: unknown) =>
      args.setLoadError(error instanceof Error ? error.message : 'workspace 打开失败')
    )
}
