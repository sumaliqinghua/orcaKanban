import { z } from 'zod'
import { LOCAL_TASK_STATUSES } from '../../shared/local-task-types'

const id = z.string().trim().min(1).max(200)
const shortText = z.string().trim().min(1).max(500)
const longText = z.string().trim().min(1).max(100_000)
const taskStatus = z.enum(LOCAL_TASK_STATUSES)

export const localTaskListArgsSchema = z
  .object({ projectId: id.optional(), projectPath: z.string().trim().min(1).max(4_096).optional() })
  .strict()
  .optional()

export const localTaskIdSchema = z
  .object({ taskId: id, projectPath: z.string().trim().min(1).max(4_096).optional() })
  .strict()

export const createLocalTaskArgsSchema = z
  .object({
    projectId: id,
    projectPath: z.string().trim().min(1).max(4_096),
    title: shortText.optional(),
    description: longText,
    labels: z.array(shortText).max(20).optional(),
    workspaceId: id.optional(),
    workspaceLabel: shortText.optional()
  })
  .strict()

export const updateLocalTaskArgsSchema = z
  .object({
    taskId: id,
    updates: z
      .object({
        title: shortText.optional(),
        description: longText.optional(),
        status: taskStatus.optional(),
        waitingReason: z.string().trim().max(10_000).nullable().optional(),
        archived: z.boolean().optional(),
        labels: z.array(shortText).max(20).optional()
      })
      .strict()
  })
  .strict()

export const createLocalTaskSessionArgsSchema = z
  .object({
    taskId: id,
    projectPath: z.string().trim().min(1).max(4_096).optional(),
    sessionId: id.optional(),
    workspaceId: id.optional(),
    title: shortText.optional(),
    associationSource: z.enum(['task-center', 'explicit']).optional()
  })
  .strict()

export const updateLocalTaskSessionOutputArgsSchema = z
  .object({ sessionId: id, latestOutput: z.string().trim().max(100_000).optional() })
  .strict()

export const createLocalTaskSubtaskArgsSchema = z
  .object({
    taskId: id,
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

export const acceptLocalTaskArgsSchema = z.object({ taskId: id }).strict()

export function parseLocalTaskIpcArgs<T>(
  schema: { parse: (value: unknown) => T },
  value: unknown
): T {
  return schema.parse(value)
}
