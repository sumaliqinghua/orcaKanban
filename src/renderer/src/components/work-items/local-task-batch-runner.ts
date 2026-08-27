import { launchAgentInNewTab } from '@/lib/launch-agent-in-new-tab'
import { useAppStore } from '@/store'
import { activateAndRevealWorktree } from '@/lib/worktree-activation'
import type {
  LocalTaskBatchCandidate,
  LocalTaskRunStatus
} from '../../../../shared/local-task-types'
import type { TuiAgent } from '../../../../shared/tui-agent'

const TASK_SETTLEMENT_POLL_MS = 1_000
const TASK_SETTLEMENT_TIMEOUT_MS = 12 * 60 * 60 * 1_000

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
  return useAppStore.getState().activeWorktreeId ?? null
}

function taskGroupId(worktreeId: string): string | undefined {
  const state = useAppStore.getState()
  return state.activeGroupIdByWorktree[worktreeId] ?? state.groupsByWorktree[worktreeId]?.[0]?.id
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

async function waitForRunToSettle(candidate: LocalTaskBatchCandidate): Promise<void> {
  const deadline = Date.now() + TASK_SETTLEMENT_TIMEOUT_MS
  while (Date.now() < deadline) {
    const task = await window.api.localTasks.get(candidate.task.id, candidate.task.projectPath)
    const run = task?.runs.find((entry) => entry.id === candidate.runId)
    if (!run || run.status === 'needs_review' || run.status === 'failed') {
      return
    }
    await new Promise((resolve) => window.setTimeout(resolve, TASK_SETTLEMENT_POLL_MS))
  }
  await updateRun(candidate, 'failed', undefined, 'Agent 会话在 12 小时内没有结束')
}

async function runCandidate(candidate: LocalTaskBatchCandidate, agent: TuiAgent): Promise<void> {
  const worktreeId = taskWorktreeId(candidate.task)
  if (!worktreeId) {
    await updateRun(candidate, 'failed', undefined, '任务没有可用的 workspace')
    return
  }
  if (!activateAndRevealWorktree(worktreeId)) {
    await updateRun(candidate, 'failed', undefined, '任务 workspace 不存在或无法激活')
    return
  }
  const result = launchAgentInNewTab({
    agent,
    worktreeId,
    ...(taskGroupId(worktreeId) ? { groupId: taskGroupId(worktreeId) } : {}),
    prompt: buildBatchPrompt(candidate),
    promptDelivery: 'submit-after-ready',
    launchSource: 'task_page',
    localTaskId: candidate.task.id,
    localTaskRoot: candidate.task.projectPath
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
      associationSource: 'task-center'
    })
    await updateRun(candidate, 'running', result.tabId)
    if (result.promptDeliveryResult) {
      const delivery = await result.promptDeliveryResult
      if (!delivery.delivered) {
        await updateRun(candidate, 'failed', result.tabId, 'Agent 会话已创建，但任务提示未成功提交')
        return
      }
    }
    await waitForRunToSettle(candidate)
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
  const groups = new Map<string, LocalTaskBatchCandidate[]>()
  for (const candidate of candidates) {
    const group = groups.get(candidate.workspaceKey) ?? []
    group.push(candidate)
    groups.set(candidate.workspaceKey, group)
  }
  await Promise.all(
    [...groups.values()].map(async (group) => {
      for (const candidate of group) {
        await runCandidate(candidate, agent)
      }
    })
  )
}
