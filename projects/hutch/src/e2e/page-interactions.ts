import type { Page } from '@playwright/test'

export function isOnPage(page: Page, bodyClass: string): Promise<boolean> {
  return page.locator(`body.${bodyClass}`).count().then(count => count > 0).catch(() => false)
}

// Promise.any: the losing waiter's rejection is suppressed, preventing dangling listener warnings
export async function clickAndWaitForPageReload(page: Page, locator: ReturnType<Page['locator']>): Promise<void> {
  const loadOrHtmxSwap = Promise.any([
    page.waitForEvent('load'),
    page.waitForResponse(resp => resp.request().headers()['hx-request'] === 'true'),
  ])
  await locator.click()
  await loadOrHtmxSwap
}
