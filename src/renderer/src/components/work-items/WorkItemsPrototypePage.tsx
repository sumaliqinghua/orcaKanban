import { useCallback, useEffect, useMemo, useState } from 'react'
import { Search, Sparkles, SquareArrowOutUpRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store'
import { TOGGLE_WORKSPACE_BOARD_EVENT } from '@/components/sidebar/useWorkspaceBoardPanel'
import type { LocalTask } from '../../../../shared/local-task-types'
import type { WorkItem } from './mock-data'
import { LocalTaskCenterHeader } from './LocalTaskCenterHeader'
import { LocalTaskCenterEmptyState } from './LocalTaskCenterEmptyState'
import { LocalTaskCenterDetail } from './LocalTaskCenterDetail'
import { createLocalTaskCenterActions } from './local-task-center-actions'
import { BoardView, ListView, SubtaskBoardView, SubtaskListView } from './work-item-views'
import { localTaskToViewModel, reconcileWorkItemSessionLiveness } from './local-task-view-model'
import { useLocalTaskBatchController } from './use-local-task-batch-controller'
import { LocalTaskQueueTabs } from './LocalTaskQueueTabs'
import { useLiveDashboardSnapshot } from '@/components/dashboard/useLiveDashboardSnapshot'
import {
  isLocalTaskInProjectScope,
  loadLocalTasksForProjectScope
} from './local-task-project-scope'
import { useLocalTaskProjectScope } from './use-local-task-project-scope'
type ViewMode = 'board' | 'list'
type BoardPerspective = 'subtasks' | 'tasks'
type QueueView = 'all' | 'inbox' | 'review'

export default function WorkItemsPrototypePage(): React.JSX.Element {
  const { projectFilter, setProjectFilter, projectOptions, projectRoots, createProjectId } =
    useLocalTaskProjectScope()
  const [items, setItems] = useState<WorkItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('board')
  const [perspective, setPerspective] = useState<BoardPerspective>('tasks')
  const [tab, setTab] = useState<'work-items' | 'external'>('work-items')
  const [query, setQuery] = useState('')
  const [labelFilter, setLabelFilter] = useState('')
  const [queueView, setQueueView] = useState<QueueView>('all')
  const [detailOpen, setDetailOpen] = useState(false)
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(new Set())
  const dashboardSnapshot = useLiveDashboardSnapshot()
  const liveSessionIds = useMemo(
    () => new Set(dashboardSnapshot.cards.map((card) => card.tabId)),
    [dashboardSnapshot.cards]
  )
  const effectiveItems = useMemo(
    () => items.map((item) => reconcileWorkItemSessionLiveness(item, liveSessionIds)),
    [items, liveSessionIds]
  )
  const selected =
    effectiveItems.find((item) => item.id === selectedId) ?? effectiveItems[0] ?? null
  const openTaskComposer = (): void => {
    useAppStore.getState().openModal('new-workspace-composer', {
      localTaskMode: true,
      ...(createProjectId !== 'local' ? { initialRepoId: createProjectId } : {}),
      telemetrySource: 'sidebar'
    })
  }
  const openWorkspaceBoard = (): void => {
    useAppStore.getState().closeWorkItemsPage()
    window.dispatchEvent(new CustomEvent(TOGGLE_WORKSPACE_BOARD_EVENT))
  }
  const loadTasks = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      const tasks = await loadLocalTasksForProjectScope(
        projectRoots,
        projectFilter,
        window.api.localTasks.list
      )
      const viewItems = tasks.map(localTaskToViewModel)
      setItems(viewItems)
      setSelectedId((current) => current ?? viewItems[0]?.id ?? null)
      setLoadError(null)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : '本地任务加载失败')
    } finally {
      setLoading(false)
    }
  }, [projectFilter, projectRoots])
  const { batchCandidates, batchRunning, runAllTasks } = useLocalTaskBatchController({
    items: effectiveItems,
    loadTasks,
    setLoadError
  })
  useEffect(() => {
    void loadTasks()
    return window.api.localTasks.onChanged((task) => {
      const inScope =
        projectRoots.length === 0
          ? projectFilter === 'all' || task.projectId === projectFilter
          : isLocalTaskInProjectScope(task, projectRoots)
      if (!inScope) {
        return
      }
      if (task.archivedAt !== null) {
        setItems((current) => current.filter((item) => item.id !== task.id))
        setSelectedId((current) => (current === task.id ? null : current))
        return
      }
      const viewItem = localTaskToViewModel(task)
      setItems((current) => {
        const existing = current.some((item) => item.id === viewItem.id)
        return existing
          ? current.map((item) => (item.id === viewItem.id ? viewItem : item))
          : [viewItem, ...current]
      })
    })
  }, [loadTasks, projectFilter, projectRoots])
  const filtered = useMemo(
    () =>
      effectiveItems.filter(
        (item) =>
          (item.title.toLowerCase().includes(query.toLowerCase()) ||
            item.id.toLowerCase().includes(query.toLowerCase())) &&
          (queueView === 'all' ||
            (queueView === 'inbox' && item.intakeState === 'inbox') ||
            (queueView === 'review' && item.status === 'Needs review')) &&
          (!labelFilter || (item.labels ?? []).includes(labelFilter))
      ),
    [effectiveItems, labelFilter, query, queueView]
  )
  const availableLabels = useMemo(
    () => [...new Set(effectiveItems.flatMap((item) => item.labels ?? []))].sort(),
    [effectiveItems]
  )
  const taskActions = createLocalTaskCenterActions({
    selected,
    setItems,
    setSelectedId,
    setLoadError
  })
  const applyTaskUpdate = (task: LocalTask): void => {
    setItems((current) =>
      current.map((item) => (item.id === task.id ? localTaskToViewModel(task) : item))
    )
  }
  const completeSubtask = (subtaskId: string): void => {
    if (!selected) {
      return
    }
    const subtask = selected.subtasks.find((item) => item.id === subtaskId)
    if (!subtask) {
      return
    }
    void window.api.localTasks
      .updateSubtask({ subtaskId, status: subtask.status === 'done' ? 'todo' : 'done' })
      .then((task) =>
        setItems((current) =>
          current.map((item) => (item.id === task.id ? localTaskToViewModel(task) : item))
        )
      )
      .catch((error: unknown) =>
        setLoadError(error instanceof Error ? error.message : '子任务更新失败')
      )
  }
  const toggleExpanded = (id: string): void => {
    setExpandedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }
  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
        正在加载本地任务…
      </div>
    )
  }
  if (loadError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-xs text-muted-foreground">
        <p>{loadError}</p>
        <Button variant="outline" size="sm" onClick={() => void loadTasks()}>
          重试
        </Button>
      </div>
    )
  }
  if (!selected) {
    return (
      <LocalTaskCenterEmptyState
        onCreate={openTaskComposer}
        onOpenWorkspaceBoard={openWorkspaceBoard}
        projectFilter={projectFilter}
        projectOptions={projectOptions}
        onProjectChange={setProjectFilter}
      />
    )
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <LocalTaskCenterHeader
        onCreate={openTaskComposer}
        onOpenWorkspaceBoard={openWorkspaceBoard}
        onRunAll={(agent) => void runAllTasks(agent)}
        runAllDisabled={batchRunning}
        candidateCount={batchCandidates.length}
        agentWorktreeId={
          batchCandidates.find((item) => item.workspaceId !== 'local')?.workspaceId ??
          useAppStore.getState().activeWorktreeId ??
          null
        }
        projectFilter={projectFilter}
        projectOptions={projectOptions}
        onProjectChange={setProjectFilter}
      />
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center gap-5 border-b border-border px-6 pt-3">
          <button
            type="button"
            onClick={() => setTab('work-items')}
            className={cn(
              'border-b-2 pb-3 text-xs font-medium',
              tab === 'work-items'
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground'
            )}
          >
            本地任务{' '}
            <span className="ml-1 text-[10px] text-muted-foreground">{effectiveItems.length}</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('external')}
            className={cn(
              'border-b-2 pb-3 text-xs font-medium',
              tab === 'external'
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground'
            )}
          >
            外部工单{' '}
            <span className="ml-1 text-[10px] text-muted-foreground">GitHub · Linear · Jira</span>
          </button>
          <span className="ml-auto pb-2 text-[10px] text-muted-foreground">本地数据</span>
        </div>
        {tab === 'external' ? (
          <div className="flex flex-1 items-center justify-center p-8">
            <div className="max-w-sm text-center">
              <SquareArrowOutUpRight className="mx-auto mb-3 size-8 text-muted-foreground/50" />
              <h2 className="text-sm font-medium">外部工单保持现有入口</h2>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                这里预留 GitHub、GitLab、Linear 和 Jira 工单浏览。本地任务只负责你的本地研发目标。
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => setTab('work-items')}
              >
                返回本地任务
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex shrink-0 items-center gap-2 px-6 py-3">
              <LocalTaskQueueTabs
                items={effectiveItems}
                value={queueView}
                onChange={setQueueView}
              />
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2 size-3.5 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="搜索本地任务"
                  className="h-8 pl-8 text-xs"
                />
              </div>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                <Sparkles className="size-3.5" />
                我的事项
              </Button>
              <select
                value={labelFilter}
                onChange={(event) => setLabelFilter(event.target.value)}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground"
                aria-label="按标签筛选任务"
              >
                <option value="">全部标签</option>
                {availableLabels.map((label) => (
                  <option key={label} value={label}>
                    {label}
                  </option>
                ))}
              </select>
              <div className="ml-auto flex items-center rounded-md border border-border p-0.5">
                <Button
                  variant={perspective === 'subtasks' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 px-2.5 text-[11px]"
                  onClick={() => setPerspective('subtasks')}
                >
                  子任务视角
                </Button>
                <Button
                  variant={perspective === 'tasks' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 px-2.5 text-[11px]"
                  onClick={() => setPerspective('tasks')}
                >
                  任务视角
                </Button>
              </div>
              <div className="flex items-center rounded-md border border-border p-0.5">
                <Button
                  variant={viewMode === 'board' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 px-2.5 text-[11px]"
                  onClick={() => setViewMode('board')}
                >
                  看板
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 px-2.5 text-[11px]"
                  onClick={() => setViewMode('list')}
                >
                  列表
                </Button>
              </div>
            </div>
            {viewMode === 'board' && perspective === 'subtasks' ? (
              <SubtaskBoardView
                items={filtered}
                selected={selected}
                onSelect={(id) => {
                  setSelectedId(id)
                  setDetailOpen(true)
                }}
              />
            ) : viewMode === 'board' ? (
              <BoardView
                items={filtered}
                selected={selected}
                onSelect={(id) => {
                  setSelectedId(id)
                  setDetailOpen(true)
                }}
              />
            ) : perspective === 'subtasks' ? (
              <SubtaskListView
                items={filtered}
                selected={selected}
                onSelect={(id) => {
                  setSelectedId(id)
                  setDetailOpen(true)
                }}
                onQuickCreate={openTaskComposer}
              />
            ) : (
              <ListView
                items={filtered}
                selected={selected}
                onSelect={(id) => {
                  setSelectedId(id)
                  setDetailOpen(true)
                }}
                expandedIds={expandedIds}
                onToggleExpanded={toggleExpanded}
                onQuickCreate={openTaskComposer}
              />
            )}
          </>
        )}
      </div>
      <LocalTaskCenterDetail
        item={selected}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onCompleteSubtask={completeSubtask}
        taskActions={taskActions}
        labelSuggestions={availableLabels}
        onTaskChanged={applyTaskUpdate}
      />
    </div>
  )
}
