import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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

  it('normalizes Completed task files and falls back to plan subtasks', () => {
    const root = projectPath()
    const taskId = 'lt_legacy-completed'
    const directory = join(root, 'orca', taskId)
    const task = {
      schemaVersion: 1,
      id: taskId,
      projectId: 'orca',
      projectPath: root,
      title: '资源文档',
      description: '整理资源调用方式',
      status: 'Completed',
      workspaceId: 'wt-1',
      workspaceLabel: '主 workspace',
      createdAt: 1,
      updatedAt: 2,
      archivedAt: null,
      titleSource: 'first-line',
      titleSuggestion: null,
      subtasks: [],
      sessions: [
        {
          id: 'session-1',
          taskId,
          workspaceId: 'wt-1',
          title: '文档会话',
          status: 'completed',
          latestOutput: '完成',
          createdAt: 1,
          updatedAt: 2,
          associationSource: 'task-center'
        }
      ],
      latestOutput: '完成',
      waitingReason: null
    }
    mkdirSync(directory, { recursive: true })
    writeFileSync(join(directory, 'task.json'), `${JSON.stringify(task)}\n`, 'utf8')
    writeFileSync(
      join(directory, 'plan.json'),
      JSON.stringify({
        subtasks: [
          {
            id: 'sub-1',
            title: '整理入口',
            status: 'done',
            steps: [{ id: 'step-1', title: '核对调用方式', status: 'done' }]
          }
        ]
      }),
      'utf8'
    )

    const store = new LocalTaskStore()
    const loaded = store.list('orca', root)[0]!
    expect(loaded.status).toBe('Needs review')
    expect(loaded.sessions[0]?.status).toBe('done')
    expect(loaded.latestOutput?.text).toBe('完成')
    expect(loaded.subtasks[0]?.steps[0]?.status).toBe('done')
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
    expect(updated.status).toBe('In progress')
    const reported = store.reportCompleted({
      taskId: task.id,
      projectPath: root,
      sessionId: session.id,
      latestOutput: '摘要'
    })
    expect(reported.latestOutput?.text).toContain('## 验证')
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
    ).toBe('Done')
    store.close()
  })

  it('requires a waiting reason and keeps archived files recoverable', () => {
    const root = projectPath()
    const store = new LocalTaskStore()
    const task = store.create({ projectId: 'orca', projectPath: root, description: '等待确认' })
    expect(() => store.update(task.id, { status: 'Waiting' })).toThrow('requires a reason')
    store.update(task.id, { status: 'Waiting', waitingReason: '请确认方案' })
    store.archive(task.id)
    expect(store.list('orca', root)).toHaveLength(0)
    expect(store.restore(task.id).archivedAt).toBeNull()
    expect(store.list('orca', root)).toHaveLength(1)
    store.close()
  })
})
