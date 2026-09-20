import { z } from 'zod'
import { LOCAL_TASK_CATALOG_METHODS } from './local-task-catalog'
import { getLocalTaskStore } from '../../../local-tasks/store'
import { publishLocalTaskChange } from '../../../local-tasks/change-notifications'
import {
  buildLocalTaskCurrentContext,
  buildLocalTaskReferenceDetail
} from '../../../../shared/local-task-reference-context'
import type { LocalTask, LocalTaskSession } from '../../../../shared/local-task-types'
import { defineMethod, InvalidArgumentError, type RpcAnyMethod } from '../core'

const Id = z.string().trim().min(1).max(512)
const Description = z.string().trim().min(1).max(100_000)
const Context = z
  .object({
    taskId: Id,
    sessionId: Id.optional(),
    worktreeId: Id.optional(),
    projectPath: z.string().trim().min(1).max(4_096).optional()
  })
  .strict()
const CreateSubtask = Context.extend({
  title: z.string().trim().min(1).max(1_000),
  steps: z.array(z.string().trim().min(1).max(1_000)).max(100).optional()
})
const CurrentContext = Context.extend({ referenceSubtaskId: Id.optional() })
const UpdateSubtask = Context.extend({
  subtaskId: Id,
  status: z.enum(['todo', 'doing', 'done']).optional(),
  title: z.string().trim().min(1).max(1_000).optional()
})
const UpdateStep = Context.extend({
  subtaskId: Id,
  stepId: Id,
  title: z.string().trim().min(1).max(1_000).optional(),
  status: z.enum(['todo', 'doing', 'done', 'canceled']).optional()
})
const UpdateDescription = Context.extend({
  description: Description,
  expectedRevision: z.number().int().optional()
})
const ReportCompleted = Context.extend({
  sessionId: Id,
  latestOutput: z.string().trim().max(100_000).optional(),
  titleSuggestion: z.string().trim().min(1).max(1_000).optional(),
  description: Description.optional()
})

function getTask(taskId: string, projectPath?: string): LocalTask {
  const task = getLocalTaskStore().get(taskId, projectPath)
  if (!task) {
    throw new InvalidArgumentError(`Local task not found: ${taskId}`)
  }
  return task
}

function ensureContext(
  params: { taskId: string; sessionId?: string; worktreeId?: string; projectPath?: string },
  requireSession = true
): { task: LocalTask; session: LocalTaskSession | null } {
  let task = getTask(params.taskId, params.projectPath)
  // "local" means the task follows the workspace from which the Agent was launched.
  // Concrete workspace IDs remain strict so a session cannot update a sibling worktree.
  if (params.worktreeId && task.workspaceId !== 'local' && task.workspaceId !== params.worktreeId) {
    throw new InvalidArgumentError('The current Agent workspace is not bound to this local task')
  }
  if (!params.sessionId) {
    if (requireSession) {
      throw new InvalidArgumentError(
        'This command must run inside an Agent session started from the task center'
      )
    }
    return { task, session: null }
  }
  let session = task.sessions.find((candidate) => candidate.id === params.sessionId) ?? null
  if (!session) {
    try {
      session = getLocalTaskStore().createSession({
        taskId: task.id,
        projectPath: params.projectPath,
        sessionId: params.sessionId,
        title: 'Agent 会话',
        workspaceId: params.worktreeId ?? task.workspaceId,
        associationSource: 'task-center'
      })
    } catch (error) {
      throw new InvalidArgumentError(error instanceof Error ? error.message : String(error))
    }
    task = getTask(task.id, params.projectPath)
    session = task.sessions.find((candidate) => candidate.id === params.sessionId) ?? null
    if (!session) {
      throw new InvalidArgumentError(
        'The current Agent session could not be associated with this local task'
      )
    }
    publishLocalTaskChange(task)
  }
  if (params.worktreeId && session.workspaceId !== params.worktreeId) {
    throw new InvalidArgumentError('The current Agent session belongs to another workspace')
  }
  return { task, session }
}

function requireSubtask(task: LocalTask, subtaskId: string): LocalTask['subtasks'][number] {
  const subtask = task.subtasks.find((candidate) => candidate.id === subtaskId)
  if (!subtask) {
    throw new InvalidArgumentError('The subtask does not belong to the current local task')
  }
  return subtask
}

function result(task: LocalTask): { task: LocalTask } {
  publishLocalTaskChange(task)
  return { task }
}

export const LOCAL_TASK_METHODS: readonly RpcAnyMethod[] = [
  ...LOCAL_TASK_CATALOG_METHODS,
  defineMethod({
    name: 'localTask.current',
    params: CurrentContext,
    handler: (params) => {
      const { task, session } = ensureContext(params, false)
      const context = buildLocalTaskCurrentContext(task, session)
      if (params.referenceSubtaskId) {
        const subtask = requireSubtask(task, params.referenceSubtaskId)
        context.reference = buildLocalTaskReferenceDetail(task, subtask)
      }
      return context
    }
  }),
  defineMethod({
    name: 'localTask.updateDescription',
    params: UpdateDescription,
    handler: (params) => {
      const { task } = ensureContext(params)
      const currentRevision = task.descriptionRevision ?? task.updatedAt
      if (params.expectedRevision !== undefined && params.expectedRevision !== currentRevision) {
        throw new InvalidArgumentError(
          'Task description changed since it was last read. Read the current description and write again.'
        )
      }
      return result(
        getLocalTaskStore().update(
          params.taskId,
          { description: params.description },
          params.projectPath
        )
      )
    }
  }),
  defineMethod({
    name: 'localTask.createSubtask',
    params: CreateSubtask,
    handler: (params) => {
      ensureContext(params)
      return result(
        getLocalTaskStore().createSubtask({
          taskId: params.taskId,
          projectPath: params.projectPath,
          title: params.title,
          steps: params.steps,
          sessionId: params.sessionId
        })
      )
    }
  }),
  defineMethod({
    name: 'localTask.updateSubtask',
    params: UpdateSubtask,
    handler: (params) => {
      const { task, session } = ensureContext(params)
      requireSubtask(task, params.subtaskId)
      return result(
        getLocalTaskStore().updateSubtask({
          subtaskId: params.subtaskId,
          status: params.status,
          title: params.title,
          actorSessionId: session!.id
        })
      )
    }
  }),
  defineMethod({
    name: 'localTask.updateStep',
    params: UpdateStep,
    handler: (params) => {
      const { task, session } = ensureContext(params)
      const subtask = requireSubtask(task, params.subtaskId)
      const step = subtask.steps.find((candidate) => candidate.id === params.stepId)
      if (!step) {
        throw new InvalidArgumentError('The execution step does not belong to the current subtask')
      }
      if (params.title !== undefined && step.status !== 'todo') {
        throw new InvalidArgumentError('Only an unstarted AI step can be edited')
      }
      return result(
        getLocalTaskStore().updateStep({
          subtaskId: params.subtaskId,
          stepId: params.stepId,
          status: params.status,
          title: params.title,
          actorSessionId: session!.id
        })
      )
    }
  }),
  defineMethod({
    name: 'localTask.reportCompleted',
    params: ReportCompleted,
    handler: (params) => {
      ensureContext(params)
      return result(
        getLocalTaskStore().reportCompleted({
          taskId: params.taskId,
          projectPath: params.projectPath,
          sessionId: params.sessionId,
          latestOutput: params.latestOutput,
          titleSuggestion: params.titleSuggestion,
          description: params.description
        })
      )
    }
  })
]
