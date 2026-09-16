import { z } from 'zod'
import { parseExecutionHostId } from '../../shared/execution-host'
import { parsePaneKey } from '../../shared/stable-pane-id'
import { LOCAL_TASK_STATUSES } from '../../shared/local-task-types'
import { isTuiAgent } from '../../shared/tui-agent-config'

const id = z.string().trim().min(1).max(200)
const shortText = z.string().trim().min(1).max(500)
const checklistChange = z.discriminatedUnion('action', [
  z.object({ action: z.literal('add'), title: shortText }).strict(),
  z
    .object({
      action: z.literal('update'),
      itemId: id,
      title: shortText.optional(),
      completed: z.boolean().optional()
    })
    .strict(),
  z.object({ action: z.literal('delete'), itemId: id }).strict()
])
const longText = z.string().trim().min(1).max(100_000)
const taskStatus = z.enum(LOCAL_TASK_STATUSES)
const providerSession = z
  .object({
    key: z.enum(['session_id', 'conversation_id']),
    id: z.string().trim().min(1).max(512),
    transcriptPath: z.string().trim().min(1).max(32_768).optional()
  })
  .strict()

export const localTaskListArgsSchema = z
  .object({
    projectId: id.optional(),
    projectPath: z.string().trim().min(1).max(4_096).optional(),
    includeArchived: z.boolean().optional()
  })
  .strict()
  .optional()

export const localTaskIdSchema = z
  .object({ taskId: id, projectPath: z.string().trim().min(1).max(4_096).optional() })
  .strict()

export const kanbanAiRecordListArgsSchema = z
  .object({
    projectId: id,
    projectPath: z.string().trim().min(1).max(4_096)
  })
  .strict()

export const markKanbanAiRecordReadArgsSchema = kanbanAiRecordListArgsSchema.extend({
  recordId: id
})

export const createLocalTaskArgsSchema = z
  .object({
    projectId: id,
    projectPath: z.string().trim().min(1).max(4_096).optional(),
    title: shortText.optional(),
    description: longText,
    labels: z.array(shortText).max(20).optional(),
    intakeState: z.enum(['inbox', 'ready']).optional(),
    clarificationRequested: z.boolean().optional(),
    agentId: z.string().refine(isTuiAgent, 'Unsupported Agent').nullable().optional(),
    workspaceId: id.optional(),
    workspaceLabel: shortText.optional()
  })
  .strict()

export const updateLocalTaskArgsSchema = z
  .object({
    taskId: id,
    projectPath: z.string().trim().min(1).max(4_096).optional(),
    updates: z
      .object({
        checklistChange: checklistChange.optional(),
        projectPath: z.string().trim().min(1).max(4_096).optional(),
        workspaceId: id.optional(),
        workspaceLabel: shortText.optional(),
        title: shortText.optional(),
        description: longText.optional(),
        status: taskStatus.optional(),
        archived: z.boolean().optional(),
        labels: z.array(shortText).max(20).optional(),
        intakeState: z.enum(['inbox', 'ready']).optional(),
        agentId: z.string().refine(isTuiAgent, 'Unsupported Agent').nullable().optional()
      })
      .strict()
  })
  .strict()

export const createLocalTaskSessionArgsSchema = z
  .object({
    sourceChecklistItemId: id.optional(),
    tags: z.array(shortText).max(20).optional(),
    providerSession: providerSession.optional(),
    taskId: id,
    projectPath: z.string().trim().min(1).max(4_096).optional(),
    sessionId: id.optional(),
    workspaceId: id.optional(),
    title: shortText.optional(),
    currentPrompt: z.string().trim().max(100_000).optional(),
    agentId: z.string().refine(isTuiAgent, 'Unsupported Agent').nullable().optional(),
    associationSource: z
      .enum(['task-center', 'explicit', 'automation', 'clarification', 'task-report'])
      .optional()
  })
  .strict()

export const updateLocalTaskSessionOutputArgsSchema = z
  .object({
    agentId: z.string().refine(isTuiAgent, 'Unsupported Agent').optional(),
    tags: z.array(shortText).max(20).optional(),
    providerSession: providerSession.optional(),
    sessionId: id,
    prompt: z.string().trim().max(100_000).optional(),
    sessionStatus: z.enum(['working', 'done']).optional(),
    latestOutput: z.string().trim().max(100_000).optional(),
    manualNotes: z.string().trim().max(100_000).nullable().optional()
  })
  .strict()

