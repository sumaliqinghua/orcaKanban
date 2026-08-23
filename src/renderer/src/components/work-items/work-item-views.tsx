import { ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getTaskPerspectiveStatus, type WorkItem } from './mock-data'
import { STATUS_ORDER } from './mock-data'
import { StatusBadge, StatusIcon, SubtaskCard, WorkItemCard } from './work-item-pieces'

export function ListView({
  items,
  selected,
  onSelect,
  expandedIds,
  onToggleExpanded,
  onQuickCreate
}: {
  items: WorkItem[]
  selected: WorkItem
  onSelect: (id: string) => void
  expandedIds: ReadonlySet<string>
  onToggleExpanded: (id: string) => void
  onQuickCreate: () => void
}): React.JSX.Element {
  return (
    <div className="scrollbar-sleek min-h-0 flex-1 overflow-y-auto px-6 pb-6">
      <div className="overflow-hidden rounded-lg border border-border">
        <div className="grid grid-cols-[28px_minmax(260px,1fr)_140px_220px_100px] border-b border-border bg-muted/30 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          <span />
          <span className="flex items-center gap-1">
            本地任务{' '}
            <Button
              variant="ghost"
              size="icon-xs"
              className="size-5"
              onClick={onQuickCreate}
              aria-label="快速新建本地任务"
            >
              <span className="text-sm leading-none">+</span>
            </Button>
          </span>
          <span>状态</span>
          <span>Workspace</span>
          <span>最近活动</span>
        </div>
        {items.map((item) => {
          const expanded = expandedIds.has(item.id)
          return (
            <div key={item.id} className="border-b border-border/70 last:border-0">
              <div
                role="button"
                tabIndex={0}
                onClick={() => onSelect(item.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onSelect(item.id)
                  }
                }}
                className={cn(
                  'grid min-h-12 w-full grid-cols-[28px_minmax(232px,1fr)_140px_220px_100px] items-center px-4 py-3 hover:bg-accent',
                  item.id === selected.id && 'bg-accent/60'
                )}
              >
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="size-6"
                  onClick={(event) => {
                    event.stopPropagation()
                    onToggleExpanded(item.id)
                  }}
                  aria-label={expanded ? '收起子任务' : '展开子任务'}
                >
                  <ChevronRight
                    className={cn('size-3.5 transition-transform', expanded && 'rotate-90')}
                  />
                </Button>
                <span className="min-w-0 truncate text-left text-xs font-medium">{item.title}</span>
                <span>
                  <StatusBadge status={getTaskPerspectiveStatus(item)} />
                </span>
                <span className="truncate text-[11px] text-muted-foreground">{item.workspace}</span>
                <span className="text-[11px] text-muted-foreground">{item.updated}</span>
              </div>
              {expanded ? (
                <div className="border-t border-border/50 bg-muted/20 px-12 py-3">
                  {item.subtasks.length ? (
                    item.subtasks.map((subtask) => (
                      <div key={subtask.id} className="mb-3 last:mb-0">
                        <div className="mb-1 flex items-center gap-2 text-[10px] font-medium text-muted-foreground">
                          <span>{subtask.title}</span>
                          <span>· {subtask.session}</span>
                          <span className="ml-auto">
                            {subtask.status === 'doing'
                              ? '处理中'
                              : subtask.status === 'done'
                                ? '已完成'
                                : '待处理'}
                          </span>
                        </div>
                        {subtask.steps.map((step) => (
                          <div key={step.id} className="flex items-center gap-2 py-1 text-[11px]">
                            <span
                              className={cn(
                                'size-1.5 rounded-full',
                                step.status === 'done' || step.status === 'canceled'
                                  ? 'bg-emerald-500'
                                  : step.status === 'doing'
                                    ? 'bg-sky-500'
                                    : 'bg-muted-foreground/30'
                              )}
                            />
                            <span
                              className={cn(
                                step.status === 'done' || step.status === 'canceled'
                                  ? 'text-muted-foreground line-through'
                                  : 'text-foreground'
                              )}
                            >
                              {step.title}
                            </span>
                            <span className="ml-auto text-[10px] text-muted-foreground">
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
                    ))
                  ) : (
                    <div className="text-[11px] text-muted-foreground">
                      会话执行后会在这里生成子任务
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function SubtaskListView({
  items,
  selected,
  onSelect,
  onQuickCreate
}: {
  items: WorkItem[]
  selected: WorkItem
  onSelect: (id: string) => void
  onQuickCreate: () => void
}): React.JSX.Element {
  const rows = items.flatMap((item) => item.subtasks.map((subtask) => ({ item, subtask })))
  return (
    <div className="scrollbar-sleek min-h-0 flex-1 overflow-y-auto px-6 pb-6">
      <div className="overflow-hidden rounded-lg border border-border">
        <div className="grid grid-cols-[minmax(260px,1fr)_140px_220px_100px] border-b border-border bg-muted/30 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          <span className="flex items-center gap-1">
            最新子任务{' '}
            <Button
              variant="ghost"
              size="icon-xs"
              className="size-5"
              onClick={onQuickCreate}
              aria-label="快速新建本地任务"
            >
              <span className="text-sm leading-none">+</span>
            </Button>
          </span>
          <span>状态</span>
          <span>所属本地任务</span>
          <span>来源会话</span>
        </div>
        {rows.map(({ item, subtask }) => {
          const status =
            subtask.status === 'doing' ? 'In progress' : subtask.status === 'done' ? 'Done' : 'Open'
          return (
            <button
              type="button"
              key={`${item.id}:${subtask.id}`}
              onClick={() => onSelect(item.id)}
              className={cn(
                'grid w-full grid-cols-[minmax(260px,1fr)_140px_220px_100px] items-center border-b border-border/70 px-4 py-3 text-left last:border-0 hover:bg-accent',
                item.id === selected.id && 'bg-accent/60'
              )}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate text-xs font-medium">{subtask.title}</span>
              </span>
              <span>
                <StatusBadge status={status} />
              </span>
              <span className="truncate text-[11px] text-muted-foreground">{item.title}</span>
              <span className="truncate text-[11px] text-muted-foreground">{subtask.session}</span>
            </button>
          )
        })}
        {rows.length === 0 ? (
          <div className="p-8 text-center text-[11px] text-muted-foreground">
            暂无子任务，打开任务会话后 AI 会在这里汇报。
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function BoardView({
  items,
  selected,
  onSelect
}: {
  items: WorkItem[]
  selected: WorkItem
  onSelect: (id: string) => void
}): React.JSX.Element {
  return (
    <div className="scrollbar-sleek flex min-h-0 flex-1 gap-3 overflow-x-auto px-6 pb-6">
      {STATUS_ORDER.map((status) => {
        const columnItems = items.filter((item) => getTaskPerspectiveStatus(item) === status)
        return (
          <section
            key={status}
            className="flex min-w-[236px] max-w-[280px] flex-1 flex-col rounded-lg border border-border/70 bg-muted/20"
          >
            <header className="flex items-center gap-2 border-b border-border/60 px-3 py-2.5">
              <StatusIcon status={status} />
              <span className="text-xs font-semibold">{status}</span>
              <span className="ml-auto rounded-full bg-background px-1.5 text-[10px] tabular-nums text-muted-foreground">
                {columnItems.length}
              </span>
            </header>
            <div className="scrollbar-sleek flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2">
              {columnItems.map((item) => (
                <WorkItemCard
                  key={item.id}
                  item={item}
                  selected={item.id === selected.id}
                  onSelect={() => onSelect(item.id)}
                />
              ))}
              {columnItems.length === 0 ? (
                <div className="flex min-h-24 items-center justify-center text-[11px] text-muted-foreground/60">
                  暂无本地任务
                </div>
              ) : null}
            </div>
          </section>
        )
      })}
    </div>
  )
}

export function SubtaskBoardView({
  items,
  selected,
  onSelect
}: {
  items: WorkItem[]
  selected: WorkItem
  onSelect: (id: string) => void
}): React.JSX.Element {
  const cards = items.flatMap((item) => item.subtasks.map((subtask) => ({ item, subtask })))
  const statusFor = (subtask: WorkItem['subtasks'][number]): WorkItem['status'] =>
    subtask.status === 'doing' ? 'In progress' : subtask.status === 'done' ? 'Done' : 'Open'
  return (
    <div className="scrollbar-sleek flex min-h-0 flex-1 gap-3 overflow-x-auto px-6 pb-6">
      {STATUS_ORDER.map((status) => {
        const column = cards.filter(({ subtask }) => statusFor(subtask) === status)
        return (
          <section
            key={status}
            className="flex min-w-[236px] max-w-[280px] flex-1 flex-col rounded-lg border border-border/70 bg-muted/20"
          >
            <header className="flex items-center gap-2 border-b border-border/60 px-3 py-2.5">
              <StatusIcon status={status} />
              <span className="text-xs font-semibold">{status}</span>
              <span className="ml-auto rounded-full bg-background px-1.5 text-[10px] tabular-nums text-muted-foreground">
                {column.length}
              </span>
            </header>
            <div className="scrollbar-sleek flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2">
              {column.map(({ item, subtask }) => (
                <SubtaskCard
                  key={`${item.id}:${subtask.id}`}
                  item={item}
                  subtask={subtask}
                  selected={item.id === selected.id}
                  onSelect={() => onSelect(item.id)}
                />
              ))}
              {column.length === 0 ? (
                <div className="flex min-h-24 items-center justify-center text-[11px] text-muted-foreground/60">
                  暂无子任务
                </div>
              ) : null}
            </div>
          </section>
        )
      })}
    </div>
  )
}
