import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it, vi } from 'vitest'
import { AgentHookServer } from './server'
import { makePaneKey } from '../../shared/stable-pane-id'

it('settles a failed Codex turn without a Stop hook or subagents', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'codex-failed-turn-'))
  const transcript = join(dir, 'rollout.jsonl')
  const paneKey = makePaneKey('failed-tab', '11111111-1111-4111-8111-111111111111')
  const line = (payload: unknown): string =>
    JSON.stringify({ type: 'event_msg', timestamp: new Date().toISOString(), payload }) + '\n'
  writeFileSync(transcript, line({ type: 'task_started', turn_id: 'failed-turn' }))
  const server = new AgentHookServer()
  await server.start({ env: 'production' })
  try {
    const env = server.buildPtyEnv()
    await fetch(`http://127.0.0.1:${env.ORCA_AGENT_HOOK_PORT}/hook/codex`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Orca-Agent-Hook-Token': env.ORCA_AGENT_HOOK_TOKEN },
      body: JSON.stringify({
        paneKey, tabId: 'failed-tab', worktreeId: 'folder:workspace',
        payload: { hook_event_name: 'UserPromptSubmit', session_id: 'failed-session', transcript_path: transcript, prompt: 'continue' }
      })
    })
    expect(server.getStatusSnapshot()[0]?.state).toBe('working')
    appendFileSync(transcript, line({ type: 'task_complete', turn_id: 'failed-turn', error: { message: 'exceeded retry limit, last status: 429 Too Many Requests' } }))
    await vi.waitFor(() => expect(server.getStatusSnapshot()[0]?.state).toBe('done'), { timeout: 2500 })
  } finally {
    server.stop()
    rmSync(dir, { recursive: true, force: true })
  }
})
