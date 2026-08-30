// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest'
import type { LocalTask } from '../../../../shared/local-task-types'
import { createLocalTaskCenterActions } from './local-task-center-actions'
import type { WorkItem } from './mock-data'

const { getState, activateWorktreeFromSidebar } = vi.hoisted(() => ({
  getState: vi.fn(() => ({})),
  activateWorktreeFromSidebar: vi.fn()
}))
vi.mock('@/store', () => ({ useAppStore: { getState } }))
vi.mock('@/lib/sidebar-worktree-activation', () => ({ activateWorktreeFromSidebar }))

const localTaskApi = { update: vi.fn() }
Object.defineProperty(window, 'api', {
  configurable: true,
  value: { localTasks: localTaskApi }
})

function selected(): WorkItem {
  return {
    id: 'task-1',
    title: '任务标题',
    description: '原描述',
    status: 'Open',
    workspace: 'workspace',
    projectPath: '/tmp/project',
    project: 'project',
    updated: 'now',
    sessions: 0,
    activeSessions: 0,
    subtasks: [],
    latestOutput: { session: 'none', text: 'none' },
    sessionsList: [],
    intakeState: 'ready'
  }
}

afterEach(() => vi.clearAllMocks())

describe('local task center description action', () => {
  it('persists a changed description through the local task API', () => {
    localTaskApi.update.mockReturnValue(new Promise<LocalTask>(() => {}))
    const actions = createLocalTaskCenterActions({
      selected: selected(),
      setItems: vi.fn(),
      setSelectedId: vi.fn(),
      setLoadError: vi.fn()
    })

    actions.editDescription('  更新后的描述  ')

    expect(localTaskApi.update).toHaveBeenCalledWith({
      taskId: 'task-1',
      updates: { description: '更新后的描述' }
    })
  })

  it('moves a ready task to the inbox through the local task API', () => {
    localTaskApi.update.mockReturnValue(new Promise<LocalTask>(() => {}))
    const actions = createLocalTaskCenterActions({
      selected: selected(),
      setItems: vi.fn(),
      setSelectedId: vi.fn(),
      setLoadError: vi.fn()
    })

    actions.moveSelectedToInbox()

    expect(localTaskApi.update).toHaveBeenCalledWith({
      taskId: 'task-1',
      updates: { intakeState: 'inbox' }
    })
  })

  it('resolves a stale workspace id by the task project path before opening it', async () => {
    const closeWorkItemsPage = vi.fn()
    getState.mockReturnValue({
      activeWorktreeId: null,
      getKnownWorktreeById: () => undefined,
      allWorktrees: () => [{ id: 'repo::/tmp/project', path: '/tmp/project' }],
      closeWorkItemsPage
    })
    activateWorktreeFromSidebar.mockResolvedValue(undefined)
    const actions = createLocalTaskCenterActions({
      selected: { ...selected(), workspaceId: 'stale-workspace' },
      setItems: vi.fn(),
      setSelectedId: vi.fn(),
      setLoadError: vi.fn()
    })

    actions.openWorkspace()
    await Promise.resolve()

    expect(activateWorktreeFromSidebar).toHaveBeenCalledWith('repo::/tmp/project')
    expect(closeWorkItemsPage).toHaveBeenCalledOnce()
  })

  it('keeps the task center open when workspace activation fails', async () => {
    const closeWorkItemsPage = vi.fn()
    const setLoadError = vi.fn()
    getState.mockReturnValue({
      activeWorktreeId: null,
      getKnownWorktreeById: () => ({ id: 'repo::/tmp/project' }),
      allWorktrees: () => [],
      closeWorkItemsPage
    })
    activateWorktreeFromSidebar.mockResolvedValue(false)
    const actions = createLocalTaskCenterActions({
      selected: { ...selected(), workspaceId: 'repo::/tmp/project' },
      setItems: vi.fn(),
      setSelectedId: vi.fn(),
      setLoadError
    })

    actions.openWorkspace()
    await Promise.resolve()

    expect(closeWorkItemsPage).not.toHaveBeenCalled()
    expect(setLoadError).toHaveBeenCalledWith('当前任务的 workspace 不可用')
  })
})
