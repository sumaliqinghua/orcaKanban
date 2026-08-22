import type { LocalTask, LocalTaskSubtask } from '../../../../shared/local-task-types'
import type { WorkItem, Subtask } from './mock-data'

function mapSubtask(subtask: LocalTaskSubtask): Subtask {
  return {
    id: subtask.id,
    title: subtask.title,
    status: subtask.status,
    session: subtask.sessionId ?? '未关联会话',
    steps: subtask.steps
  }
}

export function localTaskToViewModel(task: LocalTask): WorkItem {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    workspace: task.workspaceLabel,
    project: task.projectId,
    updated: new Date(task.updatedAt).toLocaleString(),
    sessions: task.sessions.length,
    activeSessions: task.sessions.filter((session) => session.status === 'working').length,
    waitingReason: task.waitingReason ?? undefined,
    subtasks: task.subtasks.map(mapSubtask),
    latestOutput: task.latestOutput
      ? {
          session:
            task.sessions.find((session) => session.id === task.latestOutput?.sessionId)?.title ??
            '关联会话',
          text: task.latestOutput.text
        }
      : { session: '暂无会话', text: '尚未开始。' },
    sessionsList: task.sessions.map((session) => ({
      title: session.title,
      status: session.status,
      time: new Date(session.updatedAt).toLocaleString()
    }))
  }
}
