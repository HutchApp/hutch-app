import type { Page } from '@playwright/test'

export function isOnPage(page: Page, bodyClass: string): Promise<boolean> {
  return page.locator(`body.${bodyClass}`).count().then(count => count > 0).catch(() => false)
}

export async function clickAndWaitForPageReload(page: Page, locator: ReturnType<Page['locator']>): Promise<void> {
  const loadEvent = page.waitForEvent('load')
  await locator.click()
  await Promise.race([
    // Full page navigation (non-HTMX links, standard form submits)
    loadEvent,
    // HTMX adds htmx-request class when request starts, removes after swap.
    // Wait for it to appear then disappear — guarantees the DOM is stable.
    page.waitForSelector('.htmx-request', { state: 'attached', timeout: 5000 })
      .then(() => page.waitForSelector('.htmx-request', { state: 'detached', timeout: 60000 }))
      .catch(() => page.waitForLoadState('networkidle')),
  ])
}
