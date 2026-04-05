import { test, expect } from '@playwright/test'
import { HATEOASClient, PageNavigationHandler, type NavigationConfig } from '../hateoas'
import { groupOf } from '../hateoas/action-composer'
import { createAuthActions, type AuthData, type AuthProgress } from './auth-actions'
import { createPasswordResetActions, type PasswordResetData, type PasswordResetProgress } from './password-reset-actions'
import { createQueueActions, LOCAL_TEST_ARTICLES, type QueueProgress } from './queue-actions'

const BASE_URL = 'http://localhost:3100'

test.describe('Queue management flow (local)', () => {
  test('signup, logout, reset password, login, add articles, pagination, sort, read, delete, verify tabs', async ({ page }) => {

    const authData: AuthData = {
      email: 'e2e-test@example.com',
      password: 'test-password-123',
    }

    const newPassword = 'reset-password-456'

    const passwordResetData: PasswordResetData = {
      email: authData.email,
      oldPassword: authData.password,
      newPassword,
      baseUrl: BASE_URL,
    }

    const authProgress: AuthProgress = {
      accountCreated: false,
      loggedOut: false,
      loggedIn: false,
    }

    const passwordResetProgress: PasswordResetProgress = {
      navigatedToForgotPassword: false,
      submittedForgotPassword: false,
      navigatedToResetPassword: false,
      submittedResetPassword: false,
      loggedInWithNewPassword: false,
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
      createAuthActions(authData, authProgress, passwordResetProgress),
      createPasswordResetActions(passwordResetData, authData, authProgress, passwordResetProgress),
      createQueueActions(authProgress, queueProgress, LOCAL_TEST_ARTICLES),
    )

    const navigationHandler = new PageNavigationHandler(
      page,
      {
        successDetector: async () => {
          return Object.values(authProgress).every(Boolean)
            && Object.values(passwordResetProgress).every(Boolean)
            && Object.values(queueProgress).every(Boolean)
        },
      },
      allActions,
    )

    const client = new HATEOASClient(page, navigationHandler)
    const config: NavigationConfig = { maxNavigations: 75 }

    const result = await client.navigate(`${BASE_URL}/`, config)

    expect(result.success).toBe(true)
  })
})
