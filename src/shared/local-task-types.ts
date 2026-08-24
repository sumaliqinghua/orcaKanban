export const LOCAL_TASK_STATUSES = [
  'Open',
  'In progress',
  'Waiting',
  'Needs review',
  'Done'
] as const

export type LocalTaskStatus = (typeof LOCAL_TASK_STATUSES)[number]
export type LocalTaskSubtaskStatus = 'todo' | 'doing' | 'done'
export type LocalTaskStepStatus = 'todo' | 'doing' | 'done' | 'canceled'

export type LocalTaskStep = {
  id: string
  title: string
  status: LocalTaskStepStatus
  updatedAt: number
}

export type LocalTaskSubtask = {
  id: string
  title: string
  status: LocalTaskSubtaskStatus
  sessionId: string | null
  steps: LocalTaskStep[]
  createdAt: number
  updatedAt: number
}

export type LocalTaskSession = {
  id: string
  taskId: string
  workspaceId: string
  title: string
  status: 'working' | 'idle' | 'done'
  latestOutput: string | null
  createdAt: number
  updatedAt: number
  associationSource: 'task-center' | 'explicit'
}

export type LocalTask = {
  schemaVersion: 1
  id: string
  projectId: string
  projectPath: string
  title: string
  description: string
  status: LocalTaskStatus
  workspaceId: string
  workspaceLabel: string
  createdAt: number
  updatedAt: number
  archivedAt: number | null
  titleSource: 'first-line' | 'ai-suggestion' | 'user'
  titleSuggestion: string | null
  labels: string[]
  subtasks: LocalTaskSubtask[]
  sessions: LocalTaskSession[]
  latestOutput: { sessionId: string; text: string; updatedAt: number } | null
  latestOutputSource?: 'agent-status' | 'report'
  waitingReason: string | null
}

export type CreateLocalTaskArgs = {
  projectId: string
  projectPath: string
  title?: string
  description: string
  labels?: string[]
  workspaceId?: string
  workspaceLabel?: string
}

export type UpdateLocalTaskArgs = {
  title?: string
  description?: string
  status?: LocalTaskStatus
  waitingReason?: string | null
  archived?: boolean
  labels?: string[]
}

export type CreateLocalTaskSessionArgs = {
  taskId: string
  projectPath?: string
  sessionId?: string
  workspaceId?: string
  title?: string
  associationSource?: 'task-center' | 'explicit'
}

export type UpdateLocalTaskSessionOutputArgs = {
  sessionId: string
  latestOutput?: string
}

export type AcceptLocalTaskArgs = { taskId: string }
export type ArchiveLocalTaskArgs = { taskId: string }

export type CreateLocalTaskSubtaskArgs = {
  taskId: string
  projectPath?: string
  sessionId?: string | null
  title: string
  steps?: string[]
}

export type UpdateLocalTaskSubtaskArgs = {
  subtaskId: string
  status?: LocalTaskSubtaskStatus
  title?: string
}

export type UpdateLocalTaskStepArgs = {
  subtaskId: string
  stepId: string
  title?: string
  status?: LocalTaskStepStatus
}

export type EditLocalTaskStepTitleArgs = {
  subtaskId: string
  stepId: string
  title: string
}

export type ReportLocalTaskCompletedArgs = {
  taskId: string
  projectPath?: string
  sessionId: string
  latestOutput?: string
  titleSuggestion?: string
  description?: string
}

export type LocalTaskToolContext = {
  taskId: string
  sessionId?: string
  worktreeId?: string
  projectPath?: string
}

export type LocalTaskToolUpdateDescriptionArgs = LocalTaskToolContext & {
  description: string
}

export type LocalTaskToolCreateSubtaskArgs = LocalTaskToolContext & {
  title: string
  steps?: string[]
}

export type LocalTaskToolUpdateSubtaskArgs = LocalTaskToolContext & {
  subtaskId: string
  status?: LocalTaskSubtaskStatus
  title?: string
}

export type LocalTaskToolUpdateStepArgs = LocalTaskToolContext & {
  subtaskId: string
  stepId: string
  title?: string
  status?: LocalTaskStepStatus
}

export type LocalTaskToolReportCompletedArgs = LocalTaskToolContext & {
  sessionId: string
  latestOutput?: string
  titleSuggestion?: string
  description?: string
}
