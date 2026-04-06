import { test } from '@playwright/test'
import { createPasswordResetActions, type PasswordResetProgress } from './password-reset-actions'
import { LOCAL_TEST_ARTICLES } from './queue-actions'
import { runQueueFlow } from './queue-flow'

const BASE_URL = 'http://localhost:3100'

test.describe('Queue management flow (local)', () => {
  test('signup, logout, reset password, login, add articles, pagination, sort, read, delete, verify tabs', async ({ page }) => {

    const authData = {
      email: 'e2e-test@example.com',
      password: 'test-password-123',
    }

    const passwordResetProgress: PasswordResetProgress = {
      navigatedToForgotPassword: false,
      submittedForgotPassword: false,
      navigatedToResetPassword: false,
      submittedResetPassword: false,
      loggedInWithNewPassword: false,
    }

    await runQueueFlow(page, {
      baseURL: BASE_URL,
      testArticles: LOCAL_TEST_ARTICLES,
      authData,
      passwordResetProgress,
      preQueueActionFactories: [
        (authProgress) => createPasswordResetActions(
          { email: authData.email, oldPassword: authData.password, newPassword: 'reset-password-456', baseUrl: BASE_URL },
          authData,
          authProgress,
          passwordResetProgress,
        ),
      ],
      preQueueProgressObjects: [passwordResetProgress],
      maxNavigations: 75,
    })
  })
})
