// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { WorkItem } from './mock-data'
import { isLocalTaskInQueue, LocalTaskQueueTabs } from './LocalTaskQueueTabs'

function item(id: string, archivedAt: number | null, status: WorkItem['status']): WorkItem {
  return {
    id,
    title: id,
    description: id,
    status,
    workspace: 'workspace',
    project: 'project',
    updated: 'now',
    sessions: 0,
    activeSessions: 0,
    subtasks: [],
    latestOutput: { session: 'none', text: 'none' },
    sessionsList: [],
    archivedAt,
    intakeState: 'ready'
  }
}

afterEach(() => cleanup())

describe('local task queue tabs', () => {
  it('keeps archived tasks out of active queues and includes them in archived', () => {
    const active = item('active', null, 'Needs review')
    const archived = item('archived', 1, 'Needs review')

    expect(isLocalTaskInQueue(active, 'all')).toBe(true)
    expect(isLocalTaskInQueue(archived, 'all')).toBe(false)
    expect(isLocalTaskInQueue(archived, 'review')).toBe(false)
    expect(isLocalTaskInQueue(archived, 'archived')).toBe(true)
  })

  it('shows separate active and archived counts', () => {
    render(
      <LocalTaskQueueTabs
        items={[item('active', null, 'Open'), item('archived', 1, 'Done')]}
        aiRecordUnreadCount={3}
        value="archived"
        onChange={() => {}}
      />
    )

    expect(screen.getByRole('button', { name: '全部 1' })).toBeVisible()
    expect(screen.getByRole('button', { name: '已归档 1' })).toBeVisible()
  })
})
