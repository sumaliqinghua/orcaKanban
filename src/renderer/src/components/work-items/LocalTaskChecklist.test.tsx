// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { LocalTaskChecklist } from './LocalTaskChecklist'
import type { WorkItem } from './mock-data'

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  createSession: vi.fn(),
  createSubtask: vi.fn(),
  get: vi.fn(),
  launch: vi.fn(),
  closeTab: vi.fn()
}))
vi.mock('@/store', () => {
  const state = {
    activeWorktreeId: 'unrelated',
    activeGroupIdByWorktree: {},
    groupsByWorktree: {},
    closeTab: mocks.closeTab,
    allWorktrees: () => [{ id: 'target-workspace', repoId: 'repo', path: '/repo' }]
  }
  return {
    useAppStore: Object.assign((selector: (value: typeof state) => unknown) => selector(state), {
      getState: () => state
    })
  }
})
vi.mock('@/lib/launch-agent-in-new-tab', () => ({ launchAgentInNewTab: mocks.launch }))
vi.mock('@/components/tab-bar/QuickLaunchButton', () => ({
  QuickLaunchAgentMenuItems: ({ onSelectAgent }: { onSelectAgent: (agent: string) => void }) => (
    <button onClick={() => onSelectAgent('codex')}>使用 Codex</button>
  )
}))
vi.mock('@/components/ui/dropdown-menu', () => {
  const Wrapper = ({ children }: { children: React.ReactNode }) => <div>{children}</div>
  return {
    DropdownMenu: Wrapper,
    DropdownMenuTrigger: Wrapper,
    DropdownMenuContent: Wrapper,
    DropdownMenuLabel: Wrapper
  }
})
const checklist = [{ id: 'check-1', title: '核对文案', completed: false }]
const item: WorkItem = {
  id: 'task-1',
  title: '父任务',
  description: '说明',
  status: 'Open',
  workspace: '主目录',
  workspaceId: 'local',
  projectPath: '/repo',
  project: 'repo',
  updated: 'now',
  sessions: 0,
  activeSessions: 0,
  subtasks: [],
  latestOutput: { session: '', text: '' },
  sessionsList: [],
  checklist
}
const onTaskChanged = vi.fn()
beforeEach(() => {
  vi.resetAllMocks()
  Object.defineProperty(window, 'api', { configurable: true, value: { localTasks: mocks } })
  mocks.launch.mockReturnValue({ tabId: 'tab-1' })
  mocks.createSession.mockResolvedValue({ id: 'tab-1' })
  mocks.get.mockResolvedValue({
    ...item,
    checklist: [],
    subtasks: [{ id: 'sub-1', sessionId: 'tab-1' }]
  })
})
afterEach(cleanup)
describe('待办清单交互', () => {
  it('新增失败保留输入，重试成功后关闭输入区，期间不创建会话', async () => {
    mocks.update.mockRejectedValueOnce(new Error('磁盘写入失败')).mockResolvedValueOnce({ ...item })
    render(<LocalTaskChecklist item={{ ...item, checklist: [] }} onTaskChanged={onTaskChanged} />)
    fireEvent.click(screen.getByRole('button', { name: '新增待办' }))
    expect(screen.queryByRole('button', { name: '保存' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '取消' })).not.toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox', { name: '待办内容' }), {
      target: { value: ' 核对文案 ' }
    })
    fireEvent.submit(screen.getByRole('textbox', { name: '待办内容' }).closest('form')!)
    expect(await screen.findByRole('alert')).toHaveTextContent('磁盘写入失败')
    expect(screen.getByRole('textbox', { name: '待办内容' })).toHaveValue(' 核对文案 ')
    fireEvent.submit(screen.getByRole('textbox', { name: '待办内容' }).closest('form')!)
    await waitFor(() => expect(screen.queryByRole('textbox')).not.toBeInTheDocument())
    expect(mocks.update).toHaveBeenLastCalledWith({
      taskId: item.id,
      projectPath: '/repo',
      updates: { checklistChange: { action: 'add', title: '核对文案' } }
    })
    expect(mocks.createSession).not.toHaveBeenCalled()
  })
  it('新增失焦自动添加，提交后失焦不会重复新增', async () => {
    mocks.update.mockResolvedValue(item)
    render(<LocalTaskChecklist item={item} onTaskChanged={onTaskChanged} />)
    fireEvent.click(screen.getByRole('button', { name: '新增待办' }))
    const input = screen.getByRole('textbox', { name: '待办内容' })
    fireEvent.change(input, { target: { value: '自动添加' } })
    fireEvent.blur(input)
    fireEvent.submit(input.closest('form')!)
    await waitFor(() => expect(onTaskChanged).toHaveBeenCalledTimes(1))
    expect(mocks.update).toHaveBeenCalledTimes(1)
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        updates: { checklistChange: { action: 'add', title: '自动添加' } }
      })
    )
  })
  it('空白输入失焦和按 Escape 收起均不新增待办', () => {
    render(<LocalTaskChecklist item={item} onTaskChanged={onTaskChanged} />)
    fireEvent.click(screen.getByRole('button', { name: '新增待办' }))
    const input = screen.getByRole('textbox', { name: '待办内容' })
    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.blur(input)
    expect(mocks.update).not.toHaveBeenCalled()
    fireEvent.change(input, { target: { value: '暂不添加' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    fireEvent.blur(input)
    expect(mocks.update).not.toHaveBeenCalled()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })
  it('勾选、编辑、删除都只提交目标待办的变更', async () => {
    mocks.update.mockResolvedValue(item)
    render(<LocalTaskChecklist item={item} onTaskChanged={onTaskChanged} />)
    fireEvent.click(screen.getByRole('checkbox'))
    await waitFor(() => expect(onTaskChanged).toHaveBeenCalledTimes(1))
    expect(mocks.update.mock.calls[0][0].updates.checklistChange).toEqual({
      action: 'update',
      itemId: 'check-1',
      completed: true
    })
    fireEvent.click(screen.getByRole('button', { name: '编辑待办：核对文案' }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '新的文案' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    await waitFor(() => expect(onTaskChanged).toHaveBeenCalledTimes(2))
    expect(mocks.update.mock.calls[1][0].updates.checklistChange).toEqual({
      action: 'update',
      itemId: 'check-1',
      title: '新的文案'
    })
    fireEvent.click(screen.getByRole('button', { name: '删除待办：核对文案' }))
    await waitFor(() => expect(onTaskChanged).toHaveBeenCalledTimes(3))
    expect(mocks.update.mock.calls[2][0].updates.checklistChange).toEqual({
      action: 'delete',
      itemId: 'check-1'
    })
    expect(mocks.launch).not.toHaveBeenCalled()
  })
  it('转换预填标题、选择 Agent 后绑定正确工作区，并只调用一次原子转换', async () => {
    render(<LocalTaskChecklist item={item} onTaskChanged={onTaskChanged} />)
    fireEvent.click(screen.getByRole('button', { name: '转为子任务' }))
    expect(screen.getByRole('textbox')).toHaveValue('核对文案')
    expect(mocks.launch).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '使用 Codex' }))
    await waitFor(() => expect(onTaskChanged).toHaveBeenCalledTimes(1))
    expect(mocks.launch).toHaveBeenCalledWith(
      expect.objectContaining({ worktreeId: 'target-workspace', localTaskId: item.id })
    )
    expect(mocks.createSession).toHaveBeenCalledWith(
      expect.objectContaining({ sourceChecklistItemId: 'check-1', sessionId: 'tab-1' })
    )
    expect(mocks.createSubtask).not.toHaveBeenCalled()
    expect(mocks.update).not.toHaveBeenCalled()
  })
  it('转换失败保留待办，清理未绑定终端，允许重试', async () => {
    mocks.createSession
      .mockRejectedValueOnce(new Error('保存失败'))
      .mockResolvedValueOnce({ id: 'tab-1' })
    render(<LocalTaskChecklist item={item} onTaskChanged={onTaskChanged} />)
    fireEvent.click(screen.getByRole('button', { name: '转为子任务' }))
    fireEvent.click(screen.getByRole('button', { name: '使用 Codex' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('保存失败')
    expect(onTaskChanged).not.toHaveBeenCalled()
    expect(mocks.closeTab).toHaveBeenCalledWith(
      'tab-1',
      expect.objectContaining({ reason: 'cleanup' })
    )
    fireEvent.click(screen.getByRole('button', { name: '使用 Codex' }))
    await waitFor(() => expect(onTaskChanged).toHaveBeenCalledTimes(1))
  })
  it('回读失败重试不再次启动 Agent；转换期间清单刷新不卸载对话框', async () => {
    mocks.get
      .mockRejectedValueOnce(new Error('读取失败'))
      .mockResolvedValueOnce({ ...item, checklist: [], subtasks: [{ sessionId: 'tab-1' }] })
    const view = render(<LocalTaskChecklist item={item} onTaskChanged={onTaskChanged} />)
    fireEvent.click(screen.getByRole('button', { name: '转为子任务' }))
    fireEvent.click(screen.getByRole('button', { name: '使用 Codex' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('读取失败')
    view.rerender(
      <LocalTaskChecklist item={{ ...item, checklist: [] }} onTaskChanged={onTaskChanged} />
    )
    fireEvent.click(screen.getByRole('button', { name: '重试绑定' }))
    await waitFor(() => expect(onTaskChanged).toHaveBeenCalledTimes(1))
    expect(mocks.launch).toHaveBeenCalledTimes(1)
    expect(mocks.createSession).toHaveBeenCalledTimes(1)
  })
  it('完成的待办可取消勾选但不能直接转换', () => {
    render(
      <LocalTaskChecklist
        item={{ ...item, checklist: [{ ...checklist[0], completed: true }] }}
        onTaskChanged={onTaskChanged}
      />
    )
    expect(screen.getByRole('checkbox')).toBeChecked()
    expect(screen.getByRole('button', { name: '转为子任务' })).toBeDisabled()
  })
  it.each(['folder:project-folder', 'ssh-worktree'])(
    '转换沿用任务的 %s 工作区',
    async (workspaceId) => {
      render(<LocalTaskChecklist item={{ ...item, workspaceId }} onTaskChanged={onTaskChanged} />)
      fireEvent.click(screen.getByRole('button', { name: '转为子任务' }))
      fireEvent.click(screen.getByRole('button', { name: '使用 Codex' }))
      await waitFor(() => expect(onTaskChanged).toHaveBeenCalledTimes(1))
      expect(mocks.launch).toHaveBeenCalledWith(
        expect.objectContaining({ worktreeId: workspaceId })
      )
    }
  )
  it('500 字待办转换时会话标题不超过接口上限，执行内容保持完整', async () => {
    const title = '文'.repeat(500)
    render(
      <LocalTaskChecklist
        item={{ ...item, checklist: [{ ...checklist[0], title }] }}
        onTaskChanged={onTaskChanged}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: '转为子任务' }))
    fireEvent.click(screen.getByRole('button', { name: '使用 Codex' }))
    await waitFor(() => expect(onTaskChanged).toHaveBeenCalledTimes(1))
    expect(mocks.createSession.mock.calls[0][0].title).toHaveLength(500)
    expect(mocks.createSession.mock.calls[0][0].currentPrompt).toBe(title)
  })
  it('任务主目录未加载时不借用其他项目的活动工作区', () => {
    render(
      <LocalTaskChecklist
        item={{ ...item, project: 'another-project' }}
        onTaskChanged={onTaskChanged}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: '转为子任务' }))
    expect(screen.getByRole('button', { name: '选择 Agent' })).toBeDisabled()
    expect(screen.getByText('先为任务选择并打开工作区，再创建执行会话。')).toBeInTheDocument()
    expect(mocks.launch).not.toHaveBeenCalled()
  })
})
