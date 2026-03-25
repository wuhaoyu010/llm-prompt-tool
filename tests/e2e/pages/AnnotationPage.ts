/**
 * Annotation Page Object Model
 * Handles the annotation canvas, thumbnail strip, tools, and auto-annotation
 */

import { Page, Locator, expect } from '@playwright/test'
import { BasePage } from './BasePage'

export interface BoundingBox {
  normXMin: number
  normYMin: number
  normXMax: number
  normYMax: number
}

export interface TestCase {
  id: number
  filename: string
  hasBoxes: boolean
  isSelected?: boolean
}

export class AnnotationPage extends BasePage {
  // Locators
  readonly canvas: Locator
  readonly thumbnailContainer: Locator
  readonly thumbnails: Locator
  readonly drawBoxBtn: Locator
  readonly undoBtn: Locator
  readonly clearCanvasBtn: Locator
  readonly autoAnnotateBtn: Locator
  readonly batchActionsToolbar: Locator
  readonly selectAllCheckbox: Locator

  constructor(page: Page) {
    super(page)
    this.canvas = page.locator('#annotation-canvas')
    this.thumbnailContainer = page.locator('#thumbnail-container')
    this.thumbnails = this.thumbnailContainer.locator('.thumbnail-item')
    this.drawBoxBtn = page.locator('#draw-box-btn')
    this.undoBtn = page.locator('#undo-btn')
    this.clearCanvasBtn = page.locator('#clear-canvas-btn')
    this.autoAnnotateBtn = page.locator('#batch-auto-annotate-btn')
    this.batchActionsToolbar = page.locator('.batch-actions-toolbar')
    this.selectAllCheckbox = page.locator('#select-all-checkbox')
  }

  /**
   * Get test case count
   */
  async getTestCaseCount(): Promise<number> {
    return this.thumbnails.count()
  }

  /**
   * Get test case by index
   */
  async getTestCase(index: number): Promise<TestCase | null> {
    const thumb = this.thumbnails.nth(index)
    const count = await thumb.count()
    if (count === 0) return null

    const id = await thumb.getAttribute('data-test-case-id') || await thumb.getAttribute('data-id')
    const filename = await thumb.getAttribute('data-filename') || await thumb.locator('.filename').textContent() || ''
    const hasBox = await thumb.locator('.has-boxes-indicator, .box-count').count() > 0
    const isSelected = await thumb.locator('.selected, .checked').count() > 0

    return {
      id: parseInt(id || '0'),
      filename: filename.trim(),
      hasBoxes: hasBox,
      isSelected
    }
  }

  /**
   * Select a test case thumbnail
   */
  async selectTestCase(index: number) {
    await this.thumbnails.nth(index).click()
    await this.waitForLoading()
  }

  /**
   * Select test case by checkbox (for batch operations)
   */
  async selectTestCaseCheckbox(index: number) {
    const thumb = this.thumbnails.nth(index)
    const checkbox = thumb.locator('input[type="checkbox"], .checkbox')
    await checkbox.check()
  }

  /**
   * Toggle test case selection
   */
  async toggleTestCaseSelection(index: number) {
    const thumb = this.thumbnails.nth(index)
    const checkbox = thumb.locator('input[type="checkbox"], .checkbox')
    await checkbox.click()
  }

  /**
   * Select all test cases
   */
  async selectAllTestCases() {
    const count = await this.selectAllCheckbox.count()
    if (count > 0) {
      await this.selectAllCheckbox.check()
    } else {
      // Manually select all
      const thumbCount = await this.thumbnails.count()
      for (let i = 0; i < thumbCount; i++) {
        await this.toggleTestCaseSelection(i)
      }
    }
  }

  /**
   * Get selected test case count
   */
  async getSelectedCount(): Promise<number> {
    const selected = this.thumbnails.locator('.selected, .checked')
    return selected.count()
  }

  /**
   * Check if batch actions toolbar is visible
   */
  async isBatchActionsVisible(): Promise<boolean> {
    const count = await this.batchActionsToolbar.count()
    if (count === 0) return false
    return this.batchActionsToolbar.isVisible()
  }

