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
import { z } from 'zod'
import { LOCAL_TASK_STATUSES, type LocalTask } from '../../shared/local-task-types'
import type { TuiAgent } from '../../shared/tui-agent'
import { isTuiAgent } from '../../shared/tui-agent-config'

export const LOCAL_TASK_ROOT_NAME = 'orca'
export const LOCAL_TASK_FILE_NAME = 'task.json'
export const LOCAL_TASK_PLAN_FILE_NAME = 'plan.json'
export const LOCAL_TASK_PRD_FILE_NAME = 'prd.md'
export const LOCAL_TASK_RECORDS_FILE_NAME = 'records.md'

const text = z.string().trim().min(1)
const timestamp = z.number().finite().nonnegative()
const nullableTimestamp = timestamp.nullable()
const agent = z.custom<TuiAgent>(isTuiAgent)

const stepSchema = z.strictObject({
  id: text,
  title: text,
  status: z.enum(['todo', 'doing', 'done', 'canceled']),
  updatedAt: timestamp
})

const subtaskSchema = z.strictObject({
  id: text,
  title: text,
  status: z.enum(['todo', 'doing', 'done']),
  sessionId: text.nullable(),
  steps: z.array(stepSchema),
  createdAt: timestamp,
  updatedAt: timestamp
})

const turnSchema = z.strictObject({
  id: text,
  prompt: text,
  summary: text.nullable(),
  createdAt: timestamp,
  updatedAt: timestamp
})

const sessionSchema = z.strictObject({
  id: text,
  tabId: text.optional(),
  taskId: text,
  workspaceId: text,
  title: text,
  currentPrompt: text.nullable(),
  turns: z.array(turnSchema).max(30),
  status: z.enum(['working', 'idle', 'done']),
  latestOutput: text.nullable(),
  manualNotes: z.string().trim().max(100_000).nullable().default(null),
  createdAt: timestamp,
  updatedAt: timestamp,
  agentId: agent.nullable().default(null),
  associationSource: z.enum([
    'task-center',
    'explicit',
    'automation',
    'clarification',
    'task-report'
  ])
})

const runSchema = z.strictObject({
  id: text,
  batchId: text,
  taskId: text,
  workspaceId: text,
  status: z.enum(['queued', 'running', 'needs_review', 'failed']),
  sessionId: text.nullable(),
  output: z.string().nullable(),
  error: z.string().nullable(),
  createdAt: timestamp,
  startedAt: nullableTimestamp,
  finishedAt: nullableTimestamp,
  source: z.enum(['manual', 'automation']).default('manual'),
  launchRequestId: text.nullable().default(null),
  automationId: text.nullable().optional(),
  automationRunId: text.nullable().optional()
})

const outputSchema = z.strictObject({
  sessionId: text,
  text,
  updatedAt: timestamp
})

const taskSchema = z.strictObject({
  schemaVersion: z.literal(1),
  id: text,
  projectId: text,
  projectPath: text,
  title: text,
  description: text,
  status: z.enum(LOCAL_TASK_STATUSES),
  workspaceId: text,
  workspaceLabel: text,
  createdAt: timestamp,
  updatedAt: timestamp,
  archivedAt: nullableTimestamp,
  titleSource: z.enum(['first-line', 'ai-suggestion', 'user']),
  titleSuggestion: text.nullable(),
  labels: z.array(text).max(20),
  intakeState: z.enum(['inbox', 'ready']),
  agentId: agent.nullable(),
  executionState: z.enum(['idle', 'queued', 'running', 'needs_review', 'failed']),
  executionBatchId: text.nullable(),
  executionRunId: text.nullable(),
  reviewKind: z.enum(['delivery', 'needs_input', 'execution_failed']).nullable(),
  reviewQuestion: text.nullable(),
  clarificationRequested: z.boolean().default(false),
  clarificationSessionId: text.nullable().default(null),
  runs: z.array(runSchema),
  subtasks: z.array(subtaskSchema),
  sessions: z.array(sessionSchema),
  latestOutput: outputSchema.nullable(),
  latestOutputSource: z.enum(['agent-status', 'report'])
})

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

export function readLocalTaskFile(path: string): LocalTask {
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    throw new Error(
      `Could not read local task file ${path}: ${error instanceof Error ? error.message : String(error)}`
    )
  }
  const result = taskSchema.safeParse(parsed)
  if (!result.success) {
    const detail = result.error.issues
      .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
      .join('; ')
    throw new Error(`Invalid local task file ${path}: ${detail}`)
  }
  return result.data
}

export function taskFiles(projectPath: string): string[] {
  const root = join(resolve(projectPath), LOCAL_TASK_ROOT_NAME)
  if (!existsSync(root)) {
    return []
  }
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(root, entry.name, LOCAL_TASK_FILE_NAME))
    .filter((path) => existsSync(path))
}
