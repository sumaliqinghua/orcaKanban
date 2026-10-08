// @vitest-environment happy-dom
import { act, renderHook, waitFor, cleanup } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { useLocalTaskNavigation } from './local-task-navigation'
import { useLocalTaskNavigationRequest } from './use-local-task-navigation'
import type { WorkItem } from './mock-data'

afterEach(() => {
  cleanup()
  useLocalTaskNavigation.getState().clear()
})
const item = { id: 'A', project: 'repo-A', projectPath: '/a', intakeState: 'ready' } as WorkItem
function harness(items: WorkItem[], loaded = true) {
  const actions = {
    setSelectedId: vi.fn(),
    setDetailOpen: vi.fn(),
    setQueueView: vi.fn(),
    setQuery: vi.fn(),
    setLabelFilter: vi.fn(),
    setTab: vi.fn(),
    setLoadError: vi.fn()
  }
  renderHook(() => {
    const [projectFilter, setProjectFilter] = useState('repo-B')
    useLocalTaskNavigationRequest({
      ...actions,
      projectFilter,
      setProjectFilter,
      items: projectFilter === 'repo-A' ? items : [],
      loaded,
      loading: !loaded
    })
  })
  return actions
}
it('changes the project, clears hidden filters and opens the exact detail', async () => {
  const actions = harness([item])
  act(() => useLocalTaskNavigation.getState().open(item))
  await waitFor(() => expect(actions.setSelectedId).toHaveBeenCalledWith('A'))
  expect(actions.setDetailOpen).toHaveBeenCalledWith(true)
  expect(actions.setQuery).toHaveBeenCalledWith('')
  expect(actions.setLabelFilter).toHaveBeenCalledWith('')
  expect(actions.setQueueView).toHaveBeenCalledWith('ready')
  expect(actions.setTab).toHaveBeenCalledWith('work-items')
  expect(useLocalTaskNavigation.getState().target).toBeNull()
})
it('does not substitute a task with a matching id at another path', async () => {
  const actions = harness([{ ...item, projectPath: '/other' }])
  act(() => useLocalTaskNavigation.getState().open(item))
  await waitFor(() =>
    expect(actions.setLoadError).toHaveBeenCalledWith('目标任务已删除或当前不可访问')
  )
  expect(actions.setDetailOpen).toHaveBeenCalledWith(false)
})
it('keeps navigation pending while the initial list is loading', () => {
  const actions = harness([], false)
  act(() => useLocalTaskNavigation.getState().open(item))
  expect(actions.setLoadError).not.toHaveBeenCalled()
  expect(useLocalTaskNavigation.getState().target?.id).toBe('A')
})
