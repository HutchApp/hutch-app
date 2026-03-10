import assert from 'node:assert'
import type { PageAction } from './navigation-handler.types'

export function groupOf(...actionGroups: Map<string, PageAction>[]): Map<string, PageAction> {
  const combinedActions = new Map<string, PageAction>()

  for (const actions of actionGroups) {
    for (const [key, action] of actions) {
      assert(!combinedActions.has(key), `Duplicate action key: ${key}`)
      combinedActions.set(key, action)
    }
  }

  return combinedActions
}
