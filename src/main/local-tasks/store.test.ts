import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { LocalTaskStore } from './store'

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

    const batch = store.startBatch([
      { taskId: first.id, projectPath: root },
      { taskId: second.id, projectPath: root },
      { taskId: inbox.id, projectPath: root }
    ])

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

  it('requeues tasks left queued by an interrupted previous batch', () => {
    const root = projectPath()
    const store = new LocalTaskStore()
    const task = store.create({ projectId: 'orca', projectPath: root, description: '可重试任务' })
    const first = store.startBatch([{ taskId: task.id, projectPath: root }])
    expect(first.candidates).toHaveLength(1)
    const second = store.startBatch([{ taskId: task.id, projectPath: root }])
    const reloaded = store.get(task.id, root)!

    expect(second.candidates).toHaveLength(1)
    expect(reloaded.runs).toHaveLength(2)
    expect(reloaded.runs[1]?.status).toBe('failed')
    expect(reloaded.runs[0]?.status).toBe('queued')
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
    ).toHaveLength(1)

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
    expect(() =>
      store.transferSubtask({ subtaskId: subtask.id, sessionId: secondSession.id })
    ).toThrow('force transfer requires confirmation')
    const transferred = store.transferSubtask({
      subtaskId: subtask.id,
      sessionId: secondSession.id,
      force: true
    })
    expect(transferred.subtasks[0]?.sessionId).toBe(secondSession.id)
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

  it('enters review when one of multiple agent sessions ends', () => {
    const root = projectPath()
    const store = new LocalTaskStore()
    const task = store.create({ projectId: 'orca', projectPath: root, description: '并行任务' })
    const first = store.createSession({ taskId: task.id, projectPath: root, sessionId: 'agent-a' })
    const second = store.createSession({ taskId: task.id, projectPath: root, sessionId: 'agent-b' })
    const reviewed = store.updateSessionOutput({ sessionId: first.id, latestOutput: '第一路完成' })
    expect(reviewed.status).toBe('Needs review')
    expect(reviewed.sessions.find((session) => session.id === second.id)?.status).toBe('working')
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
    store.archive(task.id)
    expect(store.list('orca', root)).toHaveLength(0)
    expect(store.restore(task.id).archivedAt).toBeNull()
    expect(store.list('orca', root)).toHaveLength(1)
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
