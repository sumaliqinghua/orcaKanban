import type { KanbanAiRecord } from '../../../../shared/kanban-ai-record'

export function findKanbanAiRecordTask<T extends { id: string; project: string }>(
  items: readonly T[],
  record: KanbanAiRecord
): T | null {
  const taskId = record.target.taskId
  if (!taskId) {
    return null
  }
  return (
    items.find(
      (candidate) => candidate.id === taskId && candidate.project === record.target.projectId
    ) ?? null
  )
}
