import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface Notification {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  title?: string
  duration?: number
}

export interface ConfirmDialog {
  title: string
  message: string
  icon?: 'warning' | 'info' | 'danger'
  onConfirm: () => void
  onCancel?: () => void
}

export const useUIStore = defineStore('ui', () => {
  const theme = ref<'light' | 'dark'>(
    (localStorage.getItem('theme') as 'light' | 'dark') || 'dark'
  )
  const isLoading = ref(false)
  const loadingMessage = ref('')
  const notifications = ref<Notification[]>([])
  const showSettingsModal = ref(false)
  const showGlobalTemplateModal = ref(false)
  const showRegressionModal = ref(false)
  const showRegressionTestModal = ref(false)
  const showBatchImportModal = ref(false)
  const showBatchAnnotateModal = ref(false)
  const showImportDefectsModal = ref(false)
  const confirmDialog = ref<ConfirmDialog | null>(null)

  function toggleTheme(): void {
    theme.value = theme.value === 'light' ? 'dark' : 'light'
    localStorage.setItem('theme', theme.value)
    document.documentElement.setAttribute('data-theme', theme.value)
  }

  function setTheme(newTheme: 'light' | 'dark'): void {
    theme.value = newTheme
    localStorage.setItem('theme', theme.value)
    document.documentElement.setAttribute('data-theme', theme.value)
  }

  function showLoading(message = '加载中...'): void {
    isLoading.value = true
    loadingMessage.value = message
  }

  function hideLoading(): void {
    isLoading.value = false
    loadingMessage.value = ''
  }

  function notify(
    message: string,
    type: Notification['type'] = 'info',
    title?: string,
    duration = 3000
  ): void {
    const id = `notification_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    const notification: Notification = { id, message, type, title, duration }
    notifications.value.push(notification)

    if (duration > 0) {
      setTimeout(() => {
        removeNotification(id)
      }, duration)
    }
  }

  function removeNotification(id: string): void {
    const index = notifications.value.findIndex(n => n.id === id)
    if (index > -1) {
      notifications.value.splice(index, 1)
    }
  }

  function openSettingsModal(): void {
    showSettingsModal.value = true
  }

  function closeSettingsModal(): void {
    showSettingsModal.value = false
  }

  function openGlobalTemplateModal(): void {
    showGlobalTemplateModal.value = true
  }

  function closeGlobalTemplateModal(): void {
    showGlobalTemplateModal.value = false
  }

  function openRegressionTestModal(): void {
    showRegressionTestModal.value = true
  }

  function closeRegressionTestModal(): void {
    showRegressionTestModal.value = false
  }

  function openBatchImportModal(): void {
    showBatchImportModal.value = true
  }

  function closeBatchImportModal(): void {
    showBatchImportModal.value = false
  }

  function openBatchAnnotateModal(): void {
    showBatchAnnotateModal.value = true
  }

  function closeBatchAnnotateModal(): void {
    showBatchAnnotateModal.value = false
  }

  function openImportDefectsModal(): void {
    showImportDefectsModal.value = true
  }

  function closeImportDefectsModal(): void {
    showImportDefectsModal.value = false
  }

  function showConfirm(options: ConfirmDialog): void {
    confirmDialog.value = { ...options }
  }

  function hideConfirm(): void {
    confirmDialog.value = null
  }

  return {
    theme,
    isLoading,
    loadingMessage,
    notifications,
    showSettingsModal,
    showGlobalTemplateModal,
    showRegressionModal,
    showRegressionTestModal,
    showBatchImportModal,
    showBatchAnnotateModal,
    showImportDefectsModal,
    confirmDialog,
    toggleTheme,
    setTheme,
    showLoading,
    hideLoading,
    notify,
    removeNotification,
    openSettingsModal,
    closeSettingsModal,
    openGlobalTemplateModal,
    closeGlobalTemplateModal,
    openRegressionTestModal,
    closeRegressionTestModal,
    openBatchImportModal,
    closeBatchImportModal,
    openBatchAnnotateModal,
    closeBatchAnnotateModal,
    openImportDefectsModal,
    closeImportDefectsModal,
    showConfirm,
    hideConfirm
  }
})
