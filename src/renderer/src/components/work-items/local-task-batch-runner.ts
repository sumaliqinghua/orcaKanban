import { launchAgentBackgroundSession } from '@/lib/launch-agent-background-session'
import { useAppStore } from '@/store'
import type {
  LocalTaskBatchCandidate,
  LocalTaskRunStatus
} from '../../../../shared/local-task-types'
import type { TuiAgent } from '../../../../shared/tui-agent'

function buildBatchPrompt(candidate: LocalTaskBatchCandidate): string {
  const task = candidate.task
  return [
    `你正在执行 Orca 本地任务：${task.title}`,
    `任务 ID：${task.id}`,
    `任务描述：${task.description}`,
    '',
    '这是一次批量执行。请先读取当前任务上下文，再独立完成目标。',
    '每次处理用户请求前读取全部子任务和会话归属；按列表顺序执行当前会话负责或未绑定的子任务。优先调整现有子任务的未开始步骤，确实是不同功能才创建新子任务。不要修改其他会话负责的子任务；需要移交时先请求用户确认。',
    '如果需求不清、需要用户决定或发现不能安全继续，请停止本轮工作，并明确写出需要用户回答的问题。',
    '完成或停止前，请使用 `orca local-task report-completed --output` 写入完整汇报，包括完成内容、验证结果、限制、风险和待确认项。不要创建新的顶层任务。'
  ].join('\n')
}

function taskWorktreeId(task: LocalTaskBatchCandidate['task']): string | null {
  if (task.workspaceId !== 'local') {
    return task.workspaceId
  }
  return (
    useAppStore
      .getState()
      .allWorktrees?.()
      .find((workspace) => workspace.path === task.projectPath)?.id ?? null
  )
}

async function updateRun(
  candidate: LocalTaskBatchCandidate,
  status: LocalTaskRunStatus,
  sessionId?: string | null,
  error?: string | null
): Promise<void> {
  await window.api.localTasks.updateRun({
    taskId: candidate.task.id,
    projectPath: candidate.task.projectPath,
    runId: candidate.runId,
    status,
    ...(sessionId !== undefined ? { sessionId } : {}),
    ...(error !== undefined ? { error } : {})
  })
}

async function runCandidate(candidate: LocalTaskBatchCandidate, agent: TuiAgent): Promise<void> {
  const worktreeId = taskWorktreeId(candidate.task)
  if (!worktreeId) {
    await updateRun(candidate, 'failed', undefined, '任务没有可用的 workspace')
    return
  }
  const result = await launchAgentBackgroundSession({
    agent,
    worktreeId,
    prompt: buildBatchPrompt(candidate),
    launchSource: 'task_page',
    title: `自动化执行 · ${candidate.task.title}`
  })
  if (!result?.tabId) {
    await updateRun(candidate, 'failed', null, '无法创建真实 Agent 会话')
    return
  }
  try {
    await window.api.localTasks.createSession({
      taskId: candidate.task.id,
      projectPath: candidate.task.projectPath,
      sessionId: result.tabId,
      workspaceId: candidate.task.workspaceId,
      title: `批量执行 · ${candidate.task.title}`,
      currentPrompt: buildBatchPrompt(candidate),
      associationSource: 'automation'
    })
    await updateRun(candidate, 'running', result.tabId)
  } catch (error) {
    await updateRun(
      candidate,
      'failed',
      result.tabId,
      error instanceof Error ? error.message : String(error)
    )
  }
}

export async function runLocalTaskBatch(
  candidates: readonly LocalTaskBatchCandidate[],
  agent: TuiAgent
): Promise<void> {
  await Promise.all(candidates.map((candidate) => runCandidate(candidate, agent)))
}
