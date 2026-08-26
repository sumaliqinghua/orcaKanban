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
  it('requires step-first refinement and explicit cross-session transfer', () => {
    const prompt = buildTaskPrompt(item, '增加批量模式')
    expect(prompt).toContain('优先调整未开始步骤')
    expect(prompt).toContain('确实是不同功能时才创建新子任务')
    expect(prompt).toContain('不要修改其他会话负责的子任务')
    expect(prompt).toContain('subtask-transfer')
    expect(prompt).toContain('用户明确确认强制移交后才加 `--force`')
  })
})
