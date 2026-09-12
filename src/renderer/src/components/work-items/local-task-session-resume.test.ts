// @vitest-environment happy-dom
import { beforeEach, expect, it, vi } from 'vitest'
import { resumeLocalTaskSession } from './local-task-session-resume'
import type { WorkItem } from './mock-data'

const mocks = vi.hoisted(() => ({
  getState: vi.fn(),
  call: vi.fn(),
  refresh: vi.fn(),
  host: vi.fn(),
  rebind: vi.fn()
}))
vi.mock('@/store', () => ({ useAppStore: { getState: mocks.getState } }))
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
const onTaskChanged = vi.fn()
beforeEach(() => {
  vi.resetAllMocks()
  mocks.host.mockReturnValue('local')
  mocks.call.mockResolvedValue({
    terminal: { tabId: 'host-restored', worktreeId: 'workspace' },
    disposition: 'created'
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
      presentation: 'visible'
    },
    { timeoutMs: 30_000 }
  )
  expect(mocks.rebind).toHaveBeenCalledWith({ sessionId: 'original', tabId: 'host-restored' })
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
