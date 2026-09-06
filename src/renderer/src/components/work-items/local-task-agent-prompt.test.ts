import { describe, expect, it } from 'vitest'
import { buildTaskPrompt } from './local-task-agent-prompt'
import type { WorkItem } from './mock-data'

const item: WorkItem = {
  id: 'lt-1',
  title: '图片检查工具',
  description: '分析并修复 Import Settings',
  status: 'Open',
  workspace: 'main',
  project: 'project',
  updated: 'now',
  sessions: 0,
  activeSessions: 0,
  subtasks: [],
  latestOutput: { session: 'none', text: 'none' },
  sessionsList: []
}

describe('local task Agent prompt', () => {
  it('keeps AI updates within the current subtask', () => {
    const prompt = buildTaskPrompt(item, '增加批量模式')
    expect(prompt).toContain('只读取和更新当前子任务的描述与步骤')
    expect(prompt).toContain('不要创建新子任务')
    expect(prompt).toContain('不要移交其他会话的子任务')
    expect(prompt).not.toContain('subtask-transfer')
    expect(prompt).toContain('完整最终回复')
    expect(prompt).toContain('事实和推测的区别')
  })
})
