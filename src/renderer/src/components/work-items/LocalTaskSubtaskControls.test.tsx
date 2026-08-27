// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { LocalTask } from '../../../../shared/local-task-types'
import { LocalTaskSubtaskCreateDialog } from './LocalTaskSubtaskCreateDialog'
import { LocalTaskSubtaskSessionSelect } from './LocalTaskSubtaskSessionSelect'
import type { WorkItem } from './mock-data'

const storeMocks = vi.hoisted(() => ({ closeTab: vi.fn() }))

vi.mock('@/store', () => {
  const state = {
    activeWorktreeId: 'wt-1',
    activeGroupIdByWorktree: {} as Record<string, string>,
    groupsByWorktree: {} as Record<string, { id: string }[]>
  }
  const useAppStore = (selector: (value: typeof state) => unknown): unknown => selector(state)
  return {
    useAppStore: Object.assign(useAppStore, {
      getState: () => ({ ...state, closeTab: storeMocks.closeTab })
    })
  }
})

vi.mock('@/components/tab-bar/QuickLaunchButton', () => ({
  QuickLaunchAgentMenuItems: ({ onSelectAgent }: { onSelectAgent?: (agent: 'codex') => void }) => (
    <button type="button" onClick={() => onSelectAgent?.('codex')}>
      Codex
    </button>
  )
}))

const launchMocks = vi.hoisted(() => ({ launchAgentInNewTab: vi.fn() }))
vi.mock('@/lib/launch-agent-in-new-tab', () => launchMocks)

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

  it('creates the subtask before launching and closes after binding the new session', async () => {
    const onTaskChanged = vi.fn()
    const taskWithSubtask = {
      ...taskResult,
      subtasks: [
        {
          id: 'subtask-new',
          title: 'test',
          status: 'todo',
          sessionId: null,
          createdAt: 1,
          updatedAt: 1,
          steps: []
        }
      ]
    } as LocalTask
    const boundTask = {
      ...taskWithSubtask,
      subtasks: [{ ...taskWithSubtask.subtasks[0]!, sessionId: 'tab-new' }]
    } as LocalTask
    localTaskApi.createSubtask.mockResolvedValue(taskWithSubtask)
    localTaskApi.createSession.mockResolvedValue({ id: 'tab-new' })
    localTaskApi.transferSubtask.mockResolvedValue(boundTask)
    launchMocks.launchAgentInNewTab.mockReturnValue({ tabId: 'tab-new' })
    render(<LocalTaskSubtaskCreateDialog item={item([])} onTaskChanged={onTaskChanged} />)
    fireEvent.click(screen.getByRole('button', { name: '新增子任务' }))
    fireEvent.change(screen.getByPlaceholderText(/Import Settings/), { target: { value: 'test' } })
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: '__new__' }
    })
    fireEvent.pointerDown(screen.getByRole('button', { name: '选择 Agent' }), {
      button: 0,
      ctrlKey: false
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Codex' }))

    await waitFor(() => expect(localTaskApi.transferSubtask).toHaveBeenCalled())
    expect(localTaskApi.createSubtask.mock.invocationCallOrder[0]).toBeLessThan(
      launchMocks.launchAgentInNewTab.mock.invocationCallOrder[0]!
    )
    expect(localTaskApi.createSession).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 'tab-new', currentPrompt: '请执行子任务：test' })
    )
    expect(localTaskApi.transferSubtask).toHaveBeenCalledWith({
      subtaskId: 'subtask-new',
      sessionId: 'tab-new'
    })
    expect(onTaskChanged).toHaveBeenLastCalledWith(boundTask)
    expect(screen.queryByRole('heading', { name: '新增子任务' })).not.toBeInTheDocument()
  })

  it('reuses the launched session when subtask binding is retried', async () => {
    const taskWithSubtask = {
      ...taskResult,
      subtasks: [
        {
          id: 'subtask-new',
          title: 'test',
          status: 'todo',
          sessionId: null,
          createdAt: 1,
          updatedAt: 1,
          steps: []
        }
      ]
    } as LocalTask
    localTaskApi.createSubtask.mockResolvedValue(taskWithSubtask)
    localTaskApi.createSession.mockResolvedValue({ id: 'tab-new' })
    localTaskApi.transferSubtask
      .mockRejectedValueOnce(new Error('子任务绑定失败'))
      .mockResolvedValueOnce({
        ...taskWithSubtask,
        subtasks: [{ ...taskWithSubtask.subtasks[0]!, sessionId: 'tab-new' }]
      })
    launchMocks.launchAgentInNewTab.mockReturnValue({ tabId: 'tab-new' })
    render(<LocalTaskSubtaskCreateDialog item={item([])} onTaskChanged={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: '新增子任务' }))
    fireEvent.change(screen.getByPlaceholderText(/Import Settings/), { target: { value: 'test' } })
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '__new__' } })

    fireEvent.pointerDown(screen.getByRole('button', { name: '选择 Agent' }), {
      button: 0,
      ctrlKey: false
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Codex' }))
    expect(await screen.findByText('子任务绑定失败')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '重试绑定' }))

    await waitFor(() => expect(localTaskApi.transferSubtask).toHaveBeenCalled())
    expect(localTaskApi.createSubtask).toHaveBeenCalledTimes(1)
    expect(localTaskApi.createSession).toHaveBeenCalledTimes(1)
    expect(launchMocks.launchAgentInNewTab).toHaveBeenCalledTimes(1)
  })

  it('closes the launched tab when the task session cannot be persisted', async () => {
    const taskWithSubtask = {
      ...taskResult,
      subtasks: [
        {
          id: 'subtask-new',
          title: 'test',
          status: 'todo',
          sessionId: null,
          createdAt: 1,
          updatedAt: 1,
          steps: []
        }
      ]
    } as LocalTask
    localTaskApi.createSubtask.mockResolvedValue(taskWithSubtask)
    localTaskApi.createSession.mockRejectedValue(new Error('会话记录写入失败'))
    launchMocks.launchAgentInNewTab.mockReturnValue({ tabId: 'tab-new' })
    render(<LocalTaskSubtaskCreateDialog item={item([])} onTaskChanged={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: '新增子任务' }))
    fireEvent.change(screen.getByPlaceholderText(/Import Settings/), { target: { value: 'test' } })
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '__new__' } })
    fireEvent.pointerDown(screen.getByRole('button', { name: '选择 Agent' }), {
      button: 0,
      ctrlKey: false
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Codex' }))

    expect(await screen.findByText('会话记录写入失败')).toBeInTheDocument()
    expect(storeMocks.closeTab).toHaveBeenCalledWith('tab-new', {
      recordInteraction: false,
      reason: 'cleanup'
    })
    expect(localTaskApi.transferSubtask).not.toHaveBeenCalled()
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
