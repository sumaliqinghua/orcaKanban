import { CheckCircle2, Circle, Play, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { WorkItemStatus } from './mock-data'

export const localTaskStatusTone: Record<WorkItemStatus, string> = {
  Open: 'border-border bg-muted/45 text-muted-foreground',
  'In progress': 'border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300',
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
  if (status === 'Needs review') {
    return <Sparkles className="size-3.5" />
  }
  return <Circle className="size-3.5" />
}

export function StatusBadge({ status }: { status: WorkItemStatus }): React.JSX.Element {
  return (
    <Badge variant="outline" className={cn('gap-1.5 font-medium', localTaskStatusTone[status])}>
      <StatusIcon status={status} />
      {status}
    </Badge>
  )
}
