// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { DetailPanel } from './LocalTaskDetailPanel'
import type { WorkItem } from './mock-data'

vi.mock('./LocalTaskAgentPicker', () => ({ LocalTaskAgentPicker: () => null }))
vi.mock('./LocalTaskLabelSuggestions', () => ({ LocalTaskLabelSuggestions: () => null }))
vi.mock('./LocalTaskSessionTurnHistory', () => ({ LocalTaskSessionTurnHistory: () => null }))
vi.mock('./LocalTaskSubtaskCreateDialog', () => ({ LocalTaskSubtaskCreateDialog: () => null }))
vi.mock('./LocalTaskSubtaskBlock', () => ({ LocalTaskSubtaskBlock: () => null }))
vi.mock('./LocalTaskReportButton', () => ({ LocalTaskReportButton: () => null }))

function item(): WorkItem {
  return {
    id: 'task-1',
    title: '任务标题',
    description: '原描述',
    status: 'Open',
    workspace: 'workspace',
    projectPath: '/tmp/project',
    project: 'project',
    updated: 'now',
    sessions: 0,
    activeSessions: 0,
    subtasks: [],
    latestOutput: { session: 'none', text: 'none' },
    sessionsList: []
  }
}

afterEach(() => cleanup())

describe('local task detail description editing', () => {
  it('opens the description editor and submits the updated text', () => {
    const onEditDescription = vi.fn()
    render(
      <DetailPanel
        item={item()}
        onCompleteSubtask={() => {}}
        onEditTitle={() => {}}
        onEditDescription={onEditDescription}
        onEditLabels={() => {}}
        labelSuggestions={[]}
        onEditStep={() => {}}
        onOpenSession={() => {}}
        onOpenWorkspace={() => {}}
        onSessionStarted={() => {}}
        onReportSessionStarted={async () => {}}
        onTaskChanged={() => {}}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: '编辑任务描述' }))
    const textarea = screen.getByRole('textbox', { name: '任务描述' })
    expect(textarea).toHaveValue('原描述')

    fireEvent.change(textarea, { target: { value: '更新后的描述' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))

    expect(onEditDescription).toHaveBeenCalledWith('更新后的描述')
  })
})
