import type {
  AcceptLocalTaskArgs,
  ArchiveLocalTaskArgs,
  CreateLocalTaskArgs,
  CreateLocalTaskSessionArgs,
  CreateLocalTaskSubtaskArgs,
  DeleteLocalTaskArgs,
  EditLocalTaskStepTitleArgs,
  LocalTask,
  LocalTaskBatch,
  LocalTaskDeletion,
  LocalTaskSession,
  StartLocalTaskBatchArgs,
  TransferLocalTaskWorkspaceArgs,
  UpdateLocalTaskRunArgs,
  UpdateLocalTaskSessionOutputArgs,
  RebindLocalTaskSessionTabArgs,
  UpdateLocalTaskArgs,
  UpdateLocalTaskSubtaskArgs,
  TransferLocalTaskSubtaskArgs
} from '../../shared/local-task-types'
import type {
  KanbanAiRecord,
  ListKanbanAiRecordsArgs,
  MarkKanbanAiRecordReadArgs
} from '../../shared/kanban-ai-record'

export type LocalTaskApi = {
  list: (args?: {
    projectId?: string
    projectPath?: string
    includeArchived?: boolean
  }) => Promise<LocalTask[]>
  listAiRecords: (args: ListKanbanAiRecordsArgs) => Promise<KanbanAiRecord[]>
  markAiRecordRead: (args: MarkKanbanAiRecordReadArgs) => Promise<KanbanAiRecord>
  get: (taskId: string, projectPath?: string) => Promise<LocalTask | null>
  create: (args: CreateLocalTaskArgs) => Promise<LocalTask>
  update: (args: {
    taskId: string
    projectPath?: string
    updates: UpdateLocalTaskArgs
  }) => Promise<LocalTask>
  createSession: (args: CreateLocalTaskSessionArgs) => Promise<LocalTaskSession>
  updateSessionOutput: (args: UpdateLocalTaskSessionOutputArgs) => Promise<LocalTask>
  rebindSessionTab: (args: RebindLocalTaskSessionTabArgs) => Promise<LocalTask>
  startBatch: (args: StartLocalTaskBatchArgs) => Promise<LocalTaskBatch>
  updateRun: (args: UpdateLocalTaskRunArgs) => Promise<LocalTask>
  createSubtask: (args: CreateLocalTaskSubtaskArgs) => Promise<LocalTask>
  updateSubtask: (args: UpdateLocalTaskSubtaskArgs) => Promise<LocalTask>
  transferSubtask: (args: TransferLocalTaskSubtaskArgs) => Promise<LocalTask>
  editStepTitle: (args: EditLocalTaskStepTitleArgs) => Promise<LocalTask>
  accept: (args: AcceptLocalTaskArgs) => Promise<LocalTask>
  archive: (args: ArchiveLocalTaskArgs) => Promise<LocalTask>
  restore: (args: AcceptLocalTaskArgs) => Promise<LocalTask>
  delete: (args: DeleteLocalTaskArgs) => Promise<LocalTaskDeletion>
  transferWorkspace: (args: TransferLocalTaskWorkspaceArgs) => Promise<LocalTask[]>
  onChanged: (callback: (task: LocalTask) => void) => () => void
  onDeleted: (callback: (deletion: LocalTaskDeletion) => void) => () => void
}
