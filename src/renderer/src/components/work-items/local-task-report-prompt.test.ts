import { describe, expect, it } from 'vitest'
import { buildTaskReportPrompt } from './local-task-report-prompt'

describe('task report prompt', () => {
  it('asks the report agent for a concise read-only whole-task briefing', () => {
    const prompt = buildTaskReportPrompt({
      id: 'task-1',
      title: '任务标题',
      description: '汇总当前改动'
    })

    expect(prompt).toContain('orca local-task current --json')
    expect(prompt).toContain('所有关联会话')
    expect(prompt).toContain('改之前是什么情况')
    expect(prompt).toContain('需要老板决定')
    expect(prompt).toContain('不要修改代码、任务状态、子任务或会话归属')
  })
})
