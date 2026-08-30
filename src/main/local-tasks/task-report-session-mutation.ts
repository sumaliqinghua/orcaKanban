import type {
  ReportLocalTaskCompletedArgs,
  LocalTask,
  LocalTaskSession
} from '../../shared/local-task-types'
import type { FileStoreMutationAccess } from './file-store-mutations'

export function completeTaskReportSession(
  store: FileStoreMutationAccess,
  task: LocalTask,
  args: ReportLocalTaskCompletedArgs & { projectPath?: string },
  session: LocalTaskSession
): LocalTask {
  const updatedAt = Date.now()
  return store.writeTask({
    ...task,
    sessions: task.sessions.map((candidate) =>
      candidate.id === args.sessionId
        ? {
            ...candidate,
            status: 'done' as const,
            latestOutput: args.latestOutput ?? session.latestOutput,
            updatedAt
          }
        : candidate
    ),
    updatedAt
  })
}
