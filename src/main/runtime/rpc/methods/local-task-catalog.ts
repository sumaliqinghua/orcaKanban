import { z } from 'zod'
import { isLocalTaskHost } from './local-task-host-scope'
import { isTuiAgent } from '../../../../shared/tui-agent-config'
import type { TuiAgent } from '../../../../shared/tui-agent'
import { isResumableTuiAgent } from '../../../../shared/agent-session-resume'
import { findTaggedTaskSession } from '../../../../shared/local-task-session-tags'
import { getLocalTaskStore } from '../../../local-tasks/store'
import { publishLocalTaskChange } from '../../../local-tasks/change-notifications'
import { defineMethod, InvalidArgumentError, type RpcAnyMethod } from '../core'

const Id = z.string().trim().min(1).max(512)
const dispatchingTasks = new Set<string>()
const Dispatch = z
  .object({
    taskId: Id,
    projectPath: z.string().trim().min(1).max(4096).optional(),
    worktree: Id,
    agent: z.string().refine(isTuiAgent, 'Unsupported Agent'),
    prompt: z.string().trim().min(1).max(100_000),
    tag: Id.optional(),
    purpose: z.enum(['execution', 'clarification', 'task-report']).default('execution'),
    title: z.string().trim().max(500).optional()
  })
  .strict()

