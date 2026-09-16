// @vitest-environment happy-dom
import { beforeEach, expect, it, vi } from 'vitest'
import type { AppState } from '@/store/types'
import { localTaskSessionTerminalCard } from './local-task-session-terminal-card'
import type { WorkItem } from './mock-data'

const host = vi.hoisted(() => vi.fn())
vi.mock('@/lib/ai-vault-resume-target', () => ({ getAiVaultResumeWorkspaceExecutionHostId: host }))
const leafId = '11111111-1111-4111-8111-111111111111'
const paneKey = `restored:${leafId}`
const session: WorkItem['sessionsList'][number] = {
  id: 'original',
  tabId: 'restored',
  workspaceId: 'folder:workspace',
  title: '原对话',
  time: '',
  status: 'done',
  agentId: 'cursor',
  providerSession: { key: 'conversation_id', id: 'original-conversation' },
  terminalBinding: { paneKey, ptyId: 'pty', executionHostId: 'local' }
}
function fixture(): AppState {
  return {
    tabsByWorktree: { 'folder:workspace': [{ id: 'restored' }] },
    terminalLayoutsByTabId: { restored: { ptyIdsByLeafId: { [leafId]: 'pty' } } },
    ptyIdsByTabId: { restored: ['pty'] },
    agentStatusByPaneKey: {},
    sleepingAgentSessionsByPaneKey: {},
    getKnownWorktreeById: () => ({ repoId: 'project', path: '/workspace' })
  } as unknown as AppState
}
beforeEach(() => host.mockReturnValue('local'))
it('没有状态事件或看板卡片时，仍显示已确认的 Cursor 终端，不伪造执行状态', () => {
  expect(localTaskSessionTerminalCard(session, fixture())).toMatchObject({
    ptyId: 'pty',
    tabId: 'restored',
    leafId,
    agentType: 'cursor',
    dotState: 'idle'
  })
})
it('拒绝已退出或被替换的终端', () => {
  const state = fixture()
  state.ptyIdsByTabId.restored = []
  expect(localTaskSessionTerminalCard(session, state)).toBeNull()
  state.ptyIdsByTabId.restored = ['pty']
  state.terminalLayoutsByTabId.restored!.ptyIdsByLeafId![leafId] = 'replacement'
  expect(localTaskSessionTerminalCard(session, state)).toBeNull()
})
it('拒绝另一个对话接管原窗格', () => {
  const state = fixture()
  state.agentStatusByPaneKey[paneKey] = {
    agentType: 'cursor',
    providerSession: { key: 'conversation_id', id: 'other' }
  } as AppState['agentStatusByPaneKey'][string]
  expect(localTaskSessionTerminalCard(session, state)).toBeNull()
})
it('执行主机切换或连接状态无法确认时不显示旧预览', () => {
  host.mockReturnValue('runtime:other')
  expect(localTaskSessionTerminalCard(session, fixture())).toBeNull()
  host.mockReturnValue('local')
  expect(
    localTaskSessionTerminalCard({ ...session, livenessUnverifiable: true }, fixture())
  ).toBeNull()
})
