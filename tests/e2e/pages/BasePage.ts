/**
 * Base Page Object Model
 * Provides common functionality for all page objects
 */

import { Page, Locator, expect } from '@playwright/test'

export abstract class BasePage {
  readonly page: Page

  constructor(page: Page) {
    this.page = page
  }

  /**
   * Navigate to the base URL
   */
  async goto() {
    await this.page.goto('/')
    await this.page.waitForLoadState('networkidle')
  }

  /**
   * Wait for API response
   */
  async waitForAPI(urlPattern: string | RegExp, options?: { timeout?: number }) {
    return this.page.waitForResponse(
      resp => typeof urlPattern === 'string'
        ? resp.url().includes(urlPattern)
        : urlPattern.test(resp.url()),
      options
    )
  }

  /**
   * Get notification text
   */
  async getNotificationText(): Promise<string | null> {
    const notification = this.page.locator('.notification-content')
    const count = await notification.count()
    if (count === 0) return null
    return notification.first().textContent()
  }

  /**
   * Wait for notification to appear
   */
  async waitForNotification(timeout = 5000): Promise<string> {
    const notification = this.page.locator('.notification-content')
    await notification.waitFor({ state: 'visible', timeout })
    return notification.textContent() || ''
  }

  /**
   * Wait for loading overlay to disappear
   */
  async waitForLoading(timeout = 30000) {
    const loadingOverlay = this.page.locator('.loading-overlay')
    const count = await loadingOverlay.count()
    if (count > 0) {
      await loadingOverlay.waitFor({ state: 'hidden', timeout })
    }
  }

  /**
   * Check if loading is visible
   */
  async isLoading(): Promise<boolean> {
    const loadingOverlay = this.page.locator('.loading-overlay')
    return loadingOverlay.isVisible()
  }

  /**
   * Take screenshot for debugging
   */
  async takeScreenshot(filename: string) {
    await this.page.screenshot({ path: `artifacts/${filename}` })
  }

  /**
   * Wait for modal to appear
   */
  async waitForModal(modalId: string, timeout = 5000) {
    const modal = this.page.locator(`#${modalId}`)
    await modal.waitFor({ state: 'visible', timeout })
    return modal
  }

  /**
   * Close modal by clicking outside or close button
   */
  async closeModal(modalId: string) {
    const modal = this.page.locator(`#${modalId}`)
    const closeBtn = modal.locator('.modal-close, .close-btn')
    const count = await closeBtn.count()
    if (count > 0) {
      await closeBtn.first().click()
    } else {
      // Click outside modal
      await this.page.mouse.click(10, 10)
    }
    await modal.waitFor({ state: 'hidden' })
  }
}