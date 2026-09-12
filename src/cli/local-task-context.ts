import { RuntimeClientError } from './runtime-client'
import type { RuntimeClient } from './runtime-client'

export async function resolveLocalTaskContext(
  client: RuntimeClient
): Promise<ReturnType<typeof getLocalTaskContext>> {
  if (process.env.ORCA_LOCAL_TASK_ID?.trim()) {
    return getLocalTaskContext()
  }
  const sessionId =
    process.env.ORCA_TAB_ID?.trim() || process.env.ORCA_PANE_KEY?.split(':', 1)[0]?.trim()
  if (!sessionId) {
    return getLocalTaskContext()
  }
  const response = await client
    .call<ReturnType<typeof getLocalTaskContext>>('localTask.sessionContext', {
      sessionId,
      worktreeId: process.env.ORCA_WORKTREE_ID?.trim() || undefined
    })
    .catch((error: unknown) => {
      if (isMissingSessionContextMethod(error)) {
        throw new RuntimeClientError(
          'runtime_compatibility',
          'The connected Orca runtime is older than this local-task CLI and does not provide localTask.sessionContext. Restart the development runtime with `pnpm dev`, then start a new Agent session from the task center.',
          {
            nextSteps: [
              'Stop the old Orca Dev process for this repository.',
              'Run `pnpm dev` from the repository root and wait for the runtime to become ready.',
              'Start a new Agent session from the task center so it receives the refreshed runtime and CLI context.'
            ]
          }
        )
      }
      throw error
    })
  return response.result
}

function isMissingSessionContextMethod(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false
  }
  const code = (error as { code?: unknown }).code
  const message = error instanceof Error ? error.message : ''
  return code === 'method_not_found' && message.includes('localTask.sessionContext')
}

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
