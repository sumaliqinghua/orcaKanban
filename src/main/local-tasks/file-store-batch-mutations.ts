import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
import type {
  LocalTask,
  LocalTaskBatch,
  LocalTaskBatchTaskRef,
  LocalTaskRunStatus,
  RequestLocalTaskReviewArgs
} from '../../shared/local-task-types'
import type { FileStoreMutationAccess } from './file-store-mutations'
import { isOpenLocalTaskBatchCandidate } from '../../shared/local-task-batch-selection'

const time = (): number => Date.now()

function workspaceKey(task: LocalTask): string {
  return `${resolve(task.projectPath)}::${task.workspaceId}`
}

export function startBatch(
  store: FileStoreMutationAccess,
  refs: LocalTaskBatchTaskRef[],
  options: { recoverQueued?: boolean; automationId?: string; automationRunId?: string } = {}
): LocalTaskBatch {
  const batchId = `ltb_${randomUUID()}`
  const createdAt = time()
  const candidates: LocalTaskBatch['candidates'] = []
  const seen = new Set<string>()
  const originals: LocalTask[] = []
  const recoverQueued = options.recoverQueued === true

  try {
    for (const ref of refs) {
      let task = store.requireTask(ref.taskId, ref.projectPath)
      const taskKey = `${resolve(ref.projectPath)}::${task.id}`
      const queuedRun =
        task.executionState === 'queued' && task.executionRunId
          ? task.runs.find((run) => run.id === task.executionRunId && run.status === 'queued')
          : undefined
      const recoverableQueued =
        recoverQueued &&
        (task.archivedAt ?? null) === null &&
        task.status === 'Open' &&
        (task.intakeState ?? 'ready') === 'ready' &&
        task.executionState === 'queued' &&
        Boolean(queuedRun)
      if (seen.has(taskKey)) {
        continue
      }
      const existingAutomationRun = options.automationRunId
        ? task.runs.find(
            (run) =>
              run.source === 'automation' &&
              run.automationRunId === options.automationRunId &&
              run.automationId === (options.automationId ?? null)
          )
        : undefined
      if (existingAutomationRun) {
        seen.add(taskKey)
        candidates.push({
          task,
          runId: existingAutomationRun.id,
          workspaceKey: workspaceKey(task)
        })
        continue
      }
      if (!isOpenLocalTaskBatchCandidate(task) && !recoverableQueued) {
        continue
      }
      seen.add(taskKey)
      originals.push(task)
      if (queuedRun) {
        task = store.writeTask({
          ...task,
          executionState: 'idle',
          executionBatchId: null,
          executionRunId: null,
          runs: task.runs.map((run) =>
            run.id === queuedRun.id
              ? {
                  ...run,
                  status: 'failed' as const,
                  error: '批次在任务启动前中断，可重新执行',
                  finishedAt: createdAt
                }
              : run
          ),
          updatedAt: createdAt
        })
      }
      const runId = `ltr_${randomUUID()}`
      const run = {
        id: runId,
        batchId,
        taskId: task.id,
        workspaceId: task.workspaceId,
        status: 'queued' as const,
        sessionId: null,
        output: null,
        error: null,
        createdAt,
        startedAt: null,
        finishedAt: null,
        source: options.automationRunId ? ('automation' as const) : ('manual' as const),
        launchRequestId: randomUUID(),
        ...(options.automationId ? { automationId: options.automationId } : {}),
        ...(options.automationRunId ? { automationRunId: options.automationRunId } : {})
      }
      const next = store.writeTask({
        ...task,
        executionState: 'queued',
        executionBatchId: batchId,
        executionRunId: runId,
        reviewKind: null,
        reviewQuestion: null,
        runs: [run, ...task.runs],
        updatedAt: createdAt
      })
      candidates.push({ task: next, runId, workspaceKey: workspaceKey(next) })
    }
  } catch (error) {
    for (let index = originals.length - 1; index >= 0; index -= 1) {
      store.writeTask(originals[index]!)
    }
    throw error
  }

  candidates.sort((left, right) => left.task.createdAt - right.task.createdAt)
  return { id: batchId, createdAt, candidates }
}

export function updateRun(
  store: FileStoreMutationAccess,
  args: {
    taskId: string
    projectPath: string
    runId: string
    status: LocalTaskRunStatus
    sessionId?: string | null
    output?: string | null
    error?: string | null
  }
): LocalTask {
  const task = store.requireTask(args.taskId, args.projectPath)
  const current = task.runs.find((run) => run.id === args.runId)
  if (!current) {
    throw new Error(`Local task run not found: ${args.runId}`)
  }
  const now = time()
  const run = {
    ...current,
    status: args.status,
    sessionId: args.sessionId === undefined ? current.sessionId : args.sessionId,
    output: args.output === undefined ? current.output : args.output,
    error: args.error === undefined ? current.error : args.error,
    startedAt: args.status === 'running' ? (current.startedAt ?? now) : current.startedAt,
    finishedAt:
      args.status === 'needs_review' || args.status === 'failed'
        ? (current.finishedAt ?? now)
        : null
  }
  const runs = task.runs.map((entry) => (entry.id === run.id ? run : entry))
  return store.writeTask({
    ...task,
    runs,
    executionState:
      args.status === 'running'
        ? 'running'
        : args.status === 'needs_review'
          ? 'needs_review'
          : args.status === 'failed'
            ? 'failed'
            : 'queued',
    status:
      args.status === 'needs_review' || args.status === 'failed'
        ? task.status === 'Done'
          ? task.status
          : 'Needs review'
        : task.status,
    reviewKind:
      args.status === 'needs_review'
        ? 'delivery'
        : args.status === 'failed'
          ? 'execution_failed'
          : task.reviewKind,
    updatedAt: now
  })
}

export function requestReview(
  store: FileStoreMutationAccess,
  args: RequestLocalTaskReviewArgs & { projectPath?: string }
): LocalTask {
  const task = store.requireTask(args.taskId, args.projectPath)
  if (!task.sessions.some((session) => session.id === args.sessionId)) {
    throw new Error('Session is not associated with this local task')
  }
  const question = args.question.trim()
  if (!question) {
    throw new Error('A review question is required')
  }
  const updatedAt = time()
  const sessions = task.sessions.map((session) =>
    session.id === args.sessionId && session.status === 'working'
      ? { ...session, status: 'idle' as const, updatedAt }
      : session
  )
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
              output: question,
              finishedAt: updatedAt
            }
          : run
      )
    : task.runs
  return store.writeTask({
    ...task,
    sessions,
    status: task.status === 'Done' ? task.status : 'Needs review',
    executionState: activeRun ? 'needs_review' : task.executionState,
    reviewKind: 'needs_input',
    reviewQuestion: question,
    runs,
    updatedAt
  })
}