export const LOCAL_TASK_CATALOG_METHODS: readonly RpcAnyMethod[] = [
  defineMethod({
    name: 'localTask.sessionContext',
    params: z.object({ sessionId: Id, worktreeId: Id.optional() }).strict(),
    handler: (params) => {
      const task = getLocalTaskStore()
        .list()
        .find((task) =>
          task.sessions.some(
            (session) =>
              (session.id === params.sessionId || session.tabId === params.sessionId) &&
              (!params.worktreeId || session.workspaceId === params.worktreeId)
          )
        )
      if (!task) {
        throw new InvalidArgumentError('No task is associated with this session')
      }
      const session = task.sessions.find(
        (row) => row.id === params.sessionId || row.tabId === params.sessionId
      )!
      return {
        taskId: task.id,
        sessionId: session.id,
        worktreeId: session.workspaceId,
        ...(task.projectPath ? { projectPath: task.projectPath } : {})
      }
    }
  }),
  defineMethod({
    name: 'localTask.list',
    params: z
      .object({
        projectId: Id.optional(),
        scope: z.enum(['all-local-projects']).default('all-local-projects'),
        includeArchived: z.boolean().optional()
      })
      .strict(),
    handler: (params, { runtime }) => {
      return {
        tasks: getLocalTaskStore()
          .list(params.projectId, undefined, params)
          .filter((task) => isLocalTaskHost(runtime, task))
      }
    }
  }),
  defineMethod({
    name: 'localTask.dispatch',
    params: Dispatch,
    handler: async (params, { runtime, signal }) => {
      const store = getLocalTaskStore()
      const task = store.get(params.taskId, params.projectPath)
      if (!task) {
        throw new InvalidArgumentError(`Local task not found: ${params.taskId}`)
      }
      if (task.archivedAt !== null) {
        throw new InvalidArgumentError('Task is archived')
      }
      if (
        params.purpose === 'execution' &&
        (task.intakeState !== 'ready' || task.status !== 'Open')
      ) {
        return { disposition: 'skipped_ineligible', task }
      }
      const prompt = [
        `本地任务 ID：${task.id}`,
        `任务描述：${task.description}`,
        params.prompt,
        `任务上下文命令：orca local-task current。任务 ID 为 ${task.id}。`
      ].join('\n\n')
      const worktreeSelector =
        task.workspaceId === 'local' ? `path:${task.projectPath}` : params.worktree
      if (
        !isLocalTaskHost(runtime, task) ||
        (!task.projectPath && task.workspaceId === 'local') ||
        (task.workspaceId !== 'local' && params.worktree !== `id:${task.workspaceId}`)
      ) {
        throw new InvalidArgumentError('Dispatch requires the task owning local workspace')
      }
      if (dispatchingTasks.has(task.id)) {
        return { disposition: 'skipped_busy', task }
      }
      dispatchingTasks.add(task.id)
      try {
        const tagged = params.tag ? findTaggedTaskSession(task.sessions, params.tag) : undefined
        const terminals = await runtime.listTerminals(worktreeSelector, 200)
        if (terminals.truncated) {
          return { disposition: 'skipped_unverifiable', task }
        }
        let live = tagged
          ? terminals.terminals.find((terminal) => terminal.tabId === (tagged.tabId ?? tagged.id))
          : undefined
        if (tagged && (!live || !live.connected)) {
          if (tagged.agentId !== params.agent) {
            return { disposition: 'skipped_agent_mismatch', task }
          }
          if (!tagged.providerSession || !isResumableTuiAgent(tagged.agentId)) {
            return { disposition: 'skipped_resume_required', task, sessionId: tagged.id }
          }
          const restored = await runtime.ensureAgentSession({
            kind: 'explicit',
            worktree: worktreeSelector,
            agent: tagged.agentId,
            providerSession: tagged.providerSession,
            presentation: 'background'
          })
          if (!restored.terminal.tabId) {
            throw new Error('Restored session has no tab')
          }
          store.rebindSessionTab({ sessionId: tagged.id, tabId: restored.terminal.tabId })
          const ready = await runtime.waitForTerminal(restored.terminal.handle, {
            condition: 'tui-idle',
            timeoutMs: 10_000,
            signal
          })
          if (!ready.satisfied) {
            return { disposition: 'skipped_unverifiable', sessionId: tagged.id }
          }
          live = await runtime.showTerminal(restored.terminal.handle)
        }
        if (live) {
          if (tagged!.agentId !== params.agent) {
            return { disposition: 'skipped_agent_mismatch', task }
          }
          const status = await runtime.getTerminalAgentStatus(live.handle)
          if (status.status === 'working' || status.status === 'permission') {
            return { disposition: 'skipped_busy' as const, task, sessionId: tagged!.id }
          }
          if (!status.isRunningAgent || status.status !== 'idle') {
            return { disposition: 'skipped_unverifiable', task, sessionId: tagged!.id }
          }
          const sent = await runtime.sendTerminalAgentPrompt(live.handle, prompt, {
            signal,
            beforeWrite: async () => {
              const current = store.get(task.id)
              const selected =
                params.tag && current
                  ? findTaggedTaskSession(current.sessions, params.tag)
                  : undefined
              if (!current || current.archivedAt !== null || selected?.id !== tagged!.id) {
                throw new Error('Task or session tag changed during dispatch')
              }
              const state = await runtime.getTerminalAgentStatus(live!.handle)
              if (!state.isRunningAgent || state.status !== 'idle') {
                throw new Error('Agent is no longer idle')
              }
            }
          })
          if (!sent.accepted) {
            throw new Error('Agent prompt was not accepted')
          }
          const updated = store.updateSessionOutput({
            sessionId: tagged!.id,
            prompt,
            sessionStatus: 'working'
          })
          publishLocalTaskChange(updated)
          return { disposition: 'continued' as const, task: updated, sessionId: tagged!.id }
        }
        if (tagged) {
          return { disposition: 'skipped_resume_required', task, sessionId: tagged.id }
        }
        if (task.sessions.some((session) => session.status === 'working')) {
          return { disposition: 'skipped_busy', task }
        }
        const created = await runtime.createMobileSessionTerminal(worktreeSelector, {
          agent: params.agent as TuiAgent,
          env: { ORCA_LOCAL_TASK_ID: task.id, ORCA_LOCAL_TASK_ROOT: task.projectPath },
          activate: false,
          select: false
        })
        const tabId = created.tab.parentTabId ?? created.tab.id
        const session = store.createSession({
          taskId: task.id,
          projectPath: params.projectPath,
          sessionId: tabId,
          workspaceId: task.workspaceId,
          title: params.title ?? task.title,
          currentPrompt: prompt,
          agentId: params.agent as TuiAgent,
          tags: params.tag ? [params.tag] : [],
          associationSource: params.purpose === 'execution' ? 'automation' : params.purpose,
          initialStatus: 'idle'
        })
        if (!created.tab.terminal) {
          const failed = store.updateSessionOutput({ sessionId: session.id, sessionStatus: 'idle', manualNotes: '派发失败：Agent 终端未就绪，可重新派发。' })
          publishLocalTaskChange(failed)
          throw new Error('Agent terminal is not ready')
        }
        try {
          const ready = await runtime.waitForTerminal(created.tab.terminal, {
            condition: 'tui-idle', timeoutMs: 10_000, signal
          })
          if (!ready.satisfied) {
            const failed = store.updateSessionOutput({ sessionId: session.id, sessionStatus: 'idle', manualNotes: '派发失败：等待 Agent 终端就绪超时，可重新派发。' })
            publishLocalTaskChange(failed)
            return { disposition: 'skipped_unverifiable', task: failed, sessionId: session.id }
          }
          const sent = await runtime.sendTerminalAgentPrompt(created.tab.terminal, prompt, { signal })
          if (!sent.accepted) throw new Error('Agent prompt was not accepted')
          const updated = store.updateSessionOutput({ sessionId: session.id, prompt, sessionStatus: 'working', manualNotes: null })
          publishLocalTaskChange(updated)
          return { disposition: 'created' as const, task: updated, sessionId: session.id }
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error)
          const failed = store.updateSessionOutput({ sessionId: session.id, sessionStatus: 'idle', manualNotes: `派发失败：${reason}。可重新派发。` })
          publishLocalTaskChange(failed)
          throw error
        }
      } finally {
        dispatchingTasks.delete(task.id)
      }
    }
  }),
  defineMethod({
    name: 'localTask.setSessionTags',
    params: z.object({ taskId: Id, sessionId: Id, tags: z.array(Id).max(20) }).strict(),
    handler: (params) => {
      const store = getLocalTaskStore()
      const task = store.get(params.taskId)
      if (!task?.sessions.some((session) => session.id === params.sessionId)) {
        throw new InvalidArgumentError('Session does not belong to this local task')
      }
      const updated = store.updateSessionOutput({ sessionId: params.sessionId, tags: params.tags })
      publishLocalTaskChange(updated)
      return { task: updated }
    }
  })
]
