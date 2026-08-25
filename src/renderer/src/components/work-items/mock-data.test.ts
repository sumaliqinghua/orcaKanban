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
  it('maps an in-review task with a completed latest subtask to Needs review', () => {
    expect(getTaskPerspectiveStatus(item('Needs review', 'done'))).toBe('Needs review')
  })

  it('uses the task status when no subtask exists', () => {
    expect(getTaskPerspectiveStatus(item('Done'))).toBe('Done')
  })

  it('keeps an accepted task Done after its latest subtask is done', () => {
    expect(getTaskPerspectiveStatus(item('Done', 'done'))).toBe('Done')
  })
})
