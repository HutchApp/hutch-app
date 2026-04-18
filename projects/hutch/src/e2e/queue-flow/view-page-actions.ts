import { expect } from '@playwright/test'
import type { PageAction } from '../hateoas/navigation-handler.types'
import { clickAndWaitForPageReload, isOnPage } from '../page-interactions'
import type { AuthProgress } from './auth-actions'

export type ViewPageProgress = {
	visitedAnonymously: boolean
}

export function createAnonymousViewPageActions(
	config: { baseUrl: string; testUrl: string },
	progress: ViewPageProgress,
): (authProgress: AuthProgress) => Map<string, PageAction> {
	return (authProgress) => {
		const actions = new Map<string, PageAction>()

		actions.set('anonymous-visit-view-page', {
			isAvailable: async (page) => {
				if (authProgress.accountCreated) return false
				if (progress.visitedAnonymously) return false
				return isOnPage(page, 'page-home')
			},
			execute: async (page) => {
				const viewUrl = `${config.baseUrl}/view/${encodeURIComponent(config.testUrl)}`
				await page.goto(viewUrl, { waitUntil: 'domcontentloaded' })

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
		})

		return actions
	}
}
