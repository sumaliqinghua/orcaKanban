import {
  ArrowUpRight,
  Bot,
  Check,
  CheckCircle2,
  Circle,
  Clock3,
  GitBranch,
  MessageSquare,
  MoreHorizontal,
  Play,
  Sparkles
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  getTaskPerspectiveStatus,
  type Subtask,
  type WorkItem,
  type WorkItemStatus
} from './mock-data'

const statusTone: Record<WorkItemStatus, string> = {
  Open: 'border-border bg-muted/45 text-muted-foreground',
  'In progress': 'border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  Waiting: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  'Needs review': 'border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300',
  Done: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
}

export function StatusIcon({ status }: { status: WorkItemStatus }): React.JSX.Element {
  if (status === 'Done') {
    return <CheckCircle2 className="size-3.5" />
  }
  if (status === 'In progress') {
    return <Play className="size-3.5" />
  }
  if (status === 'Waiting') {
    return <Clock3 className="size-3.5" />
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
  const latest = item.subtasks.find((subtask) => subtask.status === 'doing') ?? item.subtasks[0]
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
        <span className="mt-0.5 font-mono text-[10px] text-muted-foreground">{item.id}</span>
        <span className="line-clamp-2 flex-1 text-[13px] font-medium leading-snug text-foreground">
          {item.title}
        </span>
        <MoreHorizontal className="size-4 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" />
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
          {taskStatus}
        </Badge>
        <div className="flex min-w-0 items-center gap-1 text-[10px] text-muted-foreground">
          <GitBranch className="size-3" />
          <span className="truncate">{item.workspace}</span>
        </div>
      </div>
      {latest ? (
        <div className="rounded-md bg-muted/45 px-2 py-1.5">
          <div className="text-[10px] text-muted-foreground">最新子任务</div>
          <div className="mt-0.5 truncate text-[11px] font-medium">{latest.title}</div>
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
        <span className="mt-0.5 font-mono text-[10px] text-muted-foreground">{subtask.id}</span>
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

function StepStatus({ status }: { status: Subtask['steps'][number]['status'] }): React.JSX.Element {
  if (status === 'done' || status === 'canceled') {
    return <Check className="size-3 text-emerald-600" />
  }
  if (status === 'doing') {
    return <span className="size-1.5 rounded-full bg-sky-500" />
  }
  return <span className="size-1.5 rounded-full bg-muted-foreground/30" />
}

function SubtaskBlock({
  subtask,
  onComplete
}: {
  subtask: Subtask
  onComplete: () => void
}): React.JSX.Element {
  return (
    <div className="rounded-md border border-border/60">
      <div className="flex items-center gap-2 border-b border-border/50 bg-muted/30 px-2.5 py-2">
        <button
          type="button"
          onClick={onComplete}
          className={cn(
            'flex size-4 items-center justify-center rounded-full border',
            subtask.status === 'done' && 'border-emerald-500 bg-emerald-500 text-white'
          )}
          aria-label={subtask.status === 'done' ? '取消完成子任务' : '完成子任务'}
        >
          {subtask.status === 'done' ? <Check className="size-3" /> : null}
        </button>
        <span
          className={cn(
            'flex-1 text-[11px] font-medium',
            subtask.status === 'done' && 'text-muted-foreground line-through'
          )}
        >
          {subtask.title}
        </span>
        <span className="text-[10px] text-muted-foreground">{subtask.session}</span>
      </div>
      <div className="space-y-1 p-2">
        {subtask.steps.map((step) => (
          <div key={step.id} className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <StepStatus status={step.status} />
            <span className={cn('flex-1', step.status === 'done' && 'line-through')}>
              {step.title}
            </span>
            <span>
              {step.status === 'doing'
                ? 'AI 处理中'
                : step.status === 'done'
                  ? 'AI 已完成'
                  : step.status === 'canceled'
                    ? 'AI 已取消'
                    : '待执行'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function DetailPanel({
  item,
  onCompleteSubtask
}: {
  item: WorkItem
  onCompleteSubtask: (subtaskId: string) => void
}): React.JSX.Element {
  return (
    <div className="scrollbar-sleek min-h-0 flex-1 overflow-y-auto px-5 py-5">
      <div className="flex items-start gap-2">
        <h2 className="flex-1 text-lg font-semibold leading-tight tracking-tight">{item.title}</h2>
        <Button variant="ghost" size="icon-sm" className="-mr-2 -mt-1 text-muted-foreground">
          <MoreHorizontal className="size-4" />
        </Button>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{item.description}</p>
      {item.waitingReason ? (
        <div className="mt-4 flex gap-2 rounded-md border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
          <Clock3 className="mt-0.5 size-3.5 shrink-0" />
          <span>
            <strong className="font-medium">等待你的确认</strong>
            <br />
            {item.waitingReason}
          </span>
        </div>
      ) : null}
      <div className="mt-5 flex items-center gap-2 text-[11px] text-muted-foreground">
        <span className="rounded bg-muted px-1.5 py-0.5">{item.project}</span>
        <span>·</span>
        <span>{item.workspace}</span>
      </div>
      <section className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold">
            子任务{' '}
            <span className="ml-1 text-[10px] font-normal text-muted-foreground">
              {item.subtasks.filter((subtask) => subtask.status === 'done').length}/
              {item.subtasks.length}
            </span>
          </h3>
          <span className="text-[10px] text-muted-foreground">
            用户可完成子任务 · AI 维护执行步骤
          </span>
        </div>
        <div className="space-y-2">
          {item.subtasks.length ? (
            item.subtasks.map((subtask) => (
              <SubtaskBlock
                key={subtask.id}
                subtask={subtask}
                onComplete={() => onCompleteSubtask(subtask.id)}
              />
            ))
          ) : (
            <div className="rounded-md border border-dashed border-border px-2 py-4 text-center text-[11px] text-muted-foreground">
              会话执行后会在这里生成子任务
            </div>
          )}
        </div>
      </section>
      <section className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold">
            关联会话{' '}
            <span className="ml-1 text-[10px] font-normal text-muted-foreground">
              {item.sessions}
            </span>
          </h3>
          <span className="text-[10px] text-muted-foreground">仅从任务中心关联</span>
        </div>
        <div className="space-y-1">
          {item.sessionsList.map((session) => (
            <button
              type="button"
              key={session.title}
              className="flex w-full items-center gap-2 rounded-md border border-border/70 px-2.5 py-2 text-left hover:bg-accent"
            >
              <Bot className="size-3.5 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-[11px]">{session.title}</span>
              <span
                className={cn(
                  'size-1.5 rounded-full',
                  session.status === 'working'
                    ? 'bg-sky-500'
                    : session.status === 'done'
                      ? 'bg-emerald-500'
                      : 'bg-muted-foreground/40'
                )}
              />
              <span className="text-[10px] text-muted-foreground">{session.time}</span>
              <ArrowUpRight className="size-3 text-muted-foreground" />
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" className="mt-2 h-7 w-full gap-1.5 text-[11px]">
          <MessageSquare className="size-3.5" />
          从任务中心新建关联会话
        </Button>
      </section>
      <section className="mt-6">
        <h3 className="mb-2 text-xs font-semibold">Workspace</h3>
        <div className="rounded-md border border-border p-3">
          <div className="flex items-center gap-2 text-xs font-medium">
            <GitBranch className="size-3.5 text-muted-foreground" />
            {item.workspace}
          </div>
          <Button variant="ghost" size="sm" className="mt-2 h-6 gap-1 px-0 text-[10px]">
            <ArrowUpRight className="size-3" />
            打开 workspace 查看对话
          </Button>
        </div>
      </section>
      <section className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold">最近一次输出</h3>
          <span className="text-[10px] text-muted-foreground">{item.latestOutput.session}</span>
        </div>
        <div className="rounded-md bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
          {item.latestOutput.text}
        </div>
      </section>
    </div>
  )
}
