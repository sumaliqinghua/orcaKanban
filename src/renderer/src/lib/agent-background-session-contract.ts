import type { ParsedAgentStatusPayload } from '../../../shared/agent-status-types'
import type { LaunchSource } from '../../../shared/telemetry-events'
import type { TuiAgent } from '../../../shared/tui-agent'
import type { AgentStartupPlan } from '@/lib/tui-agent-startup'
import type { AutomationTerminalOwnership } from '@/lib/automation-terminal-ownership'

export type LaunchAgentBackgroundSessionArgs = {
  agent: TuiAgent
  worktreeId: string
  prompt?: string
  /** Binds the background Agent shell to a local task tool context. */
  localTaskId?: string
  /** Absolute project root containing `orca/<task-id>/task.json`. */
  localTaskRoot?: string
  launchSource?: LaunchSource
  title?: string
  onData?: (chunk: string) => void
  onExit?: (ptyId: string, code: number) => void
  onAgentStatus?: (payload: ParsedAgentStatusPayload) => void
}

export type LaunchAgentBackgroundSessionResult = {
  tabId: string
  paneKey: string
  ptyId: string
  startupPlan: AgentStartupPlan
  terminalOwnership: AutomationTerminalOwnership | null
}

export function addLocalTaskAgentEnv(
  env: Record<string, string>,
  taskId?: string,
  projectRoot?: string
): Record<string, string> {
  return Object.assign(
    env,
    taskId ? { ORCA_LOCAL_TASK_ID: taskId } : {},
    projectRoot ? { ORCA_LOCAL_TASK_ROOT: projectRoot } : {}
  )
}
