import { ListChecks, Plus, Sparkles, TerminalSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { QuickLaunchAgentMenuItems } from '@/components/tab-bar/QuickLaunchButton'
import type { TuiAgent } from '../../../../shared/tui-agent'

export function LocalTaskCenterHeader({
  onCreate,
  onOpenWorkspaceBoard,
  onRunAll,
  runAllDisabled,
  candidateCount,
  agentWorktreeId
}: {
  onCreate: () => void
  onOpenWorkspaceBoard: () => void
  onRunAll: (agent: TuiAgent) => void
  runAllDisabled: boolean
  candidateCount: number
  agentWorktreeId: string | null
}): React.JSX.Element {
  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border px-6">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-8 items-center justify-center rounded-md bg-foreground text-background">
          <Sparkles className="size-4" />
        </div>
        <div>
          <h1 className="text-[15px] font-semibold tracking-tight">任务中心</h1>
          <p className="text-[11px] text-muted-foreground">把 AI 的并行工作变成可验收的研发目标</p>
        </div>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              disabled={runAllDisabled || candidateCount === 0 || !agentWorktreeId}
              title={
                candidateCount === 0
                  ? '没有可执行任务：需要 Open、已整理、绑定 workspace 且未运行'
                  : '按 workspace 串行执行当前可执行任务'
              }
            >
              <ListChecks className="size-3.5" />
              执行当前任务
              {candidateCount > 0 ? (
                <span className="rounded bg-muted px-1 text-[10px]">{candidateCount}</span>
              ) : null}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-56">
            <DropdownMenuLabel>选择批量执行的 Agent</DropdownMenuLabel>
            {agentWorktreeId ? (
              <QuickLaunchAgentMenuItems
                worktreeId={agentWorktreeId}
                launchSource="task_page"
                onSelectAgent={onRunAll}
                onFocusTerminal={() => {}}
              />
            ) : (
              <div className="px-2 py-2 text-xs text-muted-foreground">当前没有可用 workspace</div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={onOpenWorkspaceBoard}
        >
          <TerminalSquare className="size-3.5" />
          Workspace 看板
        </Button>
        <Button variant="default" size="sm" className="gap-1.5 text-xs" onClick={onCreate}>
          <Plus className="size-3.5" />
          新建本地任务
        </Button>
      </div>
    </header>
  )
}
