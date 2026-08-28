import type { LocalTask } from './local-task-types'

type LocalTaskBatchCandidateShape = {
  archivedAt?: number | null
  status: LocalTask['status']
  intakeState?: LocalTask['intakeState']
  executionState?: LocalTask['executionState']
  projectId?: string
  workspaceId?: string
}

export function isOpenLocalTaskBatchCandidate(
  task: LocalTaskBatchCandidateShape,
  scope: { projectId?: string; workspaceId?: string | null } = {}
): boolean {
  return (
    (task.archivedAt ?? null) === null &&
    task.status === 'Open' &&
    (task.intakeState ?? 'ready') === 'ready' &&
    (task.executionState ?? 'idle') !== 'queued' &&
    (task.executionState ?? 'idle') !== 'running' &&
    (scope.projectId === undefined || task.projectId === scope.projectId) &&
    (scope.workspaceId === undefined ||
      scope.workspaceId === null ||
      task.workspaceId === scope.workspaceId)
  )
}
