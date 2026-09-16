// @vitest-environment happy-dom
import { beforeEach, expect, it, vi } from 'vitest'
import { resumeLocalTaskSession } from './local-task-session-resume'
import { AGENT_SESSION_METHODS } from '../../../../main/runtime/rpc/methods/agent-session'
import type { WorkItem } from './mock-data'

const mocks = vi.hoisted(() => ({
  getState: vi.fn(),
  subscribe: vi.fn(),
  call: vi.fn(),
  refresh: vi.fn(),
  host: vi.fn(),
  rebind: vi.fn()
}))
vi.mock('@/store', () => ({
  useAppStore: { getState: mocks.getState, subscribe: mocks.subscribe }
}))
vi.mock('@/runtime/runtime-rpc-client', () => ({ callRuntimeRpc: mocks.call }))
vi.mock('@/runtime/web-runtime-session', () => ({
  refreshWebRuntimeSessionTabsSnapshot: mocks.refresh
}))
vi.mock('@/lib/ai-vault-resume-target', () => ({
  getAiVaultResumeWorkspaceExecutionHostId: mocks.host
}))

const session: WorkItem['sessionsList'][number] = {
  id: 'original',
  title: '修复卡关',
  currentPrompt: '继续',
  status: 'done',
  time: '',
  agentId: 'codex',
  providerSession: { key: 'session_id', id: 'provider-original' }
}
const leafId = '11111111-1111-4111-8111-111111111111'
const binding = {
  paneKey: `host-restored:${leafId}`,
  ptyId: 'restored-pty',
  executionHostId: 'local'
}
const readyState = () => ({
  tabsByWorktree: { workspace: [{ id: 'host-restored' }] },
  terminalLayoutsByTabId: { 'host-restored': { ptyIdsByLeafId: { [leafId]: 'restored-pty' } } }
})
const onTaskChanged = vi.fn()
beforeEach(() => {
  vi.resetAllMocks()
  mocks.host.mockReturnValue('local')
  mocks.getState.mockReturnValue(readyState())
  mocks.subscribe.mockReturnValue(() => {})
  mocks.call.mockImplementation(async (_target, method, params) => {
    if (method === 'terminal.focus')
      return { focus: { tabId: 'host-restored', worktreeId: 'workspace', navigated: true } }
    const definition = AGENT_SESSION_METHODS.find((entry) => entry.name === method)
    definition!.params!.parse(params)
    return {
      terminal: {
        handle: 'term_restored',
        tabId: 'host-restored',
        worktreeId: 'workspace',
        ptyId: 'restored-pty',
        paneKey: binding.paneKey
      },
      disposition: 'created'
    }
  })
  mocks.refresh.mockImplementation(async () => {
    const current = readyState()
    current.terminalLayoutsByTabId['host-restored'].ptyIdsByLeafId[leafId] =
      'remote:server@@term_restored'
    mocks.getState.mockReturnValue(current)
  })
  mocks.rebind.mockResolvedValue({ projectId: 'repo' })
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: { localTasks: { rebindSessionTab: mocks.rebind } }
  })
})

it('restores the exact provider identity and binds only the host-returned tab', async () => {
  const target = await resumeLocalTaskSession({
    sessionId: 'original',
    session,
    workspaceId: 'workspace',
    onTaskChanged
  })
  expect(mocks.call).toHaveBeenCalledWith(
    { kind: 'local' },
    'terminal.ensureAgentSession',
    {
      kind: 'explicit',
      worktree: 'id:workspace',
      agent: 'codex',
      providerSession: session.providerSession,
      presentation: 'focused'
    },
    { timeoutMs: 30_000 }
  )
  expect(mocks.rebind).toHaveBeenCalledWith({
    sessionId: 'original',
    tabId: 'host-restored',
    terminalBinding: expect.objectContaining({ paneKey: binding.paneKey, ptyId: binding.ptyId })
  })
  expect(target.tabId).toBe('host-restored')
})

it('does not use a common continuation prompt when identity is missing', async () => {
  await expect(
    resumeLocalTaskSession({
      sessionId: 'original',
      session: { ...session, providerSession: undefined },
      workspaceId: 'workspace',
      onTaskChanged
    })
  ).rejects.toThrow('缺少原始会话标识')
  expect(mocks.call).not.toHaveBeenCalled()
  expect(mocks.rebind).not.toHaveBeenCalled()
})

