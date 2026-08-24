import type {
  CreateLocalTaskArgs,
  CreateLocalTaskSessionArgs,
  CreateLocalTaskSubtaskArgs,
  EditLocalTaskStepTitleArgs,
  LocalTask,
  LocalTaskBatch,
  LocalTaskSession,
  StartLocalTaskBatchArgs,
  UpdateLocalTaskRunArgs,
  UpdateLocalTaskSessionOutputArgs,
  UpdateLocalTaskArgs,
  UpdateLocalTaskSubtaskArgs
} from '../../shared/local-task-types'

export type LocalTaskApi = {
  list: (args?: { projectId?: string; projectPath?: string }) => Promise<LocalTask[]>
  get: (taskId: string, projectPath?: string) => Promise<LocalTask | null>
  create: (args: CreateLocalTaskArgs) => Promise<LocalTask>
  update: (args: { taskId: string; updates: UpdateLocalTaskArgs }) => Promise<LocalTask>
  createSession: (args: CreateLocalTaskSessionArgs) => Promise<LocalTaskSession>
  updateSessionOutput: (args: UpdateLocalTaskSessionOutputArgs) => Promise<LocalTask>
  startBatch: (args: StartLocalTaskBatchArgs) => Promise<LocalTaskBatch>
  updateRun: (args: UpdateLocalTaskRunArgs) => Promise<LocalTask>
  createSubtask: (args: CreateLocalTaskSubtaskArgs) => Promise<LocalTask>
  updateSubtask: (args: UpdateLocalTaskSubtaskArgs) => Promise<LocalTask>
  editStepTitle: (args: EditLocalTaskStepTitleArgs) => Promise<LocalTask>
  accept: (args: { taskId: string }) => Promise<LocalTask>
  archive: (args: { taskId: string }) => Promise<LocalTask>
  restore: (args: { taskId: string }) => Promise<LocalTask>
  onChanged: (callback: (task: LocalTask) => void) => () => void
}
