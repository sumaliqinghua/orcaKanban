import type { LocalTaskStatus } from './local-task-types'

export function resolveLocalTaskStatus(
  status: LocalTaskStatus,
  sessions: readonly { status: 'working' | 'idle' | 'done' }[]
): LocalTaskStatus {
  if (sessions.some((session) => session.status === 'working')) {
    return 'In progress'
  }
  if (status === 'Done') {
    return 'Done'
  }
  if (sessions.length > 0) {
    return 'Needs review'
  }
  return status === 'Needs review' ? status : 'Open'
}
