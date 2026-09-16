import { Check, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Subtask, WorkItem } from './mock-data'

function StepStatus({ status }: { status: Subtask['steps'][number]['status'] }): React.JSX.Element {
  if (status === 'done' || status === 'canceled') {
    return <Check className="size-3 text-emerald-600" />
  }
  if (status === 'doing') {
    return <span className="size-1.5 rounded-full bg-sky-500" />
  }
  return <span className="size-1.5 rounded-full bg-muted-foreground/30" />
}

export function LocalTaskSubtaskBlock({
  subtask,
  sessions,
  onComplete,
  onOpenSession,
  onEditStep
}: {
  subtask: Subtask
  sessions: WorkItem['sessionsList']
  onComplete: () => void
  onOpenSession: (sessionId: string) => void
  onEditStep: (stepId: string) => void
}): React.JSX.Element {
  const session = sessions.find((entry) => entry.id === subtask.sessionId)
  const summary = (
    <>
      <span className="min-w-0 flex-1 text-[11px] font-medium">{subtask.title}</span>
      <span className="max-w-40 truncate text-[10px] text-muted-foreground">
        {subtask.sessionId ? (session?.title ?? '关联会话') : '未绑定会话'}
      </span>
    </>
  )
  return (
    <div className="rounded-md border border-border/60">
      <div className="flex items-center gap-2 border-b border-border/50 bg-muted/30 pl-2.5">
        <button
          type="button"
          onClick={onComplete}
          className={cn(
            'flex size-4 shrink-0 items-center justify-center rounded-full border',
            subtask.status === 'done' && 'border-emerald-500 bg-emerald-500 text-white'
          )}
          aria-label={subtask.status === 'done' ? '取消完成子任务' : '完成子任务'}
        >
          {subtask.status === 'done' ? <Check className="size-3" /> : null}
        </button>
        {session?.id ? (
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-2 py-2 pr-2.5 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`侧边预览子任务会话：${subtask.title}`}
            onClick={() => onOpenSession(session.id!)}
          >
            {summary}
          </button>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-2 py-2 pr-2.5">{summary}</div>
        )}
      </div>
      <div className="space-y-1 p-2">
        {subtask.steps.map((step) => (
          <div key={step.id} className="flex items-center gap-2 text-xs text-muted-foreground">
            <StepStatus status={step.status} />
            <span className="flex-1">{step.title}</span>
            <span>
              {step.status === 'doing'
                ? 'AI 处理中'
                : step.status === 'done'
                  ? 'AI 已完成'
                  : step.status === 'canceled'
                    ? 'AI 已取消'
                    : '待执行'}
            </span>
            {step.status === 'todo' ? (
              <Button
                variant="ghost"
                size="icon-xs"
                className="size-5"
                onClick={() => onEditStep(step.id)}
                aria-label="编辑未开始步骤"
              >
                <Pencil className="size-3" />
              </Button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}
