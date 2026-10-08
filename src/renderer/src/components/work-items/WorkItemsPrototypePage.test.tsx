// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { LocalTask } from '../../../../shared/local-task-types'
import type { WorkItem } from './mock-data'
import WorkItemsPrototypePage from './WorkItemsPrototypePage'

const api = vi.hoisted(() => ({
  list: vi.fn(),
  changed: (_task: LocalTask) => {},
  deleted: (_deletion: { taskId: string; projectPath: string }) => {},
  roots: [{ projectId: 'project', projectPath: '/project' }],
  refresh: () => Promise.resolve()
}))
vi.mock('@/store', () => ({ useAppStore: { getState: () => ({ activeWorktreeId: null }) } }))
vi.mock('./use-local-task-project-scope', () => ({
  useLocalTaskProjectScope: () => ({
    projectRoots: api.roots,
    projectFilter: 'all',
    projectOptions: [],
    createProjectId: 'project',
    setProjectFilter: vi.fn()
  })
}))
vi.mock('./use-local-task-session-liveness', () => ({
  useLocalTaskSessionLiveness: (items: WorkItem[]) => items
}))
vi.mock('./use-local-task-batch-controller', () => ({
  useLocalTaskBatchController: ({ loadTasks }: { loadTasks: () => Promise<void> }) => {
    api.refresh = loadTasks
    return { batchCandidates: [], batchRunning: false, runAllTasks: vi.fn() }
  }
}))
vi.mock('./local-task-center-actions', () => ({ createLocalTaskCenterActions: () => ({}) }))
vi.mock('./use-local-task-center-interactions', () => ({
  useLocalTaskCenterInteractions: () => ({})
}))
vi.mock('./LocalTaskCenterHeader', () => ({ LocalTaskCenterHeader: () => null }))
vi.mock('./KanbanAiRecordsPane', () => ({ KanbanAiRecordsPane: () => null }))
vi.mock('./LocalTaskCenterEmptyState', () => ({ LocalTaskCenterEmptyState: () => <p>空列表</p> }))
vi.mock('./LocalTaskCenterDetail', () => ({
  LocalTaskCenterDetail: ({ item, open }: { item: WorkItem; open: boolean }) =>
    open ? (
      <section aria-label="任务详情">
        <span>{item.title}</span>
        <input aria-label="未保存草稿" defaultValue="" />
      </section>
    ) : null
}))
vi.mock('./work-item-views', () => {
  const View = ({ items, onSelect }: { items: WorkItem[]; onSelect: (id: string) => void }) => (
    <div>
      {items.map((item) => (
        <button key={item.id} onClick={() => onSelect(item.id)}>
          打开 {item.id}
        </button>
      ))}
    </div>
  )
  return { BoardView: View, ListView: View, SubtaskBoardView: View, SubtaskListView: View }
})

function task(id: string, overrides: Partial<LocalTask> = {}): LocalTask {
  return {
    id,
    title: id,
    description: '',
    projectId: 'project',
    projectPath: '/project',
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
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
beforeEach(() => {
  api.list.mockReset().mockResolvedValue([task('A'), task('B')])
  api.roots = [{ projectId: 'project', projectPath: '/project' }]
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: {
      localTasks: {
        list: api.list,
        onChanged: (cb: typeof api.changed) => {
          api.changed = cb
          return vi.fn()
        },
        onDeleted: (cb: typeof api.deleted) => {
          api.deleted = cb
          return vi.fn()
        }
      }
    }
  })
})
afterEach(cleanup)

async function openDetail() {
  const result = render(<WorkItemsPrototypePage />)
  fireEvent.click(await screen.findByRole('button', { name: '打开 A' }))
  const draft = screen.getByRole('textbox', { name: '未保存草稿' })
  fireEvent.change(draft, { target: { value: '正在编辑' } })
  return { ...result, draft }
}

