import type { WorkItem } from './mock-data'

export function buildTaskPrompt(item: WorkItem, request: string): string {
  return [
    `你正在处理 Orca 本地任务：${item.title}`,
    `任务 ID：${item.id}`,
    `任务描述：${item.description}`,
    '',
    `用户本轮请求：${request.trim()}`,
    '',
    '本轮会话对应一个子任务。先执行 `orca local-task current --json`，只读取和更新当前子任务的描述与步骤；不要创建新子任务、不要移交其他会话的子任务、不要创建新的顶层任务。用户提出相近问题时继续更新当前子任务，不要拆出新的对象；用户要研究、实现、审查或现状说明等独立方向时，由用户在任务中心新建关联会话。需要用户判断时使用 `request-review`，完成时使用 `report-completed --output`，输出完整最终回复而不是压缩摘要。最终回复应明确本会话做了什么、当前情况、事实和推测的区别、风险、不确定事项和需要用户决定的内容。若 CLI 暂时不可用，报告错误并继续保留完整会话记录，不要读取或写入任务 JSON 文件。'
  ].join('\n')
}
