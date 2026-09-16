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
import type { LocalTask, LocalTaskChecklistItem } from '../../../../shared/local-task-types'
import type { TuiAgent } from '../../../../shared/tui-agent'
import { buildLocalTaskSubtaskPrompt } from './local-task-agent-prompt'
import type { WorkItem } from './mock-data'

const NEW_SESSION = '__new__'

export function LocalTaskSubtaskCreateDialog({
  item,
  onTaskChanged,
  checklistItem,
  disabled = false,
  initiallyOpen = false,
  onClosed
}: {
  item: WorkItem
  checklistItem?: LocalTaskChecklistItem
  disabled?: boolean
  initiallyOpen?: boolean
  onClosed?: () => void
  onTaskChanged: (task: LocalTask) => void
}): React.JSX.Element {
  const worktreeId = useAppStore((state) =>
    item.workspaceId === 'local'
      ? state
          .allWorktrees()
          .find(
            (workspace) => workspace.path === item.projectPath && workspace.repoId === item.project
          )?.id
      : item.workspaceId
  )
  const activeGroupId = useAppStore((state) =>
    worktreeId
      ? (state.activeGroupIdByWorktree[worktreeId] ?? state.groupsByWorktree[worktreeId]?.[0]?.id)
      : undefined
  )
  const initialAssignment = NEW_SESSION
  const [open, setOpen] = useState(initiallyOpen)
  const [title, setTitle] = useState(checklistItem?.title ?? '')
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
    setTitle(checklistItem?.title ?? '')
    setSessionId(NEW_SESSION)
    setError(null)
    setSubmissionState(false)
    setCreatedSubtaskId(null)
    setCreatedSessionId(null)
    setOpen(true)
  }
  const close = (): void => {
    setOpen(false)
    onClosed?.()
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
          throw new Error('Agent 会话未能在目标工作区启动')
        }
        targetSessionId = launch.tabId
        try {
          await window.api.localTasks.createSession({
            taskId: item.id,
            projectPath: item.projectPath,
            sessionId: targetSessionId,
            workspaceId: item.workspaceId,
            title: `子任务 · ${title.trim()}`.slice(0, 500),
            currentPrompt: request,
            associationSource: 'task-center',
            ...(checklistItem ? { sourceChecklistItemId: checklistItem.id } : {})
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
      if (!subtaskId && !checklistItem) {
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
      if (
        checklistItem &&
        (task.checklist?.some((entry) => entry.id === checklistItem.id) ||
          !task.subtasks.some((entry) => entry.sessionId === targetSessionId))
      ) {
        throw new Error('待办尚未转换，请重试或更新 Orca 后重试')
      }
      close()
      onTaskChanged(task)
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
      {initiallyOpen ? null : (
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="xs"
            disabled={disabled}
            className="h-6 shrink-0 gap-1 px-1.5 text-xs"
          >
            {checklistItem ? null : <Plus className="size-3" />}
            {checklistItem ? '转为子任务' : '新增子任务'}
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{checklistItem ? '转为子任务' : '新增子任务'}</DialogTitle>
          <DialogDescription>
            {checklistItem
              ? '选择 Agent 后开始执行，待办会移入子任务列表。'
              : '子任务只保留勾选和执行步骤，并由一个关联会话顺序处理。'}
          </DialogDescription>
        </DialogHeader>
        <Input
          autoFocus
          value={title}
          disabled={submitting || createdSubtaskId !== null || checklistItem !== undefined}
          maxLength={500}
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
        {!worktreeId ? (
          <p className="text-xs text-muted-foreground">
            先为任务选择并打开工作区，再创建执行会话。
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        ) : null}
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
