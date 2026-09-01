import {
  FileText,
  Lightbulb,
  MessageCircleQuestion,
  Minimize2,
  type LucideIcon
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { KanbanAiRecord, KanbanAiRecordKind } from '../../../../shared/kanban-ai-record'

const KIND_PRESENTATION: Record<KanbanAiRecordKind, { label: string; icon: LucideIcon }> = {
  requirement_clarification: { label: '需求澄清', icon: MessageCircleQuestion },
  candidate_task: { label: '候选任务', icon: Lightbulb },
  task_simplification: { label: '简化建议', icon: Minimize2 },
  status_report: { label: '状态汇报', icon: FileText }
}

export function kanbanAiRecordKindLabel(kind: KanbanAiRecordKind): string {
  return KIND_PRESENTATION[kind].label
}

export function KanbanAiRecordList({
  records,
  selectedId,
  projectLabels,
  onSelect
}: {
  records: KanbanAiRecord[]
  selectedId: string | null
  projectLabels: ReadonlyMap<string, string>
  onSelect: (record: KanbanAiRecord) => void
}): React.JSX.Element {
  if (records.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-12 text-center text-xs text-muted-foreground">
        当前项目范围内还没有 AI 记录
      </div>
    )
  }
  return (
    <div className="scrollbar-sleek min-h-0 flex-1 overflow-y-auto px-6 pb-6">
      <div className="border-t border-border">
        {records.map((record) => {
          const presentation = KIND_PRESENTATION[record.kind]
          const Icon = presentation.icon
          return (
            <button
              key={record.id}
              type="button"
              data-current={selectedId === record.id || undefined}
              onClick={() => onSelect(record)}
              className={cn(
                'grid w-full grid-cols-[20px_minmax(0,1fr)_auto] gap-3 border-b border-border px-3 py-3 text-left transition-colors hover:bg-accent',
                selectedId === record.id && 'bg-accent'
              )}
            >
              <span className="relative mt-0.5 flex size-5 items-center justify-center text-muted-foreground">
                <Icon className="size-3.5" />
                {record.readAt === null ? (
                  <span
                    className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-foreground"
                    aria-label="未读"
                  />
                ) : null}
              </span>
              <span className="min-w-0">
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className={cn('truncate text-xs', record.readAt === null && 'font-semibold')}
                  >
                    {record.title}
                  </span>
                  <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {presentation.label}
                  </span>
                </span>
                <span className="mt-1 line-clamp-2 block text-[11px] leading-relaxed text-muted-foreground">
                  {record.summary}
                </span>
                <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
                  <span>
                    {projectLabels.get(record.target.projectId) ?? record.target.projectId}
                  </span>
                  {record.target.taskId ? (
                    <span className="font-mono">{record.target.taskId}</span>
                  ) : null}
                </span>
              </span>
              <span className="mt-0.5 whitespace-nowrap text-[10px] text-muted-foreground">
                {new Date(record.createdAt).toLocaleString()}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
