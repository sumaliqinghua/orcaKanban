import type {
  LocalTask,
  LocalTaskSession,
  UpdateLocalTaskSessionOutputArgs
} from '../../shared/local-task-types'
import { resolveLocalTaskStatus } from '../../shared/local-task-status'
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
  const metadataOnly =
    (args.tags !== undefined ||
      args.providerSession !== undefined ||
      args.manualNotes !== undefined) &&
    args.prompt === undefined &&
    args.sessionStatus === undefined &&
    args.latestOutput === undefined
  const session = task.sessions.find(
    (candidate) => candidate.id === args.sessionId || candidate.tabId === args.sessionId
  )
  if (!session) {
    throw new Error('Session is not associated with this local task')
  }
  const prompt = args.prompt?.trim() || session.currentPrompt || ''
  const textValue = args.latestOutput?.trim() ?? ''
  const sessionId = session.id
  const sessions = task.sessions.map((session) =>
    session.id === sessionId
      ? {
          ...session,
          tags:
            args.tags === undefined
              ? session.tags
              : [...new Set(args.tags.map((tag) => tag.trim()).filter(Boolean))].slice(0, 20),
          providerSession: args.providerSession ?? session.providerSession,
          currentPrompt: prompt || session.currentPrompt,
          turns:
            args.sessionStatus === 'done' && prompt
              ? appendSessionTurn(session.turns, prompt, textValue, updatedAt)
              : session.turns,
          status:
            args.sessionStatus === undefined
              ? args.manualNotes === undefined && !metadataOnly
                ? ('done' as const)
                : session.status
              : args.sessionStatus === 'working'
                ? ('working' as const)
                : ('done' as const),
          latestOutput: textValue || session.latestOutput,
          manualNotes:
            args.manualNotes === undefined ? session.manualNotes : args.manualNotes?.trim() || null,
          updatedAt: metadataOnly ? session.updatedAt : updatedAt
        }
      : session
  )
  const nonExecutionSession = isNonExecutionSession(session)
  const executionSessions = sessions.filter((candidate) => !isNonExecutionSession(candidate))
  const sessionEnded =
    args.sessionStatus === 'done' ||
    (args.sessionStatus === undefined && args.manualNotes === undefined && !metadataOnly)
  const activeRun =
    !nonExecutionSession && sessionEnded && task.executionRunId
      ? task.runs.find((run) => run.id === task.executionRunId && run.sessionId === sessionId)
      : undefined
  const runs = activeRun
    ? task.runs.map((run) =>
        run.id === activeRun.id
          ? {
              ...run,
              status: 'needs_review' as const,
              sessionId,
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
    status: nonExecutionSession
      ? task.status
      : resolveLocalTaskStatus(task.status, executionSessions),
    latestOutput:
      !nonExecutionSession && textValue
        ? { sessionId, text: textValue, updatedAt }
        : task.latestOutput,
    latestOutputSource:
      nonExecutionSession || metadataOnly ? task.latestOutputSource : 'agent-status',
    updatedAt: metadataOnly ? task.updatedAt : updatedAt
  })
}
