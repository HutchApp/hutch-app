import type { Page } from '@playwright/test'

export function isOnPage(page: Page, bodyClass: string): Promise<boolean> {
  return page.locator(`body.${bodyClass}`).count().then(count => count > 0).catch(() => false)
}

export async function clickAndWaitForPageReload(page: Page, locator: ReturnType<Page['locator']>): Promise<void> {
  const loadPromise = page.waitForEvent('load')
  await locator.click()
  await loadPromise
}
