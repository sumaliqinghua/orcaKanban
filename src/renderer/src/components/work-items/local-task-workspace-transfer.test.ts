import { describe, expect, it } from 'vitest'
import type { Repo } from '../../../../shared/repo-types'
import type { Worktree } from '../../../../shared/worktree/types'
import { resolveLocalTaskWorkspaceTransfer } from './local-task-workspace-transfer'

function repo(overrides: Partial<Repo> = {}): Repo {
  return {
    id: 'repo-1',
    path: '/repo',
    displayName: 'Repo',
    badgeColor: 'blue',
    addedAt: 1,
    executionHostId: 'local',
    ...overrides
  }
}

function worktree(id: string, path: string, branch: string, isMainWorktree = false): Worktree {
  return {
    id,
    repoId: 'repo-1',
    hostId: 'local',
    path,
    branch: `refs/heads/${branch}`,
    head: `${branch}-head`,
    displayName: branch,
    isMainWorktree,
    isArchived: false,
    isUnread: false,
    isPinned: false,
    sortOrder: 0,
    lastActivityAt: 1,
    comment: '',
    linkedIssue: null,
    linkedPR: null,
    linkedLinearIssue: null
  } as Worktree
}

describe('local task workspace transfer', () => {
  it('targets the matching base-branch workspace after a hosted review merge', () => {
    const source = worktree('source', '/worktrees/feature', 'feature/task')
    const target = worktree('target', '/repo', 'main', true)

    expect(
      resolveLocalTaskWorkspaceTransfer({
        repo: repo(),
        source,
        targetBranch: 'main',
        worktrees: [source, target]
      })
    ).toEqual({
      sourceProjectPath: '/worktrees/feature',
      targetProjectId: 'repo-1',
      targetProjectPath: '/repo',
      targetWorkspaceId: 'target',
      targetWorkspaceLabel: 'main · refs/heads/main'
    })
  })

  it('does not route remote workspace files through the local task store', () => {
    const source: Worktree = {
      ...worktree('source', '/remote/feature', 'feature/task'),
      hostId: 'ssh:box'
    }
    const target: Worktree = {
      ...worktree('target', '/remote/repo', 'main', true),
      hostId: 'ssh:box'
    }

    expect(
      resolveLocalTaskWorkspaceTransfer({
        repo: repo({ connectionId: 'box', executionHostId: 'ssh:box' }),
        source,
        targetBranch: 'main',
        worktrees: [source, target]
      })
    ).toBeNull()
  })
})
