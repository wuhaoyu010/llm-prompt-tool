import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '../api'
import { useUIStore } from './ui'

interface TaskStatus {
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress?: number
  total_boxes_created?: number
  processed_images?: number
  total_images?: number
  error?: string
}

export const useAutoAnnotateStore = defineStore('autoAnnotate', () => {
  const tasks = ref<Record<string, TaskStatus>>({})
  const pollingIntervals = ref<Record<string, number>>({})

  async function startSingleAnnotate(defectId: number, testCaseId: number, clearExisting = true): Promise<any> {
    const uiStore = useUIStore()

    try {
      const result = await api.post<any>(`/api/auto_annotate/defect/${defectId}`, {
        clear_existing_boxes: clearExisting,
        test_case_ids: [testCaseId]
      })

      if (result.success) {
        uiStore.notify('自动标注任务已启动', 'success', '任务创建成功')
        startPolling(result.task_id)
        return result
      } else {
        uiStore.notify(result.error || '启动失败', 'error', '自动标注失败')
        throw new Error(result.error)
      }
    } catch (error: any) {
      uiStore.notify(`启动失败: ${error.message}`, 'error', '自动标注失败')
      throw error
    }
  }

  async function startBatchAnnotate(defectNames: string[], clearExisting = true): Promise<any> {
    const uiStore = useUIStore()
    uiStore.showLoading('正在启动批量自动标注任务...')

    try {
      const result = await api.post<any>('/api/auto_annotate/batch_defects', {
        defect_names: defectNames,
        clear_existing_boxes: clearExisting
      })

      uiStore.hideLoading()

      if (result.success) {
        uiStore.notify(result.message, 'success', '批量标注已启动')
        if (result.tasks) {
          result.tasks.forEach((task: any) => {
            startPolling(task.task_id)
          })
        }
        return result
      } else {
        uiStore.notify(result.error || '启动失败', 'error', '批量标注失败')
        throw new Error(result.error)
      }
    } catch (error: any) {
      uiStore.hideLoading()
      uiStore.notify(`启动失败: ${error.message}`, 'error', '批量标注失败')
      throw error
    }
  }

  async function startPolling(taskId: string): Promise<void> {
    const uiStore = useUIStore()
    const pollInterval = 2000

    tasks.value[taskId] = { status: 'pending', progress: 0 }

    const poll = async (): Promise<void> => {
      try {
        const status = await api.get<any>(`/api/auto_annotate/task/${taskId}`)

        tasks.value[taskId] = status

        if (status.status === 'completed') {
          uiStore.hideLoading()
          uiStore.notify(
            `自动标注完成！共生成 ${status.total_boxes_created} 个标注框`,
            'success',
            '任务完成'
          )
          stopPolling(taskId)
        } else if (status.status === 'failed') {
          uiStore.hideLoading()
          uiStore.notify(status.error || '标注失败', 'error', '任务失败')
          stopPolling(taskId)
        } else if (status.status === 'processing') {
          uiStore.showLoading(`自动标注中... (${status.processed_images}/${status.total_images})`)
          if (pollingIntervals.value[taskId]) {
            setTimeout(poll, pollInterval)
          }
        }
      } catch (error) {
        console.error('Polling error:', error)
      }
    }

    pollingIntervals.value[taskId] = window.setTimeout(poll, pollInterval)
  }

  function stopPolling(taskId: string): void {
    if (pollingIntervals.value[taskId]) {
      clearTimeout(pollingIntervals.value[taskId])
      delete pollingIntervals.value[taskId]
    }
  }

  function getTaskStatus(taskId: string): TaskStatus | undefined {
    return tasks.value[taskId]
  }

  return {
    tasks,
    startSingleAnnotate,
    startBatchAnnotate,
    startPolling,
    stopPolling,
    getTaskStatus
  }
})
