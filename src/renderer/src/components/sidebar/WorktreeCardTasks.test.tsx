// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { LocalTask } from '../../../../shared/local-task-types'
import { useAppStore } from '@/store'
import { TooltipProvider } from '@/components/ui/tooltip'
import { LocalTaskCatalogProvider } from '../work-items/LocalTaskCatalogProvider'
import { useLocalTaskCenterData } from '../work-items/use-local-task-center-data'
import { useLocalTaskNavigation } from '../work-items/local-task-navigation'
import type { WorkItem } from '../work-items/mock-data'
import { WorktreeCardTasks } from './WorktreeCardTasks'

vi.mock('@/store', async () => {
  const { create } = await import('zustand')
  return {
    useAppStore: create(() => ({
      activeView: 'terminal',
      sidebarWorkspaceContent: 'tasks',
      openWorkItemsPage: vi.fn()
    }))
  }
})
vi.mock('../work-items/use-local-task-session-liveness', () => ({
  useLocalTaskSessionLiveness: (items: WorkItem[]) => items
}))
vi.mock('../work-items/work-item-pieces', () => ({ StatusIcon: () => <span aria-hidden="true" /> }))

let changed: (task: LocalTask) => void
let deleted: (deletion: { taskId: string; projectPath: string }) => void
const list = vi.fn()
const unsubscribe = vi.fn()
const onChanged = vi.fn((callback: typeof changed) => {
  changed = callback
  return unsubscribe
})
const onDeleted = vi.fn((callback: typeof deleted) => {
  deleted = callback
  return unsubscribe
})
function task(id: string, overrides: Partial<LocalTask> = {}): LocalTask {
  return {
    id,
    title: id,
    description: '',
    projectId: 'repo-1',
    projectPath: '/project',
    workspaceId: 'folder-1',
    workspaceLabel: 'dev',
    status: 'Open',
    intakeState: 'ready',
    archivedAt: null,
    updatedAt: 1,
    labels: [],
    sessions: [],
    subtasks: [],
    runs: [],
    latestOutput: null,
    ...overrides
  } as LocalTask
}
beforeEach(() => {
  list.mockReset().mockResolvedValue([task('任务 A')])
  onChanged.mockClear()
  onDeleted.mockClear()
  unsubscribe.mockClear()
  useLocalTaskNavigation.getState().clear()
  useAppStore.setState({ activeView: 'terminal', sidebarWorkspaceContent: 'tasks' })
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: { localTasks: { list, onChanged, onDeleted } }
  })
})
afterEach(cleanup)

