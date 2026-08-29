import { describe, expect, it } from 'vitest'
import type { LocalTask } from './local-task-types'
import { selectAllLocalProjectOpenTasks } from './local-task-automation-scope'

const task = (overrides: Partial<LocalTask> = {}): LocalTask =>
  ({
    schemaVersion: 1,
    id: 'lt-1',
    projectId: 'repo-local',
    projectPath: '/repos/local',
    title: 'Task',
    description: 'Description',
    status: 'Open',
    workspaceId: 'repo-local::/repos/local',
    workspaceLabel: 'local',
    createdAt: 1,
    updatedAt: 1,
    archivedAt: null,
    titleSource: 'user',
    titleSuggestion: null,
    labels: [],
    intakeState: 'ready',
    agentId: null,
    executionState: 'idle',
    executionBatchId: null,
    executionRunId: null,
    reviewKind: null,
    reviewQuestion: null,
    runs: [],
    subtasks: [],
    sessions: [],
    latestOutput: null,
    latestOutputSource: 'report',
    ...overrides
  }) as LocalTask

describe('all-local-project automation scope', () => {
  it('keeps local ready Open tasks, including project HEAD tasks', () => {
    expect(
      selectAllLocalProjectOpenTasks(
        [
          task(),
          task({ updatedAt: 2 }),
          task({ id: 'lt-inbox', intakeState: 'inbox' }),
          task({ id: 'lt-running', executionState: 'running' }),
          task({ id: 'lt-no-workspace', workspaceId: 'local' }),
          task({ id: 'lt-empty-workspace', workspaceId: '' }),
          task({ id: 'lt-remote', projectId: 'repo-remote' })
        ],
        new Set(['repo-local']),
        new Set(['repo-local::/repos/local'])
      )
    ).toEqual([task({ updatedAt: 2 }), task({ id: 'lt-no-workspace', workspaceId: 'local' })])
  })
})
