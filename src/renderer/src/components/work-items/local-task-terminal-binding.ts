import { parsePaneKey } from '../../../../shared/stable-pane-id'
import type { LocalTaskTerminalBinding } from '../../../../shared/local-task-types'

export type LocalTaskTerminalBindingState = {
  tabsByWorktree: Record<string, readonly { id: string }[]>
  terminalLayoutsByTabId: Record<
    string,
    { ptyIdsByLeafId?: Record<string, string | undefined> } | undefined
  >
}

export function hasLocalTaskTerminalBinding(
  state: LocalTaskTerminalBindingState,
  workspaceId: string,
  tabId: string,
  binding: LocalTaskTerminalBinding
): boolean {
  const pane = parsePaneKey(binding.paneKey)
  return Boolean(
    pane?.tabId === tabId &&
    state.tabsByWorktree[workspaceId]?.some((tab) => tab.id === tabId) &&
    state.terminalLayoutsByTabId[tabId]?.ptyIdsByLeafId?.[pane.leafId] === binding.ptyId
  )
}

export async function waitForLocalTaskTerminalBinding(
  workspaceId: string,
  tabId: string,
  binding: LocalTaskTerminalBinding
): Promise<void> {
  const { useAppStore } = await import('@/store')
  const ready = (): boolean =>
    hasLocalTaskTerminalBinding(useAppStore.getState(), workspaceId, tabId, binding)
  if (ready()) {
    return
  }
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      unsubscribe()
      reject(new Error('原会话已恢复，但终端标签尚未就绪，请稍后重试。'))
    }, 10_000)
    const check = (): void => {
      if (!ready()) {
        return
      }
      clearTimeout(timer)
      unsubscribe()
      resolve()
    }
    const unsubscribe = useAppStore.subscribe(check)
    check()
  })
}
