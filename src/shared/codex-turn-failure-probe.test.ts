import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHookListenerState } from './agent-hook-listener/listener-state'
import type { AgentHookEventPayload } from './agent-hook-listener/listener-event'
import { createCodexTurnFailureProbe, reconcileCodexTurnFailure } from './codex-turn-failure-probe'

describe('Codex root failure evidence', () => {
  let dir: string
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'codex-failure-')); vi.spyOn(Date, 'now').mockReturnValue(1000) })
  afterEach(() => { vi.restoreAllMocks(); rmSync(dir, { recursive: true, force: true }) })
  function setup() {
    const path = join(dir, 'rollout.jsonl')
    writeFileSync(path, '')
    const event: AgentHookEventPayload = { paneKey: 'pane', connectionId: null, providerSession: { key: 'session_id', id: 'session', transcriptPath: path }, payload: { state: 'working', agentType: 'codex', prompt: 'go' } }
    const probe = createCodexTurnFailureProbe(event)!
    const state = createHookListenerState()
    const append = (payload: unknown, timestamp = 1001, type = 'event_msg') => appendFileSync(path, JSON.stringify({ type, timestamp: new Date(timestamp).toISOString(), payload }) + '\n')
    const read = () => reconcileCodexTurnFailure(probe, state, event)
    return { append, read, probe, state, event, path }
  }
  it('settles only an explicit failed completion, including split writes', () => {
    const { read, path } = setup()
    const row = JSON.stringify({ type: 'event_msg', timestamp: new Date(1001).toISOString(), payload: { type: 'task_complete', error: { message: '429' } } })
    appendFileSync(path, row.slice(0, 30)); expect(read().payload.state).toBe('working')
    appendFileSync(path, row.slice(30) + '\n'); expect(read().payload.state).toBe('done')
    expect(read().hookEventName).toBe('Stop')
  })
  it('ignores old errors, quoted errors and successful completions', () => {
    const { append, read, probe } = setup()
    append({ type: 'task_complete', error: { message: '429' } }, 999)
    append({ type: 'task_complete', error: { message: '429' } }, 1001, 'response_item')
    append({ type: 'agent_message', message: 'exceeded retry limit, last status: 429 Too Many Requests' })
    expect(read().payload.state).toBe('working')
    append({ type: 'task_complete' })
    expect(read().payload.state).toBe('working')
    expect(probe.settled).toBe(true)
  })
  it('does not settle when a new turn follows the failed completion', () => {
    const { append, read } = setup()
    append({ type: 'task_complete', turn_id: 'old', error: '429' })
    append({ type: 'task_started', turn_id: 'new' }, 1002)
    expect(read().payload.state).toBe('working')
  })
  it('keeps independently running children visible', () => {
    const { append, read, state } = setup()
    state.codexSubagentRosterByPaneKey.set('pane', new Map([['child', { id: 'child', state: 'working', startedAt: 1 }]]))
    append({ type: 'task_complete', error: '429' })
    expect(read().payload.state).toBe('working')
    expect(state.codexLeadStateByPaneKey.get('pane')?.state).toBe('done')
  })
  it('missing files do not become evidence of completion', () => {
    const { read, path } = setup()
    rmSync(path)
    expect(read().payload.state).toBe('working')
  })
})
