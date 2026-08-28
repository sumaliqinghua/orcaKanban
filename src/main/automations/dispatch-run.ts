import type { WebContents } from 'electron'
import type {
  Automation,
  AutomationDispatchRequest,
  AutomationDispatchResult,
  AutomationPrecheckResult,
  AutomationRun
} from '../../shared/automations-types'
import type { AutomationRunTargetResult } from './run-target-resolution'
import type { AutomationRunWriter } from './automation-run-writer'
import type { HeadlessAutomationDispatcher } from './headless-dispatch'
import { runHeadlessAutomationDispatch } from './headless-dispatch-runner'
import { createAutomationDispatchToken } from './dispatch-tokens'
import { NO_DISPATCH_HOST } from './dispatch-refusal'

export async function dispatchAutomationRun(input: {
  automation: Automation
  run: AutomationRun
  target: AutomationRunTargetResult
  runs: AutomationRunWriter
  webContents: WebContents | null
  rendererReady: boolean
  headlessDispatcher: HeadlessAutomationDispatcher | null
  runPrecheck: () => Promise<AutomationPrecheckResult | null>
  markDispatchResult: (result: AutomationDispatchResult) => Promise<AutomationRun>
  watchRun: (run: AutomationRun) => void | undefined
}): Promise<AutomationRun> {
  const { automation, run, target } = input
  if (!target.ok) {
    return input.runs.updateRun({
      runId: run.id,
      status: 'skipped_unavailable',
      workspaceId: automation.workspaceId,
      error: target.error
    })
  }
  const rendererAvailable = Boolean(
    input.webContents && !input.webContents.isDestroyed() && input.rendererReady
  )
  const canDispatch =
    automation.executionMode === 'open_local_tasks'
      ? rendererAvailable
      : rendererAvailable || Boolean(input.headlessDispatcher)
  if (!canDispatch) {
    return input.runs.updateRun({
      runId: run.id,
      status: 'skipped_unavailable',
      workspaceId: automation.workspaceId,
      error:
        automation.executionMode === 'open_local_tasks'
          ? 'Open 本地任务自动化需要桌面 renderer；当前 headless 执行环境暂不支持任务批次。'
          : NO_DISPATCH_HOST
    })
  }
  if (!rendererAvailable) {
    return await runHeadlessAutomationDispatch({
      automation,
      run,
      target,
      dispatcher: input.headlessDispatcher!,
      runs: input.runs,
      runPrecheck: input.runPrecheck,
      markDispatchResult: input.markDispatchResult,
      watchRun: input.watchRun
    })
  }
  const updated = input.runs.updateRun({
    runId: run.id,
    status: 'dispatching',
    workspaceId: automation.workspaceId,
    error: null
  })
  const payload: AutomationDispatchRequest = {
    automation,
    run: updated,
    dispatchToken: createAutomationDispatchToken(automation.id, updated.id)
  }
  input.webContents?.send('automations:dispatchRequested', payload)
  return updated
}
