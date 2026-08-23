import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import type {
  CreateLocalTaskSessionArgs,
  CreateLocalTaskSubtaskArgs,
  EditLocalTaskStepTitleArgs,
  LocalTask,
  LocalTaskSession,
  ReportLocalTaskCompletedArgs,
  UpdateLocalTaskStepArgs,
  UpdateLocalTaskSubtaskArgs
} from '../../shared/local-task-types'
import { findStep, findSubtask, findTaskWithSession } from './file-store-index'
import { appendRecord, localTaskDirectory, LOCAL_TASK_RECORDS_FILE_NAME } from './file-store-format'

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
  const createdAt = time()
  const session: LocalTaskSession = {
    id: sessionId,
    taskId: task.id,
    workspaceId: text(args.workspaceId, task.workspaceId),
    title: text(args.title, '自动创建会话'),
    status: 'working',
    latestOutput: null,
    createdAt,
    updatedAt: createdAt,
    associationSource: args.associationSource ?? 'task-center'
  }
  const status = task.status === 'Open' || task.status === 'Waiting' ? 'In progress' : task.status
  store.writeTask({ ...task, sessions: [session, ...task.sessions], status, updatedAt: createdAt })
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

export function updateSubtask(
  store: FileStoreMutationAccess,
  args: UpdateLocalTaskSubtaskArgs
): LocalTask {
  const { task, index } = findSubtask(store.taskPaths(), args.subtaskId, store.readTask)
  const subtasks = [...task.subtasks]
  const current = subtasks[index]
  subtasks[index] = {
    ...current,
    title: args.title?.trim() || current.title,
    status: args.status ?? current.status,
    updatedAt: time()
  }
  return store.writeTask({ ...task, subtasks, updatedAt: time() })
}

export function updateStep(
  store: FileStoreMutationAccess,
  args: UpdateLocalTaskStepArgs
): LocalTask {
  const { task, subtaskIndex, stepIndex } = findStep(
    store.taskPaths(),
    args.stepId,
    args.subtaskId,
    store.readTask
  )
  const subtasks = task.subtasks.map((subtask, index) => {
    if (index !== subtaskIndex) {
      return subtask
    }
    const steps = subtask.steps.map((step, currentIndex) =>
      currentIndex === stepIndex
        ? {
            ...step,
            title: args.title?.trim() || step.title,
            status: args.status ?? step.status,
            updatedAt: time()
          }
        : step
    )
    return { ...subtask, steps, updatedAt: time() }
  })
  return store.writeTask({ ...task, subtasks, updatedAt: time() })
}

export function editStepTitle(
  store: FileStoreMutationAccess,
  args: EditLocalTaskStepTitleArgs
): LocalTask {
  const { task, subtaskIndex, stepIndex } = findStep(
    store.taskPaths(),
    args.stepId,
    args.subtaskId,
    store.readTask
  )
  if (task.subtasks[subtaskIndex].steps[stepIndex].status !== 'todo') {
    throw new Error('Only an unstarted AI step can be edited')
  }
  return updateStep(store, { subtaskId: args.subtaskId, stepId: args.stepId, title: args.title })
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
  const next: LocalTask = {
    ...task,
    sessions,
    latestOutput: args.latestOutput
      ? { sessionId: args.sessionId, text: args.latestOutput, updatedAt }
      : task.latestOutput,
    description: args.description?.trim() || task.description,
    title: suggestedTitle ?? task.title,
    titleSource: suggestedTitle ? 'ai-suggestion' : task.titleSource,
    titleSuggestion: suggestedTitle ?? task.titleSuggestion,
    status:
      task.status === 'Done' || task.status === 'Needs review'
        ? task.status
        : unfinished
          ? 'In progress'
          : 'Needs review',
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
