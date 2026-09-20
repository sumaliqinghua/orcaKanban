import type { LocalTaskSessionTurn, LocalTaskSubtask } from './local-task-types'

export type LocalTaskSubtaskReference = Pick<
  LocalTaskSubtask,
  'id' | 'title' | 'status' | 'sessionId'
> & {
  description: string | null
  descriptionSource: 'subtask' | 'retained-prompt' | 'recent-prompt' | 'unavailable'
  descriptionTruncated: boolean
}

export type LocalTaskSavedTurn = Pick<LocalTaskSessionTurn, 'id' | 'prompt' | 'summary'>

export type LocalTaskReferenceDetail = {
  subtask: LocalTaskSubtaskReference
  savedTurns: LocalTaskSavedTurn[]
  historySource: 'saved-turns'
  historyIsComplete: false
}
