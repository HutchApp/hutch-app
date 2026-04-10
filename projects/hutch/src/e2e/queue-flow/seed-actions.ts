import type { PageAction } from '../hateoas/navigation-handler.types'
import { isOnPage, clickAndWaitForPageReload } from '../page-interactions'
import type { AuthProgress } from './auth-actions'

export type SeedProgress = {
  articlesSeeded: boolean
}

export function createSeedActions(
  seedProgress: SeedProgress,
  seedUrls: string[],
): (authProgress: AuthProgress) => Map<string, PageAction> {
  return (authProgress) => {
    const actions = new Map<string, PageAction>()

    let articlesSeeded = 0

    for (let i = 0; i < seedUrls.length; i++) {
      actions.set(`seed-article-${i + 1}`, {
        isAvailable: async (page) => {
          if (!authProgress.accountCreated) return false
          if (authProgress.loggedOut) return false
          if (articlesSeeded !== i) return false
          return isOnPage(page, 'page-queue')
        },
        execute: async (page) => {
          const input = page.locator('[data-test-form="save-article"] input[name="url"]')
          await input.fill(seedUrls[i])
          await clickAndWaitForPageReload(
            page,
            page.locator('[data-test-form="save-article"] button[type="submit"]'),
          )
          articlesSeeded = i + 1
          if (articlesSeeded === seedUrls.length) {
            seedProgress.articlesSeeded = true
          }
        },
      })
    }

    return actions
  }
}
