import { useEffect, useRef, useState } from 'react'
import { PanelRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/store'
import type { WorkItem } from './mock-data'
import type { LocalTask } from '../../../../shared/local-task-types'
import type { TuiAgent } from '../../../../shared/tui-agent'
import { DetailPanel } from './LocalTaskDetailPanel'
import { LocalTaskActions, StatusBadge } from './work-item-pieces'
import { AgentTerminalPanel, type AgentRevealArgs } from '../dashboard-popout/AgentTerminalDialog'
import { useLiveDashboardSnapshot } from '../dashboard/useLiveDashboardSnapshot'
import { resumeLocalTaskSession } from './local-task-session-resume'
import { localTaskSessionMatchesTab } from './local-task-session-identity'
import { LocalTaskSessionHistory } from './LocalTaskSessionHistory'
import { LocalTaskSessionSplit } from './LocalTaskSessionSplit'
import { LocalTaskSessionRetryNotice } from './LocalTaskSessionRetryNotice'
import type { Worktree } from '../../../../shared/worktree/types'

function LocalTaskSessionPreview({
  sessionId,
  session,
  workspaceId,
  onClose,
  onOpenWorkspace,
  onTaskChanged
}: {
  sessionId: string
  session: WorkItem['sessionsList'][number]
  workspaceId: string
  onClose: () => void
  onOpenWorkspace: (request?: string | AgentRevealArgs) => void
  onTaskChanged: (task: LocalTask) => void
}): React.JSX.Element {
  const snapshot = useLiveDashboardSnapshot()
  const tabId = session.tabId ?? sessionId
  const matchesTab = localTaskSessionMatchesTab(session, useAppStore.getState())
  const card =
    snapshot.cards.find(
      (candidate) =>
        candidate.tabId === tabId &&
        localTaskSessionMatchesTab(session, useAppStore.getState(), candidate.paneKey)
    ) ?? null
  const ptyIdsByTabId = useAppStore((state) => state.ptyIdsByTabId)
  const hasLiveTerminal = matchesTab && (ptyIdsByTabId[tabId]?.length ?? 0) > 0
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const restorePending = useRef(false)
  const restoreFromHistory = async (): Promise<void> => {
    if (hasLiveTerminal) {
      onOpenWorkspace(sessionId)
      return
    }
    if (restorePending.current) {
      return
    }
    restorePending.current = true
    setHistoryLoading(true)
    setHistoryError(null)
    try {
      const target = await resumeLocalTaskSession({
        sessionId,
        session,
        workspaceId,
        onTaskChanged
      })
      onOpenWorkspace(target)
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : '原会话恢复失败')
    } finally {
      restorePending.current = false
      setHistoryLoading(false)
    }
  }
  if (!card?.ptyId) {
    return (
      <section className="flex min-h-0 min-w-0 flex-1 flex-col border-l border-border bg-muted/10">
        <div className="flex items-center gap-2 border-b border-border px-3 py-3 text-xs font-medium">
          <span className="flex-1">会话窗口</span>
          <Button variant="ghost" size="icon-xs" onClick={onClose} aria-label="关闭会话窗口">
            <PanelRight className="size-3.5" />
          </Button>
        </div>
        <div className="scrollbar-sleek flex flex-1 flex-col gap-3 overflow-y-auto p-4 text-xs text-muted-foreground">
          {session.retry ? (
            <LocalTaskSessionRetryNotice sessionId={sessionId} retry={session.retry} />
          ) : null}
          <LocalTaskSessionHistory
            session={session}
            onManualNotesChange={async (manualNotes) => {
              const task = await window.api.localTasks.updateSessionOutput({
                sessionId,
                manualNotes
              })
              onTaskChanged(task)
            }}
            onTagsChange={async (tags) => {
              const task = await window.api.localTasks.updateSessionOutput({ sessionId, tags })
              onTaskChanged(task)
            }}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => void restoreFromHistory()}
            disabled={historyLoading}
          >
            {hasLiveTerminal ? '打开工作树查看会话' : '在工作树中恢复'}
          </Button>
          <p>
            {hasLiveTerminal
              ? '原会话终端仍可打开；终端存在不代表智能体正在执行。'
              : session.livenessUnverifiable
                ? '暂时无法确认执行主机上的会话状态。恢复时将由执行主机核对原会话。'
                : '当前会话没有可显示的实时终端。'}
          </p>
          {historyError ? (
            <p role="alert" className="text-destructive">
              {historyError}
            </p>
          ) : null}
        </div>
      </section>
    )
  }
  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col border-l border-border">
      <LocalTaskSessionSplit
        history={
          <>
            {session.retry ? (
              <LocalTaskSessionRetryNotice sessionId={sessionId} retry={session.retry} />
            ) : null}
            <LocalTaskSessionHistory
              session={session}
              onManualNotesChange={async (manualNotes) => {
                const task = await window.api.localTasks.updateSessionOutput({
                  sessionId,
                  manualNotes
                })
                onTaskChanged(task)
              }}
              onTagsChange={async (tags) => {
                const task = await window.api.localTasks.updateSessionOutput({ sessionId, tags })
                onTaskChanged(task)
              }}
            />
          </>
        }
      >
        <AgentTerminalPanel
          card={card}
          className="m-0 min-h-0 flex-1 rounded-none border-0 border-t shadow-none"
          onOpenChange={(open) => {
            if (!open) {
              onClose()
            }
          }}
          onReveal={() => {
            onOpenWorkspace({
              repoId: card.repoId,
              worktreeId: card.worktreeId,
              executionHostId: card.executionHostId,
              tabId: card.tabId,
              leafId: card.leafId
            })
            onClose()
          }}
        />
      </LocalTaskSessionSplit>
    </section>
  )
}

