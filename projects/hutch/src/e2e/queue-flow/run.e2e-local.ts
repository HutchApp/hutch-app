import { test, expect } from '@playwright/test'
import { HATEOASClient, PageNavigationHandler, type NavigationConfig } from '../hateoas'
import { groupOf } from '../hateoas/action-composer'
import { createAuthActions, type AuthData, type AuthProgress } from './auth-actions'
import { createQueueActions, LOCAL_TEST_ARTICLES, type QueueProgress } from './queue-actions'

test.describe('Queue management flow (local)', () => {
  test('signup, logout, login, add articles, pagination, sort, read, delete, verify tabs', async ({ page }) => {

    const authData: AuthData = {
      email: 'e2e-test@example.com',
      password: 'test-password-123',
    }

    const authProgress: AuthProgress = {
      accountCreated: false,
      loggedOut: false,
      loggedIn: false,
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

    const allActions = groupOf(
      createAuthActions(authData, authProgress),
      createQueueActions(authProgress, queueProgress, LOCAL_TEST_ARTICLES),
    )

    const navigationHandler = new PageNavigationHandler(
      page,
      {
        successDetector: async () => {
          return Object.values(authProgress).every(Boolean) && Object.values(queueProgress).every(Boolean)
        },
      },
      allActions,
    )

    const client = new HATEOASClient(page, navigationHandler)
    const config: NavigationConfig = { maxNavigations: 65 }

    const result = await client.navigate('http://localhost:3100/', config)

    expect(result.success).toBe(true)
  })
})
