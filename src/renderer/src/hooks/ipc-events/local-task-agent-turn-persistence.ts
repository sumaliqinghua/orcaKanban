import type { AgentStatusIpcPayload } from '../../../../shared/agent-status-types'

export function persistLocalTaskAgentTurn(
  ownerTabId: string | undefined,
  data: AgentStatusIpcPayload
): void {
  const hasLifecycleState = data.state === 'working' || data.state === 'done'
  if (!ownerTabId || (!hasLifecycleState && !data.prompt?.trim() && !data.providerSession)) {
    return
  }
  const updateSessionOutput = window.api.localTasks?.updateSessionOutput
  if (typeof updateSessionOutput !== 'function') {
    return
  }
  void updateSessionOutput({
    sessionId: ownerTabId,
    ...(data.providerSession ? { providerSession: data.providerSession } : {}),
    ...(data.prompt?.trim() || hasLifecycleState
      ? { sessionStatus: data.state === 'done' ? ('done' as const) : ('working' as const) }
      : {}),
    ...(data.prompt?.trim() ? { prompt: data.prompt.trim() } : {}),
    ...(data.lastAssistantMessage?.trim() ? { latestOutput: data.lastAssistantMessage.trim() } : {})
  }).catch((error: unknown) => {
    console.warn('[local-task] failed to persist final Agent output:', error)
  })
}
