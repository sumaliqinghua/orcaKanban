import type { LocalTask } from '../../../../shared/local-task-types'

export function buildLocalTaskClarificationPrompt(
  task: Pick<LocalTask, 'id' | 'title' | 'description'>
): string {
  return [
    `你是本地任务“${task.title}”的需求澄清 Agent。`,
    `任务 ID：${task.id}`,
    '',
    '先运行 `orca local-task current --json`，读取父任务标题、描述和其他子任务标题、描述。不要默认读取全部会话历史。',
    '本轮只判断任务描述是否清晰、可执行且没有关键歧义；不要修改功能代码，不要启动执行批次，不要创建新的顶层任务。',
    '如果缺少用户必须决定的信息，在本会话的正常回复中完整提出具体、可回答的问题，并等待用户在本会话回复。',
    '用户确认目标、范围、需求约束和验收标准后，使用 `orca local-task update-description --description <文本> --expected-revision <当前描述版本> --json` 写回。写回内容必须与确认稿一致，不得追加本轮操作限制。当前描述版本来自 current 返回的 task.descriptionRevision；版本不匹配时重新读取后再写。',
    '如果描述已经足够清晰，调用 report-completed，汇报可执行结论，但不要自动把 inbox 整理为 ready。',
    '',
    `当前任务描述：${task.description}`
  ].join('\n')
}
