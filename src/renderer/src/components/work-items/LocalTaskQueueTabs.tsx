import { Button } from '@/components/ui/button'
import type { WorkItem } from './mock-data'

export function LocalTaskQueueTabs({
  items,
  aiRecordUnreadCount,
  value,
  onChange
}: {
  items: WorkItem[]
  aiRecordUnreadCount: number
  value: 'all' | 'inbox' | 'review' | 'ai'
  onChange: (value: 'all' | 'inbox' | 'review' | 'ai') => void
}): React.JSX.Element {
  return (
    <div className="flex items-center rounded-md border border-border p-0.5">
      {(
        [
          ['all', '全部'],
          ['inbox', '收件箱'],
          ['review', '待审阅'],
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
            {nextValue === 'all'
              ? items.length
              : nextValue === 'inbox'
                ? items.filter((item) => item.intakeState === 'inbox').length
                : nextValue === 'review'
                  ? items.filter((item) => item.status === 'Needs review').length
                  : aiRecordUnreadCount}
          </span>
        </Button>
      ))}
    </div>
  )
}
