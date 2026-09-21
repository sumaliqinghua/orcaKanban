import type { TuiAgent } from './tui-agent'
import type { SetupDecision } from './worktree/create-types'
import type { TaskSourceContext, WorkspaceRunContext } from './task-source-context'
import type { AutomationEventTrigger } from './automation-event-types'
import type { AutomationTemplateSource } from './automation-template-source'
import type {
  AutomationPrecheck,
  AutomationPrecheckResult,
  AutomationRunOutputSnapshot,
  AutomationRunUsage
} from './automation-run-usage'
export type { AutomationEventTrigger, AutomationEventType } from './automation-event-types'

export type AutomationWorkspaceMode = 'existing' | 'new_per_run'
export type AutomationExecutionMode = 'prompt' | 'open_local_tasks'
export type AutomationLocalTaskScope = 'workspace' | 'all_local_projects'
export type AutomationExecutionTargetType = 'local' | 'ssh'
export type AutomationSchedulerOwner = 'local_host_service' | 'ssh_bridge' | 'remote_host_service'
export type AutomationMissedRunPolicy = 'run_once_within_grace'
export type AutomationRunStatus =
  | 'pending'
  | 'dispatching'
  | 'dispatched'
  | 'completed'
  | 'skipped_precheck'
  | 'skipped_missed'
  | 'skipped_unavailable'
  | 'skipped_needs_interactive_auth'
  | 'dispatch_failed'
export type AutomationRunTrigger = 'scheduled' | 'manual' | 'event'

/** Statuses a run can never leave; only these are safe to evict from history. */
export function isFinalAutomationRunStatus(status: AutomationRunStatus): boolean {
  return (
    status === 'completed' ||
    status === 'dispatch_failed' ||
    status === 'skipped_precheck' ||
    status === 'skipped_missed' ||
    status === 'skipped_unavailable' ||
    status === 'skipped_needs_interactive_auth'
  )
}

export type AutomationSchedulePreset = 'hourly' | 'daily' | 'weekdays' | 'weekly' | 'custom'
export type {
  AutomationRunUsageProvider,
  AutomationRunUsageStatus,
  AutomationRunUsageAttribution,
  AutomationRunUsageUnavailableReason,
  AutomationRunUsage,
  AutomationRunOutputSnapshot,
  AutomationPrecheck,
  AutomationPrecheckResult
} from './automation-run-usage'

export type Automation = {
  id: string
  /** Optional client request key used to make cross-authority creates retry-safe. */
  creationKey?: string
  name: string
  prompt: string
  sourceTemplate?: AutomationTemplateSource | null
  executionMode?: AutomationExecutionMode
  /** Scope used by Open local task automations. Missing means the selected workspace. */
  localTaskScope?: AutomationLocalTaskScope
  precheck: AutomationPrecheck | null
  agentId: TuiAgent
  /** Why: runContext carries the logical project + host setup identity for
   *  multi-host projects; projectId remains only as the legacy repo-id storage
   *  field for pre-host-context automations.
   *  @deprecated Use runContext.projectId/runContext.repoId or
   *  getAutomationRunRepoId(). */
  runContext?: WorkspaceRunContext | null
  /** Why: task/provider data can come from a different host/account than the
   *  workspace run target, so automations persist it separately. */
  sourceContext?: TaskSourceContext | null
  eventTrigger?: AutomationEventTrigger | null
  /** @deprecated Legacy repo-id compatibility field. New code should persist
   *  runContext and use getAutomationRunRepoId() for fallback reads. */
  projectId: string
  executionTargetType: AutomationExecutionTargetType
  executionTargetId: string
  /** Why: pins the SSH registration incarnation this record was attached to, so a
   *  removed-and-re-added target reusing the id can't silently adopt it. Absent on
   *  local records, on legacy records, and on orphans whose target is gone. */
  executionTargetGeneration?: number
  schedulerOwner: AutomationSchedulerOwner
  workspaceMode: AutomationWorkspaceMode
  workspaceId: string | null
  baseBranch: string | null
  setupDecision?: SetupDecision
  reuseSession: boolean
  timezone: string
  rrule: string
  dtstart: number
  enabled: boolean
  nextRunAt: number
  lastRunAt?: number
  missedRunPolicy: AutomationMissedRunPolicy
  missedRunGraceMinutes: number
  createdAt: number
  updatedAt: number
}

export type AutomationRun = {
  id: string
  automationId: string
  runContext?: WorkspaceRunContext | null
  sourceContext?: TaskSourceContext | null
  title: string
  scheduledFor: number
  status: AutomationRunStatus
  trigger: AutomationRunTrigger
  eventId?: string
  workspaceId: string | null
  /** Why: run history must remain understandable after the backing workspace
   *  is deleted and its live metadata is gone. */
  workspaceDisplayName?: string | null
  sessionKind: 'terminal'
  chatSessionId: string | null
  terminalSessionId: string | null
  /** Why: a terminal tab can later point at a different pane/PTY. Automation
   *  run reopening must target the pane that actually executed the run. */
  terminalPaneKey: string | null
  terminalPtyId: string | null
  outputSnapshot: AutomationRunOutputSnapshot | null
  precheckResult: AutomationPrecheckResult | null
  usage: AutomationRunUsage | null
  error: string | null
  startedAt: number | null
  dispatchedAt: number | null
  createdAt: number
  /** Why: run titles must stay unique once retention prunes old runs, so the
   *  number can no longer be derived from how many runs are currently kept. */
  runNumber?: number
  /** Why: a target that cannot resolve refuses every occurrence, so consecutive
   *  identical refusals fold into this record instead of one row each. Counts the
   *  occurrences the record stands for; absent means one. */
  occurrenceCount?: number
  /** `scheduledFor` of the most recently folded occurrence; absent until one folds. */
  lastOccurrenceAt?: number
  localTaskBatchId?: string | null
  localTaskCount?: number
  localTaskCompletedCount?: number
  localTaskNeedsReviewCount?: number
  localTaskFailedCount?: number
}

