import {
  LOCAL_EXECUTION_HOST_ID,
  getWorktreeExecutionHostId
} from '../../../../shared/execution-host'
import type { Repo } from '../../../../shared/repo-types'
import type { Worktree } from '../../../../shared/worktree/types'
import type { TransferLocalTaskWorkspaceArgs } from '../../../../shared/local-task-types'

function branchName(value: string | null | undefined): string {
  return value?.replace(/^refs\/heads\//, '').replace(/^refs\/remotes\/[^/]+\//, '') ?? ''
}

export function resolveLocalTaskWorkspaceTransfer(args: {
  repo: Repo
  source: Worktree
  targetBranch?: string | null
  worktrees: readonly Worktree[]
}): TransferLocalTaskWorkspaceArgs | null {
  const sourceHost = getWorktreeExecutionHostId(args.source, args.repo)
  if (sourceHost !== LOCAL_EXECUTION_HOST_ID) {
    return null
  }
  const requestedBranch = branchName(args.targetBranch ?? args.repo.worktreeBaseRef)
  const candidates = args.worktrees.filter(
    (candidate) =>
      candidate.id !== args.source.id &&
      candidate.repoId === args.source.repoId &&
      getWorktreeExecutionHostId(candidate, args.repo) === sourceHost
  )
  const target = requestedBranch
    ? candidates.find((candidate) => branchName(candidate.branch) === requestedBranch)
    : candidates.find((candidate) => candidate.isMainWorktree)
  if (!target) {
    return null
  }
  return {
    sourceProjectPath: args.source.path,
    targetProjectId: target.repoId,
    targetProjectPath: target.path,
    targetWorkspaceId: target.id,
    targetWorkspaceLabel: `${target.displayName} · ${target.branch || `HEAD ${target.head.slice(0, 7)}`}`
  }
}
