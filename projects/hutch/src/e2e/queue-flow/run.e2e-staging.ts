/* c8 ignore start -- staging E2E test, only run in CI */
import assert from 'node:assert'
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
  test('signup, logout, login, add articles, pagination, sort, read, delete, verify tabs', async ({ page, baseURL }) => {
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
      paginationArticlesAdded: false,
      verifiedPage1HasNext: false,
      navigatedToPage2: false,
      verifiedPage2: false,
      navigatedBackToPage1: false,
      verifiedBackOnPage1: false,
      paginationArticlesDeleted: false,
      verifiedNewestFirst: false,
      sortedOldestFirst: false,
      verifiedOldestFirst: false,
      openedFirstArticle: false,
      backFromReader: false,
      verifiedReadStatus: false,
      deletedLastArticle: false,
      checkedReadTab: false,
      checkedUnreadTab: false,
      cleanupDeleted: false,
    }

    // Use the staging app's own privacy page — fetched locally by Lambda
    // (same API Gateway), so no external network dependency or timeout risk.
    // Each URL must be unique because articles are keyed by userId+url.
    // Query params make each URL distinct while fetching the same page.
    const stagingArticles: TestArticleData = {
      urls: [
        `${baseURL}/privacy?v=1`,
        `${baseURL}/privacy?v=2`,
        `${baseURL}/privacy?v=3`,
        `${baseURL}/privacy?v=4`,
      ],
      titles: ['Privacy Policy — Hutch', 'Privacy Policy — Hutch', 'Privacy Policy — Hutch', 'Privacy Policy — Hutch'],
      paginationUrls: Array.from({ length: 17 }, (_, i) => `${baseURL}/privacy?p=${i + 1}`),
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
    const config: NavigationConfig = { maxNavigations: 85 }

    assert(baseURL, "baseURL must be defined — set STAGING_URL env var")
    const result = await client.navigate(baseURL, config)

    expect(result.success).toBe(true)
  })
})
/* c8 ignore stop */
