import { expect, it } from 'vitest'
import { localTaskSessionMatchesTab } from './local-task-session-identity'
import type { AgentStatusEntry } from '../../../../shared/agent-status-types'
import type { WorkItem } from './mock-data'

const paneKey = 'mapped-tab:11111111-1111-4111-8111-111111111111'
const session: WorkItem['sessionsList'][number] = {
  id: 'original',
  tabId: 'mapped-tab',
  title: '原会话',
  time: '',
  status: 'working',
  agentId: 'codex',
  providerSession: { key: 'session_id', id: 'original-provider' }
}
function state(providerId: string) {
  return {
    agentStatusByPaneKey: {
      [paneKey]: {
        agentType: 'codex',
        providerSession: { key: 'session_id', id: providerId }
      } as AgentStatusEntry
    },
    sleepingAgentSessionsByPaneKey: {}
  }
}
it('rejects a mapped tab occupied by a different provider conversation', () => {
  expect(localTaskSessionMatchesTab(session, state('different-provider'))).toBe(false)
})
it('accepts the exact original provider conversation', () => {
  expect(localTaskSessionMatchesTab(session, state('original-provider'))).toBe(true)
})
it('does not substitute another pane in the same tab', () => {
  expect(localTaskSessionMatchesTab(session, state('original-provider'), 'another-pane')).toBe(
    false
  )
})
it('does not trust an unverified terminal when the provider identity is recorded', () => {
  expect(
    localTaskSessionMatchesTab(session, {
      agentStatusByPaneKey: {},
      sleepingAgentSessionsByPaneKey: {}
    })
  ).toBe(false)
})

it('恢复接口确认的终端在没有新事件时仍能匹配，但替换进程后失效', () => {
  const restored = {
    ...session,
    workspaceId: 'workspace',
    terminalBinding: { paneKey, ptyId: 'restored-pty', executionHostId: 'local' as const }
  }
  const restoredState = {
    agentStatusByPaneKey: {},
    sleepingAgentSessionsByPaneKey: {},
    tabsByWorktree: { workspace: [{ id: 'mapped-tab' }] },
    terminalLayoutsByTabId: {
      'mapped-tab': { ptyIdsByLeafId: { '11111111-1111-4111-8111-111111111111': 'restored-pty' } }
    }
  }
  expect(localTaskSessionMatchesTab(restored, restoredState)).toBe(true)
  expect(
    localTaskSessionMatchesTab(restored, { ...restoredState, ...state('different-provider') })
  ).toBe(false)
  restoredState.terminalLayoutsByTabId['mapped-tab'].ptyIdsByLeafId[
    '11111111-1111-4111-8111-111111111111'
  ] = 'replacement'
  expect(localTaskSessionMatchesTab(restored, restoredState)).toBe(false)
})
