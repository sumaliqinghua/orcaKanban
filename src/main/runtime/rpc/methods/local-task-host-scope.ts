import type { OrcaRuntimeService } from '../../orca-runtime'
import type { LocalTask } from '../../../../shared/local-task-types'
import { getRepoExecutionHostId } from '../../../../shared/execution-host'
import { resolveFolderWorkspaceHost } from '../../../../shared/folder-workspace-execution-host'

export function isLocalTaskHost(runtime: OrcaRuntimeService, task: LocalTask): boolean {
  const repos = runtime.listRepos()
  if (task.workspaceId.startsWith('folder:')) {
    const folderWorkspaces = runtime.listFolderWorkspaces()
    const folderId = task.workspaceId.slice('folder:'.length)
    const folder = folderWorkspaces.find((row) => row.id === folderId)
    if (
      !folder ||
      folder.isArchived ||
      (folder.executionHostId && folder.executionHostId !== 'local')
    ) {
      return false
    }
    return (
      resolveFolderWorkspaceHost(
        { repos, folderWorkspaces, projectGroups: runtime.listProjectGroups() },
        folderId
      ).kind === 'local'
    )
  }
  const repo = repos.find((row) => row.id === task.projectId)
  return Boolean(repo && getRepoExecutionHostId(repo) === 'local')
}
