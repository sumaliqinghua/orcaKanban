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
    expect(prompt).toContain('referenceSubtasks')
    expect(prompt).toContain('默认只阅读父任务标题、描述')
    expect(prompt).toContain('自行判断')
    expect(prompt).toContain('无关的直接跳过')
    expect(prompt).toContain('--reference <子任务ID>')
    expect(prompt).toContain('用户问题 + Agent 回答')
    expect(prompt).toContain('handoff skill')
    expect(prompt).toContain('不恢复、不唤醒来源会话')
    expect(prompt).toContain('--expected-revision')
  })
})
