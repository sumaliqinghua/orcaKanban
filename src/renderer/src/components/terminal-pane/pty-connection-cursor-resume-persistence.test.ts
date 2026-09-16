import { describe, expect, it, vi } from 'vitest'
import { normalizeHookPayload } from '../../../../shared/agent-hook-listener'
import { createHookListenerState } from '../../../../shared/agent-hook-listener/listener-state'
import { parseWorkspaceSession } from '../../../../shared/workspace-session-schema'
import { sleepingRecordFromEntry } from '../../store/slices/agent-status-sleeping-records'
import { bindBuildColdRestoreAgentResumeStartup } from './pty-connection/cold-restore-resume-startup'
import type { ConnectPanePtySession } from './pty-connection/connect-pane-pty-session'
import type { AppState } from '../../store/types'

const { state } = vi.hoisted(() => ({ state: { current: {} as Record<string, unknown> } }))
vi.mock('@/store', () => ({ useAppStore: { getState: () => state.current } }))
vi.mock('@/lib/agent-resume-launch-target', () => ({
  resolveAgentResumeLaunchTarget: () => ({ platform: 'linux', shell: 'posix' })
}))

const paneKey = 'cursor-tab:44444444-4444-4444-8444-444444444444'

describe('Cursor 事件到重启恢复', () => {
  it.each([null, 'ssh-connection'])(
    '完成会话在保存和重新读取后仍生成原对话恢复命令，连接为 %s',
    (connectionId) => {
      const event = normalizeHookPayload(
        createHookListenerState(),
        'cursor',
        {
          paneKey,
          tabId: 'cursor-tab',
          worktreeId: 'folder-workspace',
          payload: {
            hook_event_name: 'stop',
            status: 'completed',
            conversation_id: 'persisted-conversation',
            session_id: 'ephemeral-process'
          }
        },
        'production'
      )
      expect(event?.providerSession).toEqual({
        key: 'conversation_id',
        id: 'persisted-conversation'
      })
      const record = sleepingRecordFromEntry({
        state: {} as AppState,
        entry: {
          ...event!.payload,
          paneKey,
          connectionId,
          providerSession: event!.providerSession,
          updatedAt: 10,
          stateStartedAt: 10,
          stateHistory: []
        },
        tab: {
          id: 'cursor-tab',
          title: 'Cursor Agent',
          ptyId: null,
          worktreeId: 'folder-workspace',
          customTitle: null,
          color: null,
          sortOrder: 0,
          createdAt: 1
        },
        worktreeId: 'folder-workspace',
        capturedAt: 11,
        origin: 'quit',
        launchConfig: { agentCommand: 'cursor-agent --model auto', agentArgs: '', agentEnv: {} }
      })
      expect(record).not.toBeNull()
      const parsed = parseWorkspaceSession(
        JSON.parse(
          JSON.stringify({
            activeRepoId: null,
            activeWorktreeId: null,
            activeTabId: null,
            tabsByWorktree: {},
            terminalLayoutsByTabId: {},
            sleepingAgentSessionsByPaneKey: { [paneKey]: record }
          })
        )
      )
      expect(parsed.ok).toBe(true)
      if (!parsed.ok) {
        throw new Error('会话记录重新读取失败')
      }
      const restored = parsed.value.sleepingAgentSessionsByPaneKey?.[paneKey]
      expect(restored?.connectionId).toBe(connectionId)
      expect(restored?.providerSession).toEqual(event!.providerSession)
      state.current = { agentStatusByPaneKey: {}, settings: {} }
      const session = {
        pendingStartupCommand: null,
        cacheKey: paneKey,
        connectionId,
        executionHostId: connectionId ? `ssh:${connectionId}` : 'local',
        worktree: { path: '/workspace/folder' },
        getSleepingRecordForPane: () => ({ paneKey, record: restored }),
        isLegacyWorkerAutomaticResumeBlocked: () => false
      } as unknown as ConnectPanePtySession
      bindBuildColdRestoreAgentResumeStartup(session)
      const startup = session.buildColdRestoreAgentResumeStartup()
      expect(startup?.command).toBe("cursor-agent --model auto '--resume' 'persisted-conversation'")
      expect(startup?.resumeProviderSession).toEqual(event!.providerSession)
      expect(startup?.hasSleepingRecord).toBe(true)
    }
  )
})
