import { test, expect } from '@playwright/test'
import { HATEOASClient, PageNavigationHandler, type NavigationConfig } from '../hateoas'
import { groupOf } from '../hateoas/action-composer'
import { createAuthActions, type AuthData, type AuthProgress } from './auth-actions'
import { createQueueActions, type QueueProgress } from './queue-actions'

test.describe('Queue management flow (local)', () => {
  test('signup, logout, login, add articles, sort, read, delete, archive, verify tabs', async ({ page }) => {
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
      verifiedNewestFirst: false,
      sortedOldestFirst: false,
      verifiedOldestFirst: false,
      markedFirstAsRead: false,
      openedFirstArticle: false,
      backFromReader: false,
      deletedLastArticle: false,
      verifiedReadStatus: false,
      archivedThird: false,
      checkedReadTab: false,
      checkedUnreadTab: false,
      checkedArchivedTab: false,
    }

    const allActions = groupOf(
      createAuthActions(authData, authProgress),
      createQueueActions(authProgress, queueProgress),
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
    const config: NavigationConfig = { maxNavigations: 35 }

    const result = await client.navigate('http://localhost:3100/', config)

    expect(result.success).toBe(true)
  })
})
