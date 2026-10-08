import { beforeEach, expect, it, vi } from 'vitest'
import { openLocalTaskComposer } from './open-local-task-composer'

const state = vi.hoisted(() => ({
  openWorkItemsPage: vi.fn(),
  openModal: vi.fn(),
  folderWorkspaces: [] as { id: string; projectGroupId: string }[]
}))
vi.mock('@/store', () => ({ useAppStore: { getState: () => state } }))
beforeEach(() => {
  state.openWorkItemsPage.mockClear()
  state.openModal.mockClear()
  state.folderWorkspaces = []
})
it('opens the existing task modal with the right-click target instead of active workspace', () => {
  openLocalTaskComposer('repo-B', { id: 'ws-B', repoId: 'repo-B', hostId: 'ssh:box' })
  expect(state.openWorkItemsPage).toHaveBeenCalledOnce()
  expect(state.openModal).toHaveBeenCalledWith(
    'new-workspace-composer',
    expect.objectContaining({
      localTaskMode: true,
      localTaskWorkspaceMode: 'existing',
      initialRepoId: 'repo-B',
      initialTaskWorkspaceId: 'ws-B',
      initialTaskWorkspaceHostId: 'ssh:box',
      localTaskDraft: expect.objectContaining({ intakeState: 'ready', description: '' })
    })
  )
  expect(state.openWorkItemsPage.mock.invocationCallOrder[0]).toBeLessThan(
    state.openModal.mock.invocationCallOrder[0]
  )
})
it('keeps the existing project-only task center entry usable', () => {
  openLocalTaskComposer('repo-A')
  expect(state.openModal.mock.calls[0][1]).toMatchObject({ initialRepoId: 'repo-A' })
  expect(state.openModal.mock.calls[0][1]).not.toHaveProperty('initialTaskWorkspaceId')
})
