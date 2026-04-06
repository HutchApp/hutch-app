/* c8 ignore start -- staging E2E test, only run in CI */
import assert from 'node:assert'
import { test } from '@playwright/test'
import { createStagingCleanupActions, type StagingCleanupProgress } from './staging-cleanup-actions'
import type { TestArticleData } from './queue-actions'
import { runQueueFlow } from './queue-flow'

test.describe('Queue management flow (staging)', () => {
  test('signup, logout, login, add articles, pagination, sort, read, delete, verify tabs', async ({ page, baseURL }) => {
    assert(baseURL, "baseURL must be defined — set STAGING_URL env var")

    const stagingProgress: StagingCleanupProgress = {
      previousArticlesDeleted: false,
    }

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

    await runQueueFlow(page, {
      baseURL,
      testArticles: stagingArticles,
      authData: {
        email: 'e2e-test@example.com',
        password: 'test-password-123',
      },
      preQueueActionFactories: [
        createStagingCleanupActions(stagingProgress),
      ],
      preQueueProgressObjects: [stagingProgress],
      maxNavigations: 85,
    })
  })
})
/* c8 ignore stop */
