import type { TuiAgent } from './tui-agent'

export const LOCAL_TASK_STATUSES = [
  'Open',
  'In progress',
  'Waiting',
  'Needs review',
  'Done'
] as const

export type LocalTaskStatus = (typeof LOCAL_TASK_STATUSES)[number]
export type LocalTaskIntakeState = 'inbox' | 'ready'
export type LocalTaskExecutionState = 'idle' | 'queued' | 'running' | 'needs_review' | 'failed'
export type LocalTaskReviewKind = 'delivery' | 'needs_input' | 'execution_failed'
export type LocalTaskRunStatus = 'queued' | 'running' | 'needs_review' | 'failed'
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
  initialPrompt?: string | null
  status: 'working' | 'idle' | 'done'
  latestOutput: string | null
  createdAt: number
  updatedAt: number
  associationSource: 'task-center' | 'explicit'
}

export type LocalTaskRun = {
  id: string
  batchId: string
  taskId: string
  workspaceId: string
  status: LocalTaskRunStatus
  sessionId: string | null
  output: string | null
  error: string | null
  createdAt: number
  startedAt: number | null
  finishedAt: number | null
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
  intakeState: LocalTaskIntakeState
  agentId: TuiAgent | null
  executionState: LocalTaskExecutionState
  executionBatchId: string | null
  executionRunId: string | null
  reviewKind: LocalTaskReviewKind | null
  reviewQuestion: string | null
  runs: LocalTaskRun[]
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
  intakeState?: LocalTaskIntakeState
  agentId?: TuiAgent | null
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
  intakeState?: LocalTaskIntakeState
  agentId?: TuiAgent | null
}

export type LocalTaskBatchTaskRef = {
  taskId: string
  projectPath: string
}

export type LocalTaskBatchCandidate = {
  task: LocalTask
  runId: string
  workspaceKey: string
}

export type LocalTaskBatch = {
  id: string
  createdAt: number
  candidates: LocalTaskBatchCandidate[]
}

export type StartLocalTaskBatchArgs = {
  tasks: LocalTaskBatchTaskRef[]
}

export type UpdateLocalTaskRunArgs = {
  taskId: string
  projectPath: string
  runId: string
  status: LocalTaskRunStatus
  sessionId?: string | null
  output?: string | null
  error?: string | null
}

export type CreateLocalTaskSessionArgs = {
  taskId: string
  projectPath?: string
  sessionId?: string
  workspaceId?: string
  title?: string
  initialPrompt?: string
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

export type RequestLocalTaskReviewArgs = {
  taskId: string
  projectPath?: string
  sessionId: string
  question: string
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
