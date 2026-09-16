import type { LocalTask, RebindLocalTaskSessionTabArgs } from '../../shared/local-task-types'
import { findTaskWithSession } from './file-store-index'
import type { FileStoreMutationAccess } from './file-store-mutations'

/** Persist the renderer Tab ID separately from the stable local-task session ID. */
export function rebindSessionTab(
  store: FileStoreMutationAccess,
  args: RebindLocalTaskSessionTabArgs
): LocalTask {
  const task = findTaskWithSession(store.taskPaths(), args.sessionId, store.readTask)
  if (!task) {
    throw new Error('Session is not associated with any local task')
  }
  const tabId = args.tabId.trim()
  if (!tabId) {
    throw new Error('Tab ID must not be empty')
  }
  const hasSession = task.sessions.some((session) => session.id === args.sessionId)
  if (!hasSession) {
    throw new Error('Session is not associated with this local task')
  }
  return store.writeTask({
    ...task,
    sessions: task.sessions.map((session) =>
      session.id === args.sessionId
        ? { ...session, tabId, terminalBinding: args.terminalBinding }
        : session
    ),
    updatedAt: Date.now()
  })
}
