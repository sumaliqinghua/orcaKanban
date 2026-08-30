import type { LocalTask } from '../../../../shared/local-task-types'

export function buildTaskReportPrompt(
  task: Pick<LocalTask, 'id' | 'title' | 'description'>
): string {
  return [
    `你正在为本地任务“${task.title}”生成任务报告。`,
    `任务 ID：${task.id}`,
    '',
    '先运行 `orca local-task current --json`，读取任务描述、所有子任务、所有关联会话及其摘要。',
    '必要时检查项目当前状态、任务记录和已经发生的改动，区分执行前情况、已完成事实和推测。',
    '',
    '请用老板能快速决策的方式简洁汇报：',
    '- 改之前是什么情况',
    '- 已经做了什么',
    '- 现在是什么情况',
    '- 方案选择与原因',
    '- 不确定事项、风险与限制',
    '- 需要老板决定的问题',
    '- 建议下一步',
    '',
    '不要修改代码、任务状态、子任务或会话归属；不要创建文档，直接在当前会话中回答。',
    '',
    `当前任务描述：${task.description}`
  ].join('\n')
}
