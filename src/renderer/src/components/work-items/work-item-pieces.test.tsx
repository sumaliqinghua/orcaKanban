// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { LocalTaskActions } from './work-item-pieces'
import type { WorkItem } from './mock-data'

function item(intakeState: WorkItem['intakeState']): WorkItem {
  return {
    id: 'task-1',
    title: '任务标题',
    description: '描述',
    status: 'Open',
    workspace: 'workspace',
    project: 'project',
    updated: 'now',
    sessions: 0,
    activeSessions: 0,
    subtasks: [],
    latestOutput: { session: 'none', text: 'none' },
    sessionsList: [],
    intakeState
  }
}

afterEach(() => cleanup())

describe('local task bottom actions', () => {
  it('offers moving a ready task to the inbox', () => {
    const onMoveToInbox = vi.fn()
    render(
      <LocalTaskActions
        item={item('ready')}
        onAccept={() => {}}
        onArchive={() => {}}
        onPromote={() => {}}
        onMoveToInbox={onMoveToInbox}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: '移至收件箱' }))

    expect(onMoveToInbox).toHaveBeenCalledOnce()
  })
})
