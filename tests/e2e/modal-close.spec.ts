/**
 * Modal Close E2E Tests
 * Tests for modal close functionality especially when service returns 503 error
 */

import { test, expect } from './fixtures'

test.describe('Batch Defect Annotate Modal Close', () => {
  test.beforeEach(async ({ page, defectListPage }) => {
    await defectListPage.goto()
  })

  test('should close modal and backdrop when clicking close button after 503 error', async ({
    page,
    defectListPage
  }) => {
    // Mock the service list API to return 503 (service unavailable)
    await page.route('**/api/trueno3_service_test', async route => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Trueno3 服务未配置或未启用'
        })
      })
    })

    // Open batch defect annotate modal
    const batchBtn = page.locator('#batch-defect-auto-annotate-btn')
    const count = await batchBtn.count()

    if (count > 0) {
      await batchBtn.click()

      // Wait for modal to be visible
      const modal = page.locator('#batch-defect-annotate-modal')
      await modal.waitFor({ state: 'visible', timeout: 5000 })

      // Wait for error message to appear (503 response)
      const errorDiv = page.locator('#batch-defect-error')
      await errorDiv.waitFor({ state: 'visible', timeout: 10000 })

      // Verify backdrop is visible
      const backdrop = page.locator('#modal-backdrop')
      expect(await backdrop.isVisible()).toBe(true)

      // Click close button
      const closeBtn = modal.locator('.modal-close')
      await closeBtn.click()

      // Verify modal is hidden
      await modal.waitFor({ state: 'hidden', timeout: 5000 })
      expect(await modal.isVisible()).toBe(false)

      // BUG: Verify backdrop is also hidden - THIS IS THE BUG
      // The backdrop should be hidden but it might not be
      const backdropVisible = await backdrop.isVisible()

      // Take screenshot for evidence
      await page.screenshot({ path: 'artifacts/modal-close-503-backdrop.png' })

      // This assertion should fail before the fix
      expect(backdropVisible).toBe(false)
    } else {
      test.skip(true, 'Batch defect annotate button not found')
    }
  })

  test('should close modal and backdrop when pressing ESC after 503 error', async ({
    page,
    defectListPage
  }) => {
    // Mock the service list API to return 503 (service unavailable)
    await page.route('**/api/trueno3_service_test', async route => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Trueno3 服务未配置或未启用'
        })
      })
    })

    // Open batch defect annotate modal
    const batchBtn = page.locator('#batch-defect-auto-annotate-btn')
    const count = await batchBtn.count()

    if (count > 0) {
      await batchBtn.click()

      // Wait for modal to be visible
      const modal = page.locator('#batch-defect-annotate-modal')
      await modal.waitFor({ state: 'visible', timeout: 5000 })

      // Wait for error message to appear (503 response)
      const errorDiv = page.locator('#batch-defect-error')
      await errorDiv.waitFor({ state: 'visible', timeout: 10000 })

      // Verify backdrop is visible
      const backdrop = page.locator('#modal-backdrop')
      expect(await backdrop.isVisible()).toBe(true)

      // Press ESC key
      await page.keyboard.press('Escape')

      // BUG: The modal might not close because hideModals() doesn't include batchDefectAnnotateModal
      // Wait a moment for the handler to execute
      await page.waitForTimeout(500)

      // Take screenshot for evidence
      await page.screenshot({ path: 'artifacts/modal-esc-503.png' })

      // Check if modal is hidden
      const modalVisible = await modal.isVisible()
      const backdropVisible = await backdrop.isVisible()

      // Both should be false after ESC
      expect(modalVisible).toBe(false)
      expect(backdropVisible).toBe(false)
    } else {
      test.skip(true, 'Batch defect annotate button not found')
    }
  })

  test('should close modal when clicking cancel button', async ({ page, defectListPage }) => {
    // Mock successful service response with some defects
    await page.route('**/api/trueno3_service_test', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          functions: [
            { funID: 'hand_phone', funDesc: '检测玩手机行为' },
            { funID: 'smoke', funDesc: '检测吸烟行为' }
          ]
        })
      })
    })

    // Open batch defect annotate modal
    const batchBtn = page.locator('#batch-defect-auto-annotate-btn')
    const count = await batchBtn.count()

    if (count > 0) {
      await batchBtn.click()

      // Wait for modal to be visible
      const modal = page.locator('#batch-defect-annotate-modal')
      await modal.waitFor({ state: 'visible', timeout: 5000 })

      // Verify backdrop is visible
      const backdrop = page.locator('#modal-backdrop')
      expect(await backdrop.isVisible()).toBe(true)

      // Click cancel button
      const cancelBtn = modal.locator('.modal-cancel')
      await cancelBtn.click()

      // Verify modal is hidden
      await modal.waitFor({ state: 'hidden', timeout: 5000 })
      expect(await modal.isVisible()).toBe(false)

      // Verify backdrop is also hidden
      expect(await backdrop.isVisible()).toBe(false)
    } else {
      test.skip(true, 'Batch defect annotate button not found')
    }
  })
})

test.describe('Settings Modal Close', () => {
  test.beforeEach(async ({ page, defectListPage }) => {
    await defectListPage.goto()
  })

  test('should close settings modal with ESC key', async ({ page, settingsPage }) => {
    await settingsPage.open()
    expect(await settingsPage.isOpen()).toBe(true)

    // Press ESC
    await page.keyboard.press('Escape')

    // Wait for modal to close
    const modal = page.locator('#settings-modal')
    await modal.waitFor({ state: 'hidden', timeout: 5000 })

    // Verify backdrop is also hidden
    const backdrop = page.locator('#modal-backdrop')
    expect(await backdrop.isVisible()).toBe(false)
  })

  test('should close settings modal when clicking close button', async ({ settingsPage, page }) => {
    await settingsPage.open()
    expect(await settingsPage.isOpen()).toBe(true)

    // Click cancel button (settings modal uses cancel button instead of close button)
    const modal = page.locator('#settings-modal')
    const cancelBtn = modal.locator('#cancel-settings-btn')
    await cancelBtn.click()

    // Verify modal is hidden
    await modal.waitFor({ state: 'hidden', timeout: 5000 })

    // Verify backdrop is also hidden
    const backdrop = page.locator('#modal-backdrop')
    expect(await backdrop.isVisible()).toBe(false)
  })
})

test.describe('Import Defects Modal Close', () => {
  test.beforeEach(async ({ page, defectListPage }) => {
    await defectListPage.goto()
  })

  test('should close import modal with ESC key', async ({ page }) => {
    // Open import modal
    const importBtn = page.locator('#import-defects-btn, button:has-text("导入")')
    const count = await importBtn.count()

    if (count > 0) {
      await importBtn.first().click()

      const modal = page.locator('#import-defects-modal')
      await modal.waitFor({ state: 'visible', timeout: 5000 })

      // Press ESC
      await page.keyboard.press('Escape')

      // Verify modal is hidden
      await modal.waitFor({ state: 'hidden', timeout: 5000 })

      // Verify backdrop is also hidden
      const backdrop = page.locator('#modal-backdrop')
      expect(await backdrop.isVisible()).toBe(false)
    } else {
      test.skip(true, 'Import button not found')
    }
  })
})