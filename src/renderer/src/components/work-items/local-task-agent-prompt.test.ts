import { describe, expect, it } from 'vitest'
import { buildLocalTaskSubtaskPrompt } from './local-task-agent-prompt'

describe('local task Agent prompt', () => {
  it('keeps AI updates within the current subtask', () => {
    const prompt = buildLocalTaskSubtaskPrompt('增加批量模式')
    expect(prompt.match(/增加批量模式/g)).toHaveLength(1)
    expect(prompt).not.toContain('任务描述：')
    expect(prompt).not.toContain('任务 ID：')
    expect(prompt).toContain('确认当前会话绑定的子任务和步骤')
    expect(prompt).toContain('不要创建新子任务')
    expect(prompt).not.toContain('subtask-transfer')
    expect(prompt).toContain('完整最终回复')
    expect(prompt).toContain('验证结果')
  })
})
