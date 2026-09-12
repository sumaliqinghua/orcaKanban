import { expect, test } from './helpers/orca-app'
import { waitForActiveWorktree, waitForSessionReady } from './helpers/store'

test('continued conversation moves a reviewed task back to working and then review', async ({
  orcaPage,
  testRepoPath
}, testInfo) => {
  await waitForSessionReady(orcaPage)
  await waitForActiveWorktree(orcaPage)
  const context = await orcaPage.evaluate(async (projectPath) => {
    const state = window.__store!.getState()
    const workspaceId = state.activeWorktreeId!
    const repo = state.repos.find((entry) => entry.path === projectPath)!
    const tab = state.tabsByWorktree[workspaceId]![0]!
    const leafId = state.terminalLayoutsByTabId[tab.id]!.activeLeafId!
    const task = await window.api.localTasks.create({
      projectId: repo.id,
      projectPath,
      title: '继续会话状态验证',
      description: '待审阅后继续讨论',
      workspaceId,
      workspaceLabel: 'E2E'
    })
    await window.api.localTasks.createSession({
      taskId: task.id,
      projectPath,
      sessionId: tab.id,
      title: '原关联会话',
      currentPrompt: '最初请求'
    })
    await window.api.localTasks.updateSessionOutput({ sessionId: tab.id, sessionStatus: 'done' })
    state.openWorkItemsPage()
    return { tabId: tab.id, paneKey: `${tab.id}:${leafId}`, workspaceId }
  }, testRepoPath)
  await orcaPage.getByText('继续会话状态验证', { exact: true }).click()
  await expect(orcaPage.getByRole('img', { name: '会话已结束' })).toBeVisible()
  await orcaPage.evaluate(({ paneKey, tabId, workspaceId }) => {
    window
      .__store!.getState()
      .setAgentStatus(
        paneKey,
        { state: 'working', prompt: '继续', agentType: 'codex' },
        'Codex',
        { updatedAt: Date.now(), stateStartedAt: Date.now() },
        { tabId, worktreeId: workspaceId }
      )
  }, context)
  const row = orcaPage.getByRole('button', { name: /原关联会话.*手动/ })
  await expect(row.getByRole('img', { name: '会话运行中' })).toBeVisible()
  await expect(orcaPage.locator('aside').getByText('In progress', { exact: true })).toBeVisible()
  await orcaPage.screenshot({ path: testInfo.outputPath('continued-session-working.png') })
  await orcaPage.evaluate(({ paneKey, tabId, workspaceId }) => {
    window
      .__store!.getState()
      .setAgentStatus(
        paneKey,
        { state: 'done', prompt: '继续', agentType: 'codex' },
        'Codex',
        { updatedAt: Date.now(), stateStartedAt: Date.now() },
        { tabId, worktreeId: workspaceId }
      )
  }, context)
  await expect(row.getByRole('img', { name: '会话已结束' })).toBeVisible()
  await expect(orcaPage.locator('aside').getByText('Needs review', { exact: true })).toBeVisible()
})

test('task history opens its exact idle terminal and refuses unidentified recovery', async ({
  orcaPage,
  testRepoPath
}, testInfo) => {
  await waitForSessionReady(orcaPage)
  await waitForActiveWorktree(orcaPage)
  await orcaPage.evaluate(async (projectPath) => {
    const state = window.__store!.getState()
    const workspaceId = state.activeWorktreeId!
    const repo = state.repos.find((entry) => entry.path === projectPath)!
    const tab = state.tabsByWorktree[workspaceId]![0]!
    const task = await window.api.localTasks.create({
      projectId: repo.id,
      projectPath,
      title: '原会话恢复验证',
      description: '核对身份和状态',
      workspaceId,
      workspaceLabel: 'E2E workspace'
    })
    await window.api.localTasks.createSession({
      taskId: task.id,
      projectPath,
      sessionId: tab.id,
      title: '原始终端请求',
      currentPrompt: '原始终端请求'
    })
    await window.api.localTasks.createSession({
      taskId: task.id,
      projectPath,
      sessionId: 'missing-original-session',
      title: '继续',
      currentPrompt: '继续'
    })
    state.openWorkItemsPage()
  }, testRepoPath)
  await orcaPage.getByText('原会话恢复验证', { exact: true }).click()
  await expect(orcaPage.getByRole('img', { name: '会话运行中' })).toHaveCount(0, {
    timeout: 40_000
  })
  await orcaPage.getByRole('button', { name: /继续.*手动/ }).click()
  await expect(orcaPage.getByRole('button', { name: '在工作树中恢复' })).toBeVisible()
  await orcaPage.getByRole('button', { name: '在工作树中恢复' }).click()
  await expect(orcaPage.getByRole('alert')).toContainText('缺少原始会话标识')
  await expect(orcaPage.getByText('最近请求', { exact: true })).toBeVisible()
  await orcaPage.screenshot({ path: testInfo.outputPath('session-recovery.png') })
  await orcaPage.getByRole('button', { name: /原始终端请求.*手动/ }).click()
  await expect(orcaPage.getByRole('button', { name: '打开工作树查看会话' })).toBeVisible()
  await orcaPage.getByRole('button', { name: '打开工作树查看会话' }).click()
  await expect(orcaPage.getByRole('heading', { name: '任务中心' })).not.toBeVisible()
})
