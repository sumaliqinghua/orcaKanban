import { useState } from 'react'
import { ArrowUpRight, Bot, Check, Clock3, GitBranch, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { Subtask, WorkItem } from './mock-data'
import { LocalTaskAgentPicker } from './LocalTaskAgentPicker'

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
  onComplete,
  onEditStep
}: {
  subtask: Subtask
  onComplete: () => void
  onEditStep: (stepId: string) => void
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

export function DetailPanel({
  item,
  onCompleteSubtask,
  onEditTitle,
  onEditLabels,
  onEditStep,
  onOpenSession,
  onOpenWorkspace,
  onSessionStarted
}: {
  item: WorkItem
  onCompleteSubtask: (subtaskId: string) => void
  onEditTitle: (title: string) => void
  onEditLabels: (labels: string[]) => void
  onEditStep: (subtaskId: string, stepId: string) => void
  onOpenSession: (sessionId: string) => void
  onOpenWorkspace: () => void
  onSessionStarted: (tabId: string, request: string) => void
}): React.JSX.Element {
  const [titleDialogOpen, setTitleDialogOpen] = useState(false)
  const [labelsDialogOpen, setLabelsDialogOpen] = useState(false)
  const [titleDraft, setTitleDraft] = useState(item.title)
  const [labelsDraft, setLabelsDraft] = useState((item.labels ?? []).join(', '))
  const openTitleDialog = (): void => {
    setTitleDraft(item.title)
    setTitleDialogOpen(true)
  }
  const openLabelsDialog = (): void => {
    setLabelsDraft((item.labels ?? []).join(', '))
    setLabelsDialogOpen(true)
  }
  const saveLabels = (): void => {
    const labels = [
      ...new Set(
        labelsDraft
          .split(',')
          .map((label) => label.trim())
          .filter(Boolean)
      )
    ].slice(0, 20)
    onEditLabels(labels)
    setLabelsDialogOpen(false)
  }
  return (
    <>
      <div className="scrollbar-sleek min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <div className="flex items-start gap-2">
          <h2 className="flex-1 text-lg font-semibold leading-tight tracking-tight">
            {item.title}
          </h2>
          <Button
            variant="ghost"
            size="icon-sm"
            className="-mr-2 -mt-1 text-muted-foreground"
            onClick={openTitleDialog}
            aria-label="编辑任务标题"
          >
            <Pencil className="size-3.5" />
          </Button>
        </div>
        {item.titleSource === 'ai-suggestion' ? (
          <p className="mt-1 text-[10px] text-muted-foreground">
            标题由 AI 在首次执行后生成，后续由你编辑
          </p>
        ) : null}
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{item.description}</p>
        <div className="mt-3 flex items-center gap-1.5">
          {(item.labels ?? []).map((label) => (
            <span
              key={label}
              className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
            >
              {label}
            </span>
          ))}
          <Button
            variant="ghost"
            size="icon-xs"
            className="size-5"
            onClick={openLabelsDialog}
            aria-label="编辑任务标签"
          >
            <Pencil className="size-3" />
          </Button>
        </div>
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
                  onEditStep={(stepId) => onEditStep(subtask.id, stepId)}
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
                onClick={() => onOpenSession(session.id ?? session.title)}
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
          <LocalTaskAgentPicker item={item} onStarted={onSessionStarted} />
        </section>
        <section className="mt-6">
          <h3 className="mb-2 text-xs font-semibold">Workspace</h3>
          <div className="rounded-md border border-border p-3">
            <div className="flex items-center gap-2 text-xs font-medium">
              <GitBranch className="size-3.5 text-muted-foreground" />
              {item.workspace}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 h-6 gap-1 px-0 text-[10px]"
              onClick={onOpenWorkspace}
            >
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
      <Dialog open={titleDialogOpen} onOpenChange={setTitleDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>编辑任务标题</DialogTitle>
            <DialogDescription>修改后会写入当前任务的 task.json。</DialogDescription>
          </DialogHeader>
          <Input
            value={titleDraft}
            onChange={(event) => setTitleDraft(event.target.value)}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setTitleDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() => {
                onEditTitle(titleDraft)
                setTitleDialogOpen(false)
              }}
              disabled={!titleDraft.trim()}
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={labelsDialogOpen} onOpenChange={setLabelsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>编辑任务标签</DialogTitle>
            <DialogDescription>用逗号分隔多个标签，最多保留 20 个。</DialogDescription>
          </DialogHeader>
          <Input
            value={labelsDraft}
            onChange={(event) => setLabelsDraft(event.target.value)}
            placeholder="例如：性能, Unity, 待验证"
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setLabelsDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={saveLabels}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
