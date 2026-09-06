import type { TuiAgent } from './tui-agent'

export const LOCAL_TASK_STATUSES = ['Open', 'In progress', 'Needs review', 'Done'] as const

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
  /** 当前 Orca Terminal Tab ID；恢复后 Tab 可能因 ID 冲突被重新生成。 */
  tabId?: string
  taskId: string
  workspaceId: string
  title: string
  currentPrompt: string | null
  turns: LocalTaskSessionTurn[]
  status: 'working' | 'idle' | 'done'
  latestOutput: string | null
  /** User-authored notes kept separate from the agent-generated output. */
  manualNotes?: string | null
  createdAt: number
  updatedAt: number
  agentId: TuiAgent | null
  associationSource: 'task-center' | 'explicit' | 'automation' | 'clarification' | 'task-report'
}

export type LocalTaskSessionTurn = {
  id: string
  prompt: string
  summary: string | null
  createdAt: number
  updatedAt: number
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
  source: 'manual' | 'automation'
  launchRequestId: string | null
  automationId?: string | null
  automationRunId?: string | null
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
  clarificationRequested: boolean
  clarificationSessionId: string | null
  runs: LocalTaskRun[]
  subtasks: LocalTaskSubtask[]
  sessions: LocalTaskSession[]
  latestOutput: { sessionId: string; text: string; updatedAt: number } | null
  latestOutputSource: 'agent-status' | 'report'
}

export type CreateLocalTaskArgs = {
  projectId: string
  projectPath?: string
  title?: string
  description: string
  labels?: string[]
  intakeState?: LocalTaskIntakeState
  agentId?: TuiAgent | null
  workspaceId?: string
  workspaceLabel?: string
  clarificationRequested?: boolean
}

export type UpdateLocalTaskArgs = {
  title?: string
  description?: string
  status?: LocalTaskStatus
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
  /** Manual retry may recover an interrupted queue; automation dispatch must not. */
  recoverQueued?: boolean
  automationId?: string
  automationRunId?: string
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
  currentPrompt?: string
  agentId?: TuiAgent | null
  /** Backward-compatible alias used by older task-center callers. */
  initialPrompt?: string
  associationSource?: 'task-center' | 'explicit' | 'automation' | 'clarification' | 'task-report'
}

export type UpdateLocalTaskSessionOutputArgs = {
  sessionId: string
  prompt?: string
  sessionStatus?: 'working' | 'done'
  latestOutput?: string
  manualNotes?: string | null
}

export type RebindLocalTaskSessionTabArgs = {
  sessionId: string
  tabId: string
}

export type AcceptLocalTaskArgs = { taskId: string; projectPath?: string }
export type ArchiveLocalTaskArgs = AcceptLocalTaskArgs & { activeSessionIds?: string[] }
export type DeleteLocalTaskArgs = {
  taskId: string
  projectPath: string
  activeSessionIds?: string[]
}
export type LocalTaskDeletion = { taskId: string; projectPath: string }

export type TransferLocalTaskWorkspaceArgs = {
  sourceProjectPath: string
  targetProjectId: string
  targetProjectPath: string
  targetWorkspaceId: string
  targetWorkspaceLabel: string
}

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
