import { useContext, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { useAppStore } from '@/store'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  LocalTaskCatalogContext,
  localTaskWorkspaceKey
} from '../work-items/local-task-catalog-context'
import { useLocalTaskNavigation } from '../work-items/local-task-navigation'
import { StatusIcon, localTaskStatusTone } from '../work-items/local-task-status-presentation'
import type { WorkItem } from '../work-items/mock-data'

const labels = { Open: '未开始', 'In progress': '进行中', 'Needs review': '待审阅', Done: '已完成' }

function TaskRow({ item }: { item: WorkItem }): React.JSX.Element {
  const uncertain = item.sessionsList.some(
    (session) =>
      session.livenessUnverifiable &&
      session.associationSource !== 'clarification' &&
      session.associationSource !== 'task-report'
  )
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="flex w-full min-w-0 items-center gap-1.5 rounded-sm px-1.5 py-1 text-left text-xs text-worktree-sidebar-foreground hover:bg-worktree-sidebar-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-worktree-sidebar-ring"
          onClick={() => {
            useLocalTaskNavigation.getState().open(item)
            useAppStore.getState().openWorkItemsPage()
          }}
        >
          <span className={`shrink-0 rounded-sm ${localTaskStatusTone[item.status]}`}>
            <StatusIcon status={item.status} />
          </span>
          <span className="min-w-0 flex-1 truncate">{item.title}</span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {uncertain ? '状态待确认' : labels[item.status]}
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">
        {item.title}
        {uncertain ? ' · 无法确认远程运行状态' : ` · ${labels[item.status]}`}
      </TooltipContent>
    </Tooltip>
  )
}

export function WorktreeCardTasks({
  projectId,
  workspaceId
}: {
  projectId: string
  workspaceId: string
}): React.JSX.Element | null {
  const catalog = useContext(LocalTaskCatalogContext)
  const [expanded, setExpanded] = useState(false)
  const [completedOpen, setCompletedOpen] = useState(false)
  const items = catalog?.byWorkspace.get(localTaskWorkspaceKey(projectId, workspaceId)) ?? []
  if (!catalog) {
    return null
  }
  const loadError = catalog.loadError === '任务已删除' ? null : catalog.loadError
  if (items.length === 0 && !loadError) {
    return null
  }
  const active = items.filter((item) => item.status !== 'Done')
  const completed = items.filter((item) => item.status === 'Done')
  return (
    <div
      className="min-w-0 pl-3"
      aria-label="工作区任务"
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onDragStart={(event) => {
        event.preventDefault()
        event.stopPropagation()
      }}
    >
      {loadError ? (
        <button
          type="button"
          className="text-xs text-destructive"
          title={loadError}
          onClick={() => void catalog.loadTasks()}
        >
          任务加载失败，点击重试
        </button>
      ) : null}
      {(expanded ? active : active.slice(0, 5)).map((item) => (
        <TaskRow key={item.id} item={item} />
      ))}
      {active.length > 5 ? (
        <Button variant="ghost" size="xs" onClick={() => setExpanded(!expanded)}>
          {expanded ? '收起任务' : `显示其余 ${active.length - 5} 个任务`}
        </Button>
      ) : null}
      {completed.length > 0 ? (
        <>
          <Button
            variant="ghost"
            size="xs"
            className="text-muted-foreground"
            aria-expanded={completedOpen}
            onClick={() => setCompletedOpen(!completedOpen)}
          >
            <ChevronRight className={completedOpen ? 'size-3 rotate-90' : 'size-3'} />
            已完成任务（{completed.length}）
          </Button>
          {completedOpen ? completed.map((item) => <TaskRow key={item.id} item={item} />) : null}
        </>
      ) : null}
    </div>
  )
}
