import { randomUUID } from 'node:crypto'
import type {
  LocalTask,
  LocalTaskChecklistChange,
  LocalTaskChecklistItem,
  LocalTaskSession
} from '../../shared/local-task-types'

function checklistTitle(title: string): string {
  const trimmed = title.trim()
  if (!trimmed || trimmed.length > 500) {
    throw new Error('待办内容须为 1 至 500 个字符')
  }
  return trimmed
}

export function applyChecklistChange(
  items: LocalTaskChecklistItem[],
  change: LocalTaskChecklistChange
): LocalTaskChecklistItem[] {
  if (change.action === 'add') {
    if (items.length >= 100) {
      throw new Error('每个任务最多保留 100 条待办')
    }
    return [
      ...items,
      { id: `ltcheck_${randomUUID()}`, title: checklistTitle(change.title), completed: false }
    ]
  }
  if (!items.some((item) => item.id === change.itemId)) {
    throw new Error('待办已不存在，请刷新任务')
  }
  if (change.action === 'delete') {
    return items.filter((item) => item.id !== change.itemId)
  }
  return items.map((item) =>
    item.id === change.itemId
      ? {
          ...item,
          title: change.title === undefined ? item.title : checklistTitle(change.title),
          completed: change.completed ?? item.completed
        }
      : item
  )
}

export function requireChecklistConversion(
  task: LocalTask,
  itemId: string,
  source: LocalTaskSession['associationSource'] | undefined
): LocalTaskChecklistItem {
  const item = task.checklist?.find((candidate) => candidate.id === itemId)
  if (!item) {
    throw new Error('待办已转换或删除，请刷新任务')
  }
  if (item.completed) {
    throw new Error('请先取消完成待办，再转为子任务')
  }
  if (source === 'clarification' || source === 'task-report') {
    throw new Error('待办只能转换为执行子任务')
  }
  return item
}
