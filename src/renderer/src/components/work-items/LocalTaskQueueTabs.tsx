import { Button } from '@/components/ui/button'
import type { WorkItem } from './mock-data'

export type LocalTaskQueueView = 'all' | 'inbox' | 'review' | 'archived' | 'ai'

export function isLocalTaskInQueue(item: WorkItem, view: LocalTaskQueueView): boolean {
  const archived = item.archivedAt != null
  if (view === 'archived') {
    return archived
  }
  if (view === 'ai') {
    return false
  }
  if (archived) {
    return false
  }
  return (
    view === 'all' ||
    (view === 'inbox' && item.intakeState === 'inbox') ||
    (view === 'review' && item.status === 'Needs review')
  )
}

export function LocalTaskQueueTabs({
  items,
  aiRecordUnreadCount,
  value,
  onChange
}: {
  items: WorkItem[]
  aiRecordUnreadCount: number
  value: LocalTaskQueueView
  onChange: (value: LocalTaskQueueView) => void
}): React.JSX.Element {
  return (
    <div className="flex items-center rounded-md border border-border p-0.5">
      {(
        [
          ['all', '全部'],
          ['inbox', '收件箱'],
          ['review', '待审阅'],
          ['archived', '已归档'],
          ['ai', 'AI 记录']
        ] as const
      ).map(([nextValue, label]) => (
        <Button
          key={nextValue}
          variant={value === nextValue ? 'secondary' : 'ghost'}
          size="sm"
          className="h-7 px-2.5 text-[11px]"
          onClick={() => onChange(nextValue)}
        >
          {label}
          <span className="ml-1 text-[10px] text-muted-foreground">
            {nextValue === 'ai'
              ? aiRecordUnreadCount
              : items.filter((item) => isLocalTaskInQueue(item, nextValue)).length}
          </span>
        </Button>
      ))}
    </div>
  )
}
