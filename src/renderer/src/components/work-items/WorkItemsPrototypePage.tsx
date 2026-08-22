import { useMemo, useState } from 'react'
import {
  Archive,
  ChevronDown,
  Clock3,
  PanelRight,
  Play,
  Plus,
  Search,
  Sparkles,
  SquareArrowOutUpRight,
  TerminalSquare,
  X
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { MOCK_ITEMS, type WorkItem } from './mock-data'
import { DetailPanel, StatusBadge } from './work-item-pieces'
import { BoardView, ListView, SubtaskBoardView, SubtaskListView } from './work-item-views'

type ViewMode = 'board' | 'list'
type BoardPerspective = 'subtasks' | 'tasks'

export default function WorkItemsPrototypePage(): React.JSX.Element {
  const [items, setItems] = useState(MOCK_ITEMS)
  const [selectedId, setSelectedId] = useState('LT-104')
  const [viewMode, setViewMode] = useState<ViewMode>('board')
  const [perspective, setPerspective] = useState<BoardPerspective>('subtasks')
  const [tab, setTab] = useState<'work-items' | 'external'>('work-items')
  const [query, setQuery] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [detailOpen, setDetailOpen] = useState(true)
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(new Set())
  const selected = items.find((item) => item.id === selectedId) ?? items[0]
  const filtered = useMemo(
    () =>
      items.filter(
        (item) =>
          item.title.toLowerCase().includes(query.toLowerCase()) ||
          item.id.toLowerCase().includes(query.toLowerCase())
      ),
    [items, query]
  )
  const updateSelected = (updates: Partial<WorkItem>): void =>
    setItems((current) =>
      current.map((item) =>
        item.id === selected.id
          ? {
              ...item,
              ...updates,
              ...(updates.status === 'In progress' && item.sessions === 0
                ? {
                    sessions: 1,
                    activeSessions: 1,
                    sessionsList: [
                      { title: '自动创建会话', status: 'working' as const, time: '刚刚' }
                    ]
                  }
                : {}),
              updated: '刚刚'
            }
          : item
      )
    )
  const createMockTask = (): void => {
    const title = newTaskTitle.trim()
    if (!title) {
      return
    }
    const id = `LT-${Math.floor(110 + Math.random() * 80)}`
    const task: WorkItem = {
      id,
      title: title.split(/\r?\n/, 1)[0] ?? title,
      description: title,
      status: 'Open',
      workspace: 'local · 当前 HEAD',
      project: 'Orca',
      updated: '刚刚',
      sessions: 0,
      activeSessions: 0,
      subtasks: [],
      latestOutput: {
        session: '暂无会话',
        text: '任务已创建，切换为 In progress 后自动创建会话。'
      },
      sessionsList: []
    }
    setItems((current) => [task, ...current])
    setSelectedId(id)
    setShowCreate(false)
    setNewTaskTitle('')
  }
  const completeSubtask = (subtaskId: string): void =>
    updateSelected({
      subtasks: selected.subtasks.map((subtask) =>
        subtask.id === subtaskId
          ? { ...subtask, status: subtask.status === 'done' ? 'todo' : 'done' }
          : subtask
      )
    })
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
          <div className="flex shrink-0 gap-2 border-t border-border bg-background px-5 py-3">
            {selected.status === 'Needs review' ? (
              <Button
                className="flex-1 gap-1.5 text-xs"
                onClick={() => updateSelected({ status: 'Done' })}
              >
                验收通过
              </Button>
            ) : (
              <Button
                className="flex-1 gap-1.5 text-xs"
                onClick={() => updateSelected({ status: 'In progress' })}
              >
                <Play className="size-3.5" />
                {selected.status === 'Done' ? '要求修改' : '开始执行'}
              </Button>
            )}
            <Button
              variant="outline"
              className="gap-1.5 text-xs"
              onClick={() =>
                updateSelected({
                  status: selected.status === 'Waiting' ? 'In progress' : 'Waiting',
                  waitingReason: selected.status === 'Waiting' ? undefined : '等待你的确认'
                })
              }
            >
              <Clock3 className="size-3.5" />
              {selected.status === 'Waiting' ? '继续' : '等待'}
            </Button>
            <Button variant="ghost" size="icon" aria-label="归档事项">
              <Archive className="size-4" />
            </Button>
          </div>
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
      {showCreate ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-background p-5 shadow-xl">
            <div className="flex items-center">
              <h2 className="text-sm font-semibold">新建本地任务</h2>
              <Button
                variant="ghost"
                size="icon-sm"
                className="ml-auto"
                onClick={() => setShowCreate(false)}
              >
                <X className="size-4" />
              </Button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              创建时绑定执行上下文；未选择时默认使用 local + 当前 HEAD。
            </p>
            <Input
              className="mt-4"
              placeholder="例如：补充登录刷新测试"
              autoFocus
              value={newTaskTitle}
              onChange={(event) => setNewTaskTitle(event.target.value)}
            />
            <textarea
              className="mt-3 min-h-24 w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-xs outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="描述这个研发目标（可选）"
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowCreate(false)}>
                取消
              </Button>
              <Button size="sm" onClick={createMockTask}>
                创建本地任务
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