/** A bounded history response; older hosts may continue returning `runs` only. */
export type AutomationRunsPage = {
  runs: AutomationRun[]
  nextCursor: string | null
}

export type AutomationCreateInput = {
  /** Optional idempotency key; repeated creates return the original record. */
  creationKey?: string
  name: string
  prompt: string
  sourceTemplate?: AutomationTemplateSource | null
  executionMode?: AutomationExecutionMode
  localTaskScope?: AutomationLocalTaskScope
  precheck?: AutomationPrecheck | null
  agentId: TuiAgent
  runContext?: WorkspaceRunContext | null
  sourceContext?: TaskSourceContext | null
  eventTrigger?: AutomationEventTrigger | null
  /** @deprecated Legacy repo-id compatibility field required for older stored
   *  automations and clients. Pair it with runContext for new writes. */
  projectId: string
  workspaceMode: AutomationWorkspaceMode
  workspaceId?: string | null
  baseBranch?: string | null
  setupDecision?: SetupDecision
  reuseSession?: boolean
  timezone: string
  rrule: string
  dtstart: number
  enabled?: boolean
  missedRunGraceMinutes?: number
}

export type AutomationUpdateInput = Partial<
  Pick<Automation, Exclude<keyof AutomationCreateInput, 'creationKey'>>
>

export type AutomationDispatchRequest = {
  automation: Automation
  run: AutomationRun
  dispatchToken: string
}

export type AutomationDispatchResult = {
  runId: string
  status: AutomationRunStatus
  workspaceId?: string | null
  workspaceDisplayName?: string | null
  terminalSessionId?: string | null
  terminalPaneKey?: string | null
  terminalPtyId?: string | null
  outputSnapshot?: AutomationRunOutputSnapshot | null
  precheckResult?: AutomationPrecheckResult | null
  localTaskBatchId?: string | null
  localTaskCount?: number
  localTaskCompletedCount?: number
  localTaskNeedsReviewCount?: number
  localTaskFailedCount?: number
  usage?: AutomationRunUsage | null
  error?: string | null
}

export type ExternalAutomationProvider = 'hermes' | 'openclaw'
export type ExternalAutomationManagerStatus = 'available' | 'unavailable'
export type ExternalAutomationAction = 'pause' | 'resume' | 'run' | 'delete'
export type ExternalAutomationRunStatus = 'completed' | 'failed' | 'unknown'

export type ExternalAutomationTarget =
  | {
      type: 'local'
    }
  | {
      type: 'ssh'
      connectionId: string
    }

export type ExternalAutomationJob = {
  id: string
  managerId: string
  provider: ExternalAutomationProvider
  name: string
  schedule: string
  rawSchedule: string | null
  enabled: boolean
  state: string
  prompt: string | null
  promptPreview: string
  nextRunAt: string | null
  lastRunAt: string | null
  lastStatus: string | null
  lastError: string | null
  workdir: string | null
  runCount: number
  runCountSaturated?: true
  runs: ExternalAutomationRun[]
}

export type ExternalAutomationRun = {
  id: string
  managerId: string
  provider: ExternalAutomationProvider
  jobId: string
  runAt: string | null
  status: ExternalAutomationRunStatus
  outputPreview: string | null
  outputContent: string | null
  error: string | null
  outputPath: string | null
}

export type ExternalAutomationRunsPage = {
  managerId: string
  provider: ExternalAutomationProvider
  target: ExternalAutomationTarget
  jobId: string
  page: number
  pageSize: number
  total: number
  totalSaturated?: true
  runs: ExternalAutomationRun[]
}

export type ExternalAutomationRunsInput = {
  managerId: string
  provider: ExternalAutomationProvider
  target: ExternalAutomationTarget
  jobId: string
  page: number
  pageSize: number
}

export type ExternalAutomationCreateInput = {
  managerId: string
  provider: ExternalAutomationProvider
  target: ExternalAutomationTarget
  name: string
  prompt: string
  schedule: string
  workdir: string | null
}

export type ExternalAutomationUpdateInput = ExternalAutomationCreateInput & {
  jobId: string
}

export type ExternalAutomationManager = {
  id: string
  provider: ExternalAutomationProvider
  label: string
  targetLabel: string
  target: ExternalAutomationTarget
  status: ExternalAutomationManagerStatus
  error: string | null
  canManage: boolean
  jobs: ExternalAutomationJob[]
}

export type ExternalAutomationActionInput = {
  managerId: string
  provider: ExternalAutomationProvider
  target: ExternalAutomationTarget
  jobId: string
  action: ExternalAutomationAction
}
