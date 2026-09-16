import { extname, isAbsolute } from 'node:path'
import type { AgentHookEventPayload } from './agent-hook-listener/listener-event'
import type { HookListenerState } from './agent-hook-listener/listener-state'
import { codexRosterEffectiveState } from './codex-subagent-roster'
import { readJsonlCursor, type JsonlCursor } from './codex-transcript-cursor'

export type CodexTurnFailureProbe = {
  cursor: JsonlCursor
  since: number
  settled: boolean
  failed: boolean
}

export function createCodexTurnFailureProbe(
  event: AgentHookEventPayload
): CodexTurnFailureProbe | undefined {
  const path = event.providerSession?.transcriptPath
  if (event.payload.agentType !== 'codex' || !path || !isAbsolute(path) || extname(path) !== '.jsonl') {
    return undefined
  }
  return { cursor: { filePath: path, offset: 0, carry: '' }, since: Date.now(), settled: false, failed: false }
}

export function reconcileCodexTurnFailure(
  probe: CodexTurnFailureProbe | undefined,
  state: HookListenerState,
  event: AgentHookEventPayload
): AgentHookEventPayload {
  if (!probe) return event
  for (const row of readJsonlCursor(probe.cursor) ?? []) {
    if (row.type !== 'event_msg' || typeof row.timestamp !== 'string') continue
    const timestamp = Date.parse(row.timestamp)
    if (!Number.isFinite(timestamp) || timestamp < probe.since) continue
    const payload = row.payload as Record<string, unknown> | undefined
    if (payload?.type === 'task_started' || payload?.type === 'user_message') {
      probe.settled = false
      probe.failed = false
    } else if (payload?.type === 'task_complete' || payload?.type === 'turn_aborted') {
      probe.settled = true
      const error = payload.error
      probe.failed = payload.type === 'task_complete' && Boolean(
        typeof error === 'string' ? error.trim() : error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' && error.message.trim()
      )
    }
  }
  if (!probe.failed) return event
  const lead = state.codexLeadStateByPaneKey.get(event.paneKey)
  state.codexLeadStateByPaneKey.set(event.paneKey, { state: 'done', model: lead?.model })
  return {
    ...event,
    hookEventName: 'Stop',
    hasExplicitPrompt: false,
    toolAgentId: undefined,
    payload: {
      ...event.payload,
      state: codexRosterEffectiveState(state.codexSubagentRosterByPaneKey.get(event.paneKey), 'done')
    }
  }
}
