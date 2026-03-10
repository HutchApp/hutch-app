import type { PageAction } from '../hateoas/navigation-handler.types'
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

export function createAuthActions(data: AuthData, progress: AuthProgress): Map<string, PageAction> {
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
      await page.waitForSelector('body.page-queue')
      progress.accountCreated = true
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
