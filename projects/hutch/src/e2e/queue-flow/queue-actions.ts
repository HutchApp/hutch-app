import assert from 'node:assert/strict'
import { expect, type Page } from '@playwright/test'
import type { PageAction } from '../hateoas/navigation-handler.types'
import { isOnPage, clickAndWaitForPageReload } from '../page-interactions'
import { retriable } from '../../retriable'
import type { AuthProgress } from './auth-actions'

export type QueueProgress = {
  allArticlesAdded: boolean
  paginationArticlesAdded: boolean
  verifiedPage1HasNext: boolean
  navigatedToPage2: boolean
  verifiedPage2: boolean
  navigatedBackToPage1: boolean
  verifiedBackOnPage1: boolean
  paginationArticlesDeleted: boolean
  verifiedNewestFirst: boolean
  sortedOldestFirst: boolean
  verifiedOldestFirst: boolean
  openedFirstArticle: boolean
  backFromReader: boolean
  verifiedReadStatus: boolean
  deletedLastArticle: boolean
  archivedThird: boolean
  checkedReadTab: boolean
  checkedUnreadTab: boolean
  checkedArchivedTab: boolean
  cleanupDeleted: boolean
}

export const LOCAL_TEST_ARTICLES: TestArticleData = {
  urls: [
    'https://en.wikipedia.org/wiki/Hypertext_Transfer_Protocol',
    'https://en.wikipedia.org/wiki/Web_browser',
    'https://en.wikipedia.org/wiki/URL',
    'https://en.wikipedia.org/wiki/HTML',
  ],
  titles: ['HTTP', 'Web browser', 'URL', 'HTML'],
  paginationUrls: Array.from({ length: 17 }, (_, i) => `http://localhost:3100/privacy?p=${i + 1}`),
}

export type TestArticleData = {
  urls: string[]
  titles: string[]
  paginationUrls: string[]
}

async function getArticleCount(page: Page): Promise<number> {
  return page.locator('[data-test-article]').count()
}

async function getArticleTitles(page: Page): Promise<string[]> {
  return page.locator('[data-test-article-title]').allTextContents()
}

