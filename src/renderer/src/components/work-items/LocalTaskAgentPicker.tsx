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
  const taskPrompt = [
    `你正在处理 Orca 本地任务：${item.title}`,
    `任务 ID：${item.id}`,
    `任务描述：${item.description}`,
    '',
    '请把本轮工作绑定到这个任务：先执行 `orca local-task current --json` 读取项目目录 `orca/<任务ID>/task.json`；需要拆分工作时用 `orca local-task subtask-create --title "..." --step "..."` 创建子任务和 AI 执行步骤，用 `orca local-task subtask-update --subtask <子任务ID> --status <状态>` 更新子任务，用 `orca local-task step-update --subtask <子任务ID> --step <步骤ID> --status <状态>` 更新步骤（状态可用 todo、doing、done、canceled），用 `orca local-task update-description --description "..."` 更新任务描述；完成本轮后用 `orca local-task report-completed --output "..." --title-suggestion "..."` 报告最后输出和完成状态（只有首次未自定义标题时才提交标题建议）。这些命令会更新项目目录里的任务文件；是否需要额外修改 prd.md、plan.json 或 records.md，由你根据需求变化自行判断，不要自动维护共享的 project_status.md。不要创建新的顶层任务。'
  ].join('\n')

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
            prompt={taskPrompt}
            launchSource="task_page"
            localTaskId={item.id}
            localTaskRoot={item.projectPath}
            onFocusTerminal={onStarted}
          />
        ) : (
          <div className="px-2 py-2 text-xs text-muted-foreground">当前任务没有可用 workspace</div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