  /**
   * Click auto-annotate button
   */
  async clickAutoAnnotate() {
    await this.autoAnnotateBtn.click()
  }

  /**
   * Start auto-annotation for selected test cases
   */
  async startAutoAnnotation(clearExisting: boolean = false) {
    // Click auto-annotate button
    const [response] = await Promise.all([
      this.waitForAPI('/api/auto_annotate'),
      this.autoAnnotateBtn.click()
    ])

    return response
  }

  /**
   * Check if auto-annotate button is visible
   */
  async isAutoAnnotateVisible(): Promise<boolean> {
    const count = await this.autoAnnotateBtn.count()
    if (count === 0) return false
    return this.autoAnnotateBtn.isVisible()
  }

  /**
   * Check if auto-annotate button is enabled
   */
  async isAutoAnnotateEnabled(): Promise<boolean> {
    return this.autoAnnotateBtn.isEnabled()
  }

  /**
   * Enable drawing mode
   */
  async enableDrawMode() {
    const isActive = await this.drawBoxBtn.getAttribute('class')
    if (!isActive?.includes('active')) {
      await this.drawBoxBtn.click()
    }
  }

  /**
   * Disable drawing mode
   */
  async disableDrawMode() {
    const isActive = await this.drawBoxBtn.getAttribute('class')
    if (isActive?.includes('active')) {
      await this.drawBoxBtn.click()
    }
  }

  /**
   * Draw a bounding box on canvas
   */
  async drawBoundingBox(x: number, y: number, width: number, height: number) {
    await this.enableDrawMode()

    // Get canvas position
    const box = await this.canvas.boundingBox()
    if (!box) throw new Error('Canvas not visible')

    // Calculate absolute coordinates
    const startX = box.x + x
    const startY = box.y + y
    const endX = startX + width
    const endY = startY + height

    // Draw rectangle
    await this.page.mouse.move(startX, startY)
    await this.page.mouse.down()
    await this.page.mouse.move(endX, endY)
    await this.page.mouse.up()

    await this.disableDrawMode()
  }

  /**
   * Clear all bounding boxes
   */
  async clearCanvas() {
    await this.clearCanvasBtn.click()

    // Handle confirmation if present
    const confirmBtn = this.page.locator('.modal button:has-text("确认"), .modal button:has-text("确定")')
    const count = await confirmBtn.count()
    if (count > 0) {
      await confirmBtn.first().click()
    }
  }

  /**
   * Undo last action
   */
  async undo() {
    await this.undoBtn.click()
  }

  /**
   * Get bounding boxes for current test case
   * Note: This requires API call or checking the UI state
   */
  async getBoundingBoxes(): Promise<BoundingBox[]> {
    // This would typically come from the API
    // For E2E testing, we can check the state via API
    const response = await this.page.request.get('/api/test_cases/' + await this.getCurrentTestCaseId())
    const data = await response.json()
    return data.bounding_boxes || []
  }

  /**
   * Get current test case ID from state
   */
  async getCurrentTestCaseId(): Promise<number | null> {
    return this.page.evaluate(() => {
      // @ts-ignore - accessing global state
      return window.state?.currentTestCaseId || null
    })
  }

  /**
   * Check if canvas is visible
   */
  async isCanvasVisible(): Promise<boolean> {
    const count = await this.canvas.count()
    if (count === 0) return false
    return this.canvas.isVisible()
  }

  /**
   * Upload test case image
   */
  async uploadTestCase(filePath: string) {
    const fileInput = this.page.locator('input[type="file"][accept*="image"]')
    await fileInput.setInputFiles(filePath)
    await this.waitForLoading()
  }

  /**
   * Wait for annotation to complete
   */
  async waitForAnnotationComplete(timeout = 60000) {
    // Poll task status until complete
    const startTime = Date.now()
    while (Date.now() - startTime < timeout) {
      const notification = await this.getNotificationText()
      if (notification?.includes('完成') || notification?.includes('成功')) {
        return true
      }
      if (notification?.includes('失败') || notification?.includes('错误')) {
        throw new Error(`Annotation failed: ${notification}`)
      }
      await this.page.waitForTimeout(1000)
    }
    throw new Error('Annotation timeout')
  }
}