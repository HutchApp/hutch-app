/* c8 ignore start -- staging E2E test, only run in CI */
import assert from 'node:assert'
import { test } from '@playwright/test'
import { createCleanupActions, type CleanupProgress } from './cleanup-actions'
import { createSavePermalinkActions, type SavePermalinkProgress } from './save-permalink-actions'
import type { TestArticleData } from './queue-actions'
import { runQueueFlow } from './queue-flow'

test.describe('Queue management flow (staging)', () => {
  test('signup, logout, login, add articles, pagination, sort, read, delete, verify tabs', async ({ page, baseURL }) => {
    assert(baseURL, "baseURL must be defined — set STAGING_URL env var")

    const cleanupProgress: CleanupProgress = {
      previousArticlesDeleted: false,
    }

    const savePermalinkProgress: SavePermalinkProgress = {
      savedViaPermalink: false,
      deletedPermalinkArticle: false,
    }

    const stagingArticles: TestArticleData = {
      urls: [
        `${baseURL}/privacy?v=1`,
        `${baseURL}/privacy?v=2`,
        `${baseURL}/privacy?v=3`,
        `${baseURL}/privacy?v=4`,
      ],
      titles: ['Privacy Policy — Readplace', 'Privacy Policy — Readplace', 'Privacy Policy — Readplace', 'Privacy Policy — Readplace'],
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
        createCleanupActions(cleanupProgress),
        createSavePermalinkActions(
          { baseUrl: baseURL, testUrl: `${baseURL}/privacy?permalink=1` },
          cleanupProgress,
          savePermalinkProgress,
        ),
      ],
      preQueueProgressObjects: [cleanupProgress, savePermalinkProgress],
      maxNavigations: 90,
    })
  })
})
/* c8 ignore stop */
