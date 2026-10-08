import { useCallback, useContext, useMemo, useState } from 'react'
import { useAppStore } from '@/store'
import { LocalTaskCatalogContext } from '../work-items/local-task-catalog-context'
import type { WorkItem } from '../work-items/mock-data'
import type { Repo } from '../../../../shared/repo-types'
import type { ProjectGroup } from '../../../../shared/project-group-types'
import type { FolderWorkspace } from '../../../../shared/folder-workspace-types'
import { folderWorkspaceToWorktree } from '../../../../shared/folder-workspace-worktree'
import { getProjectGroupHeaderKey } from './worktree-list/grouping/group-keys'
import {
  buildProjectGroupingIndex,
  getProjectGroupingForRepo,
  type ProjectGroupingModel
} from './worktree-list/grouping/project-grouping'

type ProjectScope = {
  repoMap: Map<string, Repo>
  projectGrouping: ProjectGroupingModel
  projectGroups: readonly ProjectGroup[]
  folderWorkspaces: readonly FolderWorkspace[]
}

export function getEmptyTaskProjectKeys(
  scope: ProjectScope,
  items: readonly WorkItem[]
): Set<string> {
  const activeProjects = new Set(
    items
      .filter(
        (item) =>
          item.intakeState === 'ready' &&
          item.archivedAt == null &&
          item.status !== 'Done' &&
          item.workspaceId
      )
      .map((item) => item.project)
  )
  const candidates = new Set<string>()
  const nonempty = new Set<string>()
  const projectIndex = buildProjectGroupingIndex(scope.projectGrouping)
  const groups = new Map(scope.projectGroups.map((group) => [group.id, group]))
  const add = (key: string, active: boolean): void => {
    candidates.add(key)
    if (active) {
      nonempty.add(key)
    }
  }
  const addParents = (id: string | null | undefined, active: boolean): void => {
    const visited = new Set<string>()
    while (id && groups.has(id) && !visited.has(id)) {
      visited.add(id)
      add(getProjectGroupHeaderKey(id), active)
      id = groups.get(id)?.parentGroupId
    }
  }
  for (const repo of scope.repoMap.values()) {
    const active = activeProjects.has(repo.id)
    add(getProjectGroupingForRepo(repo.id, scope.repoMap, projectIndex).key, active)
    addParents(repo.projectGroupId, active)
  }
  for (const folder of scope.folderWorkspaces) {
    addParents(folder.projectGroupId, activeProjects.has(folderWorkspaceToWorktree(folder).repoId))
  }
  return new Set([...candidates].filter((key) => !nonempty.has(key)))
}

export function useTaskProjectCollapse({
  collapsedGroups,
  toggleGroup,
  groupBy,
  ...scope
}: ProjectScope & {
  collapsedGroups: Set<string>
  toggleGroup: (key: string) => void
  groupBy: string
}): { collapsedGroups: Set<string>; toggleGroup: (key: string) => void } {
  const catalog = useContext(LocalTaskCatalogContext)
  const taskMode = useAppStore((s) => s.sidebarWorkspaceContent === 'tasks')
  const enabled = taskMode && groupBy === 'repo' && catalog?.loaded === true
  const [overrides, setOverrides] = useState<ReadonlyMap<string, boolean>>(new Map())
  const { repoMap, projectGrouping, projectGroups, folderWorkspaces } = scope
  const defaults = useMemo(
    () =>
      enabled
        ? getEmptyTaskProjectKeys(
            { repoMap, projectGrouping, projectGroups, folderWorkspaces },
            catalog.effectiveItems
          )
        : new Set<string>(),
    [enabled, catalog?.effectiveItems, repoMap, projectGrouping, projectGroups, folderWorkspaces]
  )
  const effective = useMemo(() => {
    if (!enabled) {
      return collapsedGroups
    }
    const next = new Set([...collapsedGroups, ...defaults])
    for (const [key, collapsed] of overrides) {
      if (collapsed) {
        next.add(key)
      } else {
        next.delete(key)
      }
    }
    return next
  }, [collapsedGroups, defaults, enabled, overrides])
  const toggle = useCallback(
    (key: string) => {
      if (enabled && (defaults.has(key) || overrides.has(key))) {
        setOverrides((current) => new Map(current).set(key, !effective.has(key)))
      } else {
        toggleGroup(key)
      }
    },
    [enabled, defaults, overrides, effective, toggleGroup]
  )
  return { collapsedGroups: effective, toggleGroup: toggle }
}
