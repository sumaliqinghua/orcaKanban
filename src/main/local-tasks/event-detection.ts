import type { AutomationEventType } from '../../shared/automation-event-types'
import type { LocalTask } from '../../shared/local-task-types'
export type LocalTaskChangeEvent = {
  eventType: AutomationEventType
  eventId: string
  task: LocalTask
}
export function detectLocalTaskEvents(
  task: LocalTask,
  previous?: LocalTask
): LocalTaskChangeEvent[] {
  const events: LocalTaskChangeEvent[] = []
  const add = (eventType: AutomationEventType, suffix: string) =>
    events.push({ eventType, eventId: `${task.id}:${task.updatedAt}:${eventType}:${suffix}`, task })
  if (task.intakeState === 'inbox' && previous?.intakeState !== 'inbox') {
    add('local_task.intake_changed', 'inbox')
  }
  if (previous && task.status !== previous.status) {
    add('local_task.status_changed', task.status)
  }
  if (previous?.archivedAt != null && task.archivedAt === null) {
    add('local_task.reopened', 'reopened')
  }
  for (const session of task.sessions) {
    const before = previous?.sessions.find((entry) => entry.id === session.id)
    if (
      session.status === 'done' &&
      before?.status !== 'done' &&
      session.associationSource !== 'clarification' &&
      session.associationSource !== 'task-report'
    ) {
      add('agent_session.completed', session.id)
    }
  }
  return events
}
