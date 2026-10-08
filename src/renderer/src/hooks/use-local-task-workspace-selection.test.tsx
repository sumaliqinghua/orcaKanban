import { useLocalTaskComposer } from './useLocalTaskComposer'
import type { ComposerCardProps } from './useComposerState'
// @vitest-environment happy-dom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import { useLocalTaskWorkspaceSelection } from './use-local-task-workspace-selection'
import type { Worktree } from '../../../shared/worktree/types'
import type { FolderWorkspace } from '../../../shared/folder-workspace-types'

vi.mock('@/lib/launch-agent-background-session', () => ({ launchAgentBackgroundSession: vi.fn() }))
vi.mock('@/store', async () => {
  const { create } = await import('zustand')
  return {
    useAppStore: create(() => ({
      activeWorktreeId: 'active',
      worktreesByRepo: {},
      folderWorkspaces: []
    }))
  }
})
const main = { id: 'active', repoId: 'repo', isMainWorktree: true } as Worktree
const target = { id: 'clicked', repoId: 'repo' } as Worktree
beforeEach(() =>
  useAppStore.setState({ worktreesByRepo: { repo: [main, target] }, folderWorkspaces: [] })
)
afterEach(cleanup)
it('preselects the clicked non-main workspace and retains user selection', () => {
  const { result } = renderHook(() =>
    useLocalTaskWorkspaceSelection(
      { repoId: 'repo', selectedProjectId: 'repo' },
      { initialRepoId: 'repo', initialTaskWorkspaceId: 'clicked' },
      false
    )
  )
  expect(result.current.selectedWorkspaceId).toBe('clicked')
  act(() => result.current.setSelectedWorkspaceId('active'))
  expect(result.current.selectedWorkspaceId).toBe('active')
})
it('does not silently replace an unavailable explicit target', () => {
  const { result } = renderHook(() =>
    useLocalTaskWorkspaceSelection(
      { repoId: 'repo', selectedProjectId: 'repo' },
      { initialRepoId: 'repo', initialTaskWorkspaceId: 'missing' },
      false
    )
  )
  expect(result.current.selectedWorkspaceId).toBe('missing')
})
it('uses the existing default selection when no explicit target was given', () => {
  const { result } = renderHook(() =>
    useLocalTaskWorkspaceSelection({ repoId: 'repo', selectedProjectId: 'repo' }, {}, false)
  )
  expect(result.current.selectedWorkspaceId).toBe('active')
})
it('includes ordinary folder workspaces under their selected project group', () => {
  useAppStore.setState({
    folderWorkspaces: [
      { id: 'folder', projectGroupId: 'group', name: 'folder', folderPath: '/folder' }
    ] as FolderWorkspace[]
  })
  const { result } = renderHook(() =>
    useLocalTaskWorkspaceSelection(
      { repoId: '', selectedProjectId: 'project-group:group' },
      {},
      false
    )
  )
  expect(result.current.taskProjectId).toBe('folder-workspace:group')
  expect(result.current.taskWorkspaces).toHaveLength(1)
  expect(result.current.selectedWorkspaceId).toBe(result.current.taskWorkspaces[0].id)
})

it('creates in the explicit remote workspace even when the active execution host is local', async () => {
  const remote = {
    ...target,
    hostId: 'ssh:remote',
    path: '/remote/target',
    displayName: 'clicked',
    branch: 'dev'
  } as Worktree
  useAppStore.setState({
    worktreesByRepo: { repo: [main, remote] },
    activeWorkspaceExecutionHostId: 'local'
  })
  const create = vi.fn().mockResolvedValue({ clarificationRequested: false })
  Object.defineProperty(window, 'api', { configurable: true, value: { localTasks: { create } } })
  const onClose = vi.fn()
  const { result } = renderHook(() =>
    useLocalTaskComposer({
      modalData: {
        initialRepoId: 'repo',
        initialTaskWorkspaceId: 'clicked',
        initialTaskWorkspaceHostId: 'ssh:remote'
      },
      cardProps: {
        repoId: 'repo',
        selectedProjectId: 'repo',
        selectedRepoPath: '/wrong-active'
      } as ComposerCardProps,
      creatingWorkspace: false,
      onClose
    })
  )
  act(() => result.current.setTaskDescription('创建目标任务'))
  act(() => result.current.createTaskDirectly())
  await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
  expect(create).toHaveBeenCalledWith(
    expect.objectContaining({
      projectId: 'repo',
      workspaceId: 'clicked',
      projectPath: '/remote/target'
    })
  )
})
it('refuses creation when the explicit target cannot be verified on its host', () => {
  const create = vi.fn()
  Object.defineProperty(window, 'api', { configurable: true, value: { localTasks: { create } } })
  const { result } = renderHook(() =>
    useLocalTaskComposer({
      modalData: {
        initialRepoId: 'repo',
        initialTaskWorkspaceId: 'clicked',
        initialTaskWorkspaceHostId: 'ssh:missing'
      },
      cardProps: { repoId: 'repo', selectedProjectId: 'repo' } as ComposerCardProps,
      creatingWorkspace: false,
      onClose: vi.fn()
    })
  )
  act(() => result.current.setTaskDescription('不要创建到别处'))
  act(() => result.current.createTaskDirectly())
  expect(create).not.toHaveBeenCalled()
  expect(result.current.taskError).toBe('所选工作区已不可用，请重新选择')
})
