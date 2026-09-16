// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { DetailPanel } from './LocalTaskDetailPanel'
import type { WorkItem } from './mock-data'

vi.mock('./LocalTaskAgentPicker', () => ({ LocalTaskAgentPicker: () => null }))
vi.mock('./LocalTaskLabelSuggestions', () => ({ LocalTaskLabelSuggestions: () => null }))
vi.mock('./LocalTaskSessionTurnHistory', () => ({ LocalTaskSessionTurnHistory: () => null }))
vi.mock('./LocalTaskSubtaskCreateDialog', () => ({ LocalTaskSubtaskCreateDialog: () => null }))
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
      />,
      { wrapper: TooltipProvider }
    )

    fireEvent.click(screen.getByRole('button', { name: '编辑任务描述' }))
    const textarea = screen.getByRole('textbox', { name: '任务描述' })
    expect(textarea).toHaveValue('原描述')

    fireEvent.change(textarea, { target: { value: '更新后的描述' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))

    expect(onEditDescription).toHaveBeenCalledWith('更新后的描述')
  })
  it('子任务与关联会话共用侧栏回调，完成及步骤编辑不会触发预览', () => {
    const onOpenSession = vi.fn()
    const onCompleteSubtask = vi.fn()
    const onEditStep = vi.fn()
    const task: WorkItem = {
      ...item(),
      sessions: 1,
      sessionsList: [{ id: 'session-linked', title: '原有关联会话', status: 'done', time: '刚刚' }],
      subtasks: [
        {
          id: 'sub-linked',
          title: '有关联的子任务',
          status: 'done',
          sessionId: 'session-linked',
          session: '原有关联会话',
          steps: [{ id: 'step-1', title: '待编辑步骤', status: 'todo' }]
        },
        {
          id: 'sub-unlinked',
          title: '未关联的子任务',
          status: 'todo',
          sessionId: null,
          session: '',
          steps: []
        },
        {
          id: 'sub-missing',
          title: '会话不存在的子任务',
          status: 'todo',
          sessionId: 'missing',
          session: '',
          steps: []
        }
      ]
    }
    render(
      <DetailPanel
        item={task}
        onCompleteSubtask={onCompleteSubtask}
        onEditTitle={() => {}}
        onEditDescription={() => {}}
        onEditLabels={() => {}}
        labelSuggestions={[]}
        onEditStep={onEditStep}
        onOpenSession={onOpenSession}
        onOpenWorkspace={() => {}}
        onSessionStarted={() => {}}
        onReportSessionStarted={async () => {}}
        onTaskChanged={() => {}}
      />,
      { wrapper: TooltipProvider }
    )
    fireEvent.click(screen.getByRole('button', { name: '侧边预览子任务会话：有关联的子任务' }))
    fireEvent.click(screen.getByRole('button', { name: '侧边预览会话：原有关联会话' }))
    expect(onOpenSession.mock.calls).toEqual([['session-linked'], ['session-linked']])
    expect(
      screen.queryByRole('button', { name: '侧边预览子任务会话：未关联的子任务' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: '侧边预览子任务会话：会话不存在的子任务' })
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '取消完成子任务' }))
    fireEvent.click(screen.getByRole('button', { name: '编辑未开始步骤' }))
    expect(onCompleteSubtask).toHaveBeenCalledWith('sub-linked')
    expect(onEditStep).toHaveBeenCalledWith('sub-linked', 'step-1')
    expect(onOpenSession).toHaveBeenCalledTimes(2)
  })
})
