import { useState } from 'react'
import {
  Archive,
  Bot,
  CheckCircle2,
  Circle,
  FolderKanban,
  GitBranch,
  Inbox,
  MessageSquare,
  MoreHorizontal,
  Play,
  RotateCcw,
  Sparkles,
  Trash2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { joinPath } from '@/lib/path'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  getTaskPerspectiveStatus,
  type Subtask,
  type WorkItem,
  type WorkItemStatus
} from './mock-data'

const statusTone: Record<WorkItemStatus, string> = {
  Open: 'border-border bg-muted/45 text-muted-foreground',
  'In progress': 'border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  'Needs review': 'border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300',
  Done: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
}

export function LocalTaskActions({
  item,
  onAccept,
  onArchive,
  onRestore,
  onDelete,
  onPromote,
  onMoveToInbox
}: {
  item: WorkItem
  onAccept: () => void
  onArchive: () => void
  onRestore: () => void
  onDelete: () => void
  onPromote: () => void
  onMoveToInbox: () => void
}): React.JSX.Element {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const archived = item.archivedAt != null
  const taskDirectory = joinPath(item.projectPath ?? '', `orca/${item.id}`)
  return (
    <>
      <div className="flex shrink-0 gap-2 border-t border-border bg-background px-5 py-3">
        {archived ? (
          <>
            <Button variant="outline" className="flex-1 gap-1.5 text-xs" onClick={onRestore}>
              <RotateCcw className="size-4" />
              恢复任务
            </Button>
            <Button
              variant="destructive"
              className="gap-1.5 text-xs"
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="size-4" />
              永久删除
            </Button>
          </>
        ) : (
          <>
            {item.intakeState === 'inbox' ? (
              <Button className="flex-1 gap-1.5 text-xs" onClick={onPromote}>
                整理为可执行
              </Button>
            ) : item.status === 'Needs review' ? (
              <Button className="flex-1 gap-1.5 text-xs" onClick={onAccept}>
                验收通过
              </Button>
            ) : null}
            {item.intakeState !== 'inbox' ? (
              <Button
                variant="outline"
                className="flex-1 gap-1.5 text-xs"
                onClick={onMoveToInbox}
              >
                <Inbox className="size-4" />
                移至收件箱
              </Button>
            ) : null}
            <Button variant="ghost" size="icon" aria-label="归档本地任务" onClick={onArchive}>
              <Archive className="size-4" />
            </Button>
          </>
        )}
      </div>
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>永久删除本地任务</DialogTitle>
            <DialogDescription>
              此操作不可恢复。Orca 会删除任务记录和 workspace
              中的整个任务目录，但不会删除业务代码或自动操作 Git。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 rounded-md border border-border bg-muted/35 px-3 py-2 text-xs">
            <div>
              <span className="text-muted-foreground">任务：</span>
              <span className="font-medium text-foreground">{item.title}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Workspace：</span>
              <span className="font-medium text-foreground">{item.workspace}</span>
            </div>
            <div className="break-all font-mono text-[11px] text-muted-foreground">
              {taskDirectory}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setDeleteDialogOpen(false)
                onDelete()
              }}
            >
              <Trash2 className="size-4" />
              确认永久删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function StatusIcon({ status }: { status: WorkItemStatus }): React.JSX.Element {
  if (status === 'Done') {
    return <CheckCircle2 className="size-3.5" />
  }
  if (status === 'In progress') {
    return <Play className="size-3.5" />
  }
  if (status === 'Needs review') {
    return <Sparkles className="size-3.5" />
  }
  return <Circle className="size-3.5" />
}

export function StatusBadge({ status }: { status: WorkItemStatus }): React.JSX.Element {
  return (
    <Badge variant="outline" className={cn('gap-1.5 font-medium', statusTone[status])}>
      <StatusIcon status={status} />
      {status}
    </Badge>
  )
}

