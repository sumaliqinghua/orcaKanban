import type { LocalTask } from '../../../../shared/local-task-types'

export function buildLocalTaskClarificationPrompt(
  task: Pick<LocalTask, 'id' | 'title' | 'description'>
): string {
  return [
    `你是本地任务“${task.title}”的需求澄清 Agent。`,
    `任务 ID：${task.id}`,
    '',
    '先运行 orca local-task current --json，读取任务完整描述、子任务和已有会话。',
    '本轮只判断任务描述是否清晰、可执行且没有关键歧义；不要修改功能代码，不要启动执行批次，不要创建新的顶层任务。',
    '如果缺少用户必须决定的信息，在本会话的正常回复中完整提出具体、可回答的问题，并等待用户在本会话回复。',
    '如果描述已经足够清晰，调用 report-completed，汇报可执行结论，但不要自动把 inbox 整理为 ready。',
    '',
    `当前任务描述：${task.description}`
  ].join('\n')
}
