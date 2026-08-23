export type WorktreeCreationCompletion = {
  worktreeId: string
  primaryTabId: string | null
  startupTerminalTabId: string | null
}

const callbacks = new Map<string, (completion: WorktreeCreationCompletion) => void>()

export function registerWorktreeCreationCompletion(
  creationId: string,
  callback: (completion: WorktreeCreationCompletion) => void
): void {
  callbacks.set(creationId, callback)
}

export function clearWorktreeCreationCompletion(creationId: string): void {
  callbacks.delete(creationId)
}

export function takeWorktreeCreationCompletion(
  creationId: string
): ((completion: WorktreeCreationCompletion) => void) | undefined {
  const callback = callbacks.get(creationId)
  callbacks.delete(creationId)
  return callback
}
