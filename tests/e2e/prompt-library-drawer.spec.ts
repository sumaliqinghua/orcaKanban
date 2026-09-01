import { expect, test } from './helpers/orca-app'
import { waitForActiveWorktree, waitForSessionReady } from './helpers/store'

test('opens the prompt library over the current page and copies a saved prompt', async ({
  electronApp,
  orcaPage
}, testInfo) => {
  await waitForSessionReady(orcaPage)
  await waitForActiveWorktree(orcaPage)
  await orcaPage.evaluate(() => window.__store?.getState().setActiveView('automations'))

  const entry = orcaPage.getByRole('button', { name: /^(Prompt Library|提示词库)$/ })
  await expect(entry).toBeVisible()
  await entry.click()

  const drawer = orcaPage.locator('[data-prompt-library-sheet]')
  await expect(drawer).toBeVisible()
  await orcaPage.waitForTimeout(400)
  expect(await orcaPage.evaluate(() => window.__store?.getState().activeView)).toBe('automations')

  const sidebarBox = await orcaPage
    .locator('[data-native-file-drop-target="project-sidebar"]')
    .boundingBox()
  const drawerBox = await drawer.boundingBox()
  const viewportWidth = await orcaPage.evaluate(() => window.innerWidth)
  expect(sidebarBox).not.toBeNull()
  expect(drawerBox).not.toBeNull()
  expect(Math.abs(drawerBox!.x - (sidebarBox!.x + sidebarBox!.width))).toBeLessThanOrEqual(2)
  expect(drawerBox!.x + drawerBox!.width).toBeLessThanOrEqual(viewportWidth)

  await orcaPage.screenshot({ path: testInfo.outputPath('prompt-library-desktop.png') })

  await orcaPage
    .getByRole('button', { name: /New prompt|新建提示词/ })
    .first()
    .click()
  await orcaPage.getByLabel(/Title|标题/).fill('E2E review prompt')
  await orcaPage.getByLabel(/^Prompt$|^提示词$/).fill('Review every changed file and report risks.')
  await orcaPage.getByRole('button', { name: /Save|保存/ }).click()

  await expect(orcaPage.getByText('E2E review prompt')).toBeVisible()
  await orcaPage.getByRole('button', { name: /Copy prompt|复制提示词/ }).click()
  await expect(orcaPage.getByRole('button', { name: /Copied|已复制/ })).toBeVisible()
  expect(await electronApp.evaluate(({ clipboard }) => clipboard.readText())).toBe(
    'Review every changed file and report risks.'
  )

  await electronApp.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.setSize(600, 720)
  })
  await expect(drawer).toBeVisible()
  await orcaPage.screenshot({ path: testInfo.outputPath('prompt-library-narrow.png') })
  expect(await orcaPage.evaluate(() => window.__store?.getState().activeView)).toBe('automations')
})