function CenterProbe() {
  const { effectiveItems } = useLocalTaskCenterData('all', [])
  return (
    <output data-testid="center">
      {effectiveItems.map((item) => `${item.title}:${item.status}`).join(',')}
    </output>
  )
}
function fixture(withCenter = false) {
  return render(
    <TooltipProvider>
      <LocalTaskCatalogProvider>
        <WorktreeCardTasks projectId="repo-1" workspaceId="folder-1" />
        <WorktreeCardTasks projectId="repo-2" workspaceId="folder-1" />
        {withCenter ? <CenterProbe /> : null}
      </LocalTaskCatalogProvider>
    </TooltipProvider>
  )
}
it('shares one list and subscription with the task center and keeps folder ownership', async () => {
  list.mockResolvedValue([task('任务 A'), task('其他项目', { projectId: 'repo-2' })])
  fixture(true)
  await screen.findByRole('button', { name: /任务 A/ })
  const groups = screen.getAllByLabelText('工作区任务')
  expect(groups[0]).toHaveTextContent('任务 A')
  expect(groups[0]).not.toHaveTextContent('其他项目')
  expect(groups[1]).toHaveTextContent('其他项目')
  expect(list).toHaveBeenCalledTimes(1)
  expect(list).toHaveBeenCalledWith({ includeArchived: true })
  expect(onChanged).toHaveBeenCalledTimes(1)
  act(() => changed(task('任务 A', { title: '新名称', status: 'Needs review' })))
  expect(screen.getByRole('button', { name: /新名称/ })).toHaveTextContent('待审阅')
  expect(screen.getByTestId('center')).toHaveTextContent('新名称:Needs review')
  act(() => deleted({ taskId: '任务 A', projectPath: '/project' }))
  expect(screen.queryByRole('button', { name: /新名称/ })).not.toBeInTheDocument()
})
it('excludes inbox, archived and unassigned tasks and folds completed tasks', async () => {
  list.mockResolvedValue([
    task('收件箱', { intakeState: 'inbox' }),
    task('归档', { archivedAt: 1 }),
    task('无工作区', { workspaceId: '' }),
    task('已完成条目', { status: 'Done' }),
    task('任务 A')
  ])
  fixture()
  await screen.findByRole('button', { name: /任务 A/ })
  for (const name of ['收件箱', '归档', '无工作区', '已完成条目']) {
    expect(screen.queryByRole('button', { name: new RegExp(name) })).not.toBeInTheDocument()
  }
  fireEvent.click(screen.getByRole('button', { name: '已完成任务（1）' }))
  expect(screen.getByRole('button', { name: /已完成条目/ })).toBeVisible()
})
it('opens the exact task without bubbling into workspace activation', async () => {
  const activate = vi.fn()
  render(
    <TooltipProvider>
      <LocalTaskCatalogProvider>
        <div onClick={activate}>
          <WorktreeCardTasks projectId="repo-1" workspaceId="folder-1" />
        </div>
      </LocalTaskCatalogProvider>
    </TooltipProvider>
  )
  fireEvent.click(await screen.findByRole('button', { name: /任务 A/ }))
  expect(activate).not.toHaveBeenCalled()
  expect(useAppStore.getState().openWorkItemsPage).toHaveBeenCalled()
  expect(useLocalTaskNavigation.getState().target).toMatchObject({
    id: '任务 A',
    project: 'repo-1',
    projectPath: '/project'
  })
})
it('does not load until tasks are requested and retains events after switching away', async () => {
  useAppStore.setState({ sidebarWorkspaceContent: 'sessions' })
  fixture()
  expect(list).not.toHaveBeenCalled()
  act(() => useAppStore.setState({ sidebarWorkspaceContent: 'tasks' }))
  await screen.findByRole('button', { name: /任务 A/ })
  act(() => useAppStore.setState({ sidebarWorkspaceContent: 'sessions' }))
  expect(unsubscribe).not.toHaveBeenCalled()
  act(() => deleted({ taskId: '任务 A', projectPath: '/project' }))
  act(() => useAppStore.setState({ sidebarWorkspaceContent: 'tasks' }))
  expect(screen.queryByRole('button', { name: /任务 A/ })).not.toBeInTheDocument()
  await waitFor(() => expect(list).toHaveBeenCalledTimes(1))
})

it('shows recently updated tasks first and expands the remaining active tasks', async () => {
  list.mockResolvedValue(
    Array.from({ length: 7 }, (_, index) => task(`条目 ${index}`, { updatedAt: index }))
  )
  fixture()
  await screen.findByRole('button', { name: /条目 6/ })
  expect(screen.queryByRole('button', { name: /条目 0/ })).not.toBeInTheDocument()
  const rows = screen.getAllByRole('button', { name: /条目/ })
  expect(rows[0]).toHaveTextContent('条目 6')
  fireEvent.click(screen.getByRole('button', { name: '显示其余 2 个任务' }))
  expect(screen.getByRole('button', { name: /条目 0/ })).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: '收起任务' }))
  expect(screen.queryByRole('button', { name: /条目 0/ })).not.toBeInTheDocument()
})

it('renders no placeholder or task container for an empty workspace', async () => {
  list.mockResolvedValue([task('其他项目', { projectId: 'repo-2' })])
  fixture()
  await screen.findByRole('button', { name: /其他项目/ })
  expect(screen.queryByText('暂无可执行任务')).not.toBeInTheDocument()
  expect(screen.getAllByLabelText('工作区任务')).toHaveLength(1)
})
