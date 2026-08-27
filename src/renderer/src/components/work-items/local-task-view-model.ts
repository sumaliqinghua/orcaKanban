import type { LocalTask, LocalTaskSubtask } from '../../../../shared/local-task-types'
import type { WorkItem, Subtask } from './mock-data'

const SESSION_START_GRACE_MS = 15_000

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
  const activeSessions = task.sessions.filter((session) => session.status === 'working').length
  const hasEndedSession = task.sessions.some((session) => session.status !== 'working')
  const isExecutionActive = task.executionState === 'queued' || task.executionState === 'running'
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: hasEndedSession
      ? 'Needs review'
      : activeSessions > 0 || isExecutionActive
        ? 'In progress'
        : task.status,
    workspace: task.workspaceLabel,
    workspaceId: task.workspaceId,
    projectPath: task.projectPath,
    project: task.projectId,
    updated: new Date(task.updatedAt).toLocaleString(),
    sessions: task.sessions.length,
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
      title: session.title,
      currentPrompt: session.currentPrompt,
      turns: session.turns,
      latestOutput: session.latestOutput,
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
    return liveSessionIds.has(session.id) || withinStartGrace
      ? session
      : { ...session, status: 'done' as const }
  })
  const activeSessions = sessionsList.filter((session) => session.status === 'working').length
  const hasEndedSession = sessionsList.some((session) => session.status !== 'working')
  const executionActive = item.executionState === 'queued' || item.executionState === 'running'
  const status =
    item.status === 'Done'
      ? 'Done'
      : hasEndedSession
        ? 'Needs review'
        : activeSessions > 0 || executionActive
          ? 'In progress'
          : item.sessions > 0
            ? 'Needs review'
            : item.status === 'In progress'
              ? 'Open'
              : item.status
  return { ...item, status, activeSessions, sessionsList }
}
