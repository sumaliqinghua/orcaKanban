import type { AppState } from '@/store/types'
import { agentProviderSessionsEqual } from '../../../../shared/agent-session-resume'
import { parsePaneKey } from '../../../../shared/stable-pane-id'
import type { WorkItem } from './mock-data'

export function localTaskSessionMatchesTab(
  session: WorkItem['sessionsList'][number],
  state: Pick<AppState, 'agentStatusByPaneKey' | 'sleepingAgentSessionsByPaneKey'>,
  paneKey?: string
): boolean {
  if (!session.providerSession) {
    return true
  }
  const tabId = session.tabId ?? session.id
  const matchesPane = (key: string): boolean =>
    parsePaneKey(key)?.tabId === tabId && (!paneKey || paneKey === key)
  const liveEntries = Object.entries(state.agentStatusByPaneKey ?? {}).filter(([key]) =>
    matchesPane(key)
  )
  if (liveEntries.length > 0) {
    return liveEntries.some(
      ([, entry]) =>
        entry.agentType === session.agentId &&
        agentProviderSessionsEqual(
          session.agentId ?? undefined,
          session.providerSession,
          entry.providerSession
        )
    )
  }
  return Object.entries(state.sleepingAgentSessionsByPaneKey ?? {}).some(
    ([key, entry]) =>
      matchesPane(key) &&
      entry.agent === session.agentId &&
      agentProviderSessionsEqual(
        session.agentId ?? undefined,
        session.providerSession,
        entry.providerSession
      )
  )
}
