import type { LocalTask, LocalTaskSession } from '../../shared/local-task-types'

export type LocalTaskRows = {
  tasks: {
    id: string
    project_id: string
    title: string
    description: string
    status: LocalTask['status']
    workspace_id: string
    workspace_label: string
    created_at: number
    updated_at: number
    archived_at: number | null
    title_source: LocalTask['titleSource']
    waiting_reason: string | null
  }[]
  sessions: {
    id: string
    task_id: string
    workspace_id: string
    title: string
    status: LocalTaskSession['status']
    latest_output: string | null
    created_at: number
    updated_at: number
  }[]
  subtasks: {
    id: string
    task_id: string
    session_id: string | null
    title: string
    status: LocalTask['subtasks'][number]['status']
    created_at: number
    updated_at: number
  }[]
  steps: {
    id: string
    subtask_id: string
    title: string
    status: LocalTask['subtasks'][number]['steps'][number]['status']
    updated_at: number
  }[]
}

export function projectLocalTaskRows(
  task: LocalTaskRows['tasks'][number],
  sessions: LocalTaskRows['sessions'],
  subtasks: LocalTaskRows['subtasks'],
  steps: LocalTaskRows['steps']
): LocalTask {
  const taskSessions = sessions.map((session) => ({
    id: session.id,
    taskId: session.task_id,
    workspaceId: session.workspace_id,
    title: session.title,
    status: session.status,
    latestOutput: session.latest_output,
    createdAt: session.created_at,
    updatedAt: session.updated_at
  }))
  const taskSubtasks = subtasks.map((subtask) => ({
    id: subtask.id,
    title: subtask.title,
    status: subtask.status,
    sessionId: subtask.session_id,
    steps: steps
      .filter((step) => step.subtask_id === subtask.id)
      .map((step) => ({
        id: step.id,
        title: step.title,
        status: step.status,
        updatedAt: step.updated_at
      })),
    createdAt: subtask.created_at,
    updatedAt: subtask.updated_at
  }))
  const latest = [...taskSessions]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .find((session) => session.latestOutput)
  return {
    id: task.id,
    projectId: task.project_id,
    title: task.title,
    description: task.description,
    status: task.status,
    workspaceId: task.workspace_id,
    workspaceLabel: task.workspace_label,
    createdAt: task.created_at,
    updatedAt: task.updated_at,
    archivedAt: task.archived_at,
    titleSource: task.title_source,
    subtasks: taskSubtasks,
    sessions: taskSessions,
    latestOutput: latest?.latestOutput
      ? { sessionId: latest.id, text: latest.latestOutput, updatedAt: latest.updatedAt }
      : null,
    waitingReason: task.waiting_reason
  }
}
