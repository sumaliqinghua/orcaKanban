import { agentProviderSessionsEqual } from '../../shared/agent-session-resume'
import type { AgentStatusIpcPayload } from '../../shared/agent-status-types'
import type { AutomationRun } from '../../shared/automations-types'
import type { LocalTaskSessionRetry } from '../../shared/local-task-session-retry'
import { agentHookServer } from '../agent-hooks/server'
import { watchCodexSessionRetry, type CodexSessionRetryWatch } from '../local-tasks/codex-session-retry-watch'
import { getLocalTaskStore } from '../local-tasks/store'
import type { Store } from '../persistence'
import type { OrcaRuntimeService } from '../runtime/orca-runtime'

type Candidate = { run: AutomationRun; hook: AgentStatusIpcPayload; handle: string; key: string }
type WatchedRun = { key: string; retry: LocalTaskSessionRetry | null; watch: CodexSessionRetryWatch | null }

export function startAutomationSessionRetryMonitor(profile: Store, runtime: OrcaRuntimeService): { dispose: () => void } {
  const monitorStartedAt = Date.now()
  const watched = new Map<string, WatchedRun>()
  let disposed = false
  const candidates = (): Map<string, Candidate> => {
    const result = new Map<string, Candidate>()
    const automations = new Map(profile.listAutomations().map(row => [row.id, row]))
    const taskTabs = new Set(getLocalTaskStore(profile).list(undefined, undefined, { includeArchived: true })
      .flatMap(task => task.sessions.map(session => session.tabId ?? session.id)))
    const hooks = agentHookServer.getStatusSnapshot()
    const seenPanes = new Set<string>()
    const runs = profile.listAutomationRuns().sort((a, b) => (b.startedAt ?? b.createdAt) - (a.startedAt ?? a.createdAt))
    for (const run of runs) {
      const pane = run.terminalPaneKey
      if (!pane || seenPanes.has(pane)) continue
      // 一个终端复用时只属于最近一次调度，旧运行记录不能重新取得发送权。
      seenPanes.add(pane)
      const automation = automations.get(run.automationId)
      if (!automation?.enabled || automation.agentId !== 'codex' || automation.executionTargetType !== 'local' ||
        (run.runContext?.hostId && run.runContext.hostId !== 'local') ||
        !run.terminalSessionId || taskTabs.has(run.terminalSessionId)) continue
      const hook = hooks.find(row => row.paneKey === pane && row.tabId === run.terminalSessionId && !row.connectionId && row.agentType === 'codex')
      const handle = hook && runtime.getAgentStatusTerminalHandleForPaneKey(pane)
      if (!hook?.providerSession || !handle || hook.receivedAt < (run.startedAt ?? run.createdAt)) continue
      result.set(run.id, { run, hook, handle, key: JSON.stringify([pane, handle, hook.providerSession]) })
    }
    return result
  }
  const install = async (candidate: Candidate, entry: WatchedRun): Promise<void> => {
    const current = (): Candidate | undefined => candidates().get(candidate.run.id)
    const eligible = (): boolean => {
      const next = current()
      return !disposed && watched.get(candidate.run.id) === entry && next?.key === entry.key &&
        agentProviderSessionsEqual('codex', candidate.hook.providerSession, next.hook.providerSession)
    }
    try {
      const watch = await watchCodexSessionRetry({
        profile, runtime, providerSession: candidate.hook.providerSession!, monitorStartedAt,
        currentHook: () => current()?.hook,
        eligible,
        read: () => entry.retry,
        save: retry => { if (!disposed && watched.get(candidate.run.id) === entry) entry.retry = retry }
      })
      if (!eligible()) watch.dispose()
      else entry.watch = watch
    } catch {
      if (watched.get(candidate.run.id) === entry) watched.delete(candidate.run.id)
    }
  }
  const tick = (): void => {
    if (disposed) return
    const next = candidates()
    for (const [id, entry] of watched) {
      if (next.get(id)?.key !== entry.key) {
        entry.watch?.dispose()
        watched.delete(id)
      }
    }
    for (const [id, candidate] of next) {
      if (watched.has(id)) continue
      const entry: WatchedRun = { key: candidate.key, retry: null, watch: null }
      watched.set(id, entry)
      void install(candidate, entry)
    }
  }
  const timer = setInterval(tick, 1_000)
  timer.unref?.()
  tick()
  return { dispose: () => {
    disposed = true
    clearInterval(timer)
    for (const entry of watched.values()) entry.watch?.dispose()
    watched.clear()
  } }
}