it('keeps remote recovery on the owning host and refreshes its returned tab', async () => {
  mocks.host.mockReturnValue('runtime:server')
  await resumeLocalTaskSession({
    sessionId: 'original',
    session,
    workspaceId: 'workspace',
    onTaskChanged
  })
  expect(mocks.call.mock.calls[0]?.[0]).toEqual({ kind: 'environment', environmentId: 'server' })
  expect(mocks.refresh).toHaveBeenCalledWith('server', 'workspace', {
    afterCurrentInFlight: true,
    errorMode: 'throw'
  })
})

it('does not overwrite the old binding when the owning host cannot answer', async () => {
  mocks.call.mockRejectedValue(new Error('连接已断开'))
  await expect(
    resumeLocalTaskSession({
      sessionId: 'original',
      session,
      workspaceId: 'workspace',
      onTaskChanged
    })
  ).rejects.toThrow('连接已断开')
  expect(mocks.rebind).not.toHaveBeenCalled()
})

it('does not use the currently active workspace for a legacy local record', async () => {
  await expect(
    resumeLocalTaskSession({ sessionId: 'original', session, workspaceId: 'local', onTaskChanged })
  ).rejects.toThrow('无法确认')
  expect(mocks.call).not.toHaveBeenCalled()
})

it.each(['local', 'ssh:connection', 'runtime:server'])(
  'Cursor 恢复请求通过真实接口校验，执行主机为 %s',
  async (hostId) => {
    mocks.host.mockReturnValue(hostId)
    const providerSession = { key: 'conversation_id' as const, id: 'cursor-conversation' }
    await resumeLocalTaskSession({
      sessionId: 'original',
      session: { ...session, agentId: 'cursor', providerSession },
      workspaceId: 'workspace',
      onTaskChanged
    })
    expect(mocks.call.mock.calls[0]?.[2]).toMatchObject({
      providerSession,
      presentation: hostId === 'runtime:server' ? 'background' : 'focused'
    })
    expect(mocks.rebind).toHaveBeenCalledWith({
      sessionId: 'original',
      tabId: 'host-restored',
      terminalBinding: expect.objectContaining({
        paneKey: binding.paneKey,
        ptyId: hostId === 'runtime:server' ? 'remote:server@@term_restored' : binding.ptyId
      })
    })
  }
)

it('首次恢复等待标签和窗格加入界面后再返回导航目标', async () => {
  mocks.getState.mockReturnValue({ tabsByWorktree: {}, terminalLayoutsByTabId: {} })
  let settled = false
  const pending = resumeLocalTaskSession({
    sessionId: 'original',
    session,
    workspaceId: 'workspace',
    onTaskChanged
  }).then((result) => {
    settled = true
    return result
  })
  await vi.waitFor(() => expect(mocks.call).toHaveBeenCalled())
  await vi.waitFor(() =>
    expect(mocks.call).toHaveBeenCalledWith({ kind: 'local' }, 'terminal.focus', {
      terminal: 'term_restored',
      navigation: 'host'
    })
  )
  expect(settled).toBe(false)
  expect(mocks.rebind).not.toHaveBeenCalled()
  mocks.getState.mockReturnValue(readyState())
  mocks.subscribe.mock.calls[0]?.[0]()
  const result = await pending
  expect(result.leafId).toBe(leafId)
})

it('界面未能挂载时超时并释放监听，不改写任务绑定', async () => {
  vi.useFakeTimers()
  const unsubscribe = vi.fn()
  mocks.subscribe.mockReturnValue(unsubscribe)
  mocks.getState.mockReturnValue({ tabsByWorktree: {}, terminalLayoutsByTabId: {} })
  try {
    const pending = resumeLocalTaskSession({
      sessionId: 'original',
      session,
      workspaceId: 'workspace',
      onTaskChanged
    })
    const rejected = expect(pending).rejects.toThrow('终端标签尚未就绪')
    await vi.waitFor(() => expect(mocks.subscribe).toHaveBeenCalled())
    await vi.advanceTimersByTimeAsync(10_000)
    await rejected
    expect(unsubscribe).toHaveBeenCalledOnce()
    expect(mocks.rebind).not.toHaveBeenCalled()
  } finally {
    vi.useRealTimers()
  }
})