export function LocalTaskDetailAside({
  item,
  open,
  onOpenChange,
  onCompleteSubtask,
  onEditTitle,
  onEditDescription,
  onEditLabels,
  onEditStep,
  onOpenWorkspace,
  onSessionStarted,
  onReportSessionStarted,
  onAccept,
  onArchive,
  onRestore,
  onDelete,
  onPromote,
  onMoveToInbox,
  labelSuggestions,
  onTaskChanged
}: {
  item: WorkItem
  open: boolean
  onOpenChange: (open: boolean) => void
  onCompleteSubtask: (subtaskId: string) => void
  onEditTitle: (title: string) => void
  onEditDescription: (description: string) => void
  onEditLabels: (labels: string[]) => void
  onEditStep: (subtaskId: string, stepId: string) => void
  onOpenWorkspace: (request?: string | AgentRevealArgs) => void
  onSessionStarted: (tabId: string, request: string) => void
  onReportSessionStarted: (tabId: string, request: string, agent: TuiAgent) => Promise<void>
  onAccept: () => void
  onArchive: () => void
  onRestore: () => void
  onDelete: () => void
  onPromote: (workspace: Worktree) => void
  onMoveToInbox: () => void
  labelSuggestions: string[]
  onTaskChanged: (task: LocalTask) => void
}): React.JSX.Element {
  const [embeddedSessionId, setEmbeddedSessionId] = useState<string | null>(null)
  const [detailWidth, setDetailWidth] = useState(420)
  const [previewWidth, setPreviewWidth] = useState(540)
  const resizeStartRef = useRef<{ x: number; width: number } | null>(null)
  const previewResizeStartRef = useRef<{ x: number; width: number } | null>(null)
  useEffect(() => {
    const handlePointerMove = (event: PointerEvent): void => {
      const start = resizeStartRef.current
      if (start) {
        setDetailWidth(Math.min(720, Math.max(360, start.width + start.x - event.clientX)))
        return
      }
      const previewStart = previewResizeStartRef.current
      if (previewStart) {
        setPreviewWidth(
          Math.min(900, Math.max(360, previewStart.width + previewStart.x - event.clientX))
        )
      }
    }
    const handlePointerUp = (): void => {
      resizeStartRef.current = null
      previewResizeStartRef.current = null
    }
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [])
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
      className="fixed inset-y-0 right-0 z-20 flex max-w-[calc(100vw-24px)] flex-col border-l border-border bg-background shadow-xl"
      style={{
        width: embeddedSessionId
          ? `min(${detailWidth + previewWidth + 4}px, calc(100vw - 24px))`
          : `${detailWidth}px`
      }}
    >
      <div
        role="separator"
        aria-label="调整任务详情侧边栏宽度"
        className="absolute inset-y-0 -left-1 z-30 w-2 cursor-ew-resize"
        onPointerDown={(event) => {
          event.preventDefault()
          resizeStartRef.current = { x: event.clientX, width: detailWidth }
        }}
      />
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
        <div className="flex min-h-0 shrink-0 flex-col" style={{ width: `${detailWidth}px` }}>
          <DetailPanel
            item={item}
            onCompleteSubtask={onCompleteSubtask}
            onEditTitle={onEditTitle}
            onEditDescription={onEditDescription}
            onEditLabels={onEditLabels}
            labelSuggestions={labelSuggestions}
            onEditStep={onEditStep}
            onOpenSession={(sessionId) => {
              setEmbeddedSessionId(sessionId)
            }}
            onOpenWorkspace={onOpenWorkspace}
            onSessionStarted={onSessionStarted}
            onReportSessionStarted={async (tabId, request, agent) => {
              await onReportSessionStarted(tabId, request, agent)
              setEmbeddedSessionId(tabId)
            }}
            onTaskChanged={onTaskChanged}
          />
          <LocalTaskActions
            item={item}
            onAccept={onAccept}
            onArchive={onArchive}
            onRestore={onRestore}
            onDelete={onDelete}
            onPromote={onPromote}
            onMoveToInbox={onMoveToInbox}
          />
        </div>
        {embeddedSessionId ? (
          <>
            <div
              role="separator"
              aria-label="调整 Agent 会话预览宽度"
              className="z-30 w-1 shrink-0 cursor-ew-resize bg-transparent transition-colors hover:bg-border"
              onPointerDown={(event) => {
                event.preventDefault()
                previewResizeStartRef.current = { x: event.clientX, width: previewWidth }
              }}
            />
            <div className="flex min-h-0 min-w-0 shrink-0" style={{ width: `${previewWidth}px` }}>
              <LocalTaskSessionPreview
                key={embeddedSessionId}
                sessionId={embeddedSessionId}
                workspaceId={item.workspaceId ?? 'local'}
                session={
                  item.sessionsList.find((candidate) => candidate.id === embeddedSessionId) ?? {
                    title: '关联会话',
                    status: 'done',
                    time: '',
                    currentPrompt: null,
                    turns: []
                  }
                }
                onClose={() => setEmbeddedSessionId(null)}
                onOpenWorkspace={onOpenWorkspace}
                onTaskChanged={onTaskChanged}
              />
            </div>
          </>
        ) : null}
      </div>
    </aside>
  )
}
