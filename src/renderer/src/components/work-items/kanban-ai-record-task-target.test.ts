import { describe, expect, it } from 'vitest'
import type { KanbanAiRecord } from '../../../../shared/kanban-ai-record'
import { findKanbanAiRecordTask } from './kanban-ai-record-task-target'

function record(taskId: string | null, projectId = 'project-1'): KanbanAiRecord {
  return {
    schemaVersion: 1,
    id: 'air_1',
    kind: 'requirement_clarification',
    seriesKey: 'requirement_clarification:lt_1',
    createdAt: 1,
    source: { automationId: null, automationRunId: null, agentId: null },
    target: { projectId, projectPath: '/project', workspaceId: null, taskId },
    title: '澄清',
    summary: '摘要',
    body: { format: 'markdown', content: '## 当前判断' },
    basis: {},
    inputFingerprint: `sha256:${'a'.repeat(64)}`,
    readAt: null
  }
}

describe('Kanban AI record task target', () => {
  const tasks = [
    { id: 'lt_1', project: 'project-1' },
    { id: 'lt_1', project: 'project-2' }
  ]

  it('matches both the project and task identifiers', () => {
    expect(findKanbanAiRecordTask(tasks, record('lt_1', 'project-2'))).toEqual(tasks[1])
  })

  it('does not invent a target for project-only records', () => {
    expect(findKanbanAiRecordTask(tasks, record(null))).toBeNull()
  })
})
