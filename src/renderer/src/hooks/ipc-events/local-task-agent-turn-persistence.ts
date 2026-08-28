import type { AgentStatusIpcPayload } from '../../../../shared/agent-status-types'

export function persistLocalTaskAgentTurn(
  ownerTabId: string | undefined,
  data: AgentStatusIpcPayload
): void {
  if (!ownerTabId || (data.state !== 'done' && !data.prompt?.trim())) {
    return
  }
  const updateSessionOutput = window.api.localTasks?.updateSessionOutput
  if (typeof updateSessionOutput !== 'function') {
    return
  }
  void updateSessionOutput({
    sessionId: ownerTabId,
    sessionStatus: data.state === 'done' ? 'done' : 'working',
    ...(data.prompt?.trim() ? { prompt: data.prompt.trim() } : {}),
    ...(data.lastAssistantMessage?.trim() ? { latestOutput: data.lastAssistantMessage.trim() } : {})
  }).catch((error: unknown) => {
    console.warn('[local-task] failed to persist final Agent output:', error)
  })
}
