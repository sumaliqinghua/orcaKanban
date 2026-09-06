import { join, resolve } from 'node:path'

export const LOCAL_TASK_ROOT_NAME = 'orca'
export const LOCAL_TASK_PRD_FILE_NAME = 'prd.md'
export const LOCAL_TASK_PLAN_FILE_NAME = 'plan.md'
export const LOCAL_TASK_RECORDS_FILE_NAME = 'records.md'

export function localTaskDirectory(projectPath: string, taskId: string): string {
  return join(resolve(projectPath), LOCAL_TASK_ROOT_NAME, taskId)
}
