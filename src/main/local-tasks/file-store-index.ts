import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { normalizeRuntimePathForComparison } from '../../shared/cross-platform-path'
import type { LocalTask } from '../../shared/local-task-types'

type ReadTask = (path: string) => LocalTask

function readPresentTask(path: string, read: ReadTask): LocalTask | null {
  if (!existsSync(path)) {
    return null
  }
  try {
    return read(path)
  } catch (error) {
    // A workspace can disappear between existsSync and readFileSync.
    if (!existsSync(path)) {
      return null
    }
    throw error
  }
}

export function findTaskWithSession(
  paths: Iterable<string>,
  sessionId: string,
  read: ReadTask
): LocalTask | null {
  for (const path of paths) {
    const task = readPresentTask(path, read)
    if (!task) {
      continue
    }
    if (task.sessions.some((session) => session.id === sessionId || session.tabId === sessionId)) {
      return task
    }
  }
  return null
}

export function findSubtask(
  paths: Iterable<string>,
  subtaskId: string,
  read: ReadTask,
  projectPath?: string
): { task: LocalTask; index: number } {
  for (const path of paths) {
    const task = readPresentTask(path, read)
    if (!task) {
      continue
    }
    if (
      projectPath &&
      normalizeRuntimePathForComparison(task.projectPath) !==
        normalizeRuntimePathForComparison(resolve(projectPath))
    ) {
      continue
    }
    const index = task.subtasks.findIndex((subtask) => subtask.id === subtaskId)
    if (index !== -1) {
      return { task, index }
    }
  }
  throw new Error(`Local task subtask not found: ${subtaskId}`)
}

export function findStep(
  paths: Iterable<string>,
  stepId: string,
  subtaskId: string,
  read: ReadTask
): { task: LocalTask; subtaskIndex: number; stepIndex: number } {
  for (const path of paths) {
    const task = readPresentTask(path, read)
    if (!task) {
      continue
    }
    const subtaskIndex = task.subtasks.findIndex((subtask) => subtask.id === subtaskId)
    const stepIndex =
      subtaskIndex !== -1
        ? task.subtasks[subtaskIndex].steps.findIndex((step) => step.id === stepId)
        : -1
    if (subtaskIndex !== -1 && stepIndex !== -1) {
      return { task, subtaskIndex, stepIndex }
    }
  }
  throw new Error(`Local task step not found: ${stepId}`)
}
