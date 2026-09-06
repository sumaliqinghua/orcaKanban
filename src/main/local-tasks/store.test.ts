import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { LocalTaskStore } from './store'
import { isOpenLocalTaskBatchCandidate } from '../../shared/local-task-batch-selection'

const directories: string[] = []
function projectPath(): string {
  const path = mkdtempSync(join(tmpdir(), 'orca-local-task-files-'))
  directories.push(path)
  return path
}

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('LocalTaskStore file-first persistence', () => {
  it('selects only ready Open tasks in the requested workspace', () => {
    const base = {
      schemaVersion: 1 as const,
      id: 'task-1',
      projectId: 'orca',
      projectPath: '/tmp/orca',
      title: 'task',
      description: 'task',
      status: 'Open' as const,
      workspaceId: 'wt-1',
      workspaceLabel: 'wt-1',
      createdAt: 1,
      updatedAt: 1,
      archivedAt: null,
      titleSource: 'user' as const,
      titleSuggestion: null,
      labels: [],
      intakeState: 'ready' as const,
      agentId: null,
      executionState: 'idle' as const,
      executionBatchId: null,
      executionRunId: null,
      reviewKind: null,
      reviewQuestion: null,
      runs: [],
      subtasks: [],
      sessions: [],
      latestOutput: null,
      latestOutputSource: 'report' as const
    }
    expect(isOpenLocalTaskBatchCandidate(base, { projectId: 'orca', workspaceId: 'wt-1' })).toBe(
      true
    )
    expect(isOpenLocalTaskBatchCandidate({ ...base, status: 'Needs review' })).toBe(false)
    expect(isOpenLocalTaskBatchCandidate({ ...base, status: 'In progress' })).toBe(false)
    expect(isOpenLocalTaskBatchCandidate({ ...base, intakeState: 'inbox' })).toBe(false)
    expect(
      isOpenLocalTaskBatchCandidate({ ...base, workspaceId: 'wt-2' }, { workspaceId: 'wt-1' })
    ).toBe(false)
    expect(isOpenLocalTaskBatchCandidate({ ...base, executionState: 'queued' })).toBe(false)
  })

  it('creates task context files under the project directory', () => {
    const root = projectPath()
    const store = new LocalTaskStore()
    const task = store.create({
      projectId: 'orca',
      projectPath: root,
      description: '修复登录刷新\n补充测试',
      labels: [' 性能 ', 'Unity', '性能', '']
    })

    expect(task).toMatchObject({
      projectPath: root,
      title: '修复登录刷新',
      status: 'Open',
      labels: ['性能', 'Unity']
    })
    expect(existsSync(join(root, 'orca', task.id, 'task.json'))).toBe(true)
    expect(existsSync(join(root, 'orca', task.id, 'plan.json'))).toBe(true)
    expect(existsSync(join(root, 'orca', task.id, 'prd.md'))).toBe(true)
    expect(existsSync(join(root, 'orca', task.id, 'records.md'))).toBe(true)
    expect(JSON.parse(readFileSync(join(root, 'orca', task.id, 'task.json'), 'utf8')).id).toBe(
      task.id
    )
    expect(store.list('orca', root)).toHaveLength(1)
    store.close()
  })

  it('supports multiple tasks in one workspace and reloads after a new Store instance', () => {
    const root = projectPath()
    const firstStore = new LocalTaskStore()
    const first = firstStore.create({
      projectId: 'orca',
      projectPath: root,
      description: '任务一',
      workspaceId: 'wt-1'
    })
    const second = firstStore.create({
      projectId: 'orca',
      projectPath: root,
      description: '任务二',
      workspaceId: 'wt-1'
    })
    firstStore.close()

    const secondStore = new LocalTaskStore()
    expect(secondStore.list('orca', root).map((task) => task.id)).toEqual(
      expect.arrayContaining([first.id, second.id])
    )
    secondStore.close()
  })

  it('ignores a stale task copy checked out in another workspace', () => {
    const ownerRoot = projectPath()
    const shadowRoot = projectPath()
    const store = new LocalTaskStore()
    const task = store.create({
      projectId: 'orca',
      projectPath: ownerRoot,
      description: '修复线上问题',
      workspaceId: 'owner-workspace'
    })
    const session = store.createSession({
      taskId: task.id,
      projectPath: ownerRoot,
      sessionId: 'session-1',
      workspaceId: task.workspaceId
    })
    const staleReview = store.updateSessionOutput({
      sessionId: session.id,
      latestOutput: '等待验收'
    })
    const shadowTaskPath = join(shadowRoot, 'orca', task.id, 'task.json')
    mkdirSync(join(shadowRoot, 'orca', task.id), { recursive: true })
    writeFileSync(shadowTaskPath, `${JSON.stringify(staleReview, null, 2)}\n`, 'utf8')
    store.accept(task.id)
    store.archive(task.id)
    store.close()

    const reloaded = new LocalTaskStore()
    expect(reloaded.list('orca', ownerRoot)).toEqual([])
    expect(reloaded.list('orca', shadowRoot)).toEqual([])
    expect(reloaded.get(task.id)?.archivedAt).not.toBeNull()
    reloaded.close()
  })

  it('uses an explicit project path when the same task id has two owned copies', () => {
    const firstRoot = projectPath()
    const secondRoot = projectPath()
    const store = new LocalTaskStore()
    const task = store.create({
      projectId: 'orca',
      projectPath: firstRoot,
      description: '同 ID 任务',
      workspaceId: 'first-workspace'
    })
    const secondTask = {
      ...task,
      projectPath: secondRoot,
      workspaceId: 'second-workspace',
      updatedAt: task.updatedAt + 1
    }
    const secondTaskDirectory = join(secondRoot, 'orca', task.id)
    mkdirSync(secondTaskDirectory, { recursive: true })
    writeFileSync(
      join(secondTaskDirectory, 'task.json'),
      `${JSON.stringify(secondTask, null, 2)}\n`,
      'utf8'
    )

    store.list('orca', firstRoot)
    store.list('orca', secondRoot)
    expect(store.get(task.id)?.workspaceId).toBe('second-workspace')

    store.archive(task.id, [], firstRoot)

    expect(store.get(task.id, firstRoot)?.archivedAt).not.toBeNull()
    expect(store.get(task.id, secondRoot)?.archivedAt).toBeNull()
    store.close()
  })

  it('skips a deleted newest indexed copy when creating a session', () => {
    const firstRoot = projectPath()
    const secondRoot = projectPath()
    const store = new LocalTaskStore()
    const task = store.create({
      projectId: 'orca',
      projectPath: firstRoot,
      description: '清理失效索引后启动',
      workspaceId: 'first-workspace'
    })
    const newerTask = {
      ...task,
      projectPath: secondRoot,
      workspaceId: 'second-workspace',
      updatedAt: task.updatedAt + 1
    }
    const newerDirectory = join(secondRoot, 'orca', task.id)
    mkdirSync(newerDirectory, { recursive: true })
    writeFileSync(join(newerDirectory, 'task.json'), `${JSON.stringify(newerTask)}\n`, 'utf8')

    store.list('orca', firstRoot)
    store.list('orca', secondRoot)
    rmSync(secondRoot, { recursive: true, force: true })

    const session = store.createSession({ taskId: task.id, sessionId: 'session-after-cleanup' })

    expect(session.taskId).toBe(task.id)
    expect(store.get(task.id, firstRoot)?.sessions[0]?.id).toBe('session-after-cleanup')
    store.close()
  })

  it('does not retain a task after its unmerged workspace directory is deleted', () => {
    const root = projectPath()
    const store = new LocalTaskStore()
    const task = store.create({
      projectId: 'orca',
      projectPath: root,
      description: '随 workspace 删除',
      workspaceId: 'temporary-workspace'
    })

    store.close()
    rmSync(root, { recursive: true, force: true })

    const reloaded = new LocalTaskStore()
    expect(reloaded.list('orca', root)).toEqual([])
    expect(reloaded.get(task.id, root)).toBeNull()
    reloaded.close()
  })

  it('rejects legacy status values instead of normalizing them', () => {
    const root = projectPath()
    const store = new LocalTaskStore()
    const task = store.create({ projectId: 'orca', projectPath: root, description: '严格状态' })
    const taskPath = join(root, 'orca', task.id, 'task.json')
    const saved = JSON.parse(readFileSync(taskPath, 'utf8')) as Record<string, unknown>
    saved.status = 'Completed'
    writeFileSync(taskPath, JSON.stringify(saved), 'utf8')
    expect(() => store.list('orca', root)).toThrow('status')
    store.close()
  })

  it('rejects missing and unknown persisted fields', () => {
    const root = projectPath()
    const store = new LocalTaskStore()
    const task = store.create({ projectId: 'orca', projectPath: root, description: '严格字段' })
    const taskPath = join(root, 'orca', task.id, 'task.json')
    const saved = JSON.parse(readFileSync(taskPath, 'utf8')) as Record<string, unknown>
    delete saved.executionState
    saved.waitingReason = '旧字段'
    writeFileSync(taskPath, JSON.stringify(saved), 'utf8')
    expect(() => store.list('orca', root)).toThrow(/executionState|Unrecognized key/)
    store.close()
  })

  it('captures only ready open tasks in a batch and completes runs into review', () => {
    const root = projectPath()
    const store = new LocalTaskStore()
    const first = store.create({
      projectId: 'orca',
      projectPath: root,
      description: '批次任务一',
      workspaceId: 'wt-a'
    })
    const second = store.create({
      projectId: 'orca',
      projectPath: root,
      description: '批次任务二',
      workspaceId: 'wt-a'
    })
    const inbox = store.create({
      projectId: 'orca',
      projectPath: root,
      description: '先整理需求',
      intakeState: 'inbox',
      workspaceId: 'wt-b'
    })

    const batch = store.startBatch(
      [
        { taskId: first.id, projectPath: root },
        { taskId: second.id, projectPath: root },
        { taskId: inbox.id, projectPath: root }
      ],
      { recoverQueued: true }
    )

    expect(batch.candidates).toHaveLength(2)
    expect(new Set(batch.candidates.map((candidate) => candidate.workspaceKey)).size).toBe(1)
    expect(store.get(inbox.id, root)?.executionState).toBe('idle')

    const run = batch.candidates[0]!
    store.updateRun({
      taskId: run.task.id,
      projectPath: root,
      runId: run.runId,
      status: 'running',
      sessionId: 'batch-session'
    })
    const session = store.createSession({
      taskId: run.task.id,
      projectPath: root,
      sessionId: 'batch-session',
      workspaceId: run.task.workspaceId
    })
    const reviewed = store.updateSessionOutput({
      sessionId: session.id,
      latestOutput: '批次执行完成'
    })
    expect(reviewed.status).toBe('Needs review')
    expect(reviewed.executionState).toBe('needs_review')
    expect(reviewed.reviewKind).toBe('delivery')
    expect(reviewed.runs[0]?.status).toBe('needs_review')
    store.close()
  })

  it('keeps automation provenance on each task run', () => {
    const root = projectPath()
    const store = new LocalTaskStore()
    const task = store.create({
      projectId: 'orca',
      projectPath: root,
      description: '自动化来源',
      workspaceId: 'wt-a'
    })

    const batch = store.startBatch([{ taskId: task.id, projectPath: root }], {
      automationId: 'automation-1',
      automationRunId: 'run-1'
    })

    expect(batch.candidates[0]?.task.runs[0]).toMatchObject({
      automationId: 'automation-1',
      automationRunId: 'run-1',
      source: 'automation',
      launchRequestId: expect.any(String)
    })
    store.close()
  })

  it('persists manual session notes without changing the session status', () => {
    const root = projectPath()
    const store = new LocalTaskStore()
    const task = store.create({ projectId: 'orca', projectPath: root, description: '会话备注' })
    const session = store.createSession({ taskId: task.id, projectPath: root })

    const updated = store.updateSessionOutput({
      sessionId: session.id,
      manualNotes: '记录一个待确认的边界场景'
    })

    expect(updated.sessions[0]?.manualNotes).toBe('记录一个待确认的边界场景')
    expect(updated.sessions[0]?.status).toBe('working')
    store.close()
  })

  it('is idempotent for the same automation run and task', () => {
    const root = projectPath()
    const store = new LocalTaskStore()
    const task = store.create({ projectId: 'orca', projectPath: root, description: '幂等任务' })
    const first = store.startBatch([{ taskId: task.id, projectPath: root }], {
      recoverQueued: false,
      automationId: 'automation-1',
      automationRunId: 'run-1'
    })
    const second = store.startBatch([{ taskId: task.id, projectPath: root }], {
      recoverQueued: false,
      automationId: 'automation-1',
      automationRunId: 'run-1'
    })

    expect(second.candidates).toHaveLength(1)
    expect(second.candidates[0]?.runId).toBe(first.candidates[0]?.runId)
    expect(store.get(task.id, root)?.runs).toHaveLength(1)
    store.close()
  })

  it('requeues tasks left queued by an interrupted previous batch', () => {
    const root = projectPath()
    const store = new LocalTaskStore()
    const task = store.create({ projectId: 'orca', projectPath: root, description: '可重试任务' })
    const first = store.startBatch([{ taskId: task.id, projectPath: root }], {
      recoverQueued: true
    })
    expect(first.candidates).toHaveLength(1)
    const second = store.startBatch([{ taskId: task.id, projectPath: root }], {
      recoverQueued: true
    })
    const reloaded = store.get(task.id, root)!

    expect(second.candidates).toHaveLength(1)
    expect(reloaded.runs).toHaveLength(2)
    expect(reloaded.runs[1]?.status).toBe('failed')
    expect(reloaded.runs[0]?.status).toBe('queued')
    store.close()
  })

  it('does not reclaim queued tasks when automation dispatch opts out of recovery', () => {
    const root = projectPath()
    const store = new LocalTaskStore()
    const task = store.create({ projectId: 'orca', projectPath: root, description: '自动化互斥' })
    const first = store.startBatch([{ taskId: task.id, projectPath: root }], {
      recoverQueued: true
    })

    const second = store.startBatch([{ taskId: task.id, projectPath: root }], {
      recoverQueued: false
    })

    expect(first.candidates).toHaveLength(1)
    expect(second.candidates).toHaveLength(0)
    expect(store.get(task.id, root)?.executionRunId).toBe(first.candidates[0]?.runId)
    store.close()
  })

  it('does not reclaim running tasks when recovery is disabled', () => {
    const root = projectPath()
    const store = new LocalTaskStore()
    const task = store.create({ projectId: 'orca', projectPath: root, description: '运行中任务' })
    const first = store.startBatch([{ taskId: task.id, projectPath: root }], {
      recoverQueued: true
    })
    const runId = first.candidates[0]?.runId
    if (!runId) {
      throw new Error('expected a queued run')
    }
    store.updateRun({
      taskId: task.id,
      projectPath: root,
      runId,
      status: 'running',
      sessionId: 'tab-running'
    })

    const second = store.startBatch([{ taskId: task.id, projectPath: root }], {
      recoverQueued: false
    })

    expect(second.candidates).toHaveLength(0)
    expect(store.get(task.id, root)?.executionState).toBe('running')
    store.close()
  })

  it('tracks sessions, subtasks and steps, then enters review only when work is done', () => {
    const root = projectPath()
    const store = new LocalTaskStore()
    const task = store.create({
      projectId: 'orca',
      projectPath: root,
      description: '整理资源加载差异'
    })
    const session = store.createSession({
      taskId: task.id,
      projectPath: root,
      sessionId: 'session-a'
    })
    const withSubtask = store.createSubtask({
      taskId: task.id,
      projectPath: root,
      sessionId: session.id,
      title: '比较运行时入口',
      steps: ['读取当前项目', '整理差异']
    })
    const subtask = withSubtask.subtasks[0]!
    const [firstStep, secondStep] = subtask.steps
    expect(
      JSON.parse(readFileSync(join(root, 'orca', task.id, 'plan.json'), 'utf8')).subtasks
    ).toHaveLength(2)

    store.updateStep({ subtaskId: subtask.id, stepId: firstStep.id, status: 'done' })
    expect(() =>
      store.editStepTitle({ subtaskId: subtask.id, stepId: firstStep.id, title: '不能修改' })
    ).toThrow('unstarted')
    store.updateStep({ subtaskId: subtask.id, stepId: secondStep.id, status: 'done' })
    store.updateSubtask({ subtaskId: subtask.id, status: 'done' })
    const reviewed = store.reportCompleted({
      taskId: task.id,
      projectPath: root,
      sessionId: session.id,
      latestOutput: '差异已整理完成',
      titleSuggestion: '资源加载差异分析'
    })

    expect(reviewed).toMatchObject({ status: 'Needs review', title: '资源加载差异分析' })
    expect(readFileSync(join(root, 'orca', task.id, 'records.md'), 'utf8')).toContain(
      '差异已整理完成'
    )
    expect(store.accept(task.id).status).toBe('Done')
    store.close()
  })

  it('does not block a session on subtasks assigned to another session', () => {
    const root = projectPath()
    const store = new LocalTaskStore()
    const task = store.create({ projectId: 'orca', projectPath: root, description: '会话归属' })
    const first = store.createSession({
      taskId: task.id,
      projectPath: root,
      sessionId: 'session-one'
    })
    const second = store.createSession({
      taskId: task.id,
      projectPath: root,
      sessionId: 'session-two'
    })
    store.updateSubtask({ subtaskId: task.subtasks[0]!.id, status: 'done' })
    store.createSubtask({
      taskId: task.id,
      projectPath: root,
      sessionId: second.id,
      title: '另一个会话负责的未完成工作'
    })

    const reported = store.reportCompleted({
      taskId: task.id,
      projectPath: root,
      sessionId: first.id,
      latestOutput: '当前会话负责的内容已完成'
    })

    expect(reported.sessions.find((session) => session.id === first.id)?.status).toBe('done')
    store.close()
  })

  it('persists task report sessions as a separate association source', () => {
    const root = projectPath()
    const store = new LocalTaskStore()
    const task = store.create({ projectId: 'orca', projectPath: root, description: '任务报告' })
    const session = store.createSession({
      taskId: task.id,
      projectPath: root,
      sessionId: 'task-report-session',
      title: '任务报告',
      associationSource: 'task-report'
    })

    expect(session.associationSource).toBe('task-report')
    expect(store.get(task.id, root)?.sessions[0]?.associationSource).toBe('task-report')
    store.close()
  })

  it('claims unassigned subtasks and requires confirmation to transfer from a working session', () => {
    const root = projectPath()
    const store = new LocalTaskStore()
    const task = store.create({ projectId: 'orca', projectPath: root, description: '归属测试' })
    const firstSession = store.createSession({
      taskId: task.id,
      projectPath: root,
      sessionId: 'session-owner'
    })
    const secondSession = store.createSession({
      taskId: task.id,
      projectPath: root,
      sessionId: 'session-next',
      currentPrompt: '另一个问题'
    })
    const created = store.createSubtask({
      taskId: task.id,
      projectPath: root,
      title: '未绑定子任务',
      steps: ['执行步骤']
    })
    const subtask = created.subtasks[0]!
    const step = subtask.steps[0]!

    const claimed = store.updateStep({
      subtaskId: subtask.id,
      stepId: step.id,
      status: 'doing',
      actorSessionId: firstSession.id
    })
    expect(claimed.subtasks[0]?.sessionId).toBe(firstSession.id)
    expect(() =>
      store.updateStep({
        subtaskId: subtask.id,
        stepId: step.id,
        status: 'done',
        actorSessionId: secondSession.id
      })
    ).toThrow('another Agent session')
    store.close()
  })

  it('assigns existing unbound subtasks when the first session is created', () => {
    const root = projectPath()
    const store = new LocalTaskStore()
    const task = store.create({ projectId: 'orca', projectPath: root, description: '首次绑定' })
    store.createSubtask({ taskId: task.id, projectPath: root, title: '预先创建的子任务' })
    store.createSession({ taskId: task.id, projectPath: root, sessionId: 'first-session' })
    expect(store.get(task.id, root)?.subtasks[0]?.sessionId).toBe('first-session')
    store.close()
  })

  it('preserves custom plan fields while syncing subtasks', () => {
    const root = projectPath()
    const store = new LocalTaskStore()
    const task = store.create({ projectId: 'orca', projectPath: root, description: '计划字段' })
    const planPath = join(root, 'orca', task.id, 'plan.json')
    writeFileSync(planPath, JSON.stringify({ owner: 'user', notes: ['保留'] }), 'utf8')
    store.createSubtask({ taskId: task.id, projectPath: root, title: '同步子任务' })
    expect(JSON.parse(readFileSync(planPath, 'utf8'))).toMatchObject({
      owner: 'user',
      notes: ['保留']
    })
    store.close()
  })

  it('persists the last assistant output separately from task completion', () => {
    const root = projectPath()
    const store = new LocalTaskStore()
    const task = store.create({ projectId: 'orca', projectPath: root, description: '输出测试' })
    const session = store.createSession({
      taskId: task.id,
      projectPath: root,
      sessionId: 'tab-output'
    })
    const updated = store.updateSessionOutput({
      sessionId: session.id,
      latestOutput: '完整最终回复\n\n## 验证\n测试通过'
    })

    expect(updated.latestOutput?.text).toContain('## 验证')
    expect(updated.sessions[0]?.latestOutput).toContain('完整最终回复')
    expect(updated.status).toBe('Needs review')
    const reported = store.reportCompleted({
      taskId: task.id,
      projectPath: root,
      sessionId: session.id,
      latestOutput: '摘要'
    })
    expect(reported.latestOutput?.text).toContain('## 验证')
    store.close()
  })

  it('keeps task state and task output unchanged for a report session', () => {
    const root = projectPath()
    const store = new LocalTaskStore()
    const task = store.create({ projectId: 'orca', projectPath: root, description: '报告测试' })
    const report = store.createSession({
      taskId: task.id,
      projectPath: root,
      sessionId: 'task-report-session',
      associationSource: 'task-report',
      agentId: 'codex'
    })

    const updated = store.updateSessionOutput({
      sessionId: report.id,
      sessionStatus: 'done',
      latestOutput: '改前：暂无执行记录\n现在：已生成任务报告'
    })

    expect(updated.status).toBe('Open')
    expect(updated.latestOutput).toBeNull()
    expect(updated.sessions[0]).toMatchObject({
      associationSource: 'task-report',
      agentId: 'codex',
      status: 'done',
      latestOutput: expect.stringContaining('已生成任务报告')
    })
    const completed = store.reportCompleted({
      taskId: task.id,
      projectPath: root,
      sessionId: report.id,
      latestOutput: '报告会话误调用完成接口'
    })
    expect(completed.status).toBe('Open')
    expect(completed.latestOutput).toBeNull()
    expect(completed.sessions[0]?.latestOutput).toContain('误调用完成接口')
    store.close()
  })

  it('keeps running when one of multiple agent sessions ends', () => {
    const root = projectPath()
    const store = new LocalTaskStore()
    const task = store.create({ projectId: 'orca', projectPath: root, description: '并行任务' })
    const first = store.createSession({ taskId: task.id, projectPath: root, sessionId: 'agent-a' })
    const second = store.createSession({ taskId: task.id, projectPath: root, sessionId: 'agent-b' })
    const reviewed = store.updateSessionOutput({ sessionId: first.id, latestOutput: '第一路完成' })
    expect(reviewed.status).toBe('In progress')
    expect(reviewed.sessions.find((session) => session.id === second.id)?.status).toBe('working')
    store.close()
  })

  it('persists a new Terminal Tab id without changing the stable task session id', () => {
    const root = projectPath()
    const store = new LocalTaskStore()
    const task = store.create({ projectId: 'orca', projectPath: root, description: '恢复绑定' })
    const session = store.createSession({
      taskId: task.id,
      projectPath: root,
      sessionId: 'old-tab-id'
    })

    const rebound = store.rebindSessionTab({ sessionId: session.id, tabId: 'new-tab-id' })

    expect(rebound.sessions[0]).toMatchObject({ id: 'old-tab-id', tabId: 'new-tab-id' })
    expect(store.get(task.id, root)?.sessions[0]).toMatchObject({
      id: 'old-tab-id',
      tabId: 'new-tab-id'
    })
    store.close()
  })

  it('does not create duplicate working sessions for the same prompt', () => {
    const root = projectPath()
    const store = new LocalTaskStore()
    const task = store.create({ projectId: 'orca', projectPath: root, description: '去重' })
    const first = store.createSession({
      taskId: task.id,
      projectPath: root,
      sessionId: 'session-a',
      currentPrompt: '分析同一个问题'
    })
    const duplicate = store.createSession({
      taskId: task.id,
      projectPath: root,
      sessionId: 'session-b',
      currentPrompt: '分析同一个问题'
    })
    expect(duplicate.id).toBe(first.id)
    store.close()
  })

  it('records the current prompt and completed turn summaries', () => {
    const root = projectPath()
    const store = new LocalTaskStore()
    const task = store.create({ projectId: 'orca', projectPath: root, description: '会话轮次' })
    const session = store.createSession({
      taskId: task.id,
      projectPath: root,
      sessionId: 'turn-session',
      currentPrompt: '先分析加载流程'
    })
    store.updateSessionOutput({
      sessionId: session.id,
      prompt: '先分析加载流程',
      sessionStatus: 'done',
      latestOutput: '已定位加载入口'
    })
    store.updateSessionOutput({
      sessionId: session.id,
      prompt: '再检查释放边界',
      sessionStatus: 'working'
    })
    const completed = store.updateSessionOutput({
      sessionId: session.id,
      prompt: '再检查释放边界',
      sessionStatus: 'done',
      latestOutput: '已补充释放说明'
    })
    const saved = completed.sessions[0]!
    expect(saved.currentPrompt).toBe('再检查释放边界')
    expect(saved.turns).toHaveLength(2)
    expect(saved.turns[0]).toMatchObject({ prompt: '先分析加载流程', summary: '已定位加载入口' })
    expect(saved.turns[1]).toMatchObject({ prompt: '再检查释放边界', summary: '已补充释放说明' })
    store.close()
  })

  it('keeps review and done states for follow-up questions', () => {
    const root = projectPath()
    const store = new LocalTaskStore()
    const task = store.create({ projectId: 'orca', projectPath: root, description: '答疑任务' })
    const first = store.createSession({ taskId: task.id, projectPath: root, sessionId: 'delivery' })
    store.reportCompleted({ taskId: task.id, projectPath: root, sessionId: first.id })
    const question = store.createSession({
      taskId: task.id,
      projectPath: root,
      sessionId: 'question'
    })
    expect(
      store.reportCompleted({ taskId: task.id, projectPath: root, sessionId: question.id }).status
    ).toBe('Needs review')
    store.update(task.id, { status: 'In progress' })
    store.reportCompleted({ taskId: task.id, projectPath: root, sessionId: question.id })
    store.accept(task.id)
    const afterDone = store.createSession({
      taskId: task.id,
      projectPath: root,
      sessionId: 'done-question'
    })
    expect(
      store.reportCompleted({ taskId: task.id, projectPath: root, sessionId: afterDone.id }).status
    ).toBe('Needs review')
    store.close()
  })

  it('keeps archived files recoverable', () => {
    const root = projectPath()
    const store = new LocalTaskStore()
    const task = store.create({ projectId: 'orca', projectPath: root, description: '归档恢复' })
    const session = store.createSession({
      taskId: task.id,
      projectPath: root,
      sessionId: 'review-session'
    })
    store.updateSessionOutput({ sessionId: session.id, latestOutput: '已完成' })
    store.accept(task.id, root)
    store.archive(task.id, [], root)
    expect(store.list('orca', root)).toHaveLength(0)
    expect(store.list('orca', root, { includeArchived: true })).toMatchObject([
      { id: task.id, status: 'Done', archivedAt: expect.any(Number) }
    ])
    expect(store.restore(task.id, root)).toMatchObject({ status: 'Done', archivedAt: null })
    expect(store.list('orca', root)).toHaveLength(1)
    store.close()
  })

  it('deletes only an archived task directory', () => {
    const root = projectPath()
    const store = new LocalTaskStore()
    const task = store.create({ projectId: 'orca', projectPath: root, description: '永久删除' })
    const sibling = store.create({
      projectId: 'orca',
      projectPath: root,
      description: '保留的相邻任务'
    })
    expect(() => store.deleteTask(task.id, root, [])).toThrow('archived')
    expect(existsSync(join(root, 'orca', task.id))).toBe(true)

    store.archive(task.id, [], root)
    expect(store.deleteTask(task.id, root, [])).toEqual({ taskId: task.id, projectPath: root })

    expect(existsSync(join(root, 'orca', task.id))).toBe(false)
    expect(existsSync(join(root, 'orca', sibling.id))).toBe(true)
    expect(store.get(task.id, root)).toBeNull()
    store.close()
  })

  it('rejects deleting an archived task with a live Agent session', () => {
    const root = projectPath()
    const store = new LocalTaskStore()
    const task = store.create({ projectId: 'orca', projectPath: root, description: '运行中删除' })
    store.createSession({ taskId: task.id, projectPath: root, sessionId: 'running-session' })
    store.update(task.id, { archived: true }, root)

    expect(() => store.deleteTask(task.id, root, ['running-session'])).toThrow(
      'running Agent session'
    )
    expect(existsSync(join(root, 'orca', task.id))).toBe(true)
    store.close()
  })

  it('rejects archiving while an Agent session is running', () => {
    const root = projectPath()
    const store = new LocalTaskStore()
    const task = store.create({ projectId: 'orca', projectPath: root, description: '运行中归档' })
    store.createSession({ taskId: task.id, projectPath: root, sessionId: 'running-session' })
    expect(() => store.archive(task.id)).toThrow('running Agent session')
    store.close()
  })

  it('archives stale working sessions when live Agent evidence is empty', () => {
    const root = projectPath()
    const store = new LocalTaskStore()
    const task = store.create({ projectId: 'orca', projectPath: root, description: '陈旧会话' })
    store.createSession({ taskId: task.id, projectPath: root, sessionId: 'stale-session' })
    const archived = store.archive(task.id, [])
    expect(archived.archivedAt).not.toBeNull()
    expect(archived.sessions[0]?.status).toBe('done')
    store.close()
  })
})