export function createQueueActions(authProgress: AuthProgress, progress: QueueProgress, testData: TestArticleData): Map<string, PageAction> {
  const TEST_URLS = testData.urls
  const TEST_TITLES = testData.titles
  const TITLES_NEWEST_FIRST = [...TEST_TITLES].reverse()
  const TITLES_OLDEST_FIRST = [...TEST_TITLES]

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

  let paginationArticlesAdded = 0

  for (let i = 0; i < testData.paginationUrls.length; i++) {
    actions.set(`save-pagination-article-${i + 1}`, {
      isAvailable: async (page) => {
        if (!progress.allArticlesAdded) return false
        if (paginationArticlesAdded !== i) return false
        const onQueue = await isOnPage(page, 'page-queue')
        if (!onQueue) return false
        const saveForm = page.locator('[data-test-form="save-article"]')
        return saveForm.isVisible().catch(() => false)
      },
      execute: async (page) => {
        const input = page.locator('[data-test-form="save-article"] input[name="url"]')
        await input.fill(testData.paginationUrls[i])
        await clickAndWaitForPageReload(
          page,
          page.locator('[data-test-form="save-article"] button[type="submit"]'),
        )
        paginationArticlesAdded = i + 1
        if (paginationArticlesAdded === testData.paginationUrls.length) {
          progress.paginationArticlesAdded = true
        }
      },
    })
  }

  actions.set('verify-page1-has-next', {
    isAvailable: async (page) => {
      if (!progress.paginationArticlesAdded) return false
      if (progress.verifiedPage1HasNext) return false
      return isOnPage(page, 'page-queue')
    },
    execute: async (page) => {
      const pagination = page.locator('[data-test-pagination]')
      await expect(pagination).toBeVisible()

      const info = page.locator('[data-test-pagination-info]')
      const infoText = await info.textContent()
      assert.ok(infoText?.includes('Page 1'), `Expected page info to include "Page 1", got "${infoText}"`)

      const nextLink = page.locator('[data-test-pagination-next]')
      await expect(nextLink).toBeVisible()

      const articleCount = await getArticleCount(page)
      assert.equal(articleCount, 20, 'Page 1 should show 20 articles')

      progress.verifiedPage1HasNext = true
    },
  })

  actions.set('navigate-to-page2', {
    isAvailable: async (page) => {
      if (!progress.verifiedPage1HasNext) return false
      if (progress.navigatedToPage2) return false
      return isOnPage(page, 'page-queue')
    },
    execute: async (page) => {
      await clickAndWaitForPageReload(page, page.locator('[data-test-pagination-next]'))
      progress.navigatedToPage2 = true
    },
  })

  actions.set('verify-page2', {
    isAvailable: async (page) => {
      if (!progress.navigatedToPage2) return false
      if (progress.verifiedPage2) return false
      return isOnPage(page, 'page-queue')
    },
    execute: async (page) => {
      const info = page.locator('[data-test-pagination-info]')
      const infoText = await info.textContent()
      assert.ok(infoText?.includes('Page 2'), `Expected page info to include "Page 2", got "${infoText}"`)

      const prevLink = page.locator('[data-test-pagination-prev]')
      await expect(prevLink).toBeVisible()

      const articleCount = await getArticleCount(page)
      assert.equal(articleCount, 1, 'Page 2 should show exactly 1 article (21 total, 20 per page)')

      progress.verifiedPage2 = true
    },
  })

  actions.set('navigate-back-to-page1', {
    isAvailable: async (page) => {
      if (!progress.verifiedPage2) return false
      if (progress.navigatedBackToPage1) return false
      return isOnPage(page, 'page-queue')
    },
    execute: async (page) => {
      await clickAndWaitForPageReload(page, page.locator('[data-test-pagination-prev]'))
      progress.navigatedBackToPage1 = true
    },
  })

  actions.set('verify-back-on-page1', {
    isAvailable: async (page) => {
      if (!progress.navigatedBackToPage1) return false
      if (progress.verifiedBackOnPage1) return false
      return isOnPage(page, 'page-queue')
    },
    execute: async (page) => {
      const info = page.locator('[data-test-pagination-info]')
      const infoText = await info.textContent()
      assert.ok(infoText?.includes('Page 1'), `Expected page info to include "Page 1", got "${infoText}"`)

      const articleCount = await getArticleCount(page)
      assert.equal(articleCount, 20, 'Page 1 should show 20 articles after navigating back')

      progress.verifiedBackOnPage1 = true
    },
  })

  actions.set('delete-pagination-articles', {
    isAvailable: async (page) => {
      if (!progress.verifiedBackOnPage1) return false
      if (progress.paginationArticlesDeleted) return false
      return isOnPage(page, 'page-queue')
    },
    execute: async (page) => {
      const targetCount = TEST_URLS.length
      const countLocator = page.locator('[data-test-article-count]')
      await expect(countLocator).toBeVisible()
      let totalText = await countLocator.textContent()
      assert.ok(totalText, 'article count element should have text content')
      let total = parseInt(totalText, 10)

      while (total > targetCount) {
        await clickAndWaitForPageReload(page, page.locator('[data-test-action="delete"]').first())
        await expect(countLocator).toBeVisible()
        totalText = await countLocator.textContent()
        assert.ok(totalText, 'article count element should have text content')
        total = parseInt(totalText, 10)
      }

      progress.paginationArticlesDeleted = true
    },
  })

  actions.set('verify-newest-first-order', {
    isAvailable: async (page) => {
      if (!progress.paginationArticlesDeleted) return false
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

  actions.set('read-first-article', {
    isAvailable: async (page) => {
      if (!progress.verifiedOldestFirst) return false
      if (progress.openedFirstArticle) return false
      return isOnPage(page, 'page-queue')
    },
    execute: async (page) => {
      const firstArticle = page.locator('[data-test-article]').first()
      const hasUnreadClass = await firstArticle.evaluate(
        el => el.classList.contains('queue-article--unread'),
      )
      expect(hasUnreadClass).toBe(true)

      await page.locator('[data-test-article-title]').first().click()
      await page.waitForLoadState('domcontentloaded')

      const onReader = await isOnPage(page, 'page-reader')
      expect(onReader).toBe(true)

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
      await page.goto('/queue?order=asc', { waitUntil: 'domcontentloaded' })
      progress.backFromReader = true
    },
  })

  actions.set('verify-first-is-read', {
    isAvailable: async (page) => {
      if (!progress.backFromReader) return false
      if (progress.verifiedReadStatus) return false
      return isOnPage(page, 'page-queue')
    },
    execute: async (page) => {
      const articleCount = await getArticleCount(page)
      expect(articleCount).toBe(4)

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

  actions.set('delete-last-article', {
    isAvailable: async (page) => {
      if (!progress.verifiedReadStatus) return false
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