export const rebindLocalTaskSessionTabArgsSchema = z
  .object({
    sessionId: id,
    tabId: id,
    terminalBinding: z
      .object({
        paneKey: z
          .string()
          .min(1)
          .max(1024)
          .refine((value) => parsePaneKey(value) !== null),
        ptyId: z.string().min(1).max(32768),
        executionHostId: z
          .string()
          .refine((value) => parseExecutionHostId(value) !== null)
          .transform((value) => parseExecutionHostId(value)!.id)
      })
      .strict()
      .optional()
  })
  .strict()
  .refine(
    (value) =>
      !value.terminalBinding || parsePaneKey(value.terminalBinding.paneKey)?.tabId === value.tabId,
    '恢复窗格必须属于目标标签页'
  )

export const createLocalTaskSubtaskArgsSchema = z
  .object({
    taskId: id,
    projectPath: z.string().trim().min(1).max(4_096).optional(),
    sessionId: id.nullable().optional(),
    title: shortText,
    steps: z.array(shortText).max(100).optional()
  })
  .strict()

export const updateLocalTaskSubtaskArgsSchema = z
  .object({
    subtaskId: id,
    status: z.enum(['todo', 'doing', 'done']).optional(),
    title: shortText.optional()
  })
  .strict()

export const transferLocalTaskSubtaskArgsSchema = z
  .object({
    subtaskId: id,
    sessionId: id.nullable(),
    projectPath: z.string().trim().min(1).max(4_096).optional(),
    force: z.boolean().optional()
  })
  .strict()

export const updateLocalTaskStepArgsSchema = z
  .object({
    subtaskId: id,
    stepId: id,
    title: shortText.optional(),
    status: z.enum(['todo', 'doing', 'done', 'canceled']).optional()
  })
  .strict()

export const editLocalTaskStepTitleArgsSchema = z
  .object({ subtaskId: id, stepId: id, title: shortText })
  .strict()

export const reportLocalTaskCompletedArgsSchema = z
  .object({
    taskId: id,
    sessionId: id,
    latestOutput: z.string().trim().max(100_000).optional(),
    titleSuggestion: shortText.optional(),
    description: longText.optional()
  })
  .strict()

export const acceptLocalTaskArgsSchema = localTaskIdSchema

export const archiveLocalTaskArgsSchema = z
  .object({
    taskId: id,
    projectPath: z.string().trim().min(1).max(4_096).optional(),
    activeSessionIds: z.array(id).max(500).optional()
  })
  .strict()

export const deleteLocalTaskArgsSchema = z
  .object({
    taskId: z
      .string()
      .trim()
      .regex(/^lt_[A-Za-z0-9-]+$/)
      .max(200),
    projectPath: z.string().trim().min(1).max(4_096),
    activeSessionIds: z.array(id).max(500).optional()
  })
  .strict()

export const transferLocalTaskWorkspaceArgsSchema = z
  .object({
    sourceProjectPath: z.string().trim().min(1).max(4_096),
    targetProjectId: id,
    targetProjectPath: z.string().trim().min(1).max(4_096),
    targetWorkspaceId: id,
    targetWorkspaceLabel: shortText
  })
  .strict()

export const startLocalTaskBatchArgsSchema = z
  .object({
    tasks: z
      .array(z.object({ taskId: id, projectPath: z.string().trim().min(1).max(4_096) }).strict())
      .max(500),
    recoverQueued: z.boolean().optional(),
    automationId: id.optional(),
    automationRunId: id.optional()
  })
  .strict()

export const updateLocalTaskRunArgsSchema = z
  .object({
    taskId: id,
    projectPath: z.string().trim().min(1).max(4_096),
    runId: id,
    status: z.enum(['queued', 'running', 'needs_review', 'failed']),
    sessionId: id.nullable().optional(),
    output: z.string().max(100_000).nullable().optional(),
    error: z.string().max(10_000).nullable().optional()
  })
  .strict()

export function parseLocalTaskIpcArgs<T>(
  schema: { parse: (value: unknown) => T },
  value: unknown
): T {
  return schema.parse(value)
}
