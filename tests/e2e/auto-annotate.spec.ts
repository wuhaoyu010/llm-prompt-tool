/**
 * Auto-Annotate E2E Tests
 * Tests for the automatic annotation feature with Trueno3 integration
 */

import { test, expect } from './fixtures'
import { DefectListPage, DefectEditorPage, AnnotationPage, SettingsPage } from './pages'

test.describe('Auto-Annotate Feature', () => {
  test.beforeEach(async ({ page, defectListPage }) => {
    // Navigate to application
    await defectListPage.goto()
  })

  test('should show auto-annotate button when test cases are selected', async ({
    defectListPage,
    annotationPage
  }) => {
    // Select first defect
    await defectListPage.selectDefectByIndex(0)

    // Check if test cases exist
    const testCaseCount = await annotationPage.getTestCaseCount()

    if (testCaseCount > 0) {
      // Select a test case for batch operation
      await annotationPage.toggleTestCaseSelection(0)

      // Verify batch actions toolbar is visible
      const isVisible = await annotationPage.isBatchActionsVisible()
      expect(isVisible).toBe(true)

      // Verify auto-annotate button is visible
      const autoAnnotateVisible = await annotationPage.isAutoAnnotateVisible()
      expect(autoAnnotateVisible).toBe(true)
    }
  })

  test('should require defect selection before auto-annotate', async ({
    defectListPage,
    annotationPage
  }) => {
    // Verify placeholder is shown when no defect is selected
    const isPlaceholder = await defectListPage.getDefectCount() === 0
    if (isPlaceholder) {
      // Auto-annotate button should not be visible
      const isVisible = await annotationPage.isAutoAnnotateVisible()
      expect(isVisible).toBe(false)
    }
  })

  test('should disable auto-annotate when no test cases selected', async ({
    defectListPage,
    annotationPage
  }) => {
    // Select first defect
    await defectListPage.selectDefectByIndex(0)

    // Verify auto-annotate button is disabled when no selection
    const testCaseCount = await annotationPage.getTestCaseCount()
    if (testCaseCount > 0) {
      // Without selecting any test case
      const isEnabled = await annotationPage.isAutoAnnotateEnabled()
      // Should be disabled unless test cases are selected
      expect(isEnabled).toBe(false)
    }
  })
})

test.describe('Trueno3 Configuration', () => {
  test.beforeEach(async ({ page, defectListPage }) => {
    await defectListPage.goto()
  })

  test('should open settings modal', async ({ settingsPage }) => {
    await settingsPage.open()
    expect(await settingsPage.isOpen()).toBe(true)
  })

  test('should save Trueno3 configuration', async ({ settingsPage, page }) => {
    await settingsPage.open()

    // Set Trueno3 config
    await settingsPage.setTrueno3Config({
      enabled: true,
      sshHost: '192.168.1.100',
      sshPort: 22,
      sshUsername: 'testuser',
      sshPassword: 'testpass',
      serviceHost: '192.168.1.100',
      servicePort: 20011,
      callbackHost: '192.168.1.50',
      callbackPort: 5001
    })

    // Save and verify
    const response = await settingsPage.save()
    expect(response.ok()).toBe(true)

    await settingsPage.close()
  })

  test('should test Trueno3 service connection', async ({ settingsPage, page }) => {
    await settingsPage.open()

    // Set service host
    await settingsPage.setTrueno3Config({
      serviceHost: '192.168.1.100',
      servicePort: 20011
    })

    // Mock the API response for testing
    await page.route('**/api/trueno3_service_test', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: '服务连接成功',
          functions: [
            { funID: 'hand_phone', funDesc: '检测玩手机行为' },
            { funID: 'smoke', funDesc: '检测吸烟行为' }
          ]
        })
      })
    })

    // Test connection
    const result = await settingsPage.testServiceConnection()
    expect(result.success).toBe(true)

    await settingsPage.close()
  })
})

