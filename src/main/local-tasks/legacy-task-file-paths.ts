import { join } from 'node:path'
import { localTaskDirectory } from './task-context-paths'

export const LOCAL_TASK_FILE_NAME = 'task.json'

export function localTaskFile(projectPath: string, taskId: string): string {
  return join(localTaskDirectory(projectPath, taskId), LOCAL_TASK_FILE_NAME)
}
