import { PanelRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import CommentMarkdown from '@/components/sidebar/CommentMarkdown'
import type { KanbanAiRecord } from '../../../../shared/kanban-ai-record'
import { kanbanAiRecordKindLabel } from './KanbanAiRecordList'

export function KanbanAiRecordDetailAside({
  record,
  open,
  projectLabel,
  notice,
  onClose,
  onOpenTask
}: {
  record: KanbanAiRecord | null
  open: boolean
  projectLabel: string
  notice: string | null
  onClose: () => void
  onOpenTask: (record: KanbanAiRecord) => void
}): React.JSX.Element | null {
  if (!open || !record) {
    return null
  }
  return (
    <aside
      aria-label="AI 记录详情"
      className="fixed inset-y-0 right-0 z-20 flex w-[480px] max-w-[calc(100vw-24px)] flex-col border-l border-border bg-background shadow-xl"
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-5 py-3">
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
          {kanbanAiRecordKindLabel(record.kind)}
        </span>
        <span className="min-w-0 truncate font-mono text-[10px] text-muted-foreground">
          {record.id}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="ml-auto flex size-9 shrink-0 items-center justify-center p-0"
          onClick={onClose}
          aria-label="收起 AI 记录详情"
        >
          <PanelRight className="size-4" />
        </Button>
      </div>
      <div className="scrollbar-sleek min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <h2 className="text-base font-semibold leading-tight">{record.title}</h2>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{record.summary}</p>
        <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
          <span>{projectLabel}</span>
          {record.target.taskId ? <span className="font-mono">{record.target.taskId}</span> : null}
          <span>{new Date(record.createdAt).toLocaleString()}</span>
        </div>
        <div className="mt-5 border-t border-border pt-5">
          <CommentMarkdown
            variant="document"
            content={record.body.content}
            className="text-sm leading-relaxed"
          />
        </div>
        {notice ? (
          <p
            role="alert"
            className="mt-4 rounded-md border border-destructive/30 px-3 py-2 text-xs text-destructive"
          >
            {notice}
          </p>
        ) : null}
      </div>
      {record.target.taskId ? (
        <div className="shrink-0 border-t border-border px-5 py-3">
          <Button type="button" size="sm" className="w-full" onClick={() => onOpenTask(record)}>
            查看任务
          </Button>
        </div>
      ) : null}
    </aside>
  )
}
