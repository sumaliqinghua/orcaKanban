import type { LocalTask } from '../../shared/local-task-types'

type ReadTask = (path: string) => LocalTask

export function findTaskWithSession(
  paths: Iterable<string>,
  sessionId: string,
  read: ReadTask
): LocalTask | null {
  for (const path of paths) {
    const task = read(path)
    if (task.sessions.some((session) => session.id === sessionId)) {
      return task
    }
  }
  return null
}

export function findSubtask(
  paths: Iterable<string>,
  subtaskId: string,
  read: ReadTask
): { task: LocalTask; index: number } {
  for (const path of paths) {
    const task = read(path)
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
    const task = read(path)
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
