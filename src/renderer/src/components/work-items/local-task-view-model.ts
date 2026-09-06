import type { LocalTask, LocalTaskSubtask } from '../../../../shared/local-task-types'
import { resolveLocalTaskStatus } from '../../../../shared/local-task-status'
import type { WorkItem, Subtask } from './mock-data'

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
      id: session.id,
      tabId: session.tabId,
      title: session.title,
      currentPrompt: session.currentPrompt,
      turns: session.turns,
      latestOutput: session.latestOutput,
      manualNotes: session.manualNotes,
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
    executionRunId: task.executionRunId,
    reviewKind: task.reviewKind
  }
}

export function collectLiveTaskSessionIds(
  dashboardCards: readonly { tabId: string }[],
  ptyIdsByTabId: Readonly<Record<string, readonly string[]>>
): ReadonlySet<string> {
  return new Set([
    ...dashboardCards.map((card) => card.tabId),
    ...Object.entries(ptyIdsByTabId)
      .filter(([, ptyIds]) => ptyIds.length > 0)
      .map(([tabId]) => tabId)
  ])
}

export function reconcileWorkItemSessionLiveness(
  item: WorkItem,
  liveSessionIds: ReadonlySet<string>,
  now = Date.now()
): WorkItem {
  const sessionsList = item.sessionsList.map((session) => {
    if (session.status !== 'working' || !session.id) {
      return session
    }
    const withinStartGrace =
      typeof session.updatedAt === 'number' && now - session.updatedAt < SESSION_START_GRACE_MS
    return liveSessionIds.has(session.tabId ?? session.id) || withinStartGrace
      ? session
      : { ...session, status: 'done' as const }
  })
  const executionSessions = sessionsList.filter(
    (session) =>
      session.associationSource !== 'task-report' && session.associationSource !== 'clarification'
  )
  const activeSessions = executionSessions.filter((session) => session.status === 'working').length
  const status = resolveLocalTaskStatus(item.status, executionSessions)
  return { ...item, status, activeSessions, sessionsList }
}
