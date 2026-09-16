import { afterEach, describe, expect, it, vi } from 'vitest'
import { tmpdir } from 'node:os'
import { LocalTaskStore, setLocalTaskStoreForTests } from '../../../local-tasks/store'
import type { LocalTask } from '../../../../shared/local-task-types'
import { LOCAL_TASK_CATALOG_METHODS } from './local-task-catalog'

vi.mock('electron', () => ({
  app: { getPath: () => tmpdir() },
  BrowserWindow: { getAllWindows: () => [] }
}))

afterEach(() => setLocalTaskStoreForTests(null))

function fixture() {
  let tasks: LocalTask[] = []
  const store = new LocalTaskStore({
    getLocalTasks: () => tasks,
    saveLocalTask: (task) => {
      tasks = [...tasks.filter((row) => row.id !== task.id), task]
      return task
    },
    deleteLocalTask: () => {}
  })
  setLocalTaskStoreForTests(store)
  const task = store.create({
    projectId: 'repo',
    workspaceId: 'workspace',
    intakeState: 'inbox',
    description: '原始需求'
  })
  const runtime = {
    listRepos: () => [{ id: 'repo' }],
    listTerminals: vi.fn().mockResolvedValue({ terminals: [], truncated: false }),
    getTerminalAgentStatus: vi.fn().mockResolvedValue({ status: 'idle', isRunningAgent: true }),
    createMobileSessionTerminal: vi
      .fn()
      .mockResolvedValue({ tab: { id: 'tab-new', terminal: 'term_new' } }),
    sendTerminalAgentPrompt: vi.fn().mockImplementation(async () => {
      return { accepted: true }
    }),
    waitForTerminal: vi.fn().mockResolvedValue({ satisfied: true }),
    ensureAgentSession: vi
      .fn()
      .mockResolvedValue({ terminal: { tabId: 'tab-restored', handle: 'term_restored' } }),
    showTerminal: vi.fn().mockResolvedValue({ handle: 'term_restored', connected: true })
  }
  const method = LOCAL_TASK_CATALOG_METHODS.find((row) => row.name === 'localTask.dispatch')!
  if ('stream' in method) {
    throw new Error('Expected unary dispatch')
  }
  const dispatch = () =>
    method.handler(
      method.params!.parse({
        taskId: task.id,
        worktree: 'id:workspace',
        agent: 'codex',
        prompt: '梳理需求',
        tag: 'inbox',
        purpose: 'clarification'
      }),
      { runtime: runtime as never }
    ) as Promise<{ disposition: string }>
  return { task, store, runtime, dispatch }
}

describe('local task dispatch', () => {
  it('associates before submitting and preserves Inbox state', async () => {
    const f = fixture()
    expect((await f.dispatch()).disposition).toBe('created')
    expect(f.store.get(f.task.id)?.status).toBe('Open')
    expect(f.store.get(f.task.id)?.sessions[0].tags).toEqual(['inbox'])
    expect(f.runtime.sendTerminalAgentPrompt.mock.calls[0][1]).toContain('原始需求')
    expect(f.store.get(f.task.id)?.sessions[0].status).toBe('working')
  })

  it('associates the parent tab and records a retryable readiness failure', async () => {
    const f = fixture()
    f.runtime.createMobileSessionTerminal.mockResolvedValueOnce({
      tab: { id: 'leaf-new', parentTabId: 'tab-parent', terminal: 'term_new' }
    })
    f.runtime.waitForTerminal.mockResolvedValueOnce({ satisfied: false })
    const result = await f.dispatch()
    expect(result.disposition).toBe('skipped_unverifiable')
    expect(f.store.get(f.task.id)?.sessions[0]).toMatchObject({
      id: 'tab-parent',
      tabId: 'tab-parent',
      status: 'idle',
      manualNotes: expect.stringContaining('超时')
    })
    expect(f.runtime.sendTerminalAgentPrompt).not.toHaveBeenCalled()
  })

  it('records a retryable prompt rejection and only marks working after acceptance', async () => {
    const f = fixture()
    f.runtime.sendTerminalAgentPrompt.mockResolvedValueOnce({ accepted: false })
    await expect(f.dispatch()).rejects.toThrow('Agent prompt was not accepted')
    expect(f.store.get(f.task.id)?.sessions[0]).toMatchObject({
      status: 'idle',
      manualNotes: expect.stringContaining('Agent prompt was not accepted')
    })
  })
  it('continues an idle Agent instead of treating the live process as busy', async () => {
    const f = fixture()
    await f.dispatch()
    f.runtime.listTerminals.mockResolvedValue({
      terminals: [{ tabId: 'tab-new', handle: 'term_new', connected: true }],
      truncated: false
    })
    expect((await f.dispatch()).disposition).toBe('continued')
    expect(f.runtime.createMobileSessionTerminal).toHaveBeenCalledTimes(1)
    f.runtime.getTerminalAgentStatus.mockResolvedValue({ status: 'working', isRunningAgent: true })
    expect((await f.dispatch()).disposition).toBe('skipped_busy')
  })
  it('requires exact identity and restores the same logical session', async () => {
    const f = fixture()
    await f.dispatch()
    expect((await f.dispatch()).disposition).toBe('skipped_resume_required')
    f.store.updateSessionOutput({
      sessionId: 'tab-new',
      sessionStatus: 'done',
      providerSession: { key: 'session_id', id: 'provider-id' }
    })
    expect((await f.dispatch()).disposition).toBe('continued')
    expect(f.store.get(f.task.id)?.sessions[0]).toMatchObject({
      id: 'tab-new',
      tabId: 'tab-restored'
    })
    expect(f.runtime.ensureAgentSession).toHaveBeenCalledWith(
      expect.objectContaining({ providerSession: { key: 'session_id', id: 'provider-id' } })
    )
  })
  it('does not create twice for concurrent requests', async () => {
    const f = fixture()
    const results = await Promise.all([f.dispatch(), f.dispatch()])
    expect(results.map((r) => r.disposition).sort()).toEqual(['created', 'skipped_busy'])
    expect(f.runtime.createMobileSessionTerminal).toHaveBeenCalledTimes(1)
  })
  it('uses the task project path for a local main-workspace task', async () => {
    const f = fixture()
    const localTask = f.store.create({
      projectId: 'repo',
      projectPath: '/tmp/project',
      workspaceId: 'local',
      intakeState: 'inbox',
      description: '收件箱'
    })
    const method = LOCAL_TASK_CATALOG_METHODS.find((row) => row.name === 'localTask.dispatch')!
    if ('stream' in method) {
      throw new Error('Expected unary dispatch')
    }
    await method.handler(
      method.params!.parse({
        taskId: localTask.id,
        worktree: 'id:any-selected-workspace',
        agent: 'codex',
        prompt: '梳理',
        purpose: 'clarification'
      }),
      { runtime: f.runtime as never }
    )
    expect(f.runtime.listTerminals).toHaveBeenCalledWith('path:/tmp/project', 200)
  })
})
