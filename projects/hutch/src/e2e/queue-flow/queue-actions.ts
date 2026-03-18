import { expect, type Page } from '@playwright/test'
import type { PageAction } from '../hateoas/navigation-handler.types'
import { isOnPage, clickAndWaitForPageReload } from '../page-interactions'
import { retriable } from '../../retriable'
import type { AuthProgress } from './auth-actions'

export type QueueProgress = {
  allArticlesAdded: boolean
  verifiedNewestFirst: boolean
  sortedOldestFirst: boolean
  verifiedOldestFirst: boolean
  markedFirstAsRead: boolean
  openedFirstArticle: boolean
  backFromReader: boolean
  deletedLastArticle: boolean
  verifiedReadStatus: boolean
  archivedThird: boolean
  checkedReadTab: boolean
  checkedUnreadTab: boolean
  checkedArchivedTab: boolean
  cleanupDeleted: boolean
}

const TEST_URLS = [
  'https://en.wikipedia.org/wiki/Hypertext_Transfer_Protocol',
  'https://en.wikipedia.org/wiki/Web_browser',
  'https://en.wikipedia.org/wiki/URL',
  'https://en.wikipedia.org/wiki/HTML',
]

// Titles extracted by Readability from the Wikipedia pages above
const TEST_TITLES = ['HTTP', 'Web browser', 'URL', 'HTML']

// Newest-first (desc, default): 4, 3, 2, 1
// Oldest-first (asc): 1, 2, 3, 4
const TITLES_NEWEST_FIRST = [...TEST_TITLES].reverse()
const TITLES_OLDEST_FIRST = [...TEST_TITLES]

async function getArticleCount(page: Page): Promise<number> {
  return page.locator('[data-test-article]').count()
}

async function getArticleTitles(page: Page): Promise<string[]> {
  return page.locator('[data-test-article-title]').allTextContents()
}

