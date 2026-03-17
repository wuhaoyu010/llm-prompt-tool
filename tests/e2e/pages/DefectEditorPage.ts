/**
 * Defect Editor Page Object Model
 * Handles the defect editor with version dropdown and text areas
 */

import { Page, Locator, expect } from '@playwright/test'
import { BasePage } from './BasePage'

export class DefectEditorPage extends BasePage {
  // Locators
  readonly title: Locator
  readonly versionDropdown: Locator
  readonly defectCnTextarea: Locator
  readonly defectClassTextarea: Locator
  readonly judgmentPointsTextarea: Locator
  readonly exclusionsTextarea: Locator
  readonly saveBtn: Locator

  constructor(page: Page) {
    super(page)
    this.title = page.locator('#defect-title')
    this.versionDropdown = page.locator('#version-dropdown')
    this.defectCnTextarea = page.locator('#editor-defect_cn')
    this.defectClassTextarea = page.locator('#editor-defect_class')
    this.judgmentPointsTextarea = page.locator('#editor-judgment_points')
    this.exclusionsTextarea = page.locator('#editor-exclusions')
    this.saveBtn = page.locator('#save-defect-btn, button:has-text("保存")')
  }

  /**
   * Get current defect title
   */
  async getTitle(): Promise<string> {
    return this.title.textContent() || ''
  }

  /**
   * Select version by value
   */
  async selectVersion(value: string) {
    await this.versionDropdown.selectOption(value)
    await this.waitForLoading()
  }

  /**
   * Get available versions
   */
  async getVersions(): Promise<string[]> {
    const options = this.versionDropdown.locator('option')
    const count = await options.count()
    const versions: string[] = []
    for (let i = 0; i < count; i++) {
      const value = await options.nth(i).getAttribute('value')
      if (value) versions.push(value)
    }
    return versions
  }

  /**
   * Get current version
   */
  async getCurrentVersion(): Promise<string> {
    return this.versionDropdown.inputValue()
  }

  /**
   * Set defect Chinese name
   */
  async setDefectCn(value: string) {
    await this.defectCnTextarea.fill(value)
  }

  /**
   * Get defect Chinese name
   */
  async getDefectCn(): Promise<string> {
    return this.defectCnTextarea.inputValue()
  }

  /**
   * Set defect class
   */
  async setDefectClass(value: string) {
    await this.defectClassTextarea.fill(value)
  }

  /**
   * Get defect class
   */
  async getDefectClass(): Promise<string> {
    return this.defectClassTextarea.inputValue()
  }

  /**
   * Set judgment points
   */
  async setJudgmentPoints(value: string) {
    await this.judgmentPointsTextarea.fill(value)
  }

  /**
   * Get judgment points
   */
  async getJudgmentPoints(): Promise<string> {
    return this.judgmentPointsTextarea.inputValue()
  }

  /**
   * Set exclusions
   */
  async setExclusions(value: string) {
    await this.exclusionsTextarea.fill(value)
  }

  /**
   * Get exclusions
   */
  async getExclusions(): Promise<string> {
    return this.exclusionsTextarea.inputValue()
  }

  /**
   * Save defect
   */
  async save() {
    const [response] = await Promise.all([
      this.waitForAPI('/api/defect'),
      this.saveBtn.click()
    ])
    return response
  }

  /**
   * Check if editor is visible
   */
  async isVisible(): Promise<boolean> {
    return this.title.isVisible()
  }

  /**
   * Check if no defect is selected (shows placeholder)
   */
  async isPlaceholderVisible(): Promise<boolean> {
    const text = await this.getTitle()
    return text.includes('请选择一个缺陷类别')
  }
}