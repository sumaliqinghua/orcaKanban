import { useMemo, useState, type ReactNode } from 'react'
import { ChevronDown, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getTaskPerspectiveStatus, type WorkItem } from './mock-data'

export function ProjectBoardSection({
  name,
  items,
  children
}: {
  name: string
  items: WorkItem[]
  children: ReactNode
}): React.JSX.Element {
  const defaultCollapsed = items.every((item) => getTaskPerspectiveStatus(item) === 'Done')
  const [override, setOverride] = useState<{ defaultValue: boolean; collapsed: boolean } | null>(
    null
  )
  const collapsed =
    override?.defaultValue === defaultCollapsed ? override.collapsed : defaultCollapsed
  return (
    <section className="shrink-0 rounded-lg border border-border/70 bg-muted/10">
      <Button
        type="button"
        variant="ghost"
        className="flex h-auto w-full justify-start gap-2 px-3 py-2.5 text-left"
        aria-expanded={!collapsed}
        onClick={() => setOverride({ defaultValue: defaultCollapsed, collapsed: !collapsed })}
      >
        <ChevronDown className={cn('size-4 transition-transform', collapsed && '-rotate-90')} />
        <span className="min-w-0 flex-1 truncate text-xs font-semibold">{name}</span>
        <span className="shrink-0 text-[11px] text-muted-foreground">{items.length} 个任务</span>
      </Button>
      {!collapsed ? children : null}
    </section>
  )
}

export function ProjectTaskCreateButton({
  name,
  onCreate
}: {
  name: string
  onCreate: () => void
}): React.JSX.Element {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="mx-2 mt-auto mb-2"
      aria-label={`新建 ${name} 的任务`}
      title={`新建 ${name} 的任务`}
      onClick={onCreate}
    >
      <Plus className="size-4" />
    </Button>
  )
}

export function useProjectBoardGroups(
  items: WorkItem[],
  projectOptions?: readonly { id: string; label: string }[]
): [string, WorkItem[]][] {
  return useMemo(() => {
    const groups = new Map<string, WorkItem[]>()
    for (const option of projectOptions ?? []) {
      if (option.id !== 'all') {
        groups.set(option.id, [])
      }
    }
    for (const item of items) {
      const group = groups.get(item.project) ?? []
      group.push(item)
      groups.set(item.project, group)
    }
    return [...groups.entries()]
  }, [items, projectOptions])
}