export function createQueueActions(authProgress: AuthProgress, progress: QueueProgress): Map<string, PageAction> {
  const actions = new Map<string, PageAction>()

  let articlesAdded = 0

  for (let i = 0; i < TEST_URLS.length; i++) {
    actions.set(`save-article-${i + 1}`, {
      isAvailable: async (page) => {
        if (!authProgress.loggedIn) return false
        if (articlesAdded !== i) return false
        const onQueue = await isOnPage(page, 'page-queue')
        if (!onQueue) return false
        const saveForm = page.locator('[data-test-form="save-article"]')
        return saveForm.isVisible().catch(() => false)
      },
      execute: async (page) => {
        const input = page.locator('[data-test-form="save-article"] input[name="url"]')
        await input.fill(TEST_URLS[i])
        await clickAndWaitForPageReload(
          page,
          page.locator('[data-test-form="save-article"] button[type="submit"]'),
        )
        articlesAdded = i + 1
        if (articlesAdded === TEST_URLS.length) {
          progress.allArticlesAdded = true
        }
      },
    })
  }

  actions.set('verify-newest-first-order', {
    isAvailable: async (page) => {
      if (!progress.allArticlesAdded) return false
      if (progress.verifiedNewestFirst) return false
      return isOnPage(page, 'page-queue')
    },
    execute: async (page) => {
      const titles = await retriable(getArticleTitles, {
        maxAttempts: 5,
        retryDelayMs: 3000,
        shouldRetry: (result) => result.length !== TITLES_NEWEST_FIRST.length,
        // c8 ignore: beforeRetry only executes on CI when article parsing is slow
        beforeRetry: /* c8 ignore next */ async (p) => { await p.reload({ waitUntil: 'domcontentloaded' }) },
      })(page)
      expect(titles).toEqual(TITLES_NEWEST_FIRST)
      progress.verifiedNewestFirst = true
    },
  })

  actions.set('sort-oldest-first', {
    isAvailable: async (page) => {
      if (!progress.verifiedNewestFirst) return false
      if (progress.sortedOldestFirst) return false
      return isOnPage(page, 'page-queue')
    },
    execute: async (page) => {
      await clickAndWaitForPageReload(page, page.locator('[data-test-sort]'))
      progress.sortedOldestFirst = true
    },
  })

  actions.set('verify-oldest-first-order', {
    isAvailable: async (page) => {
      if (!progress.sortedOldestFirst) return false
      if (progress.verifiedOldestFirst) return false
      return isOnPage(page, 'page-queue')
    },
    execute: async (page) => {
      const titles = await getArticleTitles(page)
      expect(titles).toEqual(TITLES_OLDEST_FIRST)
      progress.verifiedOldestFirst = true
    },
  })

  actions.set('mark-first-as-read', {
    isAvailable: async (page) => {
      if (!progress.verifiedOldestFirst) return false
      if (progress.markedFirstAsRead) return false
      return isOnPage(page, 'page-queue')
    },
    execute: async (page) => {
      const firstArticle = page.locator('[data-test-article]').first()
      await clickAndWaitForPageReload(page, firstArticle.locator('[data-test-action="mark-read"]'))
      progress.markedFirstAsRead = true
    },
  })

  actions.set('read-first-article', {
    isAvailable: async (page) => {
      if (!progress.markedFirstAsRead) return false
      if (progress.openedFirstArticle) return false
      return isOnPage(page, 'page-queue')
    },
    execute: async (page) => {
      await page.locator('[data-test-article-title]').first().click()
      await page.waitForLoadState('domcontentloaded')
      progress.openedFirstArticle = true
    },
  })

  actions.set('go-back-to-queue', {
    isAvailable: async (page) => {
      if (!progress.openedFirstArticle) return false
      if (progress.backFromReader) return false
      return isOnPage(page, 'page-reader')
    },
    execute: async (page) => {
      await page.goBack()
      await page.waitForLoadState('domcontentloaded')
      progress.backFromReader = true
    },
  })

  actions.set('delete-last-article', {
    isAvailable: async (page) => {
      if (!progress.backFromReader) return false
      if (progress.deletedLastArticle) return false
      return isOnPage(page, 'page-queue')
    },
    execute: async (page) => {
      const deleteButtons = page.locator('[data-test-action="delete"]')
      const count = await deleteButtons.count()
      await clickAndWaitForPageReload(page, deleteButtons.nth(count - 1))
      progress.deletedLastArticle = true
    },
  })

  actions.set('verify-first-is-read', {
    isAvailable: async (page) => {
      if (!progress.deletedLastArticle) return false
      if (progress.verifiedReadStatus) return false
      return isOnPage(page, 'page-queue')
    },
    execute: async (page) => {
      const articleCount = await getArticleCount(page)
      expect(articleCount).toBe(3)

      const firstArticle = page.locator('[data-test-article]').first()
      const hasUnreadClass = await firstArticle.evaluate(
        el => el.classList.contains('queue-article--unread'),
      )
      expect(hasUnreadClass).toBe(false)

      const unreadButton = firstArticle.locator('[data-test-action="mark-unread"]')
      await expect(unreadButton).toBeVisible()

      progress.verifiedReadStatus = true
    },
  })

  actions.set('archive-third-article', {
    isAvailable: async (page) => {
      if (!progress.verifiedReadStatus) return false
      if (progress.archivedThird) return false
      return isOnPage(page, 'page-queue')
    },
    execute: async (page) => {
      const thirdArticle = page.locator('[data-test-article]').nth(2)
      await clickAndWaitForPageReload(page, thirdArticle.locator('[data-test-action="archive"]'))
      progress.archivedThird = true
    },
  })

  actions.set('check-read-tab', {
    isAvailable: async (page) => {
      if (!progress.archivedThird) return false
      if (progress.checkedReadTab) return false
      return isOnPage(page, 'page-queue')
    },
    execute: async (page) => {
      await clickAndWaitForPageReload(page, page.locator('[data-test-filter="read"]'))

      const count = await getArticleCount(page)
      expect(count).toBe(1)

      const titles = await getArticleTitles(page)
      expect(titles).toEqual([TEST_TITLES[0]])

      progress.checkedReadTab = true
    },
  })

  actions.set('check-unread-tab', {
    isAvailable: async (page) => {
      if (!progress.checkedReadTab) return false
      if (progress.checkedUnreadTab) return false
      return isOnPage(page, 'page-queue')
    },
    execute: async (page) => {
      await clickAndWaitForPageReload(page, page.locator('[data-test-filter="unread"]'))

      const count = await getArticleCount(page)
      expect(count).toBe(1)

      const titles = await getArticleTitles(page)
      expect(titles).toEqual([TEST_TITLES[1]])

      progress.checkedUnreadTab = true
    },
  })

  actions.set('check-archived-tab', {
    isAvailable: async (page) => {
      if (!progress.checkedUnreadTab) return false
      if (progress.checkedArchivedTab) return false
      return isOnPage(page, 'page-queue')
    },
    execute: async (page) => {
      await clickAndWaitForPageReload(page, page.locator('[data-test-filter="archived"]'))

      const count = await getArticleCount(page)
      expect(count).toBe(1)

      const titles = await getArticleTitles(page)
      expect(titles).toEqual([TEST_TITLES[2]])

      progress.checkedArchivedTab = true
    },
  })

  actions.set('cleanup-delete-all', {
    isAvailable: async (page) => {
      if (!progress.checkedArchivedTab) return false
      if (progress.cleanupDeleted) return false
      return isOnPage(page, 'page-queue')
    },
    execute: async (page) => {
      await clickAndWaitForPageReload(page, page.locator('[data-test-filter="all"]'))
      let count = await page.locator('[data-test-action="delete"]').count()
      while (count > 0) {
        await clickAndWaitForPageReload(page, page.locator('[data-test-action="delete"]').first())
        count = await page.locator('[data-test-action="delete"]').count()
      }
      progress.cleanupDeleted = true
    },
  })

  return actions
}
