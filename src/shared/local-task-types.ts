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
}

export type LocalTask = {
  id: string
  projectId: string
  title: string
  description: string
  status: LocalTaskStatus
  workspaceId: string
  workspaceLabel: string
  createdAt: number
  updatedAt: number
  archivedAt: number | null
  titleSource: 'first-line' | 'ai-suggestion' | 'user'
  subtasks: LocalTaskSubtask[]
  sessions: LocalTaskSession[]
  latestOutput: { sessionId: string; text: string; updatedAt: number } | null
  waitingReason: string | null
}

export type CreateLocalTaskArgs = {
  projectId: string
  title?: string
  description: string
  workspaceId?: string
  workspaceLabel?: string
}

export type UpdateLocalTaskArgs = {
  title?: string
  description?: string
  status?: LocalTaskStatus
  waitingReason?: string | null
  archived?: boolean
}

export type CreateLocalTaskSessionArgs = {
  taskId: string
  title?: string
}

export type CreateLocalTaskSubtaskArgs = {
  taskId: string
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

export type ReportLocalTaskCompletedArgs = {
  taskId: string
  sessionId: string
  latestOutput?: string
}
