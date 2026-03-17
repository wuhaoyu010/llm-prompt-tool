/**
 * Test Utilities
 * Common helper functions for E2E tests
 */

import { Page, APIRequestContext } from '@playwright/test'

/**
 * Wait for a specific condition to be true
 */
export async function waitForCondition(
  condition: () => Promise<boolean>,
  options: { timeout?: number; interval?: number } = {}
): Promise<void> {
  const { timeout = 30000, interval = 500 } = options
  const startTime = Date.now()

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return
    }
    await new Promise(resolve => setTimeout(resolve, interval))
  }

  throw new Error('Condition not met within timeout')
}

/**
 * Create a test defect via API
 */
export async function createTestDefect(
  request: APIRequestContext,
  data: {
    name: string
    defect_cn: string
    defect_class?: string
    judgment_points?: string
    exclusions?: string
  }
) {
  const response = await request.post('/api/defect', { data })
  return response.json()
}

/**
 * Delete a test defect via API
 */
export async function deleteTestDefect(
  request: APIRequestContext,
  defectId: number
) {
  await request.delete(`/api/defect/${defectId}`)
}

/**
 * Create a test case via API
 */
export async function createTestCase(
  request: APIRequestContext,
  defectId: number,
  imagePath: string
) {
  const formData = new FormData()
  formData.append('file', new Blob([await fetch(imagePath).then(r => r.blob())]), 'test.jpg')
  formData.append('defect_id', defectId.toString())

  const response = await request.post('/api/test_case', {
    multipart: {
      file: await fetch(imagePath).then(r => r.arrayBuffer()),
      defect_id: defectId
    }
  })
  return response.json()
}

/**
 * Delete a test case via API
 */
export async function deleteTestCase(
  request: APIRequestContext,
  testCaseId: number
) {
  await request.delete(`/api/test_case/${testCaseId}`)
}

/**
 * Get Trueno3 configuration via API
 */
export async function getTrueno3Config(request: APIRequestContext) {
  const response = await request.get('/api/trueno3_config')
  return response.json()
}

/**
 * Set Trueno3 configuration via API
 */
export async function setTrueno3Config(
  request: APIRequestContext,
  config: {
    enabled?: boolean
    ssh_host?: string
    ssh_port?: number
    ssh_username?: string
    ssh_password?: string
    service_host?: string
    service_port?: number
    callback_host?: string
    callback_port?: number
  }
) {
  const response = await request.post('/api/trueno3_config', { data: config })
  return response.json()
}

/**
 * Start auto-annotation task via API
 */
export async function startAutoAnnotation(
  request: APIRequestContext,
  defectId: number,
  options: { clear_existing_boxes?: boolean; test_case_ids?: number[] } = {}
) {
  const response = await request.post(`/api/auto_annotate/defect/${defectId}`, {
    data: options
  })
  return response.json()
}

/**
 * Get task status via API
 */
export async function getTaskStatus(
  request: APIRequestContext,
  taskId: number
) {
  const response = await request.get(`/api/auto_annotate/task/${taskId}`)
  return response.json()
}

/**
 * Wait for task to complete
 */
export async function waitForTaskComplete(
  request: APIRequestContext,
  taskId: number,
  options: { timeout?: number; interval?: number } = {}
): Promise<{ status: string; total_boxes_created?: number }> {
  const { timeout = 60000, interval = 2000 } = options
  const startTime = Date.now()

  while (Date.now() - startTime < timeout) {
    const status = await getTaskStatus(request, taskId)

    if (status.status === 'completed') {
      return status
    }

    if (status.status === 'failed') {
      throw new Error(`Task failed: ${status.error_message}`)
    }

    await new Promise(resolve => setTimeout(resolve, interval))
  }

  throw new Error('Task did not complete within timeout')
}

/**
 * Simulate Trueno3 callback
 */
export async function simulateTrueno3Callback(
  request: APIRequestContext,
  requestId: string,
  results: Array<{
    objectId: string
    type: string
    pos: Array<{ areas: Array<{ x: number; y: number }> }>
    conf?: number
  }>
) {
  const response = await request.post('/picAnalyseRetNotify', {
    data: {
      requestId,
      resultsList: results.map(r => ({
        objectId: r.objectId,
        results: [
          {
            type: r.type,
            value: 'detected',
            code: '2000',
            pos: r.pos,
            conf: r.conf || 0.95,
            desc: '检测成功'
          }
        ]
      })),
      desc: 'ok'
    }
  })
  return response.json()
}

/**
 * Clear all test data
 */
export async function clearTestData(request: APIRequestContext) {
  // Get all defects
  const defectsResponse = await request.get('/api/defects')
  const defects = await defectsResponse.json()

  // Delete each defect (cascades to test cases and bounding boxes)
  for (const defect of defects) {
    await deleteTestDefect(request, defect.id)
  }
}

/**
 * Generate a unique test name
 */
export function generateTestName(prefix: string = 'test'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}