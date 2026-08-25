import { useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { PanelRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/store'
import type { WorkItem, WorkItemStatus } from './mock-data'
import { DetailPanel } from './LocalTaskDetailPanel'
import { LocalTaskActions, StatusBadge } from './work-item-pieces'
import { AgentTerminalPanel } from '../dashboard-popout/AgentTerminalDialog'
import { useLiveDashboardSnapshot } from '../dashboard/useLiveDashboardSnapshot'
import { useAiVaultSessionLaunchActions } from '../right-sidebar/ai-vault-session-launch-actions'
import { findWorktreeById } from '@/store/slices/worktree-helpers'
import type { AiVaultSessionResumeTargetState } from '../right-sidebar/ai-vault-session-resume'

function LocalTaskSessionPreview({
  sessionId,
  session,
  projectPath,
  workspaceId,
  onClose,
  onOpenWorkspace
}: {
  sessionId: string
  session: {
    title: string
    initialPrompt?: string | null
    latestOutput?: string | null
  }
  projectPath: string
  workspaceId: string
  onClose: () => void
  onOpenWorkspace: () => void
}): React.JSX.Element {
  const snapshot = useLiveDashboardSnapshot()
  const card = snapshot.cards.find((candidate) => candidate.tabId === sessionId) ?? null
  const activeWorktreeId = useAppStore((state) => state.activeWorktreeId)
  const activeWorktree = useAppStore((state) =>
    activeWorktreeId ? (findWorktreeById(state.worktreesByRepo, activeWorktreeId) ?? null) : null
  )
  const targetState = useAppStore(
    useShallow(
      (state): AiVaultSessionResumeTargetState => ({
        folderWorkspaces: state.folderWorkspaces,
        projectGroups: state.projectGroups,
        repos: state.repos,
        worktreesByRepo: state.worktreesByRepo
      })
    )
  )
  const { handleResume } = useAiVaultSessionLaunchActions({
    activeWorktree,
    activeWorktreeId,
    targetState
  })
  const [historyLoading, setHistoryLoading] = useState(false)
  const restoreFromHistory = async (): Promise<void> => {
    setHistoryLoading(true)
    try {
      const result = await window.api.aiVault.listSessions({
        scopePaths: [projectPath],
        limit: 200,
        force: true
      })
      const matching = result.sessions.find((candidate) => {
        const prompt = candidate.firstUserPrompt ?? candidate.lastUserPrompt ?? ''
        return (
          candidate.cwd === projectPath ||
          (session.initialPrompt?.trim() ? prompt.includes(session.initialPrompt.trim()) : false) ||
          candidate.title === session.title
        )
      })
      if (matching) {
        handleResume(
          matching,
          workspaceId === 'local' ? (activeWorktreeId ?? undefined) : workspaceId
        )
      } else {
        onOpenWorkspace()
      }
    } catch {
      onOpenWorkspace()
    } finally {
      setHistoryLoading(false)
    }
  }
  if (!card) {
    return (
      <section className="flex min-h-0 min-w-0 flex-1 flex-col border-l border-border bg-muted/10">
        <div className="flex items-center gap-2 border-b border-border px-3 py-3 text-xs font-medium">
          <span className="flex-1">会话窗口</span>
          <Button variant="ghost" size="icon-xs" onClick={onClose} aria-label="关闭会话窗口">
            <PanelRight className="size-3.5" />
          </Button>
        </div>
        <div className="scrollbar-sleek flex flex-1 flex-col gap-3 overflow-y-auto p-4 text-xs text-muted-foreground">
          <SessionHistory session={session} />
          <Button
            variant="outline"
            size="sm"
            onClick={() => void restoreFromHistory()}
            disabled={historyLoading}
          >
            在工作树中恢复
          </Button>
          <p>当前会话没有可显示的实时终端，可能已经结束或尚未挂载。</p>
        </div>
      </section>
    )
  }
  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col border-l border-border">
      <div className="scrollbar-sleek max-h-56 shrink-0 overflow-y-auto p-3">
        <SessionHistory session={session} />
      </div>
      <AgentTerminalPanel
        card={card}
        className="m-0 min-h-0 flex-1 rounded-none border-0 border-t shadow-none"
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
    </section>
  )
}

function SessionHistory({
  session
}: {
  session: { initialPrompt?: string | null; latestOutput?: string | null }
}): React.JSX.Element {
  return (
    <div className="space-y-2 text-xs">
      <div className="font-medium text-foreground">会话历史</div>
      <div className="rounded-md border border-border/70 bg-muted/20 p-2.5">
        <div className="mb-1 text-[10px] font-medium text-muted-foreground">首次提示</div>
        <div className="scrollbar-sleek max-h-32 overflow-y-auto whitespace-pre-wrap leading-relaxed">
          {session.initialPrompt || '没有保存首次提示。'}
        </div>
      </div>
      <div className="rounded-md border border-border/70 bg-muted/20 p-2.5">
        <div className="mb-1 text-[10px] font-medium text-muted-foreground">最近轮次</div>
        <div className="scrollbar-sleek max-h-32 overflow-y-auto whitespace-pre-wrap leading-relaxed">
          {session.latestOutput || '没有保存最近一轮输出。'}
        </div>
      </div>
    </div>
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
  onArchive,
  onPromote
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
  onPromote: () => void
}): React.JSX.Element {
  const [embeddedSessionId, setEmbeddedSessionId] = useState<string | null>(null)
  const [detailWidth, setDetailWidth] = useState(420)
  const resizeStartRef = useRef<{ x: number; width: number } | null>(null)
  useEffect(() => {
    setEmbeddedSessionId(null)
  }, [item.id])
  useEffect(() => {
    const handlePointerMove = (event: PointerEvent): void => {
      const start = resizeStartRef.current
      if (!start) {
        return
      }
      setDetailWidth(Math.min(720, Math.max(360, start.width + start.x - event.clientX)))
    }
    const handlePointerUp = (): void => {
      resizeStartRef.current = null
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
          ? `min(${detailWidth + 540}px, calc(100vw - 24px))`
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
            onEditLabels={onEditLabels}
            onEditStep={onEditStep}
            onOpenSession={(sessionId) => {
              setEmbeddedSessionId(sessionId)
            }}
            onOpenWorkspace={onOpenWorkspace}
            onSessionStarted={onSessionStarted}
          />
          <LocalTaskActions
            item={item}
            onStatus={onStatus}
            onAccept={onAccept}
            onArchive={onArchive}
            onPromote={onPromote}
          />
        </div>
        {embeddedSessionId ? (
          <LocalTaskSessionPreview
            sessionId={embeddedSessionId}
            projectPath={item.projectPath ?? ''}
            workspaceId={item.workspaceId ?? 'local'}
            session={
              item.sessionsList.find((candidate) => candidate.id === embeddedSessionId) ?? {
                title: '关联会话',
                initialPrompt: null,
                latestOutput: null
              }
            }
            onClose={() => setEmbeddedSessionId(null)}
            onOpenWorkspace={onOpenWorkspace}
          />
        ) : null}
      </div>
    </aside>
  )
}
