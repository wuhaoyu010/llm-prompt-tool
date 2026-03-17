/**
 * Defect List Page Object Model
 * Handles the sidebar with defect list, search, and add functionality
 */

import { Page, Locator, expect } from '@playwright/test'
import { BasePage } from './BasePage'

export class DefectListPage extends BasePage {
  // Locators
  readonly defectList: Locator
  readonly searchInput: Locator
  readonly addDefectBtn: Locator
  readonly defectItems: Locator

  constructor(page: Page) {
    super(page)
    this.defectList = page.locator('#defect-list')
    this.searchInput = page.locator('#defect-search')
    this.addDefectBtn = page.locator('#add-defect-btn')
    this.defectItems = this.defectList.locator('.defect-item')
  }

  /**
   * Search for defects by name
   */
  async search(query: string) {
    await this.searchInput.fill(query)
    await this.page.waitForTimeout(300) // Wait for debounce
    await this.page.waitForLoadState('networkidle')
  }

  /**
   * Clear search input
   */
  async clearSearch() {
    await this.searchInput.clear()
    await this.page.waitForTimeout(300)
    await this.page.waitForLoadState('networkidle')
  }

  /**
   * Get count of visible defects
   */
  async getDefectCount(): Promise<number> {
    return this.defectItems.count()
  }

  /**
   * Get all defect names
   */
  async getDefectNames(): Promise<string[]> {
    const names: string[] = []
    const count = await this.defectItems.count()
    for (let i = 0; i < count; i++) {
      const text = await this.defectItems.nth(i).textContent()
      if (text) names.push(text.trim())
    }
    return names
  }

  /**
   * Select a defect by name
   */
  async selectDefect(name: string) {
    const defect = this.defectItems.filter({ hasText: name })
    await defect.click()
    await this.waitForLoading()
  }

  /**
   * Select a defect by index
   */
  async selectDefectByIndex(index: number) {
    await this.defectItems.nth(index).click()
    await this.waitForLoading()
  }

  /**
   * Add a new defect
   */
  async addNewDefect() {
    await this.addDefectBtn.click()
    await this.waitForLoading()
  }

  /**
   * Check if defect exists in list
   */
  async hasDefect(name: string): Promise<boolean> {
    const defect = this.defectItems.filter({ hasText: name })
    return defect.count() > 0
  }

  /**
   * Delete a defect by name
   */
  async deleteDefect(name: string) {
    const defect = this.defectItems.filter({ hasText: name })
    await defect.hover()

    // Find and click delete button
    const deleteBtn = defect.locator('.delete-btn, [title="删除"]')
    const count = await deleteBtn.count()
    if (count > 0) {
      await deleteBtn.first().click()

      // Handle confirmation dialog if present
      const confirmBtn = this.page.locator('.modal .btn-confirm, .modal button:has-text("确认")')
      const confirmCount = await confirmBtn.count()
      if (confirmCount > 0) {
        await confirmBtn.first().click()
      }

      await this.waitForLoading()
    }
  }

  /**
   * Get selected defect name
   */
  async getSelectedDefectName(): Promise<string | null> {
    const selected = this.defectItems.locator('.selected, .active')
    const count = await selected.count()
    if (count === 0) return null
    return selected.first().textContent()
  }
}