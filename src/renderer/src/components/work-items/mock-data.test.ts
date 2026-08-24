import { describe, expect, it } from 'vitest'
import { getTaskPerspectiveStatus, type WorkItem } from './mock-data'

const item = (
  status: WorkItem['status'],
  subtaskStatus?: WorkItem['subtasks'][number]['status']
): WorkItem => ({
  id: 'task-1',
  title: '任务',
  description: '描述',
  status,
  workspace: 'workspace',
  project: 'project',
  updated: 'now',
  sessions: 0,
  activeSessions: 0,
  subtasks: subtaskStatus
    ? [{ id: 'subtask-1', title: '子任务', status: subtaskStatus, session: 'session', steps: [] }]
    : [],
  latestOutput: { session: 'none', text: 'none' },
  sessionsList: []
})

describe('getTaskPerspectiveStatus', () => {
  it('maps the latest completed subtask to Needs review instead of Done', () => {
    expect(getTaskPerspectiveStatus(item('Done', 'done'))).toBe('Needs review')
  })

  it('keeps task-level Waiting when no subtask is currently actionable', () => {
    expect(getTaskPerspectiveStatus(item('Waiting', 'done'))).toBe('Waiting')
  })

  it('uses the task status when no subtask exists', () => {
    expect(getTaskPerspectiveStatus(item('Done'))).toBe('Done')
  })
})
