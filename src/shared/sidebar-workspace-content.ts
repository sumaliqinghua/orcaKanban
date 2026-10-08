export type SidebarWorkspaceContent = 'sessions' | 'tasks'

export function normalizeSidebarWorkspaceContent(value: unknown): SidebarWorkspaceContent {
  return value === 'tasks' ? 'tasks' : 'sessions'
}
