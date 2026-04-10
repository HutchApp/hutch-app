import type { PageAction } from '../hateoas/navigation-handler.types'
import { isOnPage, clickAndWaitForPageReload } from '../page-interactions'
import type { AuthProgress } from './auth-actions'

export type CleanupProgress = {
  previousArticlesDeleted: boolean
}

export function createCleanupActions(
  cleanupProgress: CleanupProgress,
): (authProgress: AuthProgress) => Map<string, PageAction> {
  return (authProgress) => {
    const actions = new Map<string, PageAction>()

    actions.set('cleanup-previous-articles', {
      isAvailable: async (page) => {
        if (!authProgress.loggedIn) return false
        if (cleanupProgress.previousArticlesDeleted) return false
        return isOnPage(page, 'page-queue')
      },
      execute: async (page) => {
        let count = await page.locator('[data-test-action="delete"]').count()
        while (count > 0) {
          await clickAndWaitForPageReload(page, page.locator('[data-test-action="delete"]').first())
          count = await page.locator('[data-test-action="delete"]').count()
        }
        cleanupProgress.previousArticlesDeleted = true
      },
    })

    return actions
  }
}
