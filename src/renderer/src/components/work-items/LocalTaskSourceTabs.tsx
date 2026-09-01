import { cn } from '@/lib/utils'

export function LocalTaskSourceTabs({
  value,
  taskCount,
  onChange
}: {
  value: 'work-items' | 'external'
  taskCount: number
  onChange: (value: 'work-items' | 'external') => void
}): React.JSX.Element {
  return (
    <div className="flex shrink-0 items-center gap-5 border-b border-border px-6 pt-3">
      <button
        type="button"
        onClick={() => onChange('work-items')}
        className={cn(
          'border-b-2 pb-3 text-xs font-medium',
          value === 'work-items'
            ? 'border-foreground text-foreground'
            : 'border-transparent text-muted-foreground'
        )}
      >
        本地任务 <span className="ml-1 text-[10px] text-muted-foreground">{taskCount}</span>
      </button>
      <button
        type="button"
        onClick={() => onChange('external')}
        className={cn(
          'border-b-2 pb-3 text-xs font-medium',
          value === 'external'
            ? 'border-foreground text-foreground'
            : 'border-transparent text-muted-foreground'
        )}
      >
        外部工单{' '}
        <span className="ml-1 text-[10px] text-muted-foreground">GitHub · Linear · Jira</span>
      </button>
      <span className="ml-auto pb-2 text-[10px] text-muted-foreground">本地数据</span>
    </div>
  )
}
