import { randomUUID } from 'node:crypto'
import type { LocalTaskSession } from '../../shared/local-task-types'

export function appendSessionTurn(
  turns: LocalTaskSession['turns'],
  prompt: string,
  summary: string,
  updatedAt: number
): LocalTaskSession['turns'] {
  const previous = turns.at(-1)
  if (previous?.prompt === prompt && previous.summary === (summary || null)) {
    return turns
  }
  return [
    ...turns,
    {
      id: `ltturn_${randomUUID()}`,
      prompt,
      summary: summary || null,
      createdAt: updatedAt,
      updatedAt
    }
  ].slice(-30)
}
