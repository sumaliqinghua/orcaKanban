import { beforeEach, expect, it, vi } from 'vitest'
import { openLocalTaskWorkspace } from './local-task-workspace-navigation'
import type { WorkItem } from './mock-data'

const mocks = vi.hoisted(() => ({ getState: vi.fn(), activate: vi.fn(), focus: vi.fn() }))
vi.mock('@/store', () => ({ useAppStore: { getState: mocks.getState } }))
vi.mock('@/lib/sidebar-worktree-activation', () => ({
  activateWorktreeFromSidebar: mocks.activate
}))
vi.mock('@/lib/activate-tab-and-focus-pane', () => ({ activateTabAndFocusPane: mocks.focus }))

const item = {
  workspaceId: 'workspace',
  sessionsList: [{ id: 'original', tabId: 'restored', workspaceId: 'workspace' }]
} as WorkItem

beforeEach(() => vi.resetAllMocks())

it('focuses the mapped session instead of the workspace active terminal', async () => {
  const setActiveView = vi.fn()
  mocks.getState.mockReturnValue({
    getKnownWorktreeById: () => ({ id: 'workspace' }),
    tabsByWorktree: { workspace: [{ id: 'other' }, { id: 'restored' }] },
    setActiveView
  })
  mocks.activate.mockResolvedValue(true)
  openLocalTaskWorkspace({ item, request: 'original', setLoadError: vi.fn() })
  await Promise.resolve()
  expect(mocks.focus).toHaveBeenCalledWith('restored', null)
  expect(setActiveView).toHaveBeenCalledWith('terminal')
})

it('does not bind a newly seeded unrelated terminal to missing session history', async () => {
  const setActiveView = vi.fn()
  const setLoadError = vi.fn()
  const state = {
    getKnownWorktreeById: () => ({ id: 'workspace' }),
    tabsByWorktree: { workspace: [] as { id: string }[] },
    setActiveView
  }
  mocks.getState.mockReturnValue(state)
  mocks.activate.mockImplementation(async () => {
    state.tabsByWorktree.workspace = [{ id: 'unrelated' }]
    return true
  })
  openLocalTaskWorkspace({ item, request: 'original', setLoadError })
  await Promise.resolve()
  expect(mocks.focus).not.toHaveBeenCalled()
  expect(setActiveView).not.toHaveBeenCalled()
  expect(setLoadError).toHaveBeenCalled()
})

it('恢复后的分屏会话使用已确认的窗格，不使用标签当前的其他窗格', async () => {
  const leafId = '11111111-1111-4111-8111-111111111111'
  const boundItem = {
    ...item,
    sessionsList: [
      {
        ...item.sessionsList[0]!,
        terminalBinding: {
          paneKey: `restored:${leafId}`,
          ptyId: 'pty',
          executionHostId: 'local' as const
        }
      }
    ]
  }
  mocks.getState.mockReturnValue({
    getKnownWorktreeById: () => ({ id: 'workspace' }),
    tabsByWorktree: { workspace: [{ id: 'restored' }] },
    setActiveView: vi.fn()
  })
  mocks.activate.mockResolvedValue(true)
  openLocalTaskWorkspace({ item: boundItem, request: 'original', setLoadError: vi.fn() })
  await Promise.resolve()
  expect(mocks.focus).toHaveBeenCalledWith('restored', leafId)
})
