import { expect } from '@playwright/test'
import { COOKIE_NAME, COOKIE_VALUE } from '@packages/onboarding-extension-signal'
import type { PageAction } from '../hateoas/navigation-handler.types'
import type { OnboardingActionKey } from './action-catalog'
import type { AuthProgress } from './auth-actions'

export type OnboardingProgress = {
  installedExtension: boolean
  savedFirstArticle: boolean
  savedFirstArticleReappeared: boolean
}

export function createOnboardingActions(
  progress: OnboardingProgress,
): (authProgress: AuthProgress) => Record<OnboardingActionKey, PageAction> {
  return (authProgress) => ({
    'onboarding-install-extension-incomplete': {
      isAvailable: async (page) => {
        if (!authProgress.accountCreated) return false
        if (progress.installedExtension) return false
        return (await page.locator('[data-test-onboarding-step="install-extension"]').count()) > 0
      },
      execute: async (page) => {
        const step = page.locator('[data-test-onboarding-step="install-extension"]')
        await expect(step).toHaveAttribute('data-test-onboarding-complete', 'false')

        await page.context().addCookies([{
          name: COOKIE_NAME,
          value: COOKIE_VALUE,
          path: '/',
          domain: new URL(page.url()).hostname,
        }])
        await page.reload({ waitUntil: 'domcontentloaded' })

        // After reload the step is complete. If other steps are still pending the
        // step row renders with data-test-onboarding-complete="true"; if every
        // step is already complete (e.g. when an article was auto-saved via the
        // /view → /save → signup flow) the step list is replaced by the success
        // view. Assert neither branch leaves this step marked incomplete.
        const stillIncomplete = await page.locator(
          '[data-test-onboarding-step="install-extension"][data-test-onboarding-complete="false"]',
        ).count()
        expect(stillIncomplete).toBe(0)

        progress.installedExtension = true
      },
    },

    'onboarding-save-first-article': {
      isAvailable: async (page) => {
        if (!authProgress.accountCreated) return false
        if (!progress.installedExtension) return false
        if (progress.savedFirstArticle) return false
        return (await page.locator('[data-test-onboarding].onboarding--complete').count()) > 0
      },
      execute: async (page) => {
        const container = page.locator('[data-test-onboarding]')
        await expect(container).toHaveClass(/onboarding--complete/)

        const success = page.locator('[data-test-onboarding-success]')
        await expect(success).toBeVisible()

        progress.savedFirstArticle = true
      },
    },

    'onboarding-save-first-article-reappears': {
      isAvailable: async (page) => {
        if (!progress.savedFirstArticle) return false
        if (progress.savedFirstArticleReappeared) return false
        return page.locator('[data-test-onboarding].onboarding--visible').isVisible().catch(() => false)
      },
      execute: async (page) => {
        const container = page.locator('[data-test-onboarding]')
        await expect(container).toHaveClass(/onboarding--visible/)
        await expect(container).toBeVisible()

        const step = page.locator('[data-test-onboarding-step="save-first-article"]')
        await expect(step).toHaveAttribute('data-test-onboarding-complete', 'false')

        progress.savedFirstArticleReappeared = true
      },
    },
  })
}
