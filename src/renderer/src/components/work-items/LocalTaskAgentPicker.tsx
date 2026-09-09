import { useState } from 'react'
import { MessageSquare, Play } from 'lucide-react'
import { toast } from 'sonner'
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
import { buildLocalTaskSubtaskPrompt } from './local-task-agent-prompt'

export async function persistLocalTaskSessionAssociation(
  item: WorkItem,
  tabId: string,
  request: string,
  workspaceId: string
): Promise<void> {
  await window.api.localTasks.createSession({
    taskId: item.id,
    projectPath: item.projectPath,
    sessionId: tabId,
    title: request.split(/\r?\n/, 1)[0]?.trim().slice(0, 120) || 'Agent 会话',
    workspaceId,
    currentPrompt: request,
    associationSource: 'task-center'
  })
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
  const taskPrompt = buildLocalTaskSubtaskPrompt(requestText)
  const handleStarted = async (tabId: string): Promise<void> => {
    if (!worktreeId) {
      return
    }
    try {
      // Persist the association before the task panel is closed or refreshed.
      await persistLocalTaskSessionAssociation(item, tabId, requestText, worktreeId)
      setDialogOpen(false)
      onStarted(tabId, requestText)
    } catch (cause) {
      useAppStore.getState().closeTab(tabId, {
        recordInteraction: false,
        reason: 'cleanup'
      })
      toast.error(cause instanceof Error ? cause.message : '关联会话创建失败')
    }
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
