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
    projectPath: '/tmp/project',
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
        onRestore={() => {}}
        onDelete={() => {}}
        onPromote={() => {}}
        onMoveToInbox={onMoveToInbox}
      />
    )

    const moveButton = screen.getByRole('button', { name: '移至收件箱' })
    expect(moveButton).toBeVisible()
    expect(screen.queryByRole('button', { name: '整理为可执行' })).not.toBeInTheDocument()

    fireEvent.click(moveButton)

    expect(onMoveToInbox).toHaveBeenCalledOnce()
  })

  it('offers restore and confirmed permanent deletion only for archived tasks', () => {
    const onRestore = vi.fn()
    const onDelete = vi.fn()
    render(
      <LocalTaskActions
        item={{ ...item('ready'), archivedAt: 1 }}
        onAccept={() => {}}
        onArchive={() => {}}
        onRestore={onRestore}
        onDelete={onDelete}
        onPromote={() => {}}
        onMoveToInbox={() => {}}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: '恢复任务' }))
    fireEvent.click(screen.getByRole('button', { name: '永久删除' }))

    expect(onRestore).toHaveBeenCalledOnce()
    expect(screen.getByText('/tmp/project/orca/task-1')).toBeVisible()
    expect(screen.getByText('此操作不可恢复。', { exact: false })).toBeVisible()
    expect(onDelete).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: '确认永久删除' }))
    expect(onDelete).toHaveBeenCalledOnce()
  })
})
