import { useState } from 'react'
// @vitest-environment happy-dom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import {
  LocalTaskCatalogContext,
  type LocalTaskCatalog
} from '../work-items/local-task-catalog-context'
import type { WorkItem } from '../work-items/mock-data'
import type { Repo } from '../../../../shared/repo-types'
import type { ProjectGroup } from '../../../../shared/project-group-types'
import type { FolderWorkspace } from '../../../../shared/folder-workspace-types'
import { getEmptyTaskProjectKeys, useTaskProjectCollapse } from './use-task-project-collapse'
import { useAppStore } from '@/store'

vi.mock('@/store', async () => {
  const { create } = await import('zustand')
  return { useAppStore: create(() => ({ sidebarWorkspaceContent: 'tasks' })) }
})
afterEach(cleanup)
const scope = {
  repoMap: new Map([
    ['one', { id: 'one' } as Repo],
    ['two', { id: 'two' } as Repo]
  ]),
  projectGrouping: { projects: [], projectHostSetups: [] },
  projectGroups: [],
  folderWorkspaces: []
}
const task = (project: string, overrides: Partial<WorkItem> = {}): WorkItem =>
  ({
    project,
    workspaceId: 'ws',
    intakeState: 'ready',
    archivedAt: null,
    status: 'Open',
    ...overrides
  }) as WorkItem
it('counts only unfinished ready tasks and keeps project identities separate', () => {
  expect(getEmptyTaskProjectKeys(scope, [task('one'), task('two', { status: 'Done' })])).toEqual(
    new Set(['repo:two'])
  )
  expect(
    getEmptyTaskProjectKeys(scope, [
      task('one', { intakeState: 'inbox' }),
      task('two', { archivedAt: 1 })
    ])
  ).toEqual(new Set(['repo:one', 'repo:two']))
  expect(getEmptyTaskProjectKeys(scope, [task('one', { status: 'Needs review' })])).toEqual(
    new Set(['repo:two'])
  )
})
it('keeps a parent group open for tasks in folder workspaces', () => {
  const folderScope = {
    ...scope,
    repoMap: new Map<string, Repo>(),
    projectGroups: [{ id: 'parent' }, { id: 'child', parentGroupId: 'parent' }] as ProjectGroup[],
    folderWorkspaces: [
      { id: 'f', projectGroupId: 'child', folderPath: '/folder', name: 'folder' }
    ] as FolderWorkspace[]
  }
  expect(getEmptyTaskProjectKeys(folderScope, [])).toEqual(
    new Set(['project-group:child', 'project-group:parent'])
  )
  expect(getEmptyTaskProjectKeys(folderScope, [task('folder-workspace:child')])).toEqual(new Set())
})
it('waits for loading, honors manual opening and restores session-mode preferences', () => {
  let updateCatalog!: React.Dispatch<React.SetStateAction<LocalTaskCatalog>>
  const toggleGroup = vi.fn()
  const base = new Set<string>()
  const Wrapper = ({ children }: { children: React.ReactNode }) => {
    const [value, update] = useState(
      () => ({ loaded: false, effectiveItems: [] }) as unknown as LocalTaskCatalog
    )
    updateCatalog = update
    return (
      <LocalTaskCatalogContext.Provider value={value}>{children}</LocalTaskCatalogContext.Provider>
    )
  }
  const { result, rerender } = renderHook(
    () => useTaskProjectCollapse({ ...scope, collapsedGroups: base, toggleGroup, groupBy: 'repo' }),
    { wrapper: Wrapper }
  )
  expect(result.current.collapsedGroups.size).toBe(0)
  act(() => updateCatalog((current) => ({ ...current, loaded: true })))
  expect(result.current.collapsedGroups.has('repo:one')).toBe(true)
  act(() => result.current.toggleGroup('repo:one'))
  rerender()
  expect(result.current.collapsedGroups.has('repo:one')).toBe(false)
  expect(toggleGroup).not.toHaveBeenCalled()
  act(() => updateCatalog((current) => ({ ...current, effectiveItems: [task('two')] })))
  expect(result.current.collapsedGroups.has('repo:two')).toBe(false)
  act(() => useAppStore.setState({ sidebarWorkspaceContent: 'sessions' }))
  expect(result.current.collapsedGroups).toBe(base)
})
