import { useState } from 'react'
import { MessageSquare, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Textarea } from '@/components/ui/textarea'
import { QuickLaunchAgentMenuItems } from '@/components/tab-bar/QuickLaunchButton'
import { useAppStore } from '@/store'
import type { WorkItem } from './mock-data'

function buildTaskPrompt(item: WorkItem, request: string): string {
  return [
    `你正在处理 Orca 本地任务：${item.title}`,
    `任务 ID：${item.id}`,
    `任务描述：${item.description}`,
    '',
    `用户本轮请求：${request.trim()}`,
    '',
    '本轮会话属于这个任务。先执行 `orca local-task current --json` 读取当前上下文；需要创建或更新子任务、执行步骤或完成状态时，再查看 `orca local-task --help` 使用对应命令。完成本轮时，请把完整最终回复（包括已完成、验证、限制和待确认项）原样作为 report-completed 的 output，不要只写一句摘要。若当前 CLI 不可用，直接读取项目目录 `orca/<任务ID>/task.json`，并按需要更新任务文件。不要创建新的顶层任务。'
  ].join('\n')
}

export function LocalTaskAgentPicker({
  item,
  onStarted
}: {
  item: WorkItem
  onStarted: (tabId: string, request: string) => void
}): React.JSX.Element {
  const activeWorktreeId = useAppStore((state) => state.activeWorktreeId)
  const worktreeId = item.workspaceId === 'local' ? activeWorktreeId : item.workspaceId
  const activeGroupId = useAppStore((state) =>
    worktreeId
      ? (state.activeGroupIdByWorktree[worktreeId] ?? state.groupsByWorktree[worktreeId]?.[0]?.id)
      : undefined
  )
  const [dialogOpen, setDialogOpen] = useState(false)
  const [request, setRequest] = useState('')
  const hasSessions = item.sessions > 0
  const requestText = hasSessions ? request.trim() : item.description
  const taskPrompt = buildTaskPrompt(item, requestText)
  const handleStarted = (tabId: string): void => {
    setDialogOpen(false)
    onStarted(tabId, requestText)
  }

  const agentMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" className="w-full" disabled={!requestText}>
          选择 Agent
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
            onFocusTerminal={handleStarted}
          />
        ) : (
          <div className="px-2 py-2 text-xs text-muted-foreground">当前任务没有可用 workspace</div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  if (!hasSessions) {
    return (
      <div className="mt-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 w-full gap-1.5 text-[11px]">
              <Play className="size-3.5" />
              启动任务
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
                onFocusTerminal={handleStarted}
              />
            ) : (
              <div className="px-2 py-2 text-xs text-muted-foreground">
                当前任务没有可用 workspace
              </div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    )
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="mt-2 h-8 w-full gap-1.5 text-[11px]">
          <MessageSquare className="size-3.5" />
          新建关联会话
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>新建关联会话</DialogTitle>
          <DialogDescription>
            输入这次想让 AI 处理、解释或 review 的内容，再选择 Agent。
          </DialogDescription>
        </DialogHeader>
        <Textarea
          autoFocus
          value={request}
          onChange={(event) => setRequest(event.target.value)}
          placeholder="例如：review 当前资源加载文档，指出还缺少哪些边界情况"
          className="min-h-28 text-sm"
        />
        <div className="text-[11px] text-muted-foreground">
          会话会归属当前任务；用户这次输入会作为本轮请求，不会重复发送原任务描述。
        </div>
        {agentMenu}
      </DialogContent>
    </Dialog>
  )
}
