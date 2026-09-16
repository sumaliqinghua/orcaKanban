import type { LocalTaskStatus } from './local-task-types'
export type AutomationEventType =
  | 'local_task.intake_changed'
  | 'local_task.status_changed'
  | 'local_task.reopened'
  | 'agent_session.completed'
export type AutomationEventTrigger = {
  eventType: AutomationEventType
  projectId?: string
  workspaceId?: string
  status?: LocalTaskStatus
}
