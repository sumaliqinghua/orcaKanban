import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw, Search, Sparkles, SquareArrowOutUpRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAppStore } from '@/store'
import type { WorkItem } from './mock-data'
import { LocalTaskCenterHeader } from './LocalTaskCenterHeader'
import { LocalTaskCenterEmptyState } from './LocalTaskCenterEmptyState'
import { LocalTaskCenterDetail } from './LocalTaskCenterDetail'
import { createLocalTaskCenterActions } from './local-task-center-actions'
import { BoardView, ListView, SubtaskBoardView, SubtaskListView } from './work-item-views'
import {
  collectLiveTaskSessionIds,
  localTaskToViewModel,
  reconcileWorkItemSessionLiveness
} from './local-task-view-model'
import { useLocalTaskBatchController } from './use-local-task-batch-controller'
import {
  isLocalTaskInQueue,
  LocalTaskQueueTabs,
  type LocalTaskQueueView
} from './LocalTaskQueueTabs'
import { useLiveDashboardSnapshot } from '@/components/dashboard/useLiveDashboardSnapshot'
import {
  isLocalTaskInProjectScope,
  loadLocalTasksForProjectScope
} from './local-task-project-scope'
import { useLocalTaskProjectScope } from './use-local-task-project-scope'
import { KanbanAiRecordsPane } from './KanbanAiRecordsPane'
import { useLocalTaskCenterInteractions } from './use-local-task-center-interactions'
import { LocalTaskSourceTabs } from './LocalTaskSourceTabs'
type ViewMode = 'board' | 'list'
type BoardPerspective = 'subtasks' | 'tasks'

export default function WorkItemsPrototypePage(): React.JSX.Element {
  const { projectFilter, setProjectFilter, projectOptions, projectRoots, createProjectId } =
    useLocalTaskProjectScope()
  const [items, setItems] = useState<WorkItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [aiRecordUnreadCount, setAiRecordUnreadCount] = useState(0)
  const [aiRecordCount, setAiRecordCount] = useState<number | null>(null)
  const [aiRecordRefreshToken, setAiRecordRefreshToken] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('board')
  const [perspective, setPerspective] = useState<BoardPerspective>('tasks')
  const [tab, setTab] = useState<'work-items' | 'external'>('work-items')
  const [query, setQuery] = useState('')
  const [labelFilter, setLabelFilter] = useState('')
  const [queueView, setQueueView] = useState<LocalTaskQueueView>('ready')
  const [detailOpen, setDetailOpen] = useState(false)
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(new Set())
  const dashboardSnapshot = useLiveDashboardSnapshot()
  const ptyIdsByTabId = useAppStore((state) => state.ptyIdsByTabId)
  const liveSessionIds = useMemo(
    () => collectLiveTaskSessionIds(dashboardSnapshot.cards, ptyIdsByTabId),
    [dashboardSnapshot.cards, ptyIdsByTabId]
  )
  const effectiveItems = useMemo(
    () => items.map((item) => reconcileWorkItemSessionLiveness(item, liveSessionIds)),
    [items, liveSessionIds]
  )
  const loadTasks = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      const tasks = await loadLocalTasksForProjectScope(
        projectRoots,
        projectFilter,
        window.api.localTasks.list,
        { includeArchived: true }
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
    const unsubscribeChanged = window.api.localTasks.onChanged((task) => {
      const inScope =
        projectRoots.length === 0
          ? projectFilter === 'all' || task.projectId === projectFilter
          : isLocalTaskInProjectScope(task, projectRoots)
      if (!inScope) {
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
    const unsubscribeDeleted = window.api.localTasks.onDeleted((deletion) => {
      setItems((current) =>
        current.filter(
          (item) => item.id !== deletion.taskId || item.projectPath !== deletion.projectPath
        )
      )
      setSelectedId((current) => (current === deletion.taskId ? null : current))
    })
    return () => {
      unsubscribeChanged()
      unsubscribeDeleted()
    }
  }, [loadTasks, projectFilter, projectRoots])
  const filtered = useMemo(
    () =>
      effectiveItems.filter(
        (item) =>
          (item.title.toLowerCase().includes(query.toLowerCase()) ||
            item.id.toLowerCase().includes(query.toLowerCase())) &&
          isLocalTaskInQueue(item, queueView) &&
          (!labelFilter || (item.labels ?? []).includes(labelFilter))
      ),
    [effectiveItems, labelFilter, query, queueView]
  )
  const selected = filtered.find((item) => item.id === selectedId) ?? filtered[0] ?? null
  const availableLabels = useMemo(
    () => [...new Set(effectiveItems.flatMap((item) => item.labels ?? []))].sort(),
    [effectiveItems]
  )
  const changeQueueView = (value: LocalTaskQueueView): void => {
    setQueueView(value)
    if (value === 'ai') {
      setDetailOpen(false)
    }
  }
  const taskActions = createLocalTaskCenterActions({
    selected,
    setItems,
    setSelectedId,
    setLoadError
  })
  const {
    openTaskComposer,
    openWorkspaceBoard,
    openAiRecordTask,
    applyTaskUpdate,
    completeSubtask,
    toggleExpanded
  } = useLocalTaskCenterInteractions({
    createProjectId,
    setProjectFilter,
    selected,
    setItems,
    setSelectedId,
    setLoadError,
    setDetailOpen,
    setQueueView,
    setQuery,
    setExpandedIds
  })
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
  if (effectiveItems.length === 0 && aiRecordCount === 0) {
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
        <LocalTaskSourceTabs value={tab} taskCount={effectiveItems.length} onChange={setTab} />
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
                aiRecordUnreadCount={aiRecordUnreadCount}
                value={queueView}
                onChange={changeQueueView}
              />
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2 size-3.5 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={queueView === 'ai' ? '搜索 AI 记录' : '搜索本地任务'}
                  className="h-8 pl-8 text-xs"
                />
              </div>
              {queueView === 'ai' ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="ml-auto"
                  onClick={() => setAiRecordRefreshToken((value) => value + 1)}
                  aria-label="刷新 AI 记录"
                >
                  <RefreshCw className="size-3.5" />
                </Button>
              ) : (
                <>
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
                </>
              )}
              {queueView !== 'ai' ? (
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
              ) : null}
              {queueView !== 'ai' ? (
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
              ) : null}
            </div>
            <KanbanAiRecordsPane
              active={queueView === 'ai'}
              projectOptions={projectOptions}
              projectRoots={projectRoots}
              query={query}
              items={effectiveItems}
              refreshToken={aiRecordRefreshToken}
              onUnreadCountChange={setAiRecordUnreadCount}
              onRecordCountChange={setAiRecordCount}
              onOpenTask={openAiRecordTask}
            />
            {queueView !== 'ai' ? (
              viewMode === 'board' && perspective === 'subtasks' ? (
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
              )
            ) : null}
          </>
        )}
      </div>
      {queueView !== 'ai' && selected ? (
        <LocalTaskCenterDetail
          item={selected}
          open={detailOpen}
          onOpenChange={setDetailOpen}
          onCompleteSubtask={completeSubtask}
          taskActions={taskActions}
          labelSuggestions={availableLabels}
          onTaskChanged={applyTaskUpdate}
        />
      ) : null}
    </div>
  )
}
