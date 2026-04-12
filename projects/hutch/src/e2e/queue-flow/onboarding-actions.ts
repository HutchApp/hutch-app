import { expect } from '@playwright/test'
import { COOKIE_NAME, COOKIE_VALUE } from '@packages/onboarding-extension-signal'
import type { PageAction } from '../hateoas/navigation-handler.types'
import type { AuthProgress } from './auth-actions'

export type OnboardingProgress = {
  installedExtension: boolean
  savedFirstArticle: boolean
  savedFirstArticleReappeared: boolean
}

export function createOnboardingActions(
  authProgress: AuthProgress,
  progress: OnboardingProgress,
): Map<string, PageAction> {
  const actions = new Map<string, PageAction>()

  actions.set('onboarding-install-extension-incomplete', {
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

      const updatedStep = page.locator('[data-test-onboarding-step="install-extension"]')
      await expect(updatedStep).toHaveAttribute('data-test-onboarding-complete', 'true')

      progress.installedExtension = true
    },
  })

  actions.set('onboarding-save-first-article', {
    isAvailable: async (page) => {
      if (!authProgress.accountCreated) return false
      if (!progress.installedExtension) return false
      if (progress.savedFirstArticle) return false
      return (await page.locator('[data-test-onboarding].onboarding--hidden').count()) > 0
    },
    execute: async (page) => {
      const container = page.locator('[data-test-onboarding]')
      await expect(container).toHaveClass(/onboarding--hidden/)
      await expect(container).toBeHidden()

      const step = page.locator('[data-test-onboarding-step="save-first-article"]')
      await expect(step).toHaveAttribute('data-test-onboarding-complete', 'true')

      progress.savedFirstArticle = true
    },
  })

  actions.set('onboarding-save-first-article-reappears', {
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
  })

  return actions
}
