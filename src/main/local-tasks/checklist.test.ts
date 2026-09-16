import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { LocalTaskStore, type LocalTaskProfilePersistence } from './store'
import type { LocalTask } from '../../shared/local-task-types'
import {
  createLocalTaskSessionArgsSchema,
  updateLocalTaskArgsSchema
} from '../ipc/local-task-ipc-validation'

let root: string
let store: LocalTaskStore
let task: LocalTask
let saved: LocalTask[]
let persistence: LocalTaskProfilePersistence
let failSave = false
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'orca-checklist-'))
  saved = []
  failSave = false
  persistence = {
    getLocalTasks: () => structuredClone(saved),
    saveLocalTask: (next) => {
      if (failSave) {
        throw new Error('保存失败')
      }
      saved = [...saved.filter((entry) => entry.id !== next.id), JSON.parse(JSON.stringify(next))]
      return next
    },
    deleteLocalTask: () => {}
  }
  store = new LocalTaskStore(persistence)
  task = store.create({
    projectId: 'project',
    projectPath: root,
    description: '父任务',
    workspaceId: `path:${root}`
  })
})
afterEach(() => rmSync(root, { recursive: true, force: true }))
function add(title = '核对文案'): string {
  return store.update(task.id, { checklistChange: { action: 'add', title } }).checklist!.at(-1)!.id
}
function convert(itemId: string, sessionId = 'session-1') {
  const args = createLocalTaskSessionArgsSchema.parse({
    taskId: task.id,
    projectPath: root,
    sessionId,
    sourceChecklistItemId: itemId,
    associationSource: 'task-center',
    currentPrompt: '核对文案'
  })
  return store.createSession(args)
}
describe('独立待办及转换', () => {
  it('旧任务无清单时可新增、改名、勾选并跨存储实例保留，不改变子任务或执行状态', () => {
    const id = add('  核对文案  ')
    add('核对图片')
    const args = updateLocalTaskArgsSchema.parse({
      taskId: task.id,
      updates: {
        checklistChange: { action: 'update', itemId: id, title: '核对按钮文案', completed: true }
      }
    })
    store.update(args.taskId, args.updates)
    const restored = new LocalTaskStore(persistence).get(task.id)!
    expect(restored.checklist).toEqual([
      { id, title: '核对按钮文案', completed: true },
      expect.objectContaining({ title: '核对图片', completed: false })
    ])
    expect(restored).toMatchObject({
      status: task.status,
      subtasks: task.subtasks,
      sessions: [],
      executionState: task.executionState
    })
    const deleted = store.update(task.id, { checklistChange: { action: 'delete', itemId: id } })
    expect(deleted.checklist).toHaveLength(1)
  })
  it('只转换目标待办，创建一个新子任务，保留已有未绑定子任务，重复请求不重复创建', () => {
    const id = add()
    add('另一条')
    const session = convert(id)
    const result = store.get(task.id)!
    expect(result.checklist).toEqual([expect.objectContaining({ title: '另一条' })])
    expect(result.subtasks).toHaveLength(task.subtasks.length + 1)
    expect(result.subtasks[0]).toMatchObject({
      title: '核对文案',
      status: 'todo',
      sessionId: session.id
    })
    expect(result.subtasks[1]).toEqual(task.subtasks[0])
    expect(convert(id)).toEqual(session)
    expect(store.get(task.id)?.subtasks).toHaveLength(result.subtasks.length)
    expect(() => convert(id, 'session-2')).toThrow('待办已转换或删除')
  })
  it('同名待办可分别转换，不被相同提示词合并', () => {
    const one = add()
    const two = add()
    convert(one)
    convert(two, 'session-2')
    expect(store.get(task.id)?.sessions).toHaveLength(2)
    expect(store.get(task.id)?.checklist).toEqual([])
  })
  it('失败时保留原待办且不写入新会话或子任务', () => {
    const id = add()
    const before = store.get(task.id)
    failSave = true
    expect(() => convert(id)).toThrow('保存失败')
    expect(store.get(task.id)).toEqual(before)
  })
  it('拒绝转换已完成、已删除待办及非执行会话', () => {
    const id = add()
    store.update(task.id, { checklistChange: { action: 'update', itemId: id, completed: true } })
    expect(() => convert(id)).toThrow('请先取消完成')
    store.update(task.id, { checklistChange: { action: 'update', itemId: id, completed: false } })
    expect(() =>
      store.createSession({
        taskId: task.id,
        sourceChecklistItemId: id,
        associationSource: 'clarification'
      })
    ).toThrow('执行子任务')
    store.update(task.id, { checklistChange: { action: 'delete', itemId: id } })
    expect(() => convert(id)).toThrow('待办已转换或删除')
    expect(() =>
      store.update(task.id, { checklistChange: { action: 'update', itemId: id, completed: true } })
    ).toThrow('待办已不存在')
    expect(store.get(task.id)?.sessions).toEqual([])
  })
  it('未绑定项目的收件箱也能保存普通待办', () => {
    const inbox = store.create({ projectId: 'local', description: '收件箱', intakeState: 'inbox' })
    expect(
      store.update(inbox.id, { checklistChange: { action: 'add', title: '待整理' } }).checklist
    ).toHaveLength(1)
  })
  it('接口拒绝空白、超长内容和非法勾选状态', () => {
    for (const change of [
      { action: 'add', title: ' ' },
      { action: 'add', title: 'a'.repeat(501) },
      { action: 'update', itemId: 'x', completed: 'true' }
    ]) {
      expect(
        updateLocalTaskArgsSchema.safeParse({
          taskId: task.id,
          updates: { checklistChange: change }
        }).success
      ).toBe(false)
    }
  })
  it('达到 100 条上限后仍可编辑和删除，但不能继续新增', () => {
    for (let index = 0; index < 100; index += 1) {
      add(`待办 ${index}`)
    }
    expect(() => add()).toThrow('最多保留 100 条')
    const id = store.get(task.id)!.checklist![0].id
    store.update(task.id, { checklistChange: { action: 'update', itemId: id, completed: true } })
    store.update(task.id, { checklistChange: { action: 'delete', itemId: id } })
    add()
    expect(store.get(task.id)?.checklist).toHaveLength(100)
  })
})
