/**
 * Defect Management E2E Tests
 * Tests for defect CRUD operations and versioning
 */

import { test, expect } from './fixtures'

test.describe('Defect List', () => {
  test.beforeEach(async ({ defectListPage }) => {
    await defectListPage.goto()
  })

  test('should display defect list on load', async ({ defectListPage }) => {
    const count = await defectListPage.getDefectCount()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('should search defects by name', async ({ defectListPage, page }) => {
    // Get initial count
    const initialCount = await defectListPage.getDefectCount()

    if (initialCount > 0) {
      // Get first defect name
      const names = await defectListPage.getDefectNames()
      const firstName = names[0]

      // Search for it
      await defectListPage.search(firstName)

      // Should find at least one match
      const searchCount = await defectListPage.getDefectCount()
      expect(searchCount).toBeGreaterThanOrEqual(1)

      // Clear search
      await defectListPage.clearSearch()
      const clearedCount = await defectListPage.getDefectCount()
      expect(clearedCount).toBe(initialCount)
    }
  })

  test('should select defect and show editor', async ({
    defectListPage,
    defectEditorPage
  }) => {
    const count = await defectListPage.getDefectCount()
    test.skip(count === 0, 'No defects available')

    // Select first defect
    await defectListPage.selectDefectByIndex(0)

    // Verify editor shows defect title
    const title = await defectEditorPage.getTitle()
    expect(title).not.toContain('请选择一个缺陷类别')
  })

  test('should show add defect button', async ({ defectListPage }) => {
    const isVisible = await defectListPage.addDefectBtn.isVisible()
    expect(isVisible).toBe(true)
  })
})

test.describe('Defect Editor', () => {
  test.beforeEach(async ({ defectListPage }) => {
    await defectListPage.goto()
  })

  test('should show placeholder when no defect selected', async ({
    defectEditorPage
  }) => {
    const isPlaceholder = await defectEditorPage.isPlaceholderVisible()
    expect(isPlaceholder).toBe(true)
  })

  test('should show version dropdown when defect selected', async ({
    defectListPage,
    defectEditorPage
  }) => {
    const count = await defectListPage.getDefectCount()
    test.skip(count === 0, 'No defects available')

    await defectListPage.selectDefectByIndex(0)

    // Check version dropdown
    const versions = await defectEditorPage.getVersions()
    expect(versions.length).toBeGreaterThanOrEqual(1)
  })

  test('should update defect fields', async ({
    defectListPage,
    defectEditorPage,
    page
  }) => {
    const count = await defectListPage.getDefectCount()
    test.skip(count === 0, 'No defects available')

    await defectListPage.selectDefectByIndex(0)

    // Mock save API
    await page.route('**/api/defect/*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 1,
          name: 'test_defect',
          defect_cn: '测试缺陷',
          defect_class: '测试类别',
          judgment_points: '判断要点',
          exclusions: '排除条件'
        })
      })
    })

    // Update fields
    const testValue = `测试值 ${Date.now()}`
    await defectEditorPage.setDefectCn(testValue)

    // Verify value
    const value = await defectEditorPage.getDefectCn()
    expect(value).toBe(testValue)
  })
})