import assert from 'node:assert'
import { test } from '@playwright/test'
import { createCleanupActions, type CleanupProgress } from './cleanup-actions'
import { createPasswordResetActions, type PasswordResetProgress } from './password-reset-actions'
import { createSeedActions, type SeedProgress } from './seed-actions'
import { createLocalTestArticles } from './queue-actions'
import { runQueueFlow } from './queue-flow'

assert(process.env.E2E_PORT, "E2E_PORT is required")
const BASE_URL = `http://localhost:${process.env.E2E_PORT}`

test.describe('Queue management flow (local)', () => {
  test('signup, logout, reset password, login, add articles, pagination, sort, read, delete, verify tabs', async ({ page }) => {

    const authData = {
      email: 'e2e-test@example.com',
      password: 'test-password-123',
    }

    const seedProgress: SeedProgress = {
      articlesSeeded: false,
    }

    const cleanupProgress: CleanupProgress = {
      previousArticlesDeleted: false,
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
      testArticles: createLocalTestArticles(BASE_URL),
      authData,
      passwordResetProgress,
      preQueueActionFactories: [
        createSeedActions(seedProgress, [`${BASE_URL}/privacy?seed=1`, `${BASE_URL}/privacy?seed=2`]),
        createCleanupActions(cleanupProgress),
        (authProgress) => createPasswordResetActions(
          { email: authData.email, oldPassword: authData.password, newPassword: 'reset-password-456', baseUrl: BASE_URL },
          authData,
          authProgress,
          passwordResetProgress,
        ),
      ],
      preQueueProgressObjects: [seedProgress, cleanupProgress, passwordResetProgress],
      maxNavigations: 80,
    })
  })
})
