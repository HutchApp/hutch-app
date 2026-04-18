import { expect } from '@playwright/test'
import type { PageAction } from '../hateoas/navigation-handler.types'
import type { ViewPageActionKey } from './action-catalog'
import { clickAndWaitForPageReload, isOnPage } from '../page-interactions'
import type { AuthProgress } from './auth-actions'

export type ViewPageProgress = {
	visitedAnonymously: boolean
}

export function createAnonymousViewPageActions(
	config: { baseUrl: string; testUrl: string },
	progress: ViewPageProgress,
): (authProgress: AuthProgress) => Record<ViewPageActionKey, PageAction> {
	return (authProgress) => ({
		'anonymous-visit-view-page': {
			isAvailable: async (page) => {
				if (authProgress.accountCreated) return false
				if (progress.visitedAnonymously) return false
				return isOnPage(page, 'page-home')
			},
			execute: async (page) => {
				await page.goto(`${config.baseUrl}/view`, { waitUntil: 'domcontentloaded' })
				await expect(page.locator('body.page-view-landing')).toHaveCount(1)

				await page.locator('[data-test-view-landing-input]').fill(config.testUrl)
				await clickAndWaitForPageReload(
					page,
					page.locator('[data-test-view-landing-form] button[type="submit"]'),
				)

				await expect(page.locator('body.page-view')).toHaveCount(1)
				await expect(page.locator('[data-test-reader-title]')).toBeVisible()
				await expect(page.locator('[data-test-view-cta-action]')).toBeVisible()

				// Reload the /view/<encoded-url> permalink. First visit primes the
				// global article cache via saveArticleGlobally; refresh then re-reads
				// it through findArticleByUrl. Regression guard for the ZodError that
				// surfaced when the DynamoDB projection omitted `url` while the row
				// schema required it — the first load succeeded (item absent, no
				// parse) but the refresh 500'd (item present, parse failed).
				await page.reload({ waitUntil: 'domcontentloaded' })
				await expect(page.locator('body.page-view')).toHaveCount(1)
				await expect(page.locator('[data-test-reader-title]')).toBeVisible()
				await expect(page.locator('[data-test-view-cta-action]')).toBeVisible()

				// Click Save as anonymous — /save redirects to /login?return=/save?url=...
				// so the regular navigate-to-signup action can pick up from page-login.
				await clickAndWaitForPageReload(
					page,
					page.locator('[data-test-view-cta-action]'),
				)
				await expect(page.locator('body.page-login')).toHaveCount(1)

				progress.visitedAnonymously = true
			},
		},
	})
}
