import { RuntimeClientError } from './runtime-client'

export function getLocalTaskContext(): {
  taskId: string
  sessionId: string
  worktreeId?: string
  projectPath?: string
} {
  const taskId = process.env.ORCA_LOCAL_TASK_ID?.trim()
  const sessionId =
    process.env.ORCA_TAB_ID?.trim() || process.env.ORCA_PANE_KEY?.split(':', 1)[0]?.trim()
  if (!taskId) {
    throw new RuntimeClientError(
      'invalid_argument',
      'No local task is bound to this Agent session. Start the Agent from the task center.'
    )
  }
  if (!sessionId) {
    throw new RuntimeClientError(
      'invalid_argument',
      'No Orca Agent session identity is available in this terminal.'
    )
  }
  const worktreeId = process.env.ORCA_WORKTREE_ID?.trim()
  const projectPath = process.env.ORCA_LOCAL_TASK_ROOT?.trim()
  return {
    taskId,
    sessionId,
    ...(worktreeId ? { worktreeId } : {}),
    ...(projectPath ? { projectPath } : {})
  }
}
