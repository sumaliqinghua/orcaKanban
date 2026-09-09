import type { LocalTaskSession } from './local-task-types'

export function findTaggedTaskSession(
  sessions: readonly LocalTaskSession[],
  tag: string
): LocalTaskSession | undefined {
  return sessions
    .filter((session) => session.tags?.includes(tag))
    .sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id))[0]
}
