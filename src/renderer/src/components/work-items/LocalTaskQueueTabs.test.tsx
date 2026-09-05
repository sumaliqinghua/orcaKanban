// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { WorkItem } from './mock-data'
import { isLocalTaskInQueue, LocalTaskQueueTabs } from './LocalTaskQueueTabs'

function item(
  id: string,
  archivedAt: number | null,
  status: WorkItem['status'],
  intakeState: WorkItem['intakeState'] = 'ready'
): WorkItem {
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
    intakeState
  }
}

afterEach(() => cleanup())

describe('local task queue tabs', () => {
  it('shows every unarchived ready task in executable regardless of business status', () => {
    const open = item('open', null, 'Open')
    const inProgress = item('in-progress', null, 'In progress')
    const needsReview = item('needs-review', null, 'Needs review')
    const done = item('done', null, 'Done')

    expect(
      [open, inProgress, needsReview, done].every((task) => isLocalTaskInQueue(task, 'ready'))
    ).toBe(true)
  })

  it('keeps inbox and archived tasks out of executable', () => {
    const inbox = item('inbox', null, 'Open', 'inbox')
    const archived = item('archived', 1, 'Needs review')

    expect(isLocalTaskInQueue(inbox, 'ready')).toBe(false)
    expect(isLocalTaskInQueue(inbox, 'inbox')).toBe(true)
    expect(isLocalTaskInQueue(archived, 'ready')).toBe(false)
    expect(isLocalTaskInQueue(archived, 'review')).toBe(false)
    expect(isLocalTaskInQueue(archived, 'archived')).toBe(true)
  })

  it('shows separate executable, inbox, and archived counts', () => {
    render(
      <LocalTaskQueueTabs
        items={[
          item('ready', null, 'Open'),
          item('inbox', null, 'Open', 'inbox'),
          item('archived', 1, 'Done')
        ]}
        aiRecordUnreadCount={3}
        value="archived"
        onChange={() => {}}
      />
    )

    expect(screen.getByRole('button', { name: '可执行 1' })).toBeVisible()
    expect(screen.getByRole('button', { name: '收件箱 1' })).toBeVisible()
    expect(screen.getByRole('button', { name: '已归档 1' })).toBeVisible()
  })
})
