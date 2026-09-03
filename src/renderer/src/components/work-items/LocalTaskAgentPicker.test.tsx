// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import type { WorkItem } from './mock-data'
import { LocalTaskAgentPicker, persistLocalTaskSessionAssociation } from './LocalTaskAgentPicker'

const storeMocks = vi.hoisted(() => ({ closeTab: vi.fn() }))
vi.mock('@/store', () => {
  const state = {
    activeWorktreeId: 'workspace-1',
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
  QuickLaunchAgentMenuItems: ({
    onFocusTerminal
  }: {
    onFocusTerminal: (tabId: string) => void
  }) => (
    <button type="button" onClick={() => void onFocusTerminal('tab-1')}>
      启动 Agent
    </button>
  )
}))

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuLabel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  )
}))
vi.mock('@/components/ui/textarea', () => ({
  Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />
}))

const createSession = vi.fn()

Object.defineProperty(window, 'api', {
  configurable: true,
  value: { localTasks: { createSession } }
})

const item: WorkItem = {
  id: 'task-1',
  title: '收件箱任务',
  description: '执行任务描述',
  status: 'Open',
  workspace: '主 workspace',
  workspaceId: 'workspace-1',
  projectPath: '/repo',
  project: 'repo',
  updated: 'now',
  sessions: 0,
  activeSessions: 0,
  subtasks: [],
  latestOutput: { session: 'none', text: 'none' },
  sessionsList: [],
  intakeState: 'inbox'
}

afterEach(() => vi.clearAllMocks())

describe('persistLocalTaskSessionAssociation', () => {
  it('persists the launched tab before the task detail callback continues', async () => {
    createSession.mockResolvedValue({ id: 'tab-1' })

    await persistLocalTaskSessionAssociation(item, 'tab-1', '执行任务描述', 'workspace-1')

    expect(createSession).toHaveBeenCalledWith({
      taskId: 'task-1',
      projectPath: '/repo',
      sessionId: 'tab-1',
      title: '执行任务描述',
      workspaceId: 'workspace-1',
      currentPrompt: '执行任务描述',
      associationSource: 'task-center'
    })
  })

  it('waits for association persistence before notifying the task center', async () => {
    let resolveCreate!: (value: { id: string }) => void
    createSession.mockReturnValue(
      new Promise<{ id: string }>((resolve) => (resolveCreate = resolve))
    )
    const onStarted = vi.fn()

    render(<LocalTaskAgentPicker item={item} onStarted={onStarted} />)
    fireEvent.click(screen.getByRole('button', { name: '启动 Agent' }))

    await waitFor(() => expect(createSession).toHaveBeenCalled())
    expect(onStarted).not.toHaveBeenCalled()
    resolveCreate({ id: 'tab-1' })
    await waitFor(() => expect(onStarted).toHaveBeenCalledWith('tab-1', '执行任务描述'))
  })

  it('leaves callback failure visible to the caller', async () => {
    createSession.mockRejectedValue(new Error('写入失败'))

    await expect(
      persistLocalTaskSessionAssociation(item, 'tab-1', '执行任务描述', 'workspace-1')
    ).rejects.toThrow('写入失败')
  })
})
