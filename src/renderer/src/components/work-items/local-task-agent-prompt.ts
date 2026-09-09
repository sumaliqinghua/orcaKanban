export function buildLocalTaskSubtaskPrompt(request: string): string {
  return [
    '你正在执行 Orca 本地任务中的一个子任务。',
    '',
    '本轮子任务目标：',
    request.trim(),
    '',
    '开始前执行 `orca local-task current --json`，确认当前会话绑定的子任务和步骤。只更新这些子任务，不要创建新子任务或顶层任务。需要用户判断时，在当前会话完整提问并等待回复；完成时使用 `report-completed --output`，输出完整最终回复。最终回复应说明完成内容、验证结果、风险、未完成事项和待用户决策内容。若 CLI 暂时不可用，报告错误并保留完整会话记录。'
  ].join('\n')
}
