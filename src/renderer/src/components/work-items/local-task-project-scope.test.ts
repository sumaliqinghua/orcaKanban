import { describe, expect, it } from 'vitest'
import {
  buildLocalTaskProjectOptions,
  collectLocalTaskProjectRoots,
  loadKanbanAiRecordsForProjectScope,
  mergeLocalTasksById
} from './local-task-project-scope'
import type { KanbanAiRecord } from '../../../../shared/kanban-ai-record'

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

  it('loads AI records across roots, keeps the newest duplicate and tolerates one failed root', async () => {
    const record = (id: string, createdAt: number): KanbanAiRecord => ({
      schemaVersion: 1,
      id,
      kind: 'status_report',
      seriesKey: 'status_report:orca',
      createdAt,
      source: { automationId: null, automationRunId: null, agentId: null },
      target: {
        projectId: 'orca',
        projectPath: '/repos/orca',
        workspaceId: null,
        taskId: null
      },
      title: '状态汇报',
      summary: '本轮摘要',
      body: { format: 'markdown', content: '## 已完成' },
      basis: { gitHead: 'abc' },
      inputFingerprint: `sha256:${'a'.repeat(64)}`,
      readAt: null
    })
    const result = await loadKanbanAiRecordsForProjectScope(
      [
        { projectId: 'orca', projectPath: '/repos/orca' },
        { projectId: 'orca', projectPath: '/worktrees/orca' },
        { projectId: 'other', projectPath: '/repos/other' }
      ],
      async ({ projectPath }) => {
        if (projectPath === '/repos/other') {
          throw new Error('unavailable')
        }
        return projectPath === '/repos/orca'
          ? [record('air_duplicate', 1)]
          : [record('air_duplicate', 3), record('air_second', 2)]
      }
    )

    expect(result.map(({ id, createdAt }) => ({ id, createdAt }))).toEqual([
      { id: 'air_duplicate', createdAt: 3 },
      { id: 'air_second', createdAt: 2 }
    ])
  })
})
