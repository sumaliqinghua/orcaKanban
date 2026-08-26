import type {
  EditLocalTaskStepTitleArgs,
  LocalTask,
  UpdateLocalTaskStepArgs,
  UpdateLocalTaskSubtaskArgs
} from '../../shared/local-task-types'
import type { FileStoreMutationAccess } from './file-store-mutations'
import { findStep, findSubtask } from './file-store-index'

const time = (): number => Date.now()

export function updateSubtask(
  store: FileStoreMutationAccess,
  args: UpdateLocalTaskSubtaskArgs & { actorSessionId?: string }
): LocalTask {
  const { task, index } = findSubtask(store.taskPaths(), args.subtaskId, store.readTask)
  const subtasks = [...task.subtasks]
  const current = subtasks[index]
  if (args.actorSessionId && current.sessionId && current.sessionId !== args.actorSessionId) {
    throw new Error('Subtask is assigned to another Agent session')
  }
  subtasks[index] = {
    ...current,
    title: args.title?.trim() || current.title,
    status: args.status ?? current.status,
    sessionId: args.actorSessionId && !current.sessionId ? args.actorSessionId : current.sessionId,
    updatedAt: time()
  }
  return store.writeTask({ ...task, subtasks, updatedAt: time() })
}

export function updateStep(
  store: FileStoreMutationAccess,
  args: UpdateLocalTaskStepArgs & { actorSessionId?: string }
): LocalTask {
  const { task, subtaskIndex, stepIndex } = findStep(
    store.taskPaths(),
    args.stepId,
    args.subtaskId,
    store.readTask
  )
  const subtasks = task.subtasks.map((subtask, index) => {
    if (index !== subtaskIndex) {
      return subtask
    }
    if (args.actorSessionId && subtask.sessionId && subtask.sessionId !== args.actorSessionId) {
      throw new Error('Subtask is assigned to another Agent session')
    }
    const steps = subtask.steps.map((step, currentIndex) =>
      currentIndex === stepIndex
        ? {
            ...step,
            title: args.title?.trim() || step.title,
            status: args.status ?? step.status,
            updatedAt: time()
          }
        : step
    )
    return {
      ...subtask,
      sessionId:
        args.actorSessionId && !subtask.sessionId ? args.actorSessionId : subtask.sessionId,
      steps,
      updatedAt: time()
    }
  })
  return store.writeTask({ ...task, subtasks, updatedAt: time() })
}

export function editStepTitle(
  store: FileStoreMutationAccess,
  args: EditLocalTaskStepTitleArgs
): LocalTask {
  const { task, subtaskIndex, stepIndex } = findStep(
    store.taskPaths(),
    args.stepId,
    args.subtaskId,
    store.readTask
  )
  if (task.subtasks[subtaskIndex].steps[stepIndex].status !== 'todo') {
    throw new Error('Only an unstarted AI step can be edited')
  }
  return updateStep(store, { subtaskId: args.subtaskId, stepId: args.stepId, title: args.title })
}
