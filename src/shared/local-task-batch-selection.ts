import type { LocalTask } from './local-task-types'

export function isOpenLocalTaskBatchCandidate(
  task: LocalTask,
  scope: { projectId?: string; workspaceId?: string | null } = {}
): boolean {
  return (
    task.archivedAt === null &&
    task.status === 'Open' &&
    task.intakeState === 'ready' &&
    task.executionState !== 'queued' &&
    task.executionState !== 'running' &&
    (scope.projectId === undefined || task.projectId === scope.projectId) &&
    (scope.workspaceId === undefined ||
      scope.workspaceId === null ||
      task.workspaceId === scope.workspaceId)
  )
}
