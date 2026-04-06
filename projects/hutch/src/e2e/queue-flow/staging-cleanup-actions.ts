import type { PageAction } from '../hateoas/navigation-handler.types'
import { isOnPage } from '../page-interactions'
import type { AuthProgress } from './auth-actions'

export type StagingCleanupProgress = {
  previousArticlesDeleted: boolean
}

export function createStagingCleanupActions(
  stagingProgress: StagingCleanupProgress,
): (authProgress: AuthProgress) => Map<string, PageAction> {
  return (authProgress) => {
    const actions = new Map<string, PageAction>()

    actions.set('cleanup-previous-articles', {
      isAvailable: async (page) => {
        if (!authProgress.loggedIn) return false
        if (stagingProgress.previousArticlesDeleted) return false
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
        stagingProgress.previousArticlesDeleted = true
      },
    })

    actions.set('mark-cleanup-done', {
      isAvailable: async (page) => {
        if (!authProgress.loggedIn) return false
        if (stagingProgress.previousArticlesDeleted) return false
        if (!(await isOnPage(page, 'page-queue'))) return false
        const count = await page.locator('[data-test-action="delete"]').count()
        return count === 0
      },
      execute: async () => {
        stagingProgress.previousArticlesDeleted = true
      },
    })

    return actions
  }
}
