import { type Page, expect } from '@playwright/test'
import { HATEOASClient, PageNavigationHandler, type NavigationConfig } from '../hateoas'
import { groupOf } from '../hateoas/action-composer'
import { createAuthActions, type AuthData, type AuthProgress } from './auth-actions'
import { createQueueActions, type QueueProgress, type TestArticleData } from './queue-actions'
import type { PasswordResetProgress } from './password-reset-actions'
import type { PageAction } from '../hateoas/navigation-handler.types'

type ActionGroupFactory = (authProgress: AuthProgress) => Map<string, PageAction>

export interface QueueFlowConfig {
  baseURL: string
  testArticles: TestArticleData
  authData: AuthData
  passwordResetProgress?: PasswordResetProgress
  preQueueActionFactories?: ActionGroupFactory[]
  preQueueProgressObjects?: Record<string, boolean>[]
  maxNavigations?: number
}

export async function runQueueFlow(page: Page, config: QueueFlowConfig): Promise<void> {
  const authProgress: AuthProgress = {
    accountCreated: false,
    loggedOut: false,
    loggedIn: false,
  }

  const queueProgress: QueueProgress = {
    allArticlesAdded: false,
    paginationArticlesAdded: false,
    verifiedPage1HasNext: false,
    navigatedToPage2: false,
    verifiedPage2: false,
    navigatedBackToPage1: false,
    verifiedBackOnPage1: false,
    paginationArticlesDeleted: false,
    verifiedNewestFirst: false,
    sortedOldestFirst: false,
    verifiedOldestFirst: false,
    openedFirstArticle: false,
    backFromReader: false,
    verifiedReadStatus: false,
    deletedLastArticle: false,
    checkedReadTab: false,
    checkedUnreadTab: false,
    cleanupDeleted: false,
  }

  const preQueueGroups = (config.preQueueActionFactories ?? []).map(factory => factory(authProgress))

  const allActions = groupOf(
    createAuthActions(config.authData, authProgress, config.passwordResetProgress),
    ...preQueueGroups,
    createQueueActions(authProgress, queueProgress, config.testArticles),
  )

  const allProgressObjects: Record<string, boolean>[] = [
    authProgress,
    ...(config.preQueueProgressObjects ?? []),
    queueProgress,
  ]

  const navigationHandler = new PageNavigationHandler(
    page,
    {
      successDetector: async () =>
        allProgressObjects.every(p => Object.values(p).every(Boolean)),
    },
    allActions,
  )

  const client = new HATEOASClient(page, navigationHandler)
  const navConfig: NavigationConfig = { maxNavigations: config.maxNavigations ?? 75 }

  const startURL = config.baseURL.replace(/\/+$/, '') + '/'
  const result = await client.navigate(startURL, navConfig)

  expect(result.success).toBe(true)
}
