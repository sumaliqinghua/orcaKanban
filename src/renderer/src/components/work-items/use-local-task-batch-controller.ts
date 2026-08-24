import { useMemo, useState } from 'react'
import type { TuiAgent } from '../../../../shared/tui-agent'
import type { WorkItem } from './mock-data'
import { runLocalTaskBatch } from './local-task-batch-runner'

export function useLocalTaskBatchController({
  items,
  loadTasks,
  setLoadError
}: {
  items: WorkItem[]
  loadTasks: () => Promise<void>
  setLoadError: React.Dispatch<React.SetStateAction<string | null>>
}): {
  batchCandidates: WorkItem[]
  batchRunning: boolean
  runAllTasks: (agent: TuiAgent) => Promise<void>
} {
  const [batchRunning, setBatchRunning] = useState(false)
  const batchCandidates = useMemo(
    () =>
      items.filter(
        (item) =>
          item.status === 'Open' &&
          item.intakeState !== 'inbox' &&
          item.archivedAt === null &&
          Boolean(item.workspaceId) &&
          item.executionState !== 'queued' &&
          item.executionState !== 'running'
      ),
    [items]
  )

  const runAllTasks = async (agent: TuiAgent): Promise<void> => {
    if (batchRunning || batchCandidates.length === 0) {
      return
    }
    setBatchRunning(true)
    try {
      const batch = await window.api.localTasks.startBatch({
        tasks: batchCandidates.flatMap((item) =>
          item.projectPath ? [{ taskId: item.id, projectPath: item.projectPath }] : []
        )
      })
      if (batch.candidates.length === 0) {
        setLoadError('当前没有可执行的 Open 任务')
        return
      }
      await runLocalTaskBatch(batch.candidates, agent)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : '批量执行启动失败')
    } finally {
      setBatchRunning(false)
      await loadTasks()
    }
  }

  return { batchCandidates, batchRunning, runAllTasks }
}
