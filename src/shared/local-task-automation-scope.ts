import type { LocalTask } from './local-task-types'
import { isOpenLocalTaskBatchCandidate } from './local-task-batch-selection'

export function selectAllLocalProjectOpenTasks(
  tasks: readonly LocalTask[],
  localProjectIds: ReadonlySet<string>,
  workspaceIds: ReadonlySet<string>
): LocalTask[] {
  const selected = new Map<string, LocalTask>()
  for (const task of tasks) {
    if (
      !localProjectIds.has(task.projectId) ||
      !task.workspaceId ||
      task.workspaceId === 'local' ||
      !workspaceIds.has(task.workspaceId) ||
      !isOpenLocalTaskBatchCandidate(task)
    ) {
      continue
    }
    const existing = selected.get(task.id)
    if (!existing || task.updatedAt >= existing.updatedAt) {
      selected.set(task.id, task)
    }
  }
  return [...selected.values()].sort((left, right) => right.updatedAt - left.updatedAt)
}
