<template>
  <Teleport to="body">
    <div v-if="uiStore.showBatchAnnotateModal" class="modal-backdrop" @click.self="close">
      <div class="modal">
        <div class="modal-header">
          <h3>🤖 批量缺陷自动标注</h3>
          <span class="material-icons modal-close" @click="close">close</span>
        </div>
        <div class="modal-body">
          <div class="batch-defect-info">
            <p class="hint">从服务获取可自动标注的缺陷列表，选择需要标注的缺陷进行批量处理。</p>
          </div>
          <div class="form-item">
            <label>
              <input type="checkbox" v-model="clearExisting">
              清除现有标注框
            </label>
          </div>
          
          <div v-if="isLoading" class="batch-defect-loading">
            <span class="material-icons spinning">sync</span>
            <span>正在获取服务缺陷列表...</span>
          </div>
          
          <div v-else-if="defects.length > 0" class="batch-defect-list">
            <label 
              v-for="defect in defects" 
              :key="defect.id" 
              class="defect-checkbox"
            >
              <input 
                type="checkbox" 
                :value="defect.id" 
                v-model="selectedDefectIds"
              >
              <span>{{ defect.name }}</span>
              <span class="defect-count">({{ defect.testcase_count || 0 }} 张图片)</span>
            </label>
          </div>
          
          <div v-else-if="error" class="batch-defect-error">
            <span class="material-icons">error_outline</span>
            <span>{{ error }}</span>
          </div>
          
          <div v-if="isRunning" class="batch-progress">
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: progress + '%' }"></div>
            </div>
            <span class="progress-text">{{ statusText }}</span>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="close">取消</button>
          <button 
            class="btn btn-primary" 
            :disabled="selectedDefectIds.length === 0 || isRunning"
            @click="startAnnotation"
          >
            开始标注
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useUIStore } from '../stores/ui'
import { api } from '../api'

const uiStore = useUIStore()

const emit = defineEmits(['completed'])

// ESC键关闭模态框
function handleEscKey(e) {
  if (e.key === 'Escape' && uiStore.showBatchAnnotateModal) {
    close()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleEscKey)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleEscKey)
})

const clearExisting = ref(true)
const isLoading = ref(false)
const isRunning = ref(false)
const defects = ref([])
const selectedDefectIds = ref([])
const error = ref('')
const progress = ref(0)
const statusText = ref('')

async function loadDefects() {
  isLoading.value = true
  error.value = ''

  try {
    const data = await api.get('/api/defects')
    if (Array.isArray(data)) {
      defects.value = data
    } else if (data && Array.isArray(data.defects)) {
      defects.value = data.defects
    } else if (data && Array.isArray(data.data)) {
      defects.value = data.data
    } else {
      defects.value = []
    }
  } catch (err) {
    error.value = '获取缺陷列表失败: ' + err.message
  } finally {
    isLoading.value = false
  }
}

async function startAnnotation() {
  if (selectedDefectIds.value.length === 0) return

  isRunning.value = true
  progress.value = 0
  statusText.value = '准备开始...'

  try {
    const selectedDefects = defects.value.filter(d => selectedDefectIds.value.includes(d.id))
    const defectNames = selectedDefects.map(d => d.name)

    const result = await api.post('/api/auto_annotate/batch_defects', {
      defect_names: defectNames,
      clear_existing_boxes: clearExisting.value
    })

    if (result && result.tasks && result.tasks.length > 0) {
      await pollProgress(result.tasks[0].task_id)
    } else if (result && result.task_id) {
      await pollProgress(result.task_id)
    } else {
      progress.value = 100
      statusText.value = '标注任务已启动'
      uiStore.notify('批量标注已启动', 'success', '成功')
      close()
    }
  } catch (err) {
    uiStore.notify('启动批量标注失败: ' + err.message, 'error', '错误')
    isRunning.value = false
  }
}

async function pollProgress(taskId) {
  const poll = async () => {
    try {
      const status = await api.get(`/api/auto_annotate/task/${taskId}`)
      progress.value = status.progress || 0
      statusText.value = status.message || `处理中... ${progress.value}%`

      if (status.status === 'processing' || status.status === 'pending') {
        setTimeout(poll, 2000)
      } else if (status.status === 'completed') {
        progress.value = 100
        statusText.value = '标注完成'
        uiStore.notify('批量标注完成', 'success', '成功')
        emit('completed')
        close()
      } else if (status.status === 'failed') {
        uiStore.notify('批量标注失败: ' + (status.error || '未知错误'), 'error', '错误')
        isRunning.value = false
      } else {
        isRunning.value = false
      }
    } catch (err) {
      console.error('Poll error:', err)
      isRunning.value = false
    }
  }

  await poll()
}

function close() {
  selectedDefectIds.value = []
  isRunning.value = false
  progress.value = 0
  uiStore.closeBatchAnnotateModal()
}

watch(() => uiStore.showBatchAnnotateModal, (show) => {
  if (show) {
    loadDefects()
  }
})

onMounted(() => {
  if (uiStore.showBatchAnnotateModal) {
    loadDefects()
  }
})
</script>

<style scoped>
.batch-defect-info {
  margin-bottom: 16px;
}

.hint {
  color: var(--text-secondary);
  font-size: 14px;
}

.form-item {
  margin-bottom: 16px;
}

.form-item label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.batch-defect-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 40px;
  color: var(--text-secondary);
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.batch-defect-list {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  padding: 12px;
}

.defect-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
}

.defect-checkbox:hover {
  background: var(--hover-bg);
}

.defect-count {
  color: var(--text-muted);
  font-size: 12px;
  margin-left: auto;
}

.batch-defect-error {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px;
  background: rgba(239, 68, 68, 0.1);
  border-radius: 8px;
  color: var(--error-color);
}

.batch-progress {
  margin-top: 16px;
}

.progress-bar {
  height: 8px;
  background: var(--card-bg);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 8px;
}

.progress-fill {
  height: 100%;
  background: var(--primary-gradient);
  transition: width 0.3s;
}

.progress-text {
  font-size: 14px;
  color: var(--text-secondary);
}
</style>