it('keeps the same detail and draft when the task leaves the queue', async () => {
  const { draft } = await openDetail()
  act(() => api.changed(task('A', { intakeState: 'inbox' })))
  expect(screen.getByRole('region', { name: '任务详情' })).toHaveTextContent('A')
  expect(screen.getByRole('textbox', { name: '未保存草稿' })).toBe(draft)
  expect(draft).toHaveValue('正在编辑')
})

it('keeps the mounted detail during refresh and after a refresh failure', async () => {
  const { draft } = await openDetail()
  const pending = deferred<LocalTask[]>()
  api.list.mockReturnValueOnce(pending.promise)
  act(() => {
    void api.refresh()
  })
  expect(screen.getByRole('textbox', { name: '未保存草稿' })).toBe(draft)
  await act(async () => pending.reject(new Error('刷新失败')))
  expect(screen.getByRole('alert')).toHaveTextContent('刷新失败')
  expect(screen.getByRole('textbox', { name: '未保存草稿' })).toBe(draft)
})

it('does not reload for equivalent project directories', async () => {
  const { rerender, draft } = await openDetail()
  api.roots = [{ projectId: 'project', projectPath: '/project' }]
  rerender(<WorkItemsPrototypePage />)
  await waitFor(() => expect(api.list).toHaveBeenCalledTimes(1))
  expect(screen.getByRole('textbox', { name: '未保存草稿' })).toBe(draft)
})

it('does not let a pending list overwrite changes or resurrect deletions', async () => {
  await openDetail()
  const pending = deferred<LocalTask[]>()
  api.list.mockReturnValueOnce(pending.promise)
  act(() => {
    void api.refresh()
  })
  act(() => {
    api.changed(task('A', { title: '新标题', updatedAt: 2 }))
    api.deleted({ taskId: 'B', projectPath: '/project' })
  })
  await act(async () => pending.resolve([task('A'), task('B')]))
  expect(screen.getByRole('region', { name: '任务详情' })).toHaveTextContent('新标题')
  expect(screen.queryByRole('button', { name: '打开 B' })).not.toBeInTheDocument()
})

it('ignores an older refresh finishing after the latest refresh', async () => {
  const { draft } = await openDetail()
  const older = deferred<LocalTask[]>()
  const newer = deferred<LocalTask[]>()
  api.list.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise)
  act(() => {
    void api.refresh()
    void api.refresh()
  })
  await act(async () => newer.resolve([task('A', { title: '最新结果' }), task('B')]))
  await act(async () => older.resolve([task('A', { title: '旧结果' }), task('B')]))
  expect(screen.getByRole('region', { name: '任务详情' })).toHaveTextContent('最新结果')
  expect(screen.getByRole('textbox', { name: '未保存草稿' })).toBe(draft)
})

it('keeps the detail when a refresh temporarily omits its task', async () => {
  const { draft } = await openDetail()
  api.list.mockResolvedValueOnce([task('B')])
  await act(async () => api.refresh())
  expect(screen.getByRole('region', { name: '任务详情' })).toHaveTextContent('A')
  expect(screen.getByRole('textbox', { name: '未保存草稿' })).toBe(draft)
})

it('closes a deleted detail without selecting the next task', async () => {
  await openDetail()
  act(() => api.deleted({ taskId: 'A', projectPath: '/project' }))
  expect(screen.queryByRole('region', { name: '任务详情' })).not.toBeInTheDocument()
  expect(screen.getByRole('alert')).toHaveTextContent('任务已删除')
  expect(screen.getByRole('button', { name: '打开 B' })).toBeVisible()
})

it('does not resurrect a task deleted before the initial list arrives', async () => {
  const initial = deferred<LocalTask[]>()
  api.list.mockReturnValueOnce(initial.promise)
  render(<WorkItemsPrototypePage />)
  act(() => api.deleted({ taskId: 'A', projectPath: '/project' }))
  await act(async () => initial.resolve([task('A'), task('B')]))
  expect(screen.queryByRole('button', { name: '打开 A' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: '打开 B' })).toBeVisible()
})
