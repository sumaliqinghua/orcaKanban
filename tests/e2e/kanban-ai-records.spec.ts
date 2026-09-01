import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from './helpers/orca-app'
import { waitForActiveWorktree, waitForSessionReady } from './helpers/store'

test('previews an AI record, persists read state, and opens its local task', async ({
  orcaPage,
  testRepoPath
}, testInfo) => {
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
      projectPath,
      title: '资源加载性能优化',
      description: '确认 Android 首屏资源加载的目标耗时。',
      intakeState: 'inbox',
      workspaceId: workspace?.id ?? 'local',
      workspaceLabel: workspace?.displayName ?? 'local · 当前 HEAD'
    })
    return { projectId: repo.id, taskId: task.id, workspaceId: workspace?.id ?? null }
  }, testRepoPath)
  const createdAt = Date.now()
  const date = new Date(createdAt).toISOString().slice(0, 10)
  const directory = join(testRepoPath, 'assistant', 'results', date)
  const recordPath = join(directory, 'air_e2e.json')
  mkdirSync(directory, { recursive: true })
  writeFileSync(
    recordPath,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        id: 'air_e2e',
        kind: 'requirement_clarification',
        seriesKey: `requirement_clarification:${context.taskId}`,
        createdAt,
        source: { automationId: 'auto-e2e', automationRunId: 'run-e2e', agentId: 'codex' },
        target: {
          projectId: context.projectId,
          projectPath: testRepoPath,
          workspaceId: context.workspaceId,
          taskId: context.taskId
        },
        title: '资源加载优化缺少验收指标',
        summary: '代码路径已经明确，但还需要目标耗时才能判断是否完成。',
        body: {
          format: 'markdown',
          content: '## 需要确认\n\n请补充 Android 首屏资源加载的目标耗时。'
        },
        basis: { taskUpdatedAt: createdAt, gitHead: 'e2e-head' },
        inputFingerprint: `sha256:${'a'.repeat(64)}`,
        readAt: null
      },
      null,
      2
    )}\n`,
    'utf8'
  )

  await orcaPage.evaluate(() => {
    window.__store?.getState().openWorkItemsPage()
  })
  await expect(orcaPage.getByRole('button', { name: /AI 记录/ })).toBeVisible()
  await orcaPage.getByRole('button', { name: /AI 记录/ }).click()
  await expect(orcaPage.getByText('资源加载优化缺少验收指标', { exact: true })).toBeVisible()

  await orcaPage.getByRole('button', { name: /资源加载优化缺少验收指标/ }).click()
  await expect(orcaPage.getByRole('complementary', { name: 'AI 记录详情' })).toBeVisible()
  await expect(orcaPage.getByText('请补充 Android 首屏资源加载的目标耗时。')).toBeVisible()
  await expect
    .poll(() => JSON.parse(readFileSync(recordPath, 'utf8')).readAt, { timeout: 5_000 })
    .toEqual(expect.any(Number))

  await orcaPage.screenshot({ path: testInfo.outputPath('kanban-ai-record-preview.png') })
  await orcaPage.getByRole('button', { name: '查看任务', exact: true }).click()
  await expect(
    orcaPage.getByRole('heading', { name: '资源加载性能优化', exact: true })
  ).toBeVisible()
  await expect(orcaPage.getByRole('button', { name: '收起任务详情' })).toBeVisible()
})
