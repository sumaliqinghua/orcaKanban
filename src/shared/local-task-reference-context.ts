import type {
  LocalTask,
  LocalTaskCurrentContext,
  LocalTaskSession,
  LocalTaskSubtask
} from './local-task-types'
import type {
  LocalTaskReferenceDetail,
  LocalTaskSubtaskReference
} from './local-task-reference-types'

const DESCRIPTION_PREVIEW_LIMIT = 2_000

function describeSubtask(
  task: LocalTask,
  subtask: LocalTaskSubtask,
  preview: boolean
): LocalTaskSubtaskReference {
  const session = task.sessions.find((entry) => entry.id === subtask.sessionId)
  const retainedPrompt = session?.turns.find((turn) => turn.prompt.trim())?.prompt
  const description =
    subtask.description?.trim() || retainedPrompt || session?.currentPrompt || null
  const descriptionSource = subtask.description?.trim()
    ? 'subtask'
    : retainedPrompt
      ? 'retained-prompt'
      : session?.currentPrompt
        ? 'recent-prompt'
        : 'unavailable'
  return {
    id: subtask.id,
    title: subtask.title,
    status: subtask.status,
    sessionId: subtask.sessionId,
    description: preview ? (description?.slice(0, DESCRIPTION_PREVIEW_LIMIT) ?? null) : description,
    descriptionSource,
    descriptionTruncated: preview && (description?.length ?? 0) > DESCRIPTION_PREVIEW_LIMIT
  }
}

export function buildLocalTaskCurrentContext(
  task: LocalTask,
  session: LocalTaskSession | null
): LocalTaskCurrentContext {
  return {
    task: {
      id: task.id,
      title: task.title,
      description: task.description,
      descriptionRevision: task.descriptionRevision ?? task.updatedAt
    },
    session: session ? { id: session.id, title: session.title, status: session.status } : null,
    assignedSubtasks: session
      ? task.subtasks.filter((subtask) => subtask.sessionId === session.id)
      : [],
    referenceSubtasks: task.subtasks
      .filter((subtask) => !session || subtask.sessionId !== session.id)
      .map((subtask) => describeSubtask(task, subtask, true))
  }
}

export function buildLocalTaskReferenceDetail(
  task: LocalTask,
  subtask: LocalTaskSubtask
): LocalTaskReferenceDetail {
  const session = task.sessions.find((entry) => entry.id === subtask.sessionId)
  return {
    subtask: describeSubtask(task, subtask, false),
    savedTurns: (session?.turns ?? []).map((turn) => ({
      id: turn.id,
      prompt: turn.prompt,
      summary: turn.summary
    })),
    historySource: 'saved-turns',
    historyIsComplete: false
  }
}
