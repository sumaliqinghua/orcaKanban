import { useEffect, useState } from 'react'
import { PanelRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { WorkItem, WorkItemStatus } from './mock-data'
import { DetailPanel } from './LocalTaskDetailPanel'
import { LocalTaskActions, StatusBadge } from './work-item-pieces'
import { AgentTerminalPanel } from '../dashboard-popout/AgentTerminalDialog'
import { useLiveDashboardSnapshot } from '../dashboard/useLiveDashboardSnapshot'

function LocalTaskSessionPreview({
  sessionId,
  onClose,
  onOpenWorkspace
}: {
  sessionId: string
  onClose: () => void
  onOpenWorkspace: () => void
}): React.JSX.Element {
  const snapshot = useLiveDashboardSnapshot()
  const card = snapshot.cards.find((candidate) => candidate.tabId === sessionId) ?? null
  if (!card) {
    return (
      <section className="flex min-h-0 min-w-0 flex-1 flex-col border-l border-border bg-muted/10">
        <div className="flex items-center gap-2 border-b border-border px-3 py-3 text-xs font-medium">
          <span className="flex-1">会话窗口</span>
          <Button variant="ghost" size="icon-xs" onClick={onClose} aria-label="关闭会话窗口">
            <PanelRight className="size-3.5" />
          </Button>
        </div>
        <div className="flex flex-1 items-center justify-center p-6 text-center text-xs text-muted-foreground">
          当前会话没有可显示的实时终端，可能已经结束或尚未挂载。
        </div>
      </section>
    )
  }
  return (
    <AgentTerminalPanel
      card={card}
      className="m-0 min-h-0 flex-1 rounded-none border-0 shadow-none"
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
      onReveal={() => {
        onOpenWorkspace()
        onClose()
      }}
    />
  )
}

export function LocalTaskDetailAside({
  item,
  open,
  onOpenChange,
  onCompleteSubtask,
  onEditTitle,
  onEditLabels,
  onEditStep,
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
  onEditTitle: (title: string) => void
  onEditLabels: (labels: string[]) => void
  onEditStep: (subtaskId: string, stepId: string) => void
  onOpenWorkspace: () => void
  onSessionStarted: (tabId: string, request: string) => void
  onStatus: (status: WorkItemStatus, waitingReason?: string) => void
  onAccept: () => void
  onArchive: () => void
}): React.JSX.Element {
  const [embeddedSessionId, setEmbeddedSessionId] = useState<string | null>(null)
  useEffect(() => {
    setEmbeddedSessionId(null)
  }, [item.id])
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
    <aside
      className={`fixed inset-y-0 right-0 z-20 flex max-w-[calc(100vw-24px)] flex-col border-l border-border bg-background shadow-xl ${embeddedSessionId ? 'w-[min(960px,calc(100vw-24px))]' : 'w-[420px]'}`}
    >
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
      <div className="flex min-h-0 flex-1">
        <div className="flex min-h-0 w-[420px] shrink-0 flex-col">
          <DetailPanel
            item={item}
            onCompleteSubtask={onCompleteSubtask}
            onEditTitle={onEditTitle}
            onEditLabels={onEditLabels}
            onEditStep={onEditStep}
            onOpenSession={setEmbeddedSessionId}
            onOpenWorkspace={onOpenWorkspace}
            onSessionStarted={onSessionStarted}
          />
          <LocalTaskActions
            item={item}
            onStatus={onStatus}
            onAccept={onAccept}
            onArchive={onArchive}
          />
        </div>
        {embeddedSessionId ? (
          <LocalTaskSessionPreview
            sessionId={embeddedSessionId}
            onClose={() => setEmbeddedSessionId(null)}
            onOpenWorkspace={onOpenWorkspace}
          />
        ) : null}
      </div>
    </aside>
  )
}
