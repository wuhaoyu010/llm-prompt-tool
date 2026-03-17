/**
 * Test fixtures for E2E testing
 */

import { test as base, Page } from '@playwright/test'
import {
  DefectListPage,
  DefectEditorPage,
  AnnotationPage,
  SettingsPage
} from './pages'

// Define typed fixtures
type AppFixtures = {
  defectListPage: DefectListPage
  defectEditorPage: DefectEditorPage
  annotationPage: AnnotationPage
  settingsPage: SettingsPage
}

// Extend base test with page objects
export const test = base.extend<AppFixtures>({
  defectListPage: async ({ page }, use) => {
    await use(new DefectListPage(page))
  },
  defectEditorPage: async ({ page }, use) => {
    await use(new DefectEditorPage(page))
  },
  annotationPage: async ({ page }, use) => {
    await use(new AnnotationPage(page))
  },
  settingsPage: async ({ page }, use) => {
    await use(new SettingsPage(page))
  }
})

export { expect } from '@playwright/test'