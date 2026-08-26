import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Input } from '@/components/ui/input'
import { QuickLaunchAgentMenuItems } from '@/components/tab-bar/QuickLaunchButton'
import { useAppStore } from '@/store'
import type { LocalTask } from '../../../../shared/local-task-types'
import { buildTaskPrompt } from './local-task-agent-prompt'
import type { WorkItem } from './mock-data'

const NEW_SESSION = '__new__'
const UNASSIGNED = '__unassigned__'

export function LocalTaskSubtaskCreateDialog({
  item,
  onTaskChanged
}: {
  item: WorkItem
  onTaskChanged: (task: LocalTask) => void
}): React.JSX.Element {
  const activeWorktreeId = useAppStore((state) => state.activeWorktreeId)
  const worktreeId = item.workspaceId === 'local' ? activeWorktreeId : item.workspaceId
  const activeGroupId = useAppStore((state) =>
    worktreeId
      ? (state.activeGroupIdByWorktree[worktreeId] ?? state.groupsByWorktree[worktreeId]?.[0]?.id)
      : undefined
  )
  const availableSessions = item.sessionsList.filter(
    (session): session is typeof session & { id: string } => Boolean(session.id)
  )
  const initialAssignment = availableSessions[0]?.id ?? UNASSIGNED
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [sessionId, setSessionId] = useState(initialAssignment)
  const [error, setError] = useState<string | null>(null)
  const openDialog = (): void => {
    setTitle('')
    setSessionId(availableSessions[0]?.id ?? UNASSIGNED)
    setError(null)
    setOpen(true)
  }
  const close = (): void => {
    setOpen(false)
    setTitle('')
    setSessionId(initialAssignment)
    setError(null)
  }
  const create = async (assignedSessionId: string | null): Promise<void> => {
    try {
      const task = await window.api.localTasks.createSubtask({
        taskId: item.id,
        projectPath: item.projectPath,
        title: title.trim(),
        sessionId: assignedSessionId
      })
      onTaskChanged(task)
      close()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '子任务创建失败')
    }
  }
  const request = `请执行子任务：${title.trim()}`
  const launchPrompt = buildTaskPrompt(item, request)
  const createWithNewSession = async (tabId: string): Promise<void> => {
    try {
      await window.api.localTasks.createSession({
        taskId: item.id,
        projectPath: item.projectPath,
        sessionId: tabId,
        workspaceId: item.workspaceId,
        title: `子任务 · ${title.trim()}`,
        initialPrompt: request,
        associationSource: 'task-center'
      })
      await create(tabId)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '关联会话创建失败')
    }
  }
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? openDialog() : close())}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="xs" className="h-6 gap-1 px-1.5 text-[10px]">
          <Plus className="size-3" />
          新增子任务
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>新增子任务</DialogTitle>
          <DialogDescription>
            子任务只保留勾选和执行步骤，并由一个关联会话顺序处理。
          </DialogDescription>
        </DialogHeader>
        <Input
          autoFocus
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="例如：制作 Import Settings 校验工具"
        />
        <label className="space-y-1 text-xs text-muted-foreground">
          <span>执行会话</span>
          <select
            value={sessionId}
            onChange={(event) => setSessionId(event.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
          >
            {availableSessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.title}
              </option>
            ))}
            {availableSessions.length === 0 ? <option value={UNASSIGNED}>暂不绑定</option> : null}
            <option value={NEW_SESSION}>新建关联会话…</option>
          </select>
        </label>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            取消
          </Button>
          {sessionId === NEW_SESSION ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button disabled={!title.trim() || !worktreeId}>选择 Agent</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-52">
                <DropdownMenuLabel>选择新会话的 Agent</DropdownMenuLabel>
                {worktreeId ? (
                  <QuickLaunchAgentMenuItems
                    worktreeId={worktreeId}
                    groupId={activeGroupId}
                    prompt={launchPrompt}
                    launchSource="task_page"
                    localTaskId={item.id}
                    localTaskRoot={item.projectPath}
                    onFocusTerminal={(tabId) => void createWithNewSession(tabId)}
                  />
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              disabled={!title.trim()}
              onClick={() => void create(sessionId === UNASSIGNED ? null : sessionId)}
            >
              创建
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
