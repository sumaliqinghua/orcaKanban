export function buildLocalTaskSubtaskPrompt(request: string): string {
  return [
    '你正在执行 Orca 本地任务中的一个子任务。',
    '',
    '本轮子任务目标：',
    request.trim(),
    '',
    '开始前执行 `orca local-task current --json`，确认当前会话绑定的子任务和步骤。默认只阅读父任务标题、描述，以及 referenceSubtasks 中其他子任务的标题、描述和状态。',
    '结合本轮目标自行判断哪些子任务可能提供可复用实现、已确认约束或失败经验。无关的直接跳过，不要求用户手动选择关联。参考信息不扩大本轮执行范围。',
    '只对相关子任务执行 `orca local-task current --reference <子任务ID> --json`。该命令只返回任务已保存的问答轮次（用户问题 + Agent 回答），不是包含工具调用的完整原始会话。descriptionSource 标明描述来自初始目标、保留问答或最近请求；descriptionTruncated 为 true 时说明概览被截短，可通过 reference 获取完整描述。',
    '不能仅凭状态或摘要认定功能已实现。保存的问答可能不完整，必要时再核对当前代码。不要把保存问答当成完整原始会话，也不要把远程路径当本机路径。',
    '相关保存问答较多时，复用已安装 handoff skill 的按目标整理、引用已有产物和保留证据原则，在当前会话为本轮目标整理上下文；不恢复、不唤醒来源会话，不新建交接会话。没有相关历史时无需 handoff；技能未安装时直接按上述原则整理，不因此阻塞。',
    '用户明确确认的目标、范围、需求约束和验收标准变化后，使用 `orca local-task update-description --description <文本> --expected-revision <当前描述版本> --json` 写回任务描述。写回内容必须与确认稿一致，不得追加本轮操作限制。当前描述版本来自 `orca local-task current --json` 的 task.descriptionRevision。版本不匹配时重新读取后再写，不要用旧内容覆盖新确认。试探性建议不要自动写回。',
    '只更新当前会话负责的子任务，不要创建新子任务或顶层任务。需要用户判断时，在当前会话完整提问并等待回复；完成时使用 `report-completed --output`，输出完整最终回复，说明完成内容、验证结果、风险、未完成事项和待用户决策内容。若 CLI 暂时不可用或旧运行时未提供概览，报告限制并保留完整会话记录。'
  ].join('\n')
}
