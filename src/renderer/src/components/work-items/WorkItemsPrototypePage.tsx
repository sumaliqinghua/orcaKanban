import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Archive,
  ChevronDown,
  PanelRight,
  Plus,
  Search,
  Sparkles,
  SquareArrowOutUpRight,
  TerminalSquare
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { WorkItem } from './mock-data'
import { DetailPanel, LocalTaskActions, StatusBadge } from './work-item-pieces'
import { BoardView, ListView, SubtaskBoardView, SubtaskListView } from './work-item-views'
import { localTaskToViewModel } from './local-task-view-model'
import { LocalTaskCreateDialog } from './LocalTaskCreateDialog'

type ViewMode = 'board' | 'list'
type BoardPerspective = 'subtasks' | 'tasks'

export default function WorkItemsPrototypePage(): React.JSX.Element {
  const [items, setItems] = useState<WorkItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('board')
  const [perspective, setPerspective] = useState<BoardPerspective>('subtasks')
  const [tab, setTab] = useState<'work-items' | 'external'>('work-items')
  const [query, setQuery] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [detailOpen, setDetailOpen] = useState(true)
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(new Set())
  const selected = items.find((item) => item.id === selectedId) ?? items[0] ?? null
  const loadTasks = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      const tasks = (await window.api.localTasks.list()) as LocalTask[]
      const viewItems = tasks.map(localTaskToViewModel)
      setItems(viewItems)
      setSelectedId((current) => current ?? viewItems[0]?.id ?? null)
      setLoadError(null)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : '本地任务加载失败')
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    void loadTasks()
    return window.api.localTasks.onChanged((task) => {
      const viewItem = localTaskToViewModel(task)
      setItems((current) => {
        const existing = current.some((item) => item.id === viewItem.id)
        return existing
          ? current.map((item) => (item.id === viewItem.id ? viewItem : item))
          : [viewItem, ...current]
      })
    })
  }, [loadTasks])
  const filtered = useMemo(
    () =>
      items.filter(
        (item) =>
          item.title.toLowerCase().includes(query.toLowerCase()) ||
          item.id.toLowerCase().includes(query.toLowerCase())
      ),
    [items, query]
  )
  const updateSelected = (updates: Partial<WorkItem>): void => {
    if (!selected) {
      return
    }
    void window.api.localTasks
      .update({
        taskId: selected.id,
        updates: {
          ...(updates.status ? { status: updates.status } : {}),
          ...(updates.description ? { description: updates.description } : {})
        }
      })
      .then((task) =>
        setItems((current) =>
          current.map((item) => (item.id === task.id ? localTaskToViewModel(task) : item))
        )
      )
      .catch((error: unknown) =>
        setLoadError(error instanceof Error ? error.message : '本地任务更新失败')
      )
    if (updates.status === 'In progress' && selected.sessions === 0) {
      void window.api.localTasks
        .createSession({ taskId: selected.id, title: '自动创建会话' })
        .catch(() => undefined)
    }
  }
  const onTaskCreated = (task: WorkItem): void => {
    setItems((current) => [task, ...current])
    setSelectedId(task.id)
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
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-xs text-muted-foreground">
        <p>还没有本地任务</p>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="size-3.5" />
          新建本地任务
        </Button>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-md bg-foreground text-background">
            <Sparkles className="size-4" />
          </div>
          <div>
            <h1 className="text-[15px] font-semibold tracking-tight">任务中心</h1>
            <p className="text-[11px] text-muted-foreground">
              把 AI 的并行工作变成可验收的研发目标
            </p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
            <TerminalSquare className="size-3.5" />
            Workspace 看板
          </Button>
          <Button
            variant="default"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => setShowCreate(true)}
          >
            <Plus className="size-3.5" />
            新建本地任务
          </Button>
        </div>
      </header>
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
            本地任务 <span className="ml-1 text-[10px] text-muted-foreground">7</span>
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
          <span className="ml-auto pb-2 text-[10px] text-muted-foreground">
            Mock 原型 · 数据不会保存
          </span>
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
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2 size-3.5 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="搜索事项"
                  className="h-8 pl-8 text-xs"
                />
              </div>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                <Sparkles className="size-3.5" />
                我的事项
              </Button>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                <ChevronDown className="size-3.5" />
                全部项目
              </Button>
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
              <Button variant="ghost" size="icon-sm" className="text-muted-foreground">
                <Archive className="size-4" />
              </Button>
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
                onQuickCreate={() => setShowCreate(true)}
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
                onQuickCreate={() => setShowCreate(true)}
              />
            )}
          </>
        )}
      </div>
      {detailOpen ? (
        <aside className="fixed inset-y-0 right-0 z-20 flex w-[420px] max-w-[calc(100vw-24px)] flex-col border-l border-border bg-background shadow-xl">
          <div className="flex shrink-0 items-center gap-2 border-b border-border px-5 py-3">
            <span className="font-mono text-[10px] text-muted-foreground">{selected.id}</span>
            <StatusBadge status={selected.status} />
            <Button
              variant="ghost"
              size="icon-sm"
              className="ml-auto"
              onClick={() => setDetailOpen(false)}
              aria-label="收起事项详情"
            >
              <PanelRight className="size-4" />
            </Button>
          </div>
          <DetailPanel item={selected} onCompleteSubtask={completeSubtask} />
          <LocalTaskActions
            item={selected}
            onStatus={(status, waitingReason) => updateSelected({ status, waitingReason })}
          />
        </aside>
      ) : (
        <Button
          variant="secondary"
          size="icon-sm"
          className="fixed right-4 top-14 z-10 shadow-sm"
          onClick={() => setDetailOpen(true)}
          aria-label="展开事项详情"
        >
          <PanelRight className="size-4" />
        </Button>
      )}
      <LocalTaskCreateDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onCreated={onTaskCreated}
      />
    </div>
  )
}
