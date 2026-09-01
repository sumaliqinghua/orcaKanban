import { expect, test } from './helpers/orca-app'
import { waitForSessionReady } from './helpers/store'

test('shows Kanban advisor templates in the empty automation state', async ({
  orcaPage
}, testInfo) => {
  await waitForSessionReady(orcaPage)
  await orcaPage.evaluate(() => {
    const store = window.__store
    if (!store) {
      throw new Error('window.__store is not available')
    }
    store.getState().openAutomationsPage()
  })

  await expect(orcaPage.getByText(/Start from a template|从模板开始/)).toBeVisible()
  for (const label of [
    /Inbox requirement clarification|收件箱需求澄清/,
    /Weekly candidate planning|每周候选任务规划/,
    /Stale task simplification|滞留任务简化/,
    /Daily Kanban status report|每日任务状态汇报/
  ]) {
    await expect(orcaPage.getByRole('button', { name: label })).toBeVisible()
  }

  await orcaPage
    .getByRole('button', { name: /Inbox requirement clarification|收件箱需求澄清/ })
    .click()
  await expect(orcaPage.getByRole('dialog')).toBeVisible()
  await expect(orcaPage.locator('[data-slot="automation-prompt-editor"]')).toBeVisible()
  const promptText = () =>
    orcaPage.locator('[data-slot="automation-prompt-editor"] .view-lines').innerText()
  await expect.poll(promptText, { timeout: 10_000 }).toMatch(/requirement_clarification/)
  await expect.poll(promptText, { timeout: 10_000 }).toContain('assistant/kanban-advisor/README.md')
  await orcaPage.screenshot({ path: testInfo.outputPath('kanban-advisor-template-editor.png') })
})
