import { expect, test } from './helpers/orca-app'
import { waitForActiveWorktree, waitForSessionReady } from './helpers/store'

test('loads a persisted inbox task in the task center', async ({ orcaPage, testRepoPath }) => {
  await waitForSessionReady(orcaPage)
  await waitForActiveWorktree(orcaPage)
  const context = await orcaPage.evaluate(async (projectPath) => {
    const store = window.__store
    if (!store) {
      throw new Error('window.__store is not available')
    }
    const state = store.getState()
    const repo = state.repos.find((candidate) => candidate.path === projectPath)
    if (!repo) {
      throw new Error('Seeded E2E project is not registered')
    }
    const workspace = Object.values(state.worktreesByRepo)
      .flat()
      .find((candidate) => candidate.repoId === repo.id)
    const task = await window.api.localTasks.create({
      projectId: repo.id,
      title: '资源加载性能优化',
      description: '确认 Android 首屏资源加载的目标耗时。',
      intakeState: 'inbox',
      workspaceId: workspace?.id ?? 'local',
      workspaceLabel: workspace?.displayName ?? 'local · 当前 HEAD'
    })
    return { projectId: repo.id, taskId: task.id, workspaceId: workspace?.id ?? null }
  }, testRepoPath)
  await orcaPage.evaluate(() => {
    window.__store?.getState().openWorkItemsPage()
  })
  await expect(orcaPage.getByRole('heading', { name: '任务中心' })).toBeVisible()
  const tasks = await orcaPage.evaluate(() => window.api.localTasks.list({ includeArchived: true }))
  expect(tasks.some((task) => task.title === '资源加载性能优化')).toBe(true)
})
