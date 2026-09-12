// @vitest-environment happy-dom
import { beforeEach, expect, it, vi } from 'vitest'
import { persistLocalTaskAgentTurn } from './local-task-agent-turn-persistence'
import type { AgentStatusIpcPayload } from '../../../../shared/agent-status-types'

const updateSessionOutput = vi.fn()
beforeEach(() => {
  updateSessionOutput.mockReset().mockResolvedValue({})
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: { localTasks: { updateSessionOutput } }
  })
})
function event(overrides: Partial<AgentStatusIpcPayload>): AgentStatusIpcPayload {
  return {
    state: 'working',
    receivedAt: Date.now(),
    agentType: 'codex',
    ...overrides
  } as AgentStatusIpcPayload
}
it('persists a resumed working turn before its new prompt arrives', () => {
  persistLocalTaskAgentTurn('original-tab', event({ prompt: '' }))
  expect(updateSessionOutput).toHaveBeenCalledWith({
    sessionId: 'original-tab',
    sessionStatus: 'working'
  })
})
it('persists working status alongside provider identity without requiring prompt text', () => {
  const providerSession = { key: 'session_id' as const, id: 'original-provider' }
  persistLocalTaskAgentTurn('restored-tab', event({ providerSession }))
  expect(updateSessionOutput).toHaveBeenCalledWith({
    sessionId: 'restored-tab',
    sessionStatus: 'working',
    providerSession
  })
})
it('still persists completion without a prompt', () => {
  persistLocalTaskAgentTurn('original-tab', event({ state: 'done' }))
  expect(updateSessionOutput).toHaveBeenCalledWith({
    sessionId: 'original-tab',
    sessionStatus: 'done'
  })
})
it('does not write an event with no resolved owner', () => {
  persistLocalTaskAgentTurn(undefined, event({ prompt: '继续' }))
  expect(updateSessionOutput).not.toHaveBeenCalled()
})
