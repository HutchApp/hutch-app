import type { PageAction } from '../hateoas/navigation-handler.types'
import { isOnPage } from '../page-interactions'
import type { AuthProgress } from './auth-actions'

export type CleanupProgress = {
  previousArticlesDeleted: boolean
}

export function createCleanupActions(
  cleanupProgress: CleanupProgress,
): (authProgress: AuthProgress) => Map<string, PageAction> {
  return (authProgress) => {
    const actions = new Map<string, PageAction>()

    /* c8 ignore start -- only activates when pre-existing articles are present (staging) */
    actions.set('cleanup-previous-articles', {
      isAvailable: async (page) => {
        if (!authProgress.loggedIn) return false
        if (cleanupProgress.previousArticlesDeleted) return false
        if (!(await isOnPage(page, 'page-queue'))) return false
        const count = await page.locator('[data-test-action="delete"]').count()
        return count > 0
      },
      execute: async (page) => {
        let count = await page.locator('[data-test-action="delete"]').count()
        while (count > 0) {
          const expectedCount = count - 1
          await page.locator('[data-test-action="delete"]').first().click()
          await page.waitForFunction(
            (expected) => document.querySelectorAll('[data-test-article]').length <= expected,
            expectedCount,
            { timeout: 30000 },
          )
          count = await page.locator('[data-test-action="delete"]').count()
        }
        cleanupProgress.previousArticlesDeleted = true
      },
    })
    /* c8 ignore stop */

    actions.set('mark-cleanup-done', {
      isAvailable: async (page) => {
        if (!authProgress.loggedIn) return false
        if (cleanupProgress.previousArticlesDeleted) return false
        if (!(await isOnPage(page, 'page-queue'))) return false
        const count = await page.locator('[data-test-action="delete"]').count()
        return count === 0
      },
      execute: async () => {
        cleanupProgress.previousArticlesDeleted = true
      },
    })

    return actions
  }
}
