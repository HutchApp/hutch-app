import type { PageAction } from '../hateoas/navigation-handler.types'
import type { PasswordResetProgress } from './password-reset-actions'
import { isOnPage, clickAndWaitForPageReload } from '../page-interactions'

export type AuthData = {
  email: string
  password: string
}

export type AuthProgress = {
  accountCreated: boolean
  loggedOut: boolean
  loggedIn: boolean
}

export function createAuthActions(data: AuthData, progress: AuthProgress, passwordResetProgress?: PasswordResetProgress): Map<string, PageAction> {
  const actions = new Map<string, PageAction>()

  actions.set('navigate-to-signup', {
    isAvailable: async (page) => {
      if (progress.accountCreated) return false
      return isOnPage(page, 'page-home')
    },
    execute: async (page) => {
      await page.locator('a[href="/signup"]').first().click()
    },
  })

  actions.set('submit-signup-form', {
    isAvailable: async (page) => {
      if (progress.accountCreated) return false
      return isOnPage(page, 'page-signup')
    },
    execute: async (page) => {
      await page.locator('#email').fill(data.email)
      await page.locator('#password').fill(data.password)
      await page.locator('#confirmPassword').fill(data.password)
      await clickAndWaitForPageReload(
        page,
        page.locator('[data-test-form="signup"] button[type="submit"]'),
      )

      const onQueue = await isOnPage(page, 'page-queue')
      if (onQueue) {
        progress.accountCreated = true
        return
      }

      // Account already exists in persistent storage — navigate to login
      const error = page.locator('[data-test-global-error]')
      if (await error.isVisible()) {
        await page.locator('.auth-card__footer a[href="/login"]').click()
        progress.accountCreated = true
        progress.loggedOut = true
      }
    },
  })

  actions.set('click-logout', {
    isAvailable: async (page) => {
      if (!progress.accountCreated) return false
      if (progress.loggedOut) return false
      return isOnPage(page, 'page-queue')
    },
    execute: async (page) => {
      await clickAndWaitForPageReload(
        page,
        page.locator('[data-test-nav-item="logout"]'),
      )
      await page.waitForSelector('body.page-home')
      progress.loggedOut = true
    },
  })

  actions.set('navigate-to-login', {
    isAvailable: async (page) => {
      if (!progress.loggedOut) return false
      if (progress.loggedIn) return false
      // Wait for password reset to complete before navigating to login
      if (passwordResetProgress && !passwordResetProgress.loggedInWithNewPassword) return false
      return isOnPage(page, 'page-home')
    },
    execute: async (page) => {
      await page.locator('[data-test-nav-item="login"]').click()
    },
  })

  actions.set('submit-login-form', {
    isAvailable: async (page) => {
      if (!progress.loggedOut) return false
      if (progress.loggedIn) return false
      // Wait for password reset to complete before logging in
      if (passwordResetProgress && !passwordResetProgress.loggedInWithNewPassword) return false
      return isOnPage(page, 'page-login')
    },
    execute: async (page) => {
      await page.locator('#email').fill(data.email)
      await page.locator('#password').fill(data.password)
      await clickAndWaitForPageReload(
        page,
        page.locator('[data-test-form="login"] button[type="submit"]'),
      )
      await page.waitForSelector('body.page-queue')
      progress.loggedIn = true
    },
  })

  return actions
}
