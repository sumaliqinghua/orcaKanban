import type { WorkItem } from './mock-data'

export function buildTaskPrompt(item: WorkItem, request: string): string {
  return [
    `你正在处理 Orca 本地任务：${item.title}`,
    `任务 ID：${item.id}`,
    `任务描述：${item.description}`,
    '',
    `用户本轮请求：${request.trim()}`,
    '',
    '本轮会话属于这个任务。每次收到用户追问，先执行 `orca local-task current --json`，读取全部子任务、步骤和会话归属。请求仍属于当前会话负责的子任务时，优先调整未开始步骤；只有确实是不同功能时才创建新子任务，新建子任务会自动绑定当前会话。按任务列表顺序执行当前会话负责或未绑定的未完成子任务。不要修改其他会话负责的子任务；若用户要求执行，先停下并询问是否移交，确认后使用 `orca local-task subtask-transfer --subtask <id>`；原会话仍在运行时，只有用户明确确认强制移交后才加 `--force`。需要用户判断时使用 `request-review`，完成时把完整最终回复原样作为 `report-completed --output`。若 CLI 不可用，直接读取项目目录 `orca/<任务ID>/task.json`。不要创建新的顶层任务。'
  ].join('\n')
}
