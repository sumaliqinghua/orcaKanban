import { MessageSquare, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { QuickLaunchAgentMenuItems } from '@/components/tab-bar/QuickLaunchButton'
import { useAppStore } from '@/store'
import type { WorkItem } from './mock-data'

export function LocalTaskAgentPicker({
  item,
  onStarted
}: {
  item: WorkItem
  onStarted: (tabId: string) => void
}): React.JSX.Element {
  const activeWorktreeId = useAppStore((state) => state.activeWorktreeId)
  const worktreeId = item.workspaceId === 'local' ? activeWorktreeId : item.workspaceId
  const activeGroupId = useAppStore((state) =>
    worktreeId
      ? (state.activeGroupIdByWorktree[worktreeId] ?? state.groupsByWorktree[worktreeId]?.[0]?.id)
      : undefined
  )
  const label = item.sessions === 0 ? '启动任务' : '从任务中心新建关联会话'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="mt-2 h-8 w-full gap-1.5 text-[11px]">
          {item.sessions === 0 ? (
            <Play className="size-3.5" />
          ) : (
            <MessageSquare className="size-3.5" />
          )}
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        <DropdownMenuLabel>选择要启动的 Agent</DropdownMenuLabel>
        {worktreeId ? (
          <QuickLaunchAgentMenuItems
            worktreeId={worktreeId}
            groupId={activeGroupId}
            prompt={item.description}
            launchSource="task_page"
            onFocusTerminal={onStarted}
          />
        ) : (
          <div className="px-2 py-2 text-xs text-muted-foreground">当前任务没有可用 workspace</div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
