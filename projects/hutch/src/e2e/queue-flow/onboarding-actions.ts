import { expect } from '@playwright/test'
import type { PageAction } from '../hateoas/navigation-handler.types'
import type { AuthProgress } from './auth-actions'

/**
 * 1. These actions test the *save-first-article* detection logic in both
 *    directions: the step flips to complete when the user saves at least one
 *    article, and the onboarding reappears if all articles are subsequently
 *    deleted and the count returns to zero. Other onboarding concerns
 *    (install-extension detection, open-reader-view detection, dismissal
 *    persistence) will be added in future releases as the detection logic for
 *    each lands.
 */
export type OnboardingProgress = {
  savedFirstArticle: boolean
  savedFirstArticleReappeared: boolean
}

export function createOnboardingActions(
  authProgress: AuthProgress,
  progress: OnboardingProgress,
): Map<string, PageAction> {
  const actions = new Map<string, PageAction>()

  actions.set('onboarding-save-first-article', {
    isAvailable: async (page) => {
      if (!authProgress.accountCreated) return false
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
