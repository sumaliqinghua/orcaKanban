// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { LocalTask } from '../../../../shared/local-task-types'
import { LocalTaskSubtaskCreateDialog } from './LocalTaskSubtaskCreateDialog'
import { LocalTaskSubtaskSessionSelect } from './LocalTaskSubtaskSessionSelect'
import type { WorkItem } from './mock-data'

const storeState = {
  activeWorktreeId: 'wt-1',
  activeGroupIdByWorktree: {} as Record<string, string>,
  groupsByWorktree: {} as Record<string, { id: string }[]>
}

vi.mock('@/store', () => ({
  useAppStore: (selector: (state: typeof storeState) => unknown) => selector(storeState)
}))

vi.mock('@/components/tab-bar/QuickLaunchButton', () => ({
  QuickLaunchAgentMenuItems: () => <div>Agent options</div>
}))

const localTaskApi = {
  createSubtask: vi.fn(),
  createSession: vi.fn(),
  transferSubtask: vi.fn()
}

Object.defineProperty(window, 'api', {
  configurable: true,
  value: { localTasks: localTaskApi }
})

function item(sessions: WorkItem['sessionsList']): WorkItem {
  return {
    id: 'task-1',
    title: '任务',
    description: '描述',
    status: 'Open',
    workspace: 'workspace',
    workspaceId: 'wt-1',
    projectPath: '/tmp/project',
    project: 'project',
    updated: 'now',
    sessions: sessions.length,
    activeSessions: sessions.filter((session) => session.status === 'working').length,
    subtasks: [],
    latestOutput: { session: 'none', text: 'none' },
    sessionsList: sessions
  }
}

const taskResult = { id: 'task-1' } as LocalTask

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('local task subtask controls', () => {
  it('requires an existing session when sessions are available', async () => {
    localTaskApi.createSubtask.mockResolvedValue(taskResult)
    render(
      <LocalTaskSubtaskCreateDialog
        item={item([{ id: 'session-1', title: '实现会话', status: 'working', time: 'now' }])}
        onTaskChanged={() => {}}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: '新增子任务' }))
    expect(screen.queryByRole('option', { name: '暂不绑定' })).not.toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText(/Import Settings/), {
      target: { value: '制作工具' }
    })
    fireEvent.click(screen.getByRole('button', { name: '创建' }))
    await waitFor(() =>
      expect(localTaskApi.createSubtask).toHaveBeenCalledWith(
        expect.objectContaining({ title: '制作工具', sessionId: 'session-1' })
      )
    )
  })

  it('allows an unassigned subtask before the first session exists', () => {
    render(<LocalTaskSubtaskCreateDialog item={item([])} onTaskChanged={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: '新增子任务' }))
    expect(screen.getByRole('option', { name: '暂不绑定' })).toBeInTheDocument()
  })

  it('requires confirmation before transferring from a working session', async () => {
    localTaskApi.transferSubtask
      .mockRejectedValueOnce(new Error('force transfer requires confirmation'))
      .mockResolvedValueOnce(taskResult)
    render(
      <LocalTaskSubtaskSessionSelect
        subtask={{
          id: 'subtask-1',
          title: '制作工具',
          status: 'todo',
          sessionId: 'session-1',
          session: 'session-1',
          steps: []
        }}
        sessions={[
          { id: 'session-1', title: '原会话', status: 'working', time: 'now' },
          { id: 'session-2', title: '当前会话', status: 'working', time: 'now' }
        ]}
        onTaskChanged={() => {}}
      />
    )
    fireEvent.change(screen.getByLabelText(/选择“制作工具”的执行会话/), {
      target: { value: 'session-2' }
    })
    expect(await screen.findByRole('heading', { name: '更换执行会话' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '确认移交' }))
    await waitFor(() =>
      expect(localTaskApi.transferSubtask).toHaveBeenLastCalledWith({
        subtaskId: 'subtask-1',
        sessionId: 'session-2',
        force: true
      })
    )
  })
})
