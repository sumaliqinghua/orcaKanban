import { describe, expect, it } from 'vitest'
import type { LocalTask } from '../../../../shared/local-task-types'
import {
  collectLiveTaskSessionIds,
  localTaskToViewModel,
  reconcileWorkItemSessionLiveness
} from './local-task-view-model'
import type { WorkItem } from './mock-data'

const NOW = 100_000

function item(updatedAt: number): WorkItem {
  return {
    id: 'task-1',
    title: '任务',
    description: '描述',
    status: 'In progress',
    workspace: 'workspace',
    project: 'project',
    updated: 'now',
    sessions: 1,
    activeSessions: 1,
    subtasks: [],
    latestOutput: { session: 'none', text: 'none' },
    sessionsList: [
      {
        id: 'session-1',
        title: '会话',
        status: 'working',
        time: 'now',
        updatedAt
      }
    ]
  }
}

describe('local task live session reconciliation', () => {
  it('does not classify an idle shell or a completed dashboard card as working', () => {
    const cards = [{ tabId: 'session-1', dotState: 'done' as const }]
    const ids = collectLiveTaskSessionIds(cards)
    expect(ids.has('session-1')).toBe(false)
    expect(ids.has('shell')).toBe(false)
  })
  it('requires agent activity rather than terminal existence', () => {
    expect(collectLiveTaskSessionIds([])).toEqual(new Set())
    expect(
      collectLiveTaskSessionIds([
        { tabId: 'working', dotState: 'working' },
        { tabId: 'idle', dotState: 'idle' }
      ])
    ).toEqual(new Set(['working']))
  })

  it('keeps missing remote evidence unverifiable rather than declaring completion', () => {
    const result = reconcileWorkItemSessionLiveness(item(NOW - 60_000), new Set(), NOW, {
      unverifiable: true
    })
    expect(result.sessionsList[0]).toMatchObject({ status: 'idle', livenessUnverifiable: true })
    expect(result.activeSessions).toBe(0)
    expect(result.status).toBe('In progress')
    const reconnected = reconcileWorkItemSessionLiveness(
      result,
      new Set(['session-1']),
      NOW + 1_000,
      {
        dashboardCards: [{ tabId: 'session-1', dotState: 'working' }]
      }
    )
    expect(reconnected.sessionsList[0]?.livenessUnverifiable).toBe(false)
    expect(reconnected.activeSessions).toBe(1)
  })

  it('lets an explicit completed card override the startup grace period', () => {
    const result = reconcileWorkItemSessionLiveness(item(NOW - 1_000), new Set(), NOW, {
      dashboardCards: [{ tabId: 'session-1', dotState: 'done' }]
    })
    expect(result.sessionsList[0]?.status).toBe('done')
  })

  it('reflects new work even when persisted history still says done', () => {
    const source = item(NOW - 60_000)
    source.status = 'Needs review'
    source.activeSessions = 0
    source.sessionsList[0]!.status = 'done'
    const result = reconcileWorkItemSessionLiveness(source, new Set(['session-1']), NOW, {
      dashboardCards: [{ tabId: 'session-1', dotState: 'working' }]
    })
    expect(result.sessionsList[0]?.status).toBe('working')
    expect(result.status).toBe('In progress')
    expect(result.activeSessions).toBe(1)
    const completed = reconcileWorkItemSessionLiveness(result, new Set(), NOW + 1_000, {
      dashboardCards: [{ tabId: 'session-1', dotState: 'done' }]
    })
    expect(completed.status).toBe('Needs review')
    expect(completed.activeSessions).toBe(0)
  })

  it('does not borrow working status from another conversation in the same tab', () => {
    const result = reconcileWorkItemSessionLiveness(
      item(NOW - 60_000),
      new Set(['session-1']),
      NOW,
      {
        dashboardCards: [{ tabId: 'session-1', dotState: 'working', paneKey: 'other' }],
        matchesSession: (_session, paneKey) => !paneKey
      }
    )
    expect(result.sessionsList[0]?.status).toBe('done')
  })

  it('keeps a dashboard-visible session running', () => {
    const result = reconcileWorkItemSessionLiveness(item(NOW - 60_000), new Set(['session-1']), NOW)
    expect(result.status).toBe('In progress')
    expect(result.activeSessions).toBe(1)
  })

  it('uses the restored terminal tab when reconciling a stable session', () => {
    const source = item(NOW - 60_000)
    source.sessionsList[0]!.tabId = 'restored-tab'
    const result = reconcileWorkItemSessionLiveness(source, new Set(['restored-tab']), NOW)
    expect(result.status).toBe('In progress')
    expect(result.activeSessions).toBe(1)
  })

  it('keeps running while another associated session awaits review', () => {
    const source = item(NOW - 60_000)
    source.sessionsList.push({ id: 'ended', title: '已结束', status: 'done', time: 'now' })
    const result = reconcileWorkItemSessionLiveness(source, new Set(['session-1']), NOW)
    expect(result.status).toBe('In progress')
    expect(result.activeSessions).toBe(1)
  })

  it('keeps a newly created session running during its startup grace period', () => {
    const result = reconcileWorkItemSessionLiveness(item(NOW - 1_000), new Set(), NOW)
    expect(result.status).toBe('In progress')
  })

  it('marks a stale file-only working session ready for review', () => {
    const result = reconcileWorkItemSessionLiveness(item(NOW - 60_000), new Set(), NOW)
    expect(result.status).toBe('Needs review')
    expect(result.activeSessions).toBe(0)
    expect(result.sessionsList[0]?.status).toBe('done')
  })

  it('does not count report sessions as execution activity', () => {
    const source = item(NOW - 60_000)
    source.sessions = 1
    source.activeSessions = 1
    source.sessionsList.push({
      id: 'report-1',
      title: '任务报告',
      associationSource: 'task-report',
      status: 'working',
      time: 'now',
      updatedAt: NOW - 60_000
    })

    const result = reconcileWorkItemSessionLiveness(source, new Set(['session-1', 'report-1']), NOW)

    expect(result.sessions).toBe(1)
    expect(result.activeSessions).toBe(1)
    expect(result.status).toBe('In progress')
  })
})

describe('local task view model status', () => {
  it('preserves Done after an execution session has ended', () => {
    const task = {
      schemaVersion: 1,
      id: 'task-1',
      projectId: 'project',
      projectPath: '/tmp/project',
      title: '任务',
      description: '描述',
      status: 'Done',
      workspaceId: 'workspace',
      workspaceLabel: 'workspace',
      createdAt: NOW - 120_000,
      updatedAt: NOW,
      archivedAt: null,
      titleSource: 'user',
      titleSuggestion: null,
      labels: [],
      intakeState: 'ready',
      agentId: null,
      executionState: 'idle',
      executionBatchId: null,
      executionRunId: null,
      clarificationRequested: false,
      clarificationSessionId: null,
      runs: [],
      subtasks: [],
      sessions: [
        {
          id: 'session-1',
          taskId: 'task-1',
          workspaceId: 'workspace',
          title: '会话',
          currentPrompt: null,
          turns: [],
          status: 'done',
          latestOutput: '已完成',
          createdAt: NOW - 60_000,
          updatedAt: NOW,
          agentId: null,
          associationSource: 'task-center'
        }
      ],
      latestOutput: { sessionId: 'session-1', text: '已完成', updatedAt: NOW },
      latestOutputSource: 'report'
    } satisfies LocalTask

    expect(localTaskToViewModel(task).status).toBe('Done')
  })
})
