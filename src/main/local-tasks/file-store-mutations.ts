import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import type {
  CreateLocalTaskSessionArgs,
  CreateLocalTaskSubtaskArgs,
  LocalTask,
  LocalTaskSession,
  ReportLocalTaskCompletedArgs,
  UpdateLocalTaskArgs
} from '../../shared/local-task-types'
import { findTaskWithSession } from './file-store-index'
import { appendRecord, localTaskDirectory, LOCAL_TASK_RECORDS_FILE_NAME } from './file-store-format'
import { completeTaskReportSession } from './task-report-session-mutation'
export { updateSessionOutput } from './session-output-mutations'
export type FileStoreMutationAccess = {
  requireTask: (id: string, projectPath?: string) => LocalTask
  readTask: (path: string) => LocalTask
  taskPaths: () => Iterable<string>
  writeTask: (task: LocalTask) => LocalTask
}
const time = (): number => Date.now()
const text = (value: string | null | undefined, fallback: string): string =>
  value?.trim() || fallback
const normalizeLabels = (value: string[] | undefined): string[] =>
  [...new Set((value ?? []).map((label) => label.trim()).filter(Boolean))].slice(0, 20)
const isNonExecutionSession = (session: LocalTaskSession): boolean =>
  session.associationSource === 'task-report' || session.associationSource === 'clarification'
