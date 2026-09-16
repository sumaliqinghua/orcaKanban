import type { Automation, AutomationEventType, AutomationRun } from '../../shared/automations-types'
import type { AutomationRunWriter } from './automation-run-writer'
import type { AutomationRunTargetResult } from './run-target-resolution'

export async function dispatchAutomationEvent(args: {
  automations: readonly Automation[]
  runs: AutomationRunWriter
  listRuns: (automationId: string) => AutomationRun[]
  eventType: AutomationEventType
  eventId: string
  projectId: string
  workspaceId: string | null
  taskId: string
  status?: string
  resolveTarget: (automation: Automation) => AutomationRunTargetResult
  requestDispatch: (
    automation: Automation,
    run: AutomationRun,
    target: AutomationRunTargetResult
  ) => Promise<AutomationRun>
}): Promise<void> {
  for (const automation of args.automations) {
    const trigger = automation.eventTrigger
    if (!automation.enabled || !trigger || trigger.eventType !== args.eventType) {
      continue
    }
    if (trigger.projectId && trigger.projectId !== args.projectId) {
      continue
    }
    if (trigger.workspaceId && trigger.workspaceId !== args.workspaceId) {
      continue
    }
    if (trigger.status && trigger.status !== args.status) {
      continue
    }
    if (args.listRuns(automation.id).some((run) => run.eventId === args.eventId)) {
      continue
    }
    const run = args.runs.createRun(automation, Date.now(), 'event', args.eventId)
    await args.requestDispatch(
      {
        ...automation,
        prompt: `${automation.prompt}\n\n事件：${args.eventType}\n任务 ID：${args.taskId}`
      },
      run,
      args.resolveTarget(automation)
    )
  }
}