export function WorkItemCard({
  item,
  selected,
  onSelect
}: {
  item: WorkItem
  selected: boolean
  onSelect: () => void
}): React.JSX.Element {
  const taskStatus = getTaskPerspectiveStatus(item)
  const completed = item.subtasks.filter((subtask) => subtask.status === 'done').length
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'group flex w-full flex-col gap-3 rounded-lg border bg-card p-3 text-left shadow-xs transition-colors hover:border-foreground/25',
        selected && 'border-foreground/40 ring-1 ring-foreground/15'
      )}
    >
      <div className="flex items-start gap-2">
        <span className="line-clamp-2 flex-1 text-[13px] font-medium leading-snug text-foreground">
          {item.title}
        </span>
        <MoreHorizontal className="size-4 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" />
      </div>
      {(item.labels ?? []).length ? (
        <div className="flex flex-wrap gap-1">
          {(item.labels ?? []).map((label) => (
            <span
              key={label}
              className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
            >
              {label}
            </span>
          ))}
        </div>
      ) : null}
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
          {taskStatus}
        </Badge>
        <div className="flex min-w-0 items-center gap-1 text-[10px] text-muted-foreground">
          <FolderKanban className="size-3" />
          <span className="truncate">{item.project}</span>
        </div>
        <div className="flex min-w-0 items-center gap-1 text-[10px] text-muted-foreground">
          <GitBranch className="size-3" />
          <span className="truncate">{item.workspace}</span>
        </div>
      </div>
      {item.subtasks.length ? (
        <div className="rounded-md bg-muted/45 px-2 py-1.5">
          <div className="text-[10px] text-muted-foreground">子任务</div>
          <div className="scrollbar-sleek mt-1 max-h-20 space-y-1 overflow-y-auto">
            {item.subtasks.map((subtask) => (
              <div key={subtask.id} className="flex items-center gap-1.5 text-[11px]">
                <span
                  className={cn(
                    'size-1.5 shrink-0 rounded-full',
                    subtask.status === 'done'
                      ? 'bg-emerald-500'
                      : subtask.status === 'doing'
                        ? 'bg-sky-500'
                        : 'bg-muted-foreground/30'
                  )}
                />
                <span className="min-w-0 flex-1 truncate font-medium">{subtask.title}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {subtask.status === 'doing'
                    ? '处理中'
                    : subtask.status === 'done'
                      ? '已完成'
                      : '待处理'}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
        <span>
          {completed}/{item.subtasks.length} 子任务完成
        </span>
        <span className="flex items-center gap-1">
          <MessageSquare className="size-3" />
          {item.sessions}
        </span>
        {item.activeSessions ? (
          <span className="flex items-center gap-1 text-sky-600">
            <span className="size-1.5 rounded-full bg-sky-500" />
            {item.activeSessions} 运行中
          </span>
        ) : null}
      </div>
    </button>
  )
}

export function SubtaskCard({
  item,
  subtask,
  selected,
  onSelect
}: {
  item: WorkItem
  subtask: Subtask
  selected: boolean
  onSelect: () => void
}): React.JSX.Element {
  const completedSteps = subtask.steps.filter(
    (step) => step.status === 'done' || step.status === 'canceled'
  ).length
  const statusLabel =
    subtask.status === 'doing' ? 'In progress' : subtask.status === 'done' ? 'Done' : 'Open'
  const taskStatus = getTaskPerspectiveStatus(item)
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'group flex w-full flex-col gap-2 rounded-lg border bg-card p-3 text-left shadow-xs transition-colors hover:border-foreground/25',
        selected && 'border-foreground/40 ring-1 ring-foreground/15'
      )}
    >
      <div className="flex items-start gap-2">
        <span className="line-clamp-2 flex-1 text-[12px] font-medium leading-snug">
          {subtask.title}
        </span>
        <MoreHorizontal className="size-4 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" />
      </div>
      <div className="flex items-center gap-1.5">
        <Badge
          variant="outline"
          className={cn(
            'h-5 px-1.5 text-[10px]',
            statusLabel === 'In progress'
              ? 'border-sky-500/30 text-sky-700 dark:text-sky-300'
              : statusLabel === 'Done'
                ? 'border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                : 'text-muted-foreground'
          )}
        >
          {statusLabel}
        </Badge>
        <span className="flex min-w-0 items-center gap-1 truncate text-[10px] text-muted-foreground">
          <FolderKanban className="size-3 shrink-0" />
          {item.project}
        </span>
        <span className="truncate text-[10px] text-muted-foreground">任务：{taskStatus}</span>
        <span className="truncate text-[10px] text-muted-foreground">来自：{item.title}</span>
      </div>
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Bot className="size-3" />
          {subtask.session}
        </span>
        <span>
          {completedSteps}/{subtask.steps.length} AI 步骤
        </span>
      </div>
    </button>
  )
}
