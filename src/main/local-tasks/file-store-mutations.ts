import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import type {
  CreateLocalTaskSessionArgs,
  CreateLocalTaskSubtaskArgs,
  LocalTask,
  LocalTaskSession,
  ReportLocalTaskCompletedArgs,
  UpdateLocalTaskSessionOutputArgs
} from '../../shared/local-task-types'
import { findTaskWithSession } from './file-store-index'
import { appendRecord, localTaskDirectory, LOCAL_TASK_RECORDS_FILE_NAME } from './file-store-format'
import { appendSessionTurn } from './session-turn-mutations'

export type FileStoreMutationAccess = {
  requireTask: (id: string, projectPath?: string) => LocalTask
  readTask: (path: string) => LocalTask
  taskPaths: () => Iterable<string>
  writeTask: (task: LocalTask) => LocalTask
}

const time = (): number => Date.now()
const text = (value: string | null | undefined, fallback: string): string =>
  value?.trim() || fallback

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
  const requestedPrompt = args.initialPrompt?.trim() || null
  const duplicate = task.sessions.find(
    (session) =>
      session.status === 'working' &&
      requestedPrompt !== null &&
      session.initialPrompt?.trim() === requestedPrompt
  )
  if (duplicate) {
    return duplicate
  }
  const createdAt = time()
  const session: LocalTaskSession = {
    id: sessionId,
    taskId: task.id,
    workspaceId: text(args.workspaceId, task.workspaceId),
    title: text(args.title, '自动创建会话'),
    currentPrompt: requestedPrompt,
    turns: [],
    initialPrompt: requestedPrompt,
    status: 'working',
    latestOutput: null,
    createdAt,
    updatedAt: createdAt,
    associationSource: args.associationSource ?? 'task-center'
  }
  const status =
    task.status === 'Done' || task.status === 'Needs review' ? 'In progress' : task.status
  store.writeTask({ ...task, sessions: [session, ...task.sessions], status, updatedAt: createdAt })
  return session
}

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
          status: args.sessionStatus === 'working' ? ('working' as const) : ('done' as const),
          latestOutput: textValue || session.latestOutput,
          updatedAt
        }
      : session
  )
  const hasEndedSession = sessions.some((session) => session.status !== 'working')
  const hasWorkingSession = sessions.some((session) => session.status === 'working')
  const activeRun = task.executionRunId
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
    status:
      task.status === 'Done'
        ? 'Done'
        : hasEndedSession
          ? 'Needs review'
          : hasWorkingSession
            ? 'In progress'
            : 'Needs review',
    latestOutput: textValue
      ? { sessionId: args.sessionId, text: textValue, updatedAt }
      : task.latestOutput,
    latestOutputSource: 'agent-status',
    updatedAt
  })
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
  if (!task.sessions.some((session) => session.id === args.sessionId)) {
    throw new Error('Session is not associated with this local task')
  }
  const unfinished = task.subtasks.some(
    (subtask) =>
      subtask.status !== 'done' ||
      subtask.steps.some((step) => step.status !== 'done' && step.status !== 'canceled')
  )
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