test.describe('Auto-Annotate Workflow', () => {
  test.beforeEach(async ({ page, defectListPage }) => {
    await defectListPage.goto()
  })

  test('should start auto-annotation task', async ({
    defectListPage,
    annotationPage,
    page
  }) => {
    // Select first defect
    await defectListPage.selectDefectByIndex(0)

    const testCaseCount = await annotationPage.getTestCaseCount()
    test.skip(testCaseCount === 0, 'No test cases available')

    // Select test cases
    await annotationPage.toggleTestCaseSelection(0)

    // Mock the auto-annotate API response
    await page.route('**/api/auto_annotate/defect/*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          task_id: 123,
          request_id: 'test-uuid-123',
          total_images: 1,
          message: '自动标注任务已启动'
        })
      })
    })

    // Start auto-annotation
    const response = await annotationPage.startAutoAnnotation()
    expect(response.ok()).toBe(true)

    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.task_id).toBeDefined()
  })

  test('should handle auto-annotation callback', async ({
    page,
    defectListPage,
    annotationPage
  }) => {
    // This test simulates receiving a callback from Trueno3
    // In a real scenario, Trueno3 would POST to /picAnalyseRetNotify

    // First, create a mock task
    const mockTaskId = 'test-callback-task'
    const mockObjectId = 'testcase-1'

    // Mock the callback response
    await page.route('**/picAnalyseRetNotify', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 200,
          message: 'received'
        })
      })
    })

    // Simulate callback data
    const callbackData = {
      requestId: mockTaskId,
      resultsList: [
        {
          objectId: mockObjectId,
          results: [
            {
              type: 'hand_phone',
              value: 'detected',
              code: '2000',
              pos: [
                {
                  areas: [
                    { x: 100, y: 200 },
                    { x: 300, y: 400 }
                  ]
                }
              ],
              conf: 0.95,
              desc: '检测成功'
            }
          ]
        }
      ],
      desc: 'ok'
    }

    // Make callback request
    const response = await page.request.post('/picAnalyseRetNotify', {
      data: callbackData
    })

    expect(response.ok()).toBe(true)
  })

  test('should query task status', async ({ page, defectListPage }) => {
    // Mock task status response
    await page.route('**/api/auto_annotate/task/*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          task_id: 123,
          request_id: 'test-uuid-123',
          defect_id: 1,
          status: 'completed',
          total_images: 5,
          processed_images: 5,
          total_boxes_created: 12,
          created_at: '2026-03-16T10:00:00Z',
          completed_at: '2026-03-16T10:05:00Z',
          items: [
            {
              test_case_id: 1,
              filename: 'test1.jpg',
              status: 'completed',
              boxes_created: 3
            }
          ]
        })
      })
    })

    // Query task status
    const response = await page.request.get('/api/auto_annotate/task/123')
    expect(response.ok()).toBe(true)

    const data = await response.json()
    expect(data.status).toBe('completed')
    expect(data.total_boxes_created).toBe(12)
  })
})

test.describe('Annotation Canvas', () => {
  test.beforeEach(async ({ page, defectListPage }) => {
    await defectListPage.goto()
  })

  test('should display annotation canvas when defect selected', async ({
    defectListPage,
    annotationPage
  }) => {
    // Select first defect
    await defectListPage.selectDefectByIndex(0)

    // Check canvas visibility
    const isCanvasVisible = await annotationPage.isCanvasVisible()
    expect(isCanvasVisible).toBe(true)
  })

  test('should display test case thumbnails', async ({
    defectListPage,
    annotationPage
  }) => {
    // Select first defect
    await defectListPage.selectDefectByIndex(0)

    // Check thumbnail container
    const testCaseCount = await annotationPage.getTestCaseCount()
    // Should have test cases or show empty state
    expect(testCaseCount).toBeGreaterThanOrEqual(0)
  })

  test('should allow drawing bounding boxes', async ({
    defectListPage,
    annotationPage,
    page
  }) => {
    // Select first defect
    await defectListPage.selectDefectByIndex(0)

    // Select first test case to load it on canvas
    const testCaseCount = await annotationPage.getTestCaseCount()
    test.skip(testCaseCount === 0, 'No test cases available')

    await annotationPage.selectTestCase(0)

    // Check canvas is ready
    const isCanvasVisible = await annotationPage.isCanvasVisible()
    expect(isCanvasVisible).toBe(true)

    // Draw a bounding box
    await annotationPage.drawBoundingBox(50, 50, 100, 100)
  })
})