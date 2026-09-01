export const KANBAN_AI_RECORD_KINDS = [
  'requirement_clarification',
  'candidate_task',
  'task_simplification',
  'status_report'
] as const

export type KanbanAiRecordKind = (typeof KANBAN_AI_RECORD_KINDS)[number]
export type KanbanAiRecordBasisValue = string | number | boolean | null

export type KanbanAiRecord = {
  schemaVersion: 1
  id: string
  kind: KanbanAiRecordKind
  seriesKey: string
  createdAt: number
  source: {
    automationId: string | null
    automationRunId: string | null
    agentId: string | null
  }
  target: {
    projectId: string
    projectPath: string
    workspaceId: string | null
    taskId: string | null
  }
  title: string
  summary: string
  body: {
    format: 'markdown'
    content: string
  }
  basis: Record<string, KanbanAiRecordBasisValue>
  inputFingerprint: string
  readAt: number | null
}

export type ListKanbanAiRecordsArgs = {
  projectId: string
  projectPath: string
}

export type MarkKanbanAiRecordReadArgs = ListKanbanAiRecordsArgs & {
  recordId: string
}
