import { useEffect, useMemo, useState } from 'react'
import type { KanbanAiRecord } from '../../../../shared/kanban-ai-record'
import type { WorkItem } from './mock-data'
import {
  loadKanbanAiRecordsForProjectScope,
  type LocalTaskProjectOption,
  type LocalTaskProjectRoot
} from './local-task-project-scope'
import { findKanbanAiRecordTask } from './kanban-ai-record-task-target'
import { KanbanAiRecordDetailAside } from './KanbanAiRecordDetailAside'
import { KanbanAiRecordList } from './KanbanAiRecordList'

export function KanbanAiRecordsPane({
  active,
  projectOptions,
  projectRoots,
  query,
  items,
  refreshToken,
  onUnreadCountChange,
  onRecordCountChange,
  onOpenTask
}: {
  active: boolean
  projectOptions: readonly LocalTaskProjectOption[]
  projectRoots: readonly LocalTaskProjectRoot[]
  query: string
  items: readonly WorkItem[]
  refreshToken: number
  onUnreadCountChange: (count: number) => void
  onRecordCountChange: (count: number) => void
  onOpenTask: (task: WorkItem) => void
}): React.JSX.Element {
  const [records, setRecords] = useState<KanbanAiRecord[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const projectLabels = useMemo(
    () => new Map(projectOptions.map((option) => [option.id, option.label])),
    [projectOptions]
  )
  const selected = records.find((record) => record.id === selectedId) ?? null
  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) {
      return records
    }
    return records.filter(
      (record) =>
        record.title.toLowerCase().includes(normalizedQuery) ||
        record.summary.toLowerCase().includes(normalizedQuery) ||
        record.id.toLowerCase().includes(normalizedQuery) ||
        record.target.taskId?.toLowerCase().includes(normalizedQuery)
    )
  }, [query, records])

  useEffect(() => {
    onRecordCountChange(records.length)
    onUnreadCountChange(records.filter((record) => record.readAt === null).length)
  }, [onRecordCountChange, onUnreadCountChange, records])

  useEffect(() => {
    let cancelled = false
    void loadKanbanAiRecordsForProjectScope(projectRoots, window.api.localTasks.listAiRecords)
      .then((next) => {
        if (cancelled) {
          return
        }
        setRecords(next)
        onRecordCountChange(next.length)
        onUnreadCountChange(next.filter((record) => record.readAt === null).length)
        setSelectedId((current) =>
          current && next.some((record) => record.id === current) ? current : null
        )
        setNotice(null)
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setNotice(error instanceof Error ? error.message : 'AI 记录加载失败')
        }
      })
    return () => {
      cancelled = true
    }
  }, [onRecordCountChange, onUnreadCountChange, projectRoots, refreshToken])

  const selectRecord = (record: KanbanAiRecord): void => {
    setSelectedId(record.id)
    setDetailOpen(true)
    setNotice(null)
    if (record.readAt !== null) {
      return
    }
    void window.api.localTasks
      .markAiRecordRead({
        projectId: record.target.projectId,
        projectPath: record.target.projectPath,
        recordId: record.id
      })
      .then((updated) => {
        setRecords((current) =>
          current.map((candidate) => (candidate.id === updated.id ? updated : candidate))
        )
      })
      .catch((error: unknown) =>
        setNotice(error instanceof Error ? error.message : 'AI 记录已读状态更新失败')
      )
  }

  const openTask = (record: KanbanAiRecord): void => {
    const task = findKanbanAiRecordTask(items, record)
    if (!task) {
      setNotice('关联任务不存在、已归档或不在当前本地项目范围内。')
      return
    }
    onOpenTask(task)
    setDetailOpen(false)
  }

  return (
    <>
      {active ? (
        <KanbanAiRecordList
          records={filtered}
          selectedId={selectedId}
          projectLabels={projectLabels}
          onSelect={selectRecord}
        />
      ) : null}
      <KanbanAiRecordDetailAside
        record={selected}
        open={active && detailOpen}
        projectLabel={
          selected
            ? (projectLabels.get(selected.target.projectId) ?? selected.target.projectId)
            : ''
        }
        notice={notice}
        onClose={() => setDetailOpen(false)}
        onOpenTask={openTask}
      />
    </>
  )
}
