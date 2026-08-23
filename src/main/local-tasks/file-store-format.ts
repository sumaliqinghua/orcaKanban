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
import { LOCAL_TASK_STATUSES, type LocalTask } from '../../shared/local-task-types'

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
  if (typeof value === 'string' && LOCAL_TASK_STATUSES.includes(value as LocalTask['status'])) {
    return value as LocalTask['status']
  }
  throw new Error(`Invalid local task file ${path}: status is not supported`)
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
    subtasks: Array.isArray(value.subtasks) ? value.subtasks : [],
    sessions: Array.isArray(value.sessions) ? value.sessions : [],
    latestOutput: value.latestOutput ?? null,
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
