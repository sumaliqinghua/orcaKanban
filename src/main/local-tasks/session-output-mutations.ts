import type {
  LocalTask,
  LocalTaskSession,
  UpdateLocalTaskSessionOutputArgs
} from '../../shared/local-task-types'
import { findTaskWithSession } from './file-store-index'
import { appendSessionTurn } from './session-turn-mutations'
import type { FileStoreMutationAccess } from './file-store-mutations'

const time = (): number => Date.now()
const isNonExecutionSession = (session: LocalTaskSession): boolean =>
  session.associationSource === 'task-report' || session.associationSource === 'clarification'

export function updateSessionOutput(
  store: FileStoreMutationAccess,
  args: UpdateLocalTaskSessionOutputArgs
): LocalTask {
  const task = findTaskWithSession(store.taskPaths(), args.sessionId, store.readTask)
  if (!task) {
    throw new Error('Session is not associated with any local task')
  }
  const updatedAt = time()
  const session = task.sessions.find((candidate) => candidate.id === args.sessionId)
  if (!session) {
    throw new Error('Session is not associated with this local task')
  }
  const prompt = args.prompt?.trim() || session.currentPrompt || ''
  const textValue = args.latestOutput?.trim() ?? ''
  const sessions = task.sessions.map((session) =>
    session.id === args.sessionId
      ? {
          ...session,
          currentPrompt: prompt || session.currentPrompt,
          turns:
            args.sessionStatus === 'done' && prompt
              ? appendSessionTurn(session.turns, prompt, textValue, updatedAt)
              : session.turns,
          status:
            args.sessionStatus === undefined
              ? args.manualNotes === undefined
                ? ('done' as const)
                : session.status
              : args.sessionStatus === 'working'
                ? ('working' as const)
                : ('done' as const),
          latestOutput: textValue || session.latestOutput,
          manualNotes:
            args.manualNotes === undefined ? session.manualNotes : args.manualNotes?.trim() || null,
          updatedAt
        }
      : session
  )
  const nonExecutionSession = isNonExecutionSession(session)
  const executionSessions = sessions.filter((candidate) => !isNonExecutionSession(candidate))
  const hasEndedSession = executionSessions.some((candidate) => candidate.status !== 'working')
  const hasWorkingSession = executionSessions.some((candidate) => candidate.status === 'working')
  const activeRun =
    !nonExecutionSession && task.executionRunId
      ? task.runs.find((run) => run.id === task.executionRunId)
      : undefined
  const runs = activeRun
    ? task.runs.map((run) =>
        run.id === activeRun.id
          ? {
              ...run,
              status: 'needs_review' as const,
              sessionId: args.sessionId,
              output: textValue || run.output,
              finishedAt: updatedAt
            }
          : run
      )
    : task.runs
  return store.writeTask({
    ...task,
    sessions,
    runs,
    executionState: activeRun ? 'needs_review' : task.executionState,
    reviewKind: activeRun ? 'delivery' : task.reviewKind,
    status: nonExecutionSession
      ? task.status
      : task.status === 'Done'
        ? 'Done'
        : hasEndedSession
          ? 'Needs review'
          : hasWorkingSession
            ? 'In progress'
            : 'Needs review',
    latestOutput:
      !nonExecutionSession && textValue
        ? { sessionId: args.sessionId, text: textValue, updatedAt }
        : task.latestOutput,
    latestOutputSource: nonExecutionSession ? task.latestOutputSource : 'agent-status',
    updatedAt
  })
}
