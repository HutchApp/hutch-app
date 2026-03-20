import type { Page } from '@playwright/test'

export function isOnPage(page: Page, bodyClass: string): Promise<boolean> {
  return page.locator(`body.${bodyClass}`).count().then(count => count > 0).catch(() => false)
}

export async function clickAndWaitForPageReload(page: Page, locator: ReturnType<Page['locator']>): Promise<void> {
  const loadOrHtmxSwap = Promise.race([
    page.waitForEvent('load'),
    page.waitForResponse(resp => resp.request().headers()['hx-request'] === 'true'),
  ])
  await locator.click()
  // HTMX hx-boost submits via XHR and swaps content without a full page
  // navigation. When the server responds with a 303 redirect, the XHR follows
  // it transparently and Playwright may not fire the intermediate response
  // event. Fall back to waiting for all network activity to settle, then
  // wait for HTMX to finish processing (no elements with htmx-request class).
  await Promise.race([
    loadOrHtmxSwap,
    page.waitForLoadState('networkidle').then(() =>
      page.waitForFunction(() => !document.querySelector('.htmx-request'), undefined, { timeout: 5000 }).catch(() => {})
    ),
  ])
}
