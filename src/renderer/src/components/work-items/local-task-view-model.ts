import type { LocalTask, LocalTaskSubtask } from '../../../../shared/local-task-types'
import { resolveLocalTaskStatus } from '../../../../shared/local-task-status'
import type { WorkItem, Subtask } from './mock-data'
import type { DashboardCard } from '../../../../shared/dashboard-snapshot'

const SESSION_START_GRACE_MS = 15_000
const isExecutionSession = (session: LocalTask['sessions'][number]): boolean =>
  session.associationSource !== 'task-report' && session.associationSource !== 'clarification'

function mapSubtask(subtask: LocalTaskSubtask): Subtask {
  return {
    id: subtask.id,
    title: subtask.title,
    status: subtask.status,
    sessionId: subtask.sessionId,
    session: subtask.sessionId ?? '未关联会话',
    steps: subtask.steps
  }
}

export function localTaskToViewModel(task: LocalTask): WorkItem {
  const executionSessions = task.sessions.filter(isExecutionSession)
  const activeSessions = executionSessions.filter((session) => session.status === 'working').length
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: resolveLocalTaskStatus(task.status, executionSessions),
    workspace: task.workspaceLabel,
    workspaceId: task.workspaceId,
    projectPath: task.projectPath,
    project: task.projectId,
    updated: new Date(task.updatedAt).toLocaleString(),
    sessions: executionSessions.length,
    activeSessions,
    checklist: task.checklist ?? [],
    subtasks: task.subtasks.map(mapSubtask),
    latestOutput: task.latestOutput
      ? {
          session:
            task.sessions.find((session) => session.id === task.latestOutput?.sessionId)?.title ??
            '关联会话',
          text: task.latestOutput.text
        }
      : { session: '暂无会话', text: '尚未开始。' },
    sessionsList: task.sessions.map((session) => ({
      retry: session.retry,
      id: session.id,
      tabId: session.tabId,
      terminalBinding: session.terminalBinding,
      providerSession: session.providerSession,
      title: session.title,
      currentPrompt: session.currentPrompt,
      turns: session.turns,
      latestOutput: session.latestOutput,
      manualNotes: session.manualNotes,
      tags: session.tags,
      agentId: session.agentId,
      associationSource: session.associationSource,
      workspaceId: session.workspaceId,
      status: session.status,
      time: new Date(session.updatedAt).toLocaleString(),
      updatedAt: session.updatedAt
    })),
    titleSource: task.titleSource,
    titleSuggestion: task.titleSuggestion,
    labels: task.labels,
    archivedAt: task.archivedAt,
    intakeState: task.intakeState,
    executionState: task.executionState,
    executionBatchId: task.executionBatchId,
    executionRunId: task.executionRunId
  }
}

export function collectLiveTaskSessionIds(
  dashboardCards: readonly Pick<DashboardCard, 'tabId' | 'dotState'>[]
): ReadonlySet<string> {
  return new Set(
    dashboardCards.filter((card) => card.dotState === 'working').map((card) => card.tabId)
  )
}

export function reconcileWorkItemSessionLiveness(
  item: WorkItem,
  liveSessionIds: ReadonlySet<string>,
  now = Date.now(),
  options: {
    dashboardCards?: readonly (Pick<DashboardCard, 'tabId' | 'dotState'> &
      Partial<Pick<DashboardCard, 'paneKey'>>)[]
    unverifiable?: boolean
    matchesSession?: (session: WorkItem['sessionsList'][number], paneKey?: string) => boolean
  } = {}
): WorkItem {
  const sessionsList = item.sessionsList.map((session) => {
    if (session.retry) {
      return {
        ...session,
        status: session.retry.phase === 'running' ? ('working' as const) : ('idle' as const)
      }
    }
    if (!session.id) {
      return session
    }
    const withinStartGrace =
      typeof session.updatedAt === 'number' && now - session.updatedAt < SESSION_START_GRACE_MS
    const tabId = session.tabId ?? session.id
    const matchesSession = options.matchesSession?.(session) ?? true
    const cards = options.dashboardCards?.filter(
      (candidate) =>
        candidate.tabId === tabId && (options.matchesSession?.(session, candidate.paneKey) ?? true)
    )
    const working = cards
      ? cards.some((card) => card.dotState === 'working')
      : matchesSession && liveSessionIds.has(tabId)
    if (working) {
      return { ...session, status: 'working' as const }
    }
    const card = cards?.find((candidate) => candidate.dotState !== 'done') ?? cards?.[0]
    if (card) {
      return {
        ...session,
        status: card.dotState === 'done' ? ('done' as const) : ('idle' as const)
      }
    }
    if (session.status !== 'working' || withinStartGrace) {
      return session
    }
    if (options.unverifiable) {
      return { ...session, status: 'idle' as const, livenessUnverifiable: true }
    }
    return { ...session, status: 'done' as const }
  })
  const executionSessions = sessionsList.filter(
    (session) =>
      session.associationSource !== 'task-report' && session.associationSource !== 'clarification'
  )
  const activeSessions = executionSessions.filter((session) => session.status === 'working').length
  const status = resolveLocalTaskStatus(item.status, executionSessions)
  return { ...item, status, activeSessions, sessionsList }
}
