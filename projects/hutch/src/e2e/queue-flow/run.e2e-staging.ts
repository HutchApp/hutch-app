import { test, expect } from '@playwright/test'
import { HATEOASClient, PageNavigationHandler, type NavigationConfig } from '../hateoas'
import { groupOf } from '../hateoas/action-composer'
import { isOnPage } from '../page-interactions'
import { createAuthActions, type AuthData, type AuthProgress } from './auth-actions'
import { createQueueActions, type QueueProgress, type TestArticleData } from './queue-actions'
import type { PageAction } from '../hateoas/navigation-handler.types'

function createStagingCleanupActions(
  authProgress: AuthProgress,
  stagingProgress: { previousArticlesDeleted: boolean },
): Map<string, PageAction> {
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
        // Wait for HTMX to finish swapping — article count decreases
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

test.describe('Queue management flow (staging)', () => {
  test('signup, logout, login, add articles, sort, read, delete, archive, verify tabs', async ({ page, baseURL }) => {
    const authData: AuthData = {
      email: 'e2e-test@example.com',
      password: 'test-password-123',
    }

    const authProgress: AuthProgress = {
      accountCreated: false,
      loggedOut: false,
      loggedIn: false,
    }

    const stagingProgress = {
      previousArticlesDeleted: false,
    }

    const queueProgress: QueueProgress = {
      allArticlesAdded: false,
      verifiedNewestFirst: false,
      sortedOldestFirst: false,
      verifiedOldestFirst: false,
      openedFirstArticle: false,
      backFromReader: false,
      verifiedReadStatus: false,
      deletedLastArticle: false,
      archivedThird: false,
      checkedReadTab: false,
      checkedUnreadTab: false,
      checkedArchivedTab: false,
      cleanupDeleted: false,
    }

    // Lightweight URLs that Lambda can reliably fetch within its 30s
    // timeout. example.com is an IANA-maintained page (~1KB).
    const stagingArticles: TestArticleData = {
      urls: [
        'https://example.com',
        'https://example.com',
        'https://example.com',
        'https://example.com',
      ],
      titles: ['Example Domain', 'Example Domain', 'Example Domain', 'Example Domain'],
    }

    const allActions = groupOf(
      createAuthActions(authData, authProgress),
      createStagingCleanupActions(authProgress, stagingProgress),
      createQueueActions(authProgress, queueProgress, stagingArticles),
    )

    const navigationHandler = new PageNavigationHandler(
      page,
      {
        successDetector: async () => {
          return Object.values(authProgress).every(Boolean)
            && Object.values(stagingProgress).every(Boolean)
            && Object.values(queueProgress).every(Boolean)
        },
      },
      allActions,
    )

    const client = new HATEOASClient(page, navigationHandler)
    const config: NavigationConfig = { maxNavigations: 60 }

    const result = await client.navigate(baseURL!, config)

    expect(result.success).toBe(true)
  })
})