export function updateTask(
  store: FileStoreMutationAccess,
  id: string,
  updates: UpdateLocalTaskArgs
): LocalTask {
  const current = store.requireTask(id)
  if (updates.status === 'Done' || updates.status === 'Needs review') {
    throw new Error('This status is controlled by the review lifecycle')
  }
  const nextStatus = updates.status ?? current.status
  const organizingInboxTask = current.intakeState === 'inbox' && updates.intakeState === 'ready'
  const reopenAfterClarification = organizingInboxTask && current.status === 'Needs review'
  return store.writeTask({
    ...current,
    title: updates.title?.trim() || current.title,
    description: updates.description?.trim() || current.description,
    status: reopenAfterClarification ? 'Open' : nextStatus,
    archivedAt:
      updates.archived === true ? time() : updates.archived === false ? null : current.archivedAt,
    titleSource: updates.title?.trim() ? 'user' : current.titleSource,
    titleSuggestion: updates.title?.trim() ? null : current.titleSuggestion,
    labels: updates.labels === undefined ? current.labels : normalizeLabels(updates.labels),
    intakeState: updates.intakeState ?? current.intakeState,
    clarificationRequested: organizingInboxTask ? false : current.clarificationRequested,
    reviewKind: reopenAfterClarification ? null : current.reviewKind,
    reviewQuestion: reopenAfterClarification ? null : current.reviewQuestion,
    agentId: updates.agentId === undefined ? current.agentId : updates.agentId,
    updatedAt: time()
  })
}
export function createSession(
  store: FileStoreMutationAccess,
  args: CreateLocalTaskSessionArgs & { projectPath?: string }
): LocalTaskSession {
  const task = store.requireTask(args.taskId, args.projectPath)
  const sessionId = args.sessionId?.trim() || `lts_${randomUUID()}`
  const owner = findTaskWithSession(store.taskPaths(), sessionId, store.readTask)
  if (owner && owner.id !== task.id) {
    throw new Error('Session is already associated with another local task')
  }
  const existing = task.sessions.find((session) => session.id === sessionId)
  if (existing) {
    return existing
  }
  const requestedPrompt = args.currentPrompt?.trim() || args.initialPrompt?.trim() || null
  const duplicate = task.sessions.find(
    (session) =>
      session.status === 'working' &&
      requestedPrompt !== null &&
      session.currentPrompt?.trim() === requestedPrompt
  )
  if (duplicate) {
    return duplicate
  }
  const createdAt = time()
  const associationSource = args.associationSource ?? 'task-center'
  const session: LocalTaskSession = {
    id: sessionId,
    taskId: task.id,
    workspaceId: text(args.workspaceId, task.workspaceId),
    title: text(args.title, '自动创建会话'),
    currentPrompt: requestedPrompt,
    turns: [],
    status: 'working',
    latestOutput: null,
    manualNotes: null,
    createdAt,
    updatedAt: createdAt,
    agentId: args.agentId ?? null,
    associationSource
  }
  const nonExecutionSession = isNonExecutionSession(session)
  const status = nonExecutionSession
    ? task.status
    : task.status === 'Done' || task.status === 'Needs review'
      ? 'In progress'
      : task.status
  const subtasks =
    !nonExecutionSession && task.sessions.length === 0
      ? task.subtasks.map((subtask) =>
          subtask.sessionId === null ? { ...subtask, sessionId, updatedAt: createdAt } : subtask
        )
      : task.subtasks
  store.writeTask({
    ...task,
    subtasks,
    sessions: [session, ...task.sessions],
    clarificationSessionId:
      session.associationSource === 'clarification' ? session.id : task.clarificationSessionId,
    status,
    updatedAt: createdAt
  })
  return session
}
export function createSubtask(
  store: FileStoreMutationAccess,
  args: CreateLocalTaskSubtaskArgs & { projectPath?: string }
): LocalTask {
  const task = store.requireTask(args.taskId, args.projectPath)
  if (args.sessionId && !task.sessions.some((session) => session.id === args.sessionId)) {
    throw new Error('Session is not associated with this local task')
  }
  const createdAt = time()
  const subtask = {
    id: `ltsub_${randomUUID()}`,
    title: text(args.title, '未命名子任务'),
    status: 'todo' as const,
    sessionId: args.sessionId ?? null,
    steps: (args.steps ?? []).map((title) => ({
      id: `ltstep_${randomUUID()}`,
      title: text(title, '未命名执行步骤'),
      status: 'todo' as const,
      updatedAt: createdAt
    })),
    createdAt,
    updatedAt: createdAt
  }
  return store.writeTask({ ...task, subtasks: [...task.subtasks, subtask], updatedAt: createdAt })
}
export function reportCompleted(
  store: FileStoreMutationAccess,
  args: ReportLocalTaskCompletedArgs & { projectPath?: string }
): LocalTask {
  const task = store.requireTask(args.taskId, args.projectPath)
  const currentSession = task.sessions.find((session) => session.id === args.sessionId)
  if (!currentSession) {
    throw new Error('Session is not associated with this local task')
  }
  if (currentSession.associationSource === 'task-report') {
    return completeTaskReportSession(store, task, args, currentSession)
  }
  const unfinished = task.subtasks.some((subtask) => {
    // A session must not block completion on work explicitly owned by another session.
    if (subtask.sessionId !== null && subtask.sessionId !== args.sessionId) {
      return false
    }
    return (
      subtask.status !== 'done' ||
      subtask.steps.some((step) => step.status !== 'done' && step.status !== 'canceled')
    )
  })
  const updatedAt = time()
  const sessions = task.sessions.map((session) =>
    session.id === args.sessionId
      ? {
          ...session,
          status: unfinished ? ('idle' as const) : ('done' as const),
          latestOutput: args.latestOutput ?? session.latestOutput,
          updatedAt
        }
      : session
  )
  const suggestedTitle =
    args.titleSuggestion?.trim() && task.titleSource === 'first-line'
      ? args.titleSuggestion.trim()
      : null
  const shouldKeepAgentOutput =
    task.latestOutputSource === 'agent-status' && task.latestOutput?.sessionId === args.sessionId
  const activeRun = task.executionRunId
    ? task.runs.find((run) => run.id === task.executionRunId)
    : undefined
  const nextRuns = activeRun
    ? task.runs.map((run) =>
        run.id === activeRun.id
          ? {
              ...run,
              status: 'needs_review' as const,
              sessionId: args.sessionId,
              output: args.latestOutput ?? run.output,
              finishedAt: updatedAt
            }
          : run
      )
    : task.runs
  const next: LocalTask = {
    ...task,
    sessions,
    runs: nextRuns,
    executionState: activeRun ? 'needs_review' : task.executionState,
    reviewKind: activeRun ? 'delivery' : task.reviewKind,
    latestOutput:
      !shouldKeepAgentOutput && args.latestOutput
        ? { sessionId: args.sessionId, text: args.latestOutput, updatedAt }
        : task.latestOutput,
    latestOutputSource: shouldKeepAgentOutput ? 'agent-status' : 'report',
    description: args.description?.trim() || task.description,
    title: suggestedTitle ?? task.title,
    titleSource: suggestedTitle ? 'ai-suggestion' : task.titleSource,
    titleSuggestion: suggestedTitle ?? task.titleSuggestion,
    status: task.status === 'Done' ? task.status : 'Needs review',
    updatedAt
  }
  const result = store.writeTask(next)
  if (args.latestOutput) {
    appendRecord(
      join(localTaskDirectory(task.projectPath, task.id), LOCAL_TASK_RECORDS_FILE_NAME),
      `## ${new Date(updatedAt).toISOString()}\n\n${args.latestOutput}`
    )
  }
  return result
}
