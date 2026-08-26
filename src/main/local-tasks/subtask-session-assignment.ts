import type { LocalTask, TransferLocalTaskSubtaskArgs } from '../../shared/local-task-types'
import type { FileStoreMutationAccess } from './file-store-mutations'
import { findSubtask } from './file-store-index'

const time = (): number => Date.now()

export function transferSubtask(
  store: FileStoreMutationAccess,
  args: TransferLocalTaskSubtaskArgs
): LocalTask {
  const { task, index } = findSubtask(store.taskPaths(), args.subtaskId, store.readTask)
  const current = task.subtasks[index]
  if (current.sessionId === args.sessionId) {
    return task
  }
  const owner = current.sessionId
    ? task.sessions.find((session) => session.id === current.sessionId)
    : undefined
  if (owner?.status === 'working' && args.force !== true) {
    throw new Error(
      'Subtask is assigned to a running Agent session; force transfer requires confirmation'
    )
  }
  const subtasks = [...task.subtasks]
  subtasks[index] = { ...current, sessionId: args.sessionId, updatedAt: time() }
  return store.writeTask({ ...task, subtasks, updatedAt: time() })
}
