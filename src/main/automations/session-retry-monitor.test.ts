import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Store } from '../persistence'
import type { OrcaRuntimeService } from '../runtime/orca-runtime'
import type { SubscribeNativeChatTranscriptArgs } from '../native-chat/transcript-watch'
import { startAutomationSessionRetryMonitor } from './session-retry-monitor'

const mocks = vi.hoisted(() => ({ hooks: vi.fn(), tasks: vi.fn(), subscribe: vi.fn(), tail: vi.fn() }))
vi.mock('../agent-hooks/server', () => ({ agentHookServer: { getStatusSnapshot: mocks.hooks } }))
vi.mock('../local-tasks/store', () => ({ getLocalTaskStore: () => ({ list: mocks.tasks }) }))
vi.mock('../native-chat/transcript-watch', () => ({ subscribeNativeChatTranscript: mocks.subscribe, readNativeChatTranscriptTail: mocks.tail }))
const error = 'exceeded retry limit, last status: 429 Too Many Requests'

describe('automation session retries', () => {
  let monitor: ReturnType<typeof startAutomationSessionRetryMonitor>
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(100_000); vi.resetAllMocks() })
  afterEach(() => { monitor?.dispose(); vi.useRealTimers() })
  function setup({ historical = false, fast = false, remote = false, taskBound = false } = {}) {
    let subscription: SubscribeNativeChatTranscriptArgs | undefined
    let turn = { state: 'completed' as const, turnId: 'turn-1', timestamp: historical ? 90_000 : 100_500, error }
    const hook = { paneKey: 'pane-1', tabId: 'tab-1', receivedAt: 100_000, agentType: 'codex', connectionId: remote ? 'ssh-1' : null, providerSession: { key: 'session_id', id: 'native-1', transcriptPath: '/rollout.jsonl' } }
    const run = { id: 'run-1', automationId: 'auto-1', terminalPaneKey: 'pane-1', terminalSessionId: 'tab-1', createdAt: 90_000, startedAt: 95_000 }
    const automation = { id: 'auto-1', enabled: true, agentId: 'codex', executionTargetType: 'local' }
    const profile = { listAutomations: () => [automation], listAutomationRuns: () => [run], flushPendingOrThrowAsync: vi.fn().mockResolvedValue(undefined) }
    const send = vi.fn(async (_handle, _prompt, opts) => { await opts.beforeWrite(); return { accepted: true } })
    const runtime = { getAgentStatusTerminalHandleForPaneKey: vi.fn(() => 'handle-1'), getTerminalAgentStatus: vi.fn().mockResolvedValue({ isRunningAgent: true, status: 'idle' }), sendTerminalAgentPrompt: send }
    mocks.hooks.mockReturnValue([hook]); mocks.tasks.mockReturnValue(taskBound ? [{ sessions: [{ id: 'task-session', tabId: 'tab-1' }] }] : [])
    mocks.tail.mockImplementation(async () => ({ lifecycle: turn, messages: [] }))
    mocks.subscribe.mockImplementation(async args => {
      subscription = args
      args.onInitialSnapshot([], false, 0, undefined, fast || historical ? turn : { state: 'working', turnId: 'turn-1', timestamp: 100_000 })
      return { unsubscribe: vi.fn() }
    })
    monitor = startAutomationSessionRetryMonitor(profile as unknown as Store, runtime as unknown as OrcaRuntimeService)
    const fail = (id = 'turn-1') => { turn = { ...turn, turnId: id, timestamp: Date.now() }; subscription?.onAppend([], turn) }
    const start = (id: string) => subscription?.onAppend([], { state: 'working', turnId: id, timestamp: Date.now() })
    return { send, fail, start, hook, runtime, automation }
  }
  it('retries a dispatch session with no local task, at most three times', async () => {
    const { send, fail, start } = setup()
    await vi.advanceTimersByTimeAsync(1)
    fail()
    for (const [i, delay] of [30_000, 120_000, 300_000].entries()) {
      await vi.advanceTimersByTimeAsync(delay - 1)
      expect(send).toHaveBeenCalledTimes(i)
      await vi.advanceTimersByTimeAsync(1)
      expect(send).toHaveBeenCalledTimes(i + 1)
      expect(send.mock.calls[i]?.slice(0, 2)).toEqual(['handle-1', '继续'])
      start(`auto-turn-${i}`); fail(`auto-turn-${i}`)
    }
    await vi.advanceTimersByTimeAsync(600_000)
    expect(send).toHaveBeenCalledTimes(3)
  })
  it('catches a failure before the first subscription snapshot', async () => {
    const { send } = setup({ fast: true })
    await vi.advanceTimersByTimeAsync(30_000)
    expect(send).toHaveBeenCalledTimes(1)
  })
  it('does not replay a failure from before monitor startup', async () => {
    const { send } = setup({ historical: true })
    await vi.advanceTimersByTimeAsync(600_000)
    expect(send).not.toHaveBeenCalled()
  })
  it.each(['manual', 'closed', 'rebound', 'disabled'] as const)('cancels after %s', async reason => {
    const { fail, start, hook, runtime, send, automation } = setup()
    await vi.advanceTimersByTimeAsync(1); fail()
    if (reason === 'manual') start('manual-turn')
    if (reason === 'closed') runtime.getAgentStatusTerminalHandleForPaneKey.mockReturnValue(null as unknown as string)
    if (reason === 'rebound') hook.providerSession.id = 'replacement'
    if (reason === 'disabled') automation.enabled = false
    await vi.advanceTimersByTimeAsync(30_000)
    expect(send).not.toHaveBeenCalled()
  })
  it.each([{ remote: true }, { taskBound: true }])('does not compete for a remote or task-owned session: %j', options => {
    setup(options)
    expect(mocks.subscribe).not.toHaveBeenCalled()
  })
  it('rechecks the transcript before writing a retry', async () => {
    const { fail, send } = setup()
    await vi.advanceTimersByTimeAsync(1); fail()
    mocks.tail.mockResolvedValue({ lifecycle: { state: 'working', turnId: 'new-turn', timestamp: Date.now() }, messages: [] })
    await vi.advanceTimersByTimeAsync(30_000)
    expect(send).not.toHaveBeenCalled()
  })
})
