import type { PageAction } from '../hateoas/navigation-handler.types'
import { isOnPage, clickAndWaitForPageReload } from '../page-interactions'
import type { AuthProgress } from './auth-actions'

export type PasswordResetProgress = {
  navigatedToForgotPassword: boolean
  submittedForgotPassword: boolean
  navigatedToResetPassword: boolean
  submittedResetPassword: boolean
  loggedInWithNewPassword: boolean
}

export type PasswordResetData = {
  email: string
  oldPassword: string
  newPassword: string
  baseUrl: string
}

export function createPasswordResetActions(
  data: PasswordResetData,
  authProgress: AuthProgress,
  resetProgress: PasswordResetProgress,
): Map<string, PageAction> {
  const actions = new Map<string, PageAction>()

  actions.set('navigate-to-forgot-password', {
    isAvailable: async (page) => {
      if (!authProgress.loggedOut) return false
      if (resetProgress.navigatedToForgotPassword) return false
      return isOnPage(page, 'page-home')
    },
    execute: async (page) => {
      await page.locator('[data-test-nav-item="login"]').click()
      await page.waitForSelector('body.page-login')
      await page.locator('a[href="/forgot-password"]').click()
      await page.waitForSelector('body.page-forgot-password')
      resetProgress.navigatedToForgotPassword = true
    },
  })

  actions.set('submit-forgot-password-form', {
    isAvailable: async (page) => {
      if (!resetProgress.navigatedToForgotPassword) return false
      if (resetProgress.submittedForgotPassword) return false
      return isOnPage(page, 'page-forgot-password')
    },
    execute: async (page) => {
      await page.locator('#email').fill(data.email)
      await clickAndWaitForPageReload(
        page,
        page.locator('[data-test-form="forgot-password"] button[type="submit"]'),
      )
      resetProgress.submittedForgotPassword = true
    },
  })

  actions.set('navigate-to-reset-password', {
    isAvailable: async () => {
      if (!resetProgress.submittedForgotPassword) return false
      if (resetProgress.navigatedToResetPassword) return false
      return true
    },
    execute: async (page) => {
      const response = await page.request.get(`${data.baseUrl}/e2e/sent-emails`)
      const emails = await response.json()
      const resetEmail = emails.find((e: { subject: string }) => e.subject.includes('Reset your password'))
      const tokenMatch = resetEmail.html.match(/token=([a-f0-9]+)/)
      const token = tokenMatch[1]

      await page.goto(`${data.baseUrl}/reset-password?token=${token}`)
      await page.waitForSelector('body.page-reset-password')
      resetProgress.navigatedToResetPassword = true
    },
  })

  actions.set('submit-reset-password-form', {
    isAvailable: async (page) => {
      if (!resetProgress.navigatedToResetPassword) return false
      if (resetProgress.submittedResetPassword) return false
      return isOnPage(page, 'page-reset-password')
    },
    execute: async (page) => {
      await page.locator('#password').fill(data.newPassword)
      await page.locator('#confirmPassword').fill(data.newPassword)
      await clickAndWaitForPageReload(
        page,
        page.locator('[data-test-form="reset-password"] button[type="submit"]'),
      )
      resetProgress.submittedResetPassword = true
    },
  })

  actions.set('login-with-new-password', {
    isAvailable: async (page) => {
      if (!resetProgress.submittedResetPassword) return false
      if (resetProgress.loggedInWithNewPassword) return false
      return isOnPage(page, 'page-reset-password')
    },
    execute: async (page) => {
      await page.locator('a[href="/login"]').click()
      await page.waitForSelector('body.page-login')
      await page.locator('#email').fill(data.email)
      await page.locator('#password').fill(data.newPassword)
      await clickAndWaitForPageReload(
        page,
        page.locator('[data-test-form="login"] button[type="submit"]'),
      )
      await page.waitForSelector('body.page-queue')
      resetProgress.loggedInWithNewPassword = true
      authProgress.loggedIn = true
    },
  })

  return actions
}
