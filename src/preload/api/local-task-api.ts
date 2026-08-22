import type {
  CreateLocalTaskArgs,
  CreateLocalTaskSessionArgs,
  CreateLocalTaskSubtaskArgs,
  LocalTask,
  LocalTaskSession,
  ReportLocalTaskCompletedArgs,
  UpdateLocalTaskArgs,
  UpdateLocalTaskStepArgs,
  UpdateLocalTaskSubtaskArgs
} from '../../shared/local-task-types'

export type LocalTaskApi = {
  list: (args?: { projectId?: string }) => Promise<LocalTask[]>
  get: (taskId: string) => Promise<LocalTask | null>
  create: (args: CreateLocalTaskArgs) => Promise<LocalTask>
  update: (args: { taskId: string; updates: UpdateLocalTaskArgs }) => Promise<LocalTask>
  createSession: (args: CreateLocalTaskSessionArgs) => Promise<LocalTaskSession>
  createSubtask: (args: CreateLocalTaskSubtaskArgs) => Promise<LocalTask>
  updateSubtask: (args: UpdateLocalTaskSubtaskArgs) => Promise<LocalTask>
  updateStep: (args: UpdateLocalTaskStepArgs) => Promise<LocalTask>
  reportCompleted: (args: ReportLocalTaskCompletedArgs) => Promise<LocalTask>
  onChanged: (callback: (task: LocalTask) => void) => () => void
}
