import { randomUUID } from 'node:crypto'
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import {
  LOCAL_TASK_STATUSES,
  type LocalTask,
  type LocalTaskExecutionState,
  type LocalTaskReviewKind,
  type LocalTaskRun
} from '../../shared/local-task-types'

export const LOCAL_TASK_ROOT_NAME = 'orca'
export const LOCAL_TASK_FILE_NAME = 'task.json'
export const LOCAL_TASK_PLAN_FILE_NAME = 'plan.json'
export const LOCAL_TASK_PRD_FILE_NAME = 'prd.md'
export const LOCAL_TASK_RECORDS_FILE_NAME = 'records.md'

export function localTaskDirectory(projectPath: string, taskId: string): string {
  return join(resolve(projectPath), LOCAL_TASK_ROOT_NAME, taskId)
}

export function localTaskFile(projectPath: string, taskId: string): string {
  return join(localTaskDirectory(projectPath, taskId), LOCAL_TASK_FILE_NAME)
}

export function atomicWrite(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true })
  const temporary = `${path}.tmp-${process.pid}-${randomUUID()}`
  writeFileSync(temporary, content, 'utf8')
  renameSync(temporary, path)
}

export function writeJson(path: string, value: unknown): void {
  atomicWrite(path, `${JSON.stringify(value, null, 2)}\n`)
}

