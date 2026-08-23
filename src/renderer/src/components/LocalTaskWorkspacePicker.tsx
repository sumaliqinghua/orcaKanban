import { Button } from '@/components/ui/button'
import type { Worktree } from '../../../shared/worktree/types'

export function LocalTaskWorkspacePicker({
  creatingWorkspace,
  workspaces,
  selectedWorkspaceId,
  onWorkspaceChange,
  onBackToExisting
}: {
  creatingWorkspace: boolean
  workspaces: Worktree[]
  selectedWorkspaceId: string
  onWorkspaceChange: (value: string) => void
  onBackToExisting: () => void
}): React.JSX.Element {
  if (creatingWorkspace) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 px-0 text-[11px]"
        onClick={onBackToExisting}
      >
        返回选择已有 workspace
      </Button>
    )
  }
  return (
    <label className="block space-y-1 text-xs font-medium text-muted-foreground">
      <span>绑定 workspace</span>
      <select
        value={selectedWorkspaceId}
        onChange={(event) => onWorkspaceChange(event.target.value)}
        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm font-normal text-foreground outline-none focus:border-ring focus:ring-[3px] focus:ring-ring/50"
      >
        {workspaces.length === 0 ? (
          <option value="local">local · 当前 HEAD（暂无已登记 workspace）</option>
        ) : null}
        {workspaces.map((workspace) => (
          <option key={workspace.id} value={workspace.id}>
            {workspace.displayName} · {workspace.branch || `HEAD ${workspace.head.slice(0, 7)}`}
            {workspace.isMainWorktree ? ' · 主 workspace' : ''}
          </option>
        ))}
        <option value="__new__">新建 workspace…</option>
      </select>
    </label>
  )
}
