import { describe, expect, it } from 'vitest'
import {
  buildLocalTaskProjectOptions,
  collectLocalTaskProjectRoots,
  mergeLocalTasksById
} from './local-task-project-scope'

describe('local task project scope', () => {
  it('lists all registered project and workspace paths for the all-projects view', () => {
    const repos = [
      { id: 'orca', displayName: 'Orca', path: '/repos/orca' },
      { id: 'other', displayName: 'Other', path: '/repos/other' }
    ]
    const worktrees = [
      { repoId: 'orca', path: '/repos/orca' },
      { repoId: 'orca', path: '/worktrees/orca-kanban' },
      { repoId: 'other', path: '/worktrees/other-main' }
    ]

    expect(collectLocalTaskProjectRoots(repos, worktrees, 'all')).toEqual([
      { projectId: 'orca', projectPath: '/repos/orca' },
      { projectId: 'orca', projectPath: '/worktrees/orca-kanban' },
      { projectId: 'other', projectPath: '/repos/other' },
      { projectId: 'other', projectPath: '/worktrees/other-main' }
    ])
  })

  it('limits roots to the selected project', () => {
    expect(
      collectLocalTaskProjectRoots(
        [{ id: 'orca', displayName: 'Orca', path: '/repos/orca' }],
        [
          { repoId: 'orca', path: '/worktrees/orca-kanban' },
          { repoId: 'other', path: '/worktrees/other' }
        ],
        'orca'
      )
    ).toEqual([
      { projectId: 'orca', projectPath: '/repos/orca' },
      { projectId: 'orca', projectPath: '/worktrees/orca-kanban' }
    ])
  })

  it('provides an actionable all-projects option and deduplicates task snapshots', () => {
    expect(
      buildLocalTaskProjectOptions([
        { id: 'orca', displayName: 'Orca', path: '/repos/orca' },
        { id: 'orca', displayName: 'Orca (SSH)', path: '/remote/orca' }
      ])
    ).toEqual([
      { id: 'all', label: '全部项目' },
      { id: 'orca', label: 'Orca' }
    ])

    const first = { id: 'lt_1', updatedAt: 1 }
    const newer = { id: 'lt_1', updatedAt: 2 }
    expect(mergeLocalTasksById([first, newer, { id: 'lt_2', updatedAt: 3 }])).toEqual([
      { id: 'lt_2', updatedAt: 3 },
      newer
    ])
  })
})
