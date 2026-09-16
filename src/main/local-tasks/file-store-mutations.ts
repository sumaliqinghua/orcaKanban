import { randomUUID } from 'node:crypto'
import { resolveLocalTaskStatus } from '../../shared/local-task-status'
import { join } from 'node:path'
import type {
  CreateLocalTaskSessionArgs,
  CreateLocalTaskSubtaskArgs,
  LocalTask,
  LocalTaskSession,
  ReportLocalTaskCompletedArgs,
  UpdateLocalTaskArgs
} from '../../shared/local-task-types'
import { applyChecklistChange, requireChecklistConversion } from './checklist-mutations'
import { findTaskWithSession } from './file-store-index'
import { localTaskDirectory, LOCAL_TASK_RECORDS_FILE_NAME } from './task-context-paths'
import { appendRecord } from './task-context-file-io'
import { completeTaskReportSession } from './task-report-session-mutation'
export { updateSessionOutput } from './session-output-mutations'
export { rebindSessionTab } from './session-tab-mutations'
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
  updates: UpdateLocalTaskArgs,
  projectPath?: string
): LocalTask {
  const current = store.requireTask(id, projectPath)
  if (updates.status === 'Done' || updates.status === 'Needs review') {
    throw new Error('This status is controlled by the review lifecycle')
  }
  const nextStatus = updates.status ?? current.status
  const organizingInboxTask = current.intakeState === 'inbox' && updates.intakeState === 'ready'
  const reopenAfterClarification = organizingInboxTask && current.status === 'Needs review'
  return store.writeTask({
    ...current,
    ...(updates.checklistChange
      ? { checklist: applyChecklistChange(current.checklist ?? [], updates.checklistChange) }
      : {}),
    projectPath: updates.projectPath?.trim() || current.projectPath,
    workspaceId: updates.workspaceId?.trim() || current.workspaceId,
    workspaceLabel: updates.workspaceLabel?.trim() || current.workspaceLabel,
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
  const checklistItem = args.sourceChecklistItemId
    ? requireChecklistConversion(task, args.sourceChecklistItemId, args.associationSource)
    : undefined
  const requestedPrompt = args.currentPrompt?.trim() || args.initialPrompt?.trim() || null
  const duplicate = task.sessions.find(
    (session) =>
      !checklistItem &&
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
    tags: normalizeLabels(args.tags),
    ...(args.providerSession ? { providerSession: args.providerSession } : {}),
    tabId: sessionId,
    taskId: task.id,
    workspaceId: text(args.workspaceId, task.workspaceId),
    title: text(args.title, '自动创建会话'),
    currentPrompt: requestedPrompt,
    turns: [],
    status: args.initialStatus ?? 'working',
    latestOutput: null,
    manualNotes: null,
    createdAt,
    updatedAt: createdAt,
    agentId: args.agentId ?? null,
    associationSource
  }
  const nonExecutionSession = isNonExecutionSession(session)
  const status = nonExecutionSession ? task.status : 'In progress'
  const defaultSubtaskIndex =
    !checklistItem && !nonExecutionSession && task.sessions.every(isNonExecutionSession)
      ? task.subtasks.findIndex((subtask) => subtask.sessionId === null)
      : -1
  let subtasks = task.subtasks.map((subtask, index) =>
    index === defaultSubtaskIndex ? { ...subtask, sessionId, updatedAt: createdAt } : subtask
  )
  if (!nonExecutionSession && defaultSubtaskIndex === -1) {
    subtasks = [
      {
        id: `ltsub_${randomUUID()}`,
        title: checklistItem?.title ?? text(args.title, requestedPrompt ?? '关联会话'),
        status: 'todo' as const,
        sessionId,
        steps: [],
        createdAt,
        updatedAt: createdAt
      },
      ...subtasks
    ]
  }
  store.writeTask({
    ...task,
    ...(checklistItem
      ? { checklist: task.checklist!.filter((item) => item.id !== checklistItem.id) }
      : {}),
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
  return store.writeTask({ ...task, subtasks: [subtask, ...task.subtasks], updatedAt: createdAt })
}
export function reportCompleted(
  store: FileStoreMutationAccess,
  args: ReportLocalTaskCompletedArgs & { projectPath?: string }
): LocalTask {
  const task = store.requireTask(args.taskId, args.projectPath)
  const currentSession = task.sessions.find(
    (session) => session.id === args.sessionId || session.tabId === args.sessionId
  )
  if (!currentSession) {
    throw new Error('Session is not associated with this local task')
  }
  if (currentSession.associationSource === 'task-report') {
    return completeTaskReportSession(store, task, args, currentSession)
  }
  const sessionId = currentSession.id
  const unfinished = task.subtasks.some((subtask) => {
    // A session must not block completion on work explicitly owned by another session.
    if (subtask.sessionId !== null && subtask.sessionId !== sessionId) {
      return false
    }
    return (
      subtask.status !== 'done' ||
      subtask.steps.some((step) => step.status !== 'done' && step.status !== 'canceled')
    )
  })
  const updatedAt = time()
  const sessions = task.sessions.map((session) =>
    session.id === sessionId
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
    task.latestOutputSource === 'agent-status' && task.latestOutput?.sessionId === sessionId
  const activeRun = task.executionRunId
    ? task.runs.find((run) => run.id === task.executionRunId)
    : undefined
  const nextRuns = activeRun
    ? task.runs.map((run) =>
        run.id === activeRun.id
          ? {
              ...run,
              status: 'needs_review' as const,
              sessionId,
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
    latestOutput:
      !shouldKeepAgentOutput && args.latestOutput
        ? { sessionId, text: args.latestOutput, updatedAt }
        : task.latestOutput,
    latestOutputSource: shouldKeepAgentOutput ? 'agent-status' : 'report',
    description: args.description?.trim() || task.description,
    title: suggestedTitle ?? task.title,
    titleSource: suggestedTitle ? 'ai-suggestion' : task.titleSource,
    titleSuggestion: suggestedTitle ?? task.titleSuggestion,
    status: resolveLocalTaskStatus(
      task.status,
      sessions.filter((entry) => !isNonExecutionSession(entry))
    ),
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
