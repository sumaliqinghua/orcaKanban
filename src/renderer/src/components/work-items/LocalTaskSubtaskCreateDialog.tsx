import { useRef, useState } from 'react'
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
import { launchAgentInNewTab } from '@/lib/launch-agent-in-new-tab'
import { useAppStore } from '@/store'
import type { LocalTask } from '../../../../shared/local-task-types'
import type { TuiAgent } from '../../../../shared/tui-agent'
import { buildLocalTaskSubtaskPrompt } from './local-task-agent-prompt'
import type { WorkItem } from './mock-data'

const NEW_SESSION = '__new__'

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
  const initialAssignment = NEW_SESSION
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [sessionId, setSessionId] = useState(initialAssignment)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [createdSubtaskId, setCreatedSubtaskId] = useState<string | null>(null)
  const [createdSessionId, setCreatedSessionId] = useState<string | null>(null)
  const submittingRef = useRef(false)
  const setSubmissionState = (next: boolean): void => {
    submittingRef.current = next
    setSubmitting(next)
  }
  const openDialog = (): void => {
    setTitle('')
    setSessionId(NEW_SESSION)
    setError(null)
    setSubmissionState(false)
    setCreatedSubtaskId(null)
    setCreatedSessionId(null)
    setOpen(true)
  }
  const close = (): void => {
    setOpen(false)
    setTitle('')
    setSessionId(initialAssignment)
    setError(null)
    setSubmissionState(false)
    setCreatedSubtaskId(null)
    setCreatedSessionId(null)
  }
  const request = title.trim()
  const launchPrompt = buildLocalTaskSubtaskPrompt(request)
  const createWithNewSession = async (agent?: TuiAgent): Promise<void> => {
    if (submittingRef.current || !worktreeId) {
      return
    }
    setSubmissionState(true)
    try {
      let subtaskId = createdSubtaskId
      let targetSessionId = createdSessionId
      if (!targetSessionId) {
        if (!agent) {
          throw new Error('请选择用于执行子任务的 Agent')
        }
        const launch = launchAgentInNewTab({
          agent,
          worktreeId,
          ...(activeGroupId ? { groupId: activeGroupId } : {}),
          prompt: launchPrompt,
          launchSource: 'task_page',
          localTaskId: item.id,
          localTaskRoot: item.projectPath
        })
        if (!launch?.tabId) {
          throw new Error('子任务已创建但 Agent 会话未能在当前窗口启动')
        }
        targetSessionId = launch.tabId
        try {
          await window.api.localTasks.createSession({
            taskId: item.id,
            projectPath: item.projectPath,
            sessionId: targetSessionId,
            workspaceId: item.workspaceId,
            title: `子任务 · ${title.trim()}`,
            currentPrompt: request,
            associationSource: 'task-center'
          })
        } catch (cause) {
          useAppStore.getState().closeTab(targetSessionId, {
            recordInteraction: false,
            reason: 'cleanup'
          })
          throw cause
        }
        setCreatedSessionId(targetSessionId)
      }
      if (!subtaskId) {
        const taskWithSubtask = await window.api.localTasks.createSubtask({
          taskId: item.id,
          projectPath: item.projectPath,
          title: title.trim(),
          sessionId: targetSessionId
        })
        const subtask = taskWithSubtask.subtasks.find(
          (candidate) => candidate.sessionId === targetSessionId
        )
        if (!subtask) {
          throw new Error('子任务已创建，但无法确定新子任务')
        }
        subtaskId = subtask.id
        setCreatedSubtaskId(subtaskId)
        onTaskChanged(taskWithSubtask)
      }
      const task = await window.api.localTasks.get(item.id, item.projectPath)
      if (!task) {
        throw new Error('任务已不存在')
      }
      onTaskChanged(task)
      close()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '关联会话创建失败')
      setSubmissionState(false)
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          openDialog()
        } else if (!submittingRef.current) {
          close()
        }
      }}
    >
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
          disabled={submitting || createdSubtaskId !== null}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="例如：制作 Import Settings 校验工具"
        />
        <label className="space-y-1 text-xs text-muted-foreground">
          <span>执行会话</span>
          <select
            value={sessionId}
            disabled={submitting || createdSubtaskId !== null}
            onChange={(event) => setSessionId(event.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
          >
            <option value={NEW_SESSION}>新建关联会话…</option>
          </select>
        </label>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button variant="outline" disabled={submitting} onClick={close}>
            取消
          </Button>
          {sessionId === NEW_SESSION ? (
            createdSessionId ? (
              <Button disabled={submitting} onClick={() => void createWithNewSession()}>
                {submitting ? '绑定中…' : '重试绑定'}
              </Button>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button disabled={!title.trim() || !worktreeId || submitting}>
                    {submitting ? '创建中…' : '选择 Agent'}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-52">
                  <DropdownMenuLabel>选择新会话的 Agent</DropdownMenuLabel>
                  {worktreeId ? (
                    <QuickLaunchAgentMenuItems
                      worktreeId={worktreeId}
                      onSelectAgent={(agent) => void createWithNewSession(agent)}
                      onFocusTerminal={() => {}}
                    />
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            )
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
