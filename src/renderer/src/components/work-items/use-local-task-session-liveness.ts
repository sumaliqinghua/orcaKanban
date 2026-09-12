import { useEffect, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '@/store'
import { getAiVaultResumeWorkspaceTargetStatus } from '@/lib/ai-vault-resume-target'
import { useLiveDashboardSnapshot } from '../dashboard/useLiveDashboardSnapshot'
import { localTaskSessionMatchesTab } from './local-task-session-identity'
import {
  collectLiveTaskSessionIds,
  reconcileWorkItemSessionLiveness
} from './local-task-view-model'
import type { WorkItem } from './mock-data'

export function useLocalTaskSessionLiveness(items: WorkItem[]): WorkItem[] {
  const { cards } = useLiveDashboardSnapshot()
  const identityAndHostState = useAppStore(
    useShallow((state) => ({
      repos: state.repos,
      worktreesByRepo: state.worktreesByRepo,
      folderWorkspaces: state.folderWorkspaces,
      projectGroups: state.projectGroups,
      agentStatusByPaneKey: state.agentStatusByPaneKey,
      sleepingAgentSessionsByPaneKey: state.sleepingAgentSessionsByPaneKey
    }))
  )
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(timer)
  }, [])
  return useMemo(() => {
    const liveIds = collectLiveTaskSessionIds(cards)
    return items.map((item) =>
      reconcileWorkItemSessionLiveness(item, liveIds, now, {
        dashboardCards: cards,
        matchesSession: (session, paneKey) =>
          localTaskSessionMatchesTab(session, identityAndHostState, paneKey),
        unverifiable:
          getAiVaultResumeWorkspaceTargetStatus(identityAndHostState, item.workspaceId ?? null) !==
          'local'
      })
    )
  }, [items, cards, now, identityAndHostState])
}
