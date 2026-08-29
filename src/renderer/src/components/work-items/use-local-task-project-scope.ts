import { useMemo, useState } from 'react'
import { useAppStore } from '@/store'
import { useAllWorktrees, useRepos } from '@/store/selectors'
import {
  buildLocalTaskProjectOptions,
  collectLocalTaskProjectRoots
} from './local-task-project-scope'

export function useLocalTaskProjectScope(): {
  projectFilter: string
  setProjectFilter: (value: string) => void
  projectOptions: ReturnType<typeof buildLocalTaskProjectOptions>
  projectRoots: ReturnType<typeof collectLocalTaskProjectRoots>
  createProjectId: string
} {
  const activeRepoId = useAppStore((state) => state.activeRepoId)
  const repos = useRepos()
  const allWorktrees = useAllWorktrees()
  const [projectFilter, setProjectFilter] = useState('all')
  const projectOptions = useMemo(() => buildLocalTaskProjectOptions(repos), [repos])
  const projectRoots = useMemo(
    () =>
      collectLocalTaskProjectRoots(
        repos,
        allWorktrees.map((worktree) => ({ repoId: worktree.repoId, path: worktree.path })),
        projectFilter
      ),
    [allWorktrees, projectFilter, repos]
  )
  return {
    projectFilter,
    setProjectFilter,
    projectOptions,
    projectRoots,
    createProjectId: projectFilter !== 'all' ? projectFilter : (activeRepoId ?? 'local')
  }
}
