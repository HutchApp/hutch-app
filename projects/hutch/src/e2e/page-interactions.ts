import type { Page } from '@playwright/test'

export function isOnPage(page: Page, bodyClass: string): Promise<boolean> {
  return page.locator(`body.${bodyClass}`).count().then(count => count > 0).catch(() => false)
}

export async function clickAndWaitForPageReload(page: Page, locator: ReturnType<Page['locator']>): Promise<void> {
  const loadOrHtmxSwap = Promise.race([
    page.waitForEvent('load'),
    page.waitForResponse(resp => resp.request().headers()['hx-request'] === 'true'),
  ])
  // Wait for any response after the click — ensures the request triggered
  // by the click has been sent and responded to before checking networkidle.
  // Without this, networkidle resolves immediately if the network is already
  // idle from a previous action (HTMX hasn't started the new POST yet).
  const responseAfterClick = page.waitForResponse(() => true)
  await locator.click()
  await Promise.race([
    loadOrHtmxSwap,
    responseAfterClick.then(() => page.waitForLoadState('networkidle')),
  ])
}
