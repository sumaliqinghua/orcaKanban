import { PanelRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { WorkItem, WorkItemStatus } from './mock-data'
import { DetailPanel } from './LocalTaskDetailPanel'
import { LocalTaskActions, StatusBadge } from './work-item-pieces'

export function LocalTaskDetailAside({
  item,
  open,
  onOpenChange,
  onCompleteSubtask,
  onEditTitle,
  onEditStep,
  onOpenSession,
  onOpenWorkspace,
  onSessionStarted,
  onStatus,
  onAccept,
  onArchive
}: {
  item: WorkItem
  open: boolean
  onOpenChange: (open: boolean) => void
  onCompleteSubtask: (subtaskId: string) => void
  onEditTitle: () => void
  onEditStep: (subtaskId: string, stepId: string) => void
  onOpenSession: (sessionId: string) => void
  onOpenWorkspace: () => void
  onSessionStarted: (tabId: string, request: string) => void
  onStatus: (status: WorkItemStatus, waitingReason?: string) => void
  onAccept: () => void
  onArchive: () => void
}): React.JSX.Element {
  if (!open) {
    return (
      <Button
        type="button"
        variant="secondary"
        size="icon-sm"
        className="fixed right-4 top-14 z-30 flex size-9 shrink-0 items-center justify-center p-0 shadow-sm"
        onClick={() => onOpenChange(true)}
        aria-label="展开任务详情"
      >
        <PanelRight className="size-4" />
      </Button>
    )
  }
  return (
    <aside className="fixed inset-y-0 right-0 z-20 flex w-[420px] max-w-[calc(100vw-24px)] flex-col border-l border-border bg-background shadow-xl">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-5 py-3">
        <span className="font-mono text-[10px] text-muted-foreground">{item.id}</span>
        <StatusBadge status={item.status} />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="ml-auto flex size-9 shrink-0 items-center justify-center p-0"
          onClick={() => onOpenChange(false)}
          aria-label="收起任务详情"
        >
          <PanelRight className="size-4" />
        </Button>
      </div>
      <DetailPanel
        item={item}
        onCompleteSubtask={onCompleteSubtask}
        onEditTitle={onEditTitle}
        onEditStep={onEditStep}
        onOpenSession={onOpenSession}
        onOpenWorkspace={onOpenWorkspace}
        onSessionStarted={onSessionStarted}
      />
      <LocalTaskActions item={item} onStatus={onStatus} onAccept={onAccept} onArchive={onArchive} />
    </aside>
  )
}
