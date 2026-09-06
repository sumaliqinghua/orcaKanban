import type { LocalTask } from '../../../../shared/local-task-types'
import type { KanbanAiRecord } from '../../../../shared/kanban-ai-record'

export type LocalTaskProjectFilter = string

export type LocalTaskProjectOption = {
  id: string
  label: string
}

export type LocalTaskProjectRoot = {
  projectId: string
  projectPath: string
}

type ProjectRow = {
  id: string
  displayName: string
  path: string
}

type WorkspaceRow = {
  repoId: string
  path: string
}

export function buildLocalTaskProjectOptions(
  repos: readonly ProjectRow[]
): LocalTaskProjectOption[] {
  const options: LocalTaskProjectOption[] = [{ id: 'all', label: '全部项目' }]
  const seen = new Set<string>()
  for (const repo of repos) {
    if (seen.has(repo.id)) {
      continue
    }
    seen.add(repo.id)
    options.push({ id: repo.id, label: repo.displayName })
  }
  return options
}

export function collectLocalTaskProjectRoots(
  repos: readonly ProjectRow[],
  worktrees: readonly WorkspaceRow[],
  projectFilter: LocalTaskProjectFilter
): LocalTaskProjectRoot[] {
  const roots: LocalTaskProjectRoot[] = []
  const seen = new Set<string>()
  const addRoot = (projectId: string, projectPath: string): void => {
    if (!projectPath || (projectFilter !== 'all' && projectId !== projectFilter)) {
      return
    }
    const key = `${projectId}\0${projectPath}`
    if (seen.has(key)) {
      return
    }
    seen.add(key)
    roots.push({ projectId, projectPath })
  }

  for (const repo of repos) {
    addRoot(repo.id, repo.path)
    for (const worktree of worktrees) {
      if (worktree.repoId === repo.id) {
        addRoot(worktree.repoId, worktree.path)
      }
    }
  }
  for (const worktree of worktrees) {
    if (!repos.some((repo) => repo.id === worktree.repoId)) {
      addRoot(worktree.repoId, worktree.path)
    }
  }
  return roots
}

export function mergeLocalTasksById<T extends { id: string; updatedAt: number }>(
  tasks: readonly T[]
): T[] {
  const byId = new Map<string, T>()
  for (const task of tasks) {
    const existing = byId.get(task.id)
    if (!existing || task.updatedAt >= existing.updatedAt) {
      byId.set(task.id, task)
    }
  }
  return [...byId.values()].sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function loadLocalTasksForProjectScope(
  roots: readonly LocalTaskProjectRoot[],
  projectFilter: LocalTaskProjectFilter,
  list: (args?: {
    projectId?: string
    projectPath?: string
    includeArchived?: boolean
  }) => Promise<LocalTask[]>,
  options: { includeArchived?: boolean } = {}
): Promise<LocalTask[]> {
  const requests =
    roots.length > 0
      ? roots.map((root) =>
          list({
            projectId: root.projectId,
            projectPath: root.projectPath,
            ...(options.includeArchived ? { includeArchived: true } : {})
          })
        )
      : [
          list({
            ...(projectFilter === 'all' ? {} : { projectId: projectFilter }),
            ...(options.includeArchived ? { includeArchived: true } : {})
          })
        ]
  const results = await Promise.allSettled(requests)
  const tasks = mergeLocalTasksById(
    results.flatMap((result) => (result.status === 'fulfilled' ? result.value : []))
  )
  const failures = results.filter((result) => result.status === 'rejected')
  if (tasks.length === 0 && failures.length === results.length && failures.length > 0) {
    const reason = failures[0].reason
    throw reason instanceof Error ? reason : new Error('本地任务加载失败')
  }
  return tasks
}

export async function loadKanbanAiRecordsForProjectScope(
  roots: readonly LocalTaskProjectRoot[],
  list: (args: LocalTaskProjectRoot) => Promise<KanbanAiRecord[]>
): Promise<KanbanAiRecord[]> {
  if (roots.length === 0) {
    return []
  }
  const results = await Promise.allSettled(roots.map((root) => list(root)))
  const byId = new Map<string, KanbanAiRecord>()
  for (const result of results) {
    if (result.status !== 'fulfilled') {
      continue
    }
    for (const record of result.value) {
      const current = byId.get(record.id)
      if (!current || record.createdAt > current.createdAt) {
        byId.set(record.id, record)
      }
    }
  }
  if (byId.size === 0 && results.every((result) => result.status === 'rejected')) {
    const reason = results[0]?.status === 'rejected' ? results[0].reason : null
    throw reason instanceof Error ? reason : new Error('AI 记录加载失败')
  }
  return [...byId.values()].sort((left, right) => right.createdAt - left.createdAt)
}

export function isLocalTaskInProjectScope<T extends { projectId: string; projectPath: string }>(
  task: T,
  roots: readonly LocalTaskProjectRoot[]
): boolean {
  return (
    roots.length === 0 ||
    (task.projectPath === '' && roots.some((root) => root.projectId === task.projectId)) ||
    roots.some((root) => root.projectId === task.projectId && root.projectPath === task.projectPath)
  )
}