export function appendRecord(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true })
  appendFileSync(path, `\n${content.trim()}\n`, 'utf8')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requiredString(value: unknown, name: string, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Invalid local task file ${path}: ${name} must be a non-empty string`)
  }
  return value
}

function requiredStatus(value: unknown, path: string): LocalTask['status'] {
  if (value === 'Completed') {
    return 'Needs review'
  }
  if (typeof value === 'string' && LOCAL_TASK_STATUSES.includes(value as LocalTask['status'])) {
    return value as LocalTask['status']
  }
  throw new Error(`Invalid local task file ${path}: status is not supported`)
}

function executionState(value: unknown): LocalTaskExecutionState {
  return value === 'queued' || value === 'running' || value === 'needs_review' || value === 'failed'
    ? value
    : 'idle'
}

function reviewKind(value: unknown): LocalTaskReviewKind | null {
  return value === 'delivery' || value === 'needs_input' || value === 'execution_failed'
    ? value
    : null
}

function readRuns(value: unknown): LocalTaskRun[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter(isRecord).flatMap((raw) => {
    if (
      typeof raw.id !== 'string' ||
      typeof raw.batchId !== 'string' ||
      typeof raw.taskId !== 'string' ||
      typeof raw.workspaceId !== 'string'
    ) {
      return []
    }
    const status =
      raw.status === 'running' || raw.status === 'needs_review' || raw.status === 'failed'
        ? raw.status
        : 'queued'
    return [
      {
        id: raw.id,
        batchId: raw.batchId,
        taskId: raw.taskId,
        workspaceId: raw.workspaceId,
        status,
        sessionId: typeof raw.sessionId === 'string' ? raw.sessionId : null,
        output: typeof raw.output === 'string' ? raw.output : null,
        error: typeof raw.error === 'string' ? raw.error : null,
        createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
        startedAt: typeof raw.startedAt === 'number' ? raw.startedAt : null,
        finishedAt: typeof raw.finishedAt === 'number' ? raw.finishedAt : null
      }
    ]
  })
}

function subtaskStatus(value: unknown): LocalTask['subtasks'][number]['status'] {
  return value === 'doing' || value === 'in_progress'
    ? 'doing'
    : value === 'done' || value === 'completed'
      ? 'done'
      : 'todo'
}

function stepStatus(value: unknown): LocalTask['subtasks'][number]['steps'][number]['status'] {
  return value === 'doing' || value === 'in_progress'
    ? 'doing'
    : value === 'done' || value === 'completed'
      ? 'done'
      : value === 'canceled' || value === 'cancelled'
        ? 'canceled'
        : 'todo'
}

function readPlanSubtasks(path: string): LocalTask['subtasks'] {
  try {
    const parsed = JSON.parse(
      readFileSync(join(dirname(path), LOCAL_TASK_PLAN_FILE_NAME), 'utf8')
    ) as { subtasks?: unknown }
    if (!Array.isArray(parsed.subtasks)) {
      return []
    }
    return parsed.subtasks.filter(isRecord).map((raw, subtaskIndex) => {
      const steps = Array.isArray(raw.steps) ? raw.steps : []
      return {
        id: typeof raw.id === 'string' ? raw.id : `plan-subtask-${subtaskIndex}`,
        title: typeof raw.title === 'string' && raw.title.trim() ? raw.title : '未命名子任务',
        status: subtaskStatus(raw.status),
        sessionId: typeof raw.sessionId === 'string' ? raw.sessionId : null,
        steps: steps.filter(isRecord).map((step, stepIndex) => ({
          id: typeof step.id === 'string' ? step.id : `plan-step-${subtaskIndex}-${stepIndex}`,
          title:
            typeof step.title === 'string' && step.title.trim() ? step.title : '未命名执行步骤',
          status: stepStatus(step.status),
          updatedAt: typeof step.updatedAt === 'number' ? step.updatedAt : Date.now()
        })),
        createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
        updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : Date.now()
      }
    })
  } catch {
    return []
  }
}

export function readLocalTaskFile(path: string): LocalTask {
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    throw new Error(
      `Could not read local task file ${path}: ${error instanceof Error ? error.message : String(error)}`
    )
  }
  if (!isRecord(parsed)) {
    throw new Error(`Invalid local task file ${path}: expected an object`)
  }
  const value = parsed as Partial<LocalTask>
  const sessions = Array.isArray(value.sessions)
    ? value.sessions.filter(isRecord).map((session) => ({
        ...session,
        initialPrompt: typeof session.initialPrompt === 'string' ? session.initialPrompt : null,
        status: (session.status as string) === 'completed' ? 'done' : session.status
      }))
    : []
  const subtasks =
    Array.isArray(value.subtasks) && value.subtasks.length > 0
      ? value.subtasks
      : readPlanSubtasks(path)
  const latestOutput =
    typeof value.latestOutput === 'string'
      ? {
          sessionId: sessions[0]?.id ?? '',
          text: value.latestOutput,
          updatedAt: typeof value.updatedAt === 'number' ? value.updatedAt : Date.now()
        }
      : isRecord(value.latestOutput) && typeof value.latestOutput.text === 'string'
        ? {
            sessionId:
              typeof value.latestOutput.sessionId === 'string'
                ? value.latestOutput.sessionId
                : (sessions[0]?.id ?? ''),
            text: value.latestOutput.text,
            updatedAt:
              typeof value.latestOutput.updatedAt === 'number'
                ? value.latestOutput.updatedAt
                : Date.now()
          }
        : null
  return {
    schemaVersion: 1,
    id: requiredString(value.id, 'id', path),
    projectId: requiredString(value.projectId, 'projectId', path),
    projectPath: requiredString(value.projectPath, 'projectPath', path),
    title: requiredString(value.title, 'title', path),
    description: requiredString(value.description, 'description', path),
    status: requiredStatus(value.status ?? 'Open', path),
    workspaceId: requiredString(value.workspaceId, 'workspaceId', path),
    workspaceLabel: requiredString(value.workspaceLabel, 'workspaceLabel', path),
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : Date.now(),
    updatedAt: typeof value.updatedAt === 'number' ? value.updatedAt : Date.now(),
    archivedAt: typeof value.archivedAt === 'number' ? value.archivedAt : null,
    titleSource: value.titleSource ?? 'first-line',
    titleSuggestion: value.titleSuggestion ?? null,
    labels: Array.isArray(value.labels)
      ? value.labels
          .filter((label): label is string => typeof label === 'string' && label.trim().length > 0)
          .map((label) => label.trim())
          .slice(0, 20)
      : [],
    intakeState: value.intakeState === 'inbox' ? 'inbox' : 'ready',
    agentId: typeof value.agentId === 'string' ? (value.agentId as LocalTask['agentId']) : null,
    executionState: executionState(value.executionState),
    executionBatchId: typeof value.executionBatchId === 'string' ? value.executionBatchId : null,
    executionRunId: typeof value.executionRunId === 'string' ? value.executionRunId : null,
    reviewKind: reviewKind(value.reviewKind),
    reviewQuestion: typeof value.reviewQuestion === 'string' ? value.reviewQuestion : null,
    runs: readRuns(value.runs),
    subtasks: subtasks as LocalTask['subtasks'],
    sessions: sessions as LocalTask['sessions'],
    latestOutput: latestOutput as LocalTask['latestOutput'],
    latestOutputSource: value.latestOutputSource === 'agent-status' ? 'agent-status' : 'report',
    waitingReason: value.waitingReason ?? null
  }
}

export function taskFiles(projectPath: string): string[] {
  const root = join(resolve(projectPath), LOCAL_TASK_ROOT_NAME)
  if (!existsSync(root)) {
    return []
  }
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(root, entry.name, LOCAL_TASK_FILE_NAME))
    .filter((path: string) => existsSync(path))
}
