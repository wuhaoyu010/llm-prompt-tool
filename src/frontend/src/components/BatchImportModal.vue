<template>
  <div v-if="uiStore.showBatchImportModal" class="modal" @click.self="close">
    <div class="modal-content modal-lg">
      <div class="modal-header">
        <h3>📥 批量导入图片</h3>
        <span class="material-icons modal-close" @click="close">close</span>
      </div>
      <div class="modal-body">
        <div 
          class="batch-import-area"
          :class="{ 'drag-over': isDragOver }"
          @dragover.prevent="isDragOver = true"
          @dragleave.prevent="isDragOver = false"
          @drop.prevent="handleDrop"
          @click="triggerFileInput"
        >
          <span class="material-icons">add_photo_alternate</span>
          <p>拖拽图片或文件夹到此处</p>
          <p class="hint-text">支持多选图片文件</p>
          <p class="hint-text warning">⚠️ 导入后需要在画布上绘制标注框，标注会自动保存</p>
          <input 
            ref="fileInput"
            type="file" 
            accept="image/*" 
            multiple 
            hidden
            @change="handleFileSelect"
          >
          <div class="import-buttons">
            <button class="btn btn-secondary" @click.stop="selectFiles">选择文件</button>
            <button class="btn btn-secondary" @click.stop="selectFolder">选择文件夹</button>
          </div>
        </div>
        
        <div v-if="selectedFiles.length > 0" class="batch-import-preview">
          <div class="preview-header">
            <span>已选择 <strong>{{ selectedFiles.length }}</strong> 张图片</span>
            <button class="btn btn-secondary btn-sm" @click="clearFiles">清空</button>
          </div>
          <div class="preview-grid">
            <div 
              v-for="(file, index) in previewFiles" 
              :key="index" 
              class="preview-item"
            >
              <img :src="file.preview" :alt="file.name">
              <span class="preview-name">{{ file.name }}</span>
            </div>
          </div>
        </div>
        
        <div class="batch-import-options">
          <div class="form-item">
            <label>默认类型</label>
            <div class="sample-type-selector">
              <label class="sample-type-label">
                <input type="radio" v-model="sampleType" value="positive">
                <span class="sample-type-text positive">✓ 正例</span>
              </label>
              <label class="sample-type-label">
                <input type="radio" v-model="sampleType" value="negative">
                <span class="sample-type-text negative">✗ 反例</span>
              </label>
            </div>
          </div>
        </div>
        
        <div v-if="isUploading" class="batch-import-progress">
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: uploadProgress + '%' }"></div>
          </div>
          <span>{{ uploadStatus }}</span>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" @click="close">取消</button>
        <button 
          class="btn btn-primary" 
          :disabled="selectedFiles.length === 0 || isUploading"
          @click="executeImport"
        >
          开始导入
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useUIStore } from '../stores/ui'
import { useDefectStore } from '../stores/defect'
import { axiosInstance } from '../api/axios'

const uiStore = useUIStore()
const defectStore = useDefectStore()

// ESC键关闭模态框
function handleEscKey(e) {
  if (e.key === 'Escape' && uiStore.showBatchImportModal) {
    close()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleEscKey)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleEscKey)
})

const fileInput = ref(null)
const isDragOver = ref(false)
const selectedFiles = ref([])
const sampleType = ref('positive')
const isUploading = ref(false)
const uploadProgress = ref(0)
const uploadStatus = ref('')

const previewFiles = computed(() => {
  return selectedFiles.value.slice(0, 20).map(file => ({
    name: file.name,
    preview: URL.createObjectURL(file)
  }))
})

function triggerFileInput() {
  fileInput.value?.click()
}

function selectFiles() {
  if (fileInput.value) {
    fileInput.value.removeAttribute('webkitdirectory')
    fileInput.value.removeAttribute('directory')
    fileInput.value.click()
  }
}

function selectFolder() {
  if (fileInput.value) {
    fileInput.value.setAttribute('webkitdirectory', '')
    fileInput.value.setAttribute('directory', '')
    fileInput.value.click()
  }
}

function handleFileSelect(e) {
  const files = Array.from(e.target.files).filter(f => f.type.startsWith('image/'))
  selectedFiles.value = [...selectedFiles.value, ...files]
}

function handleDrop(e) {
  isDragOver.value = false
  const items = e.dataTransfer.items
  const files = []
  
  for (const item of items) {
    if (item.kind === 'file') {
      const file = item.getAsFile()
      if (file && file.type.startsWith('image/')) {
        files.push(file)
      }
    }
  }
  
  selectedFiles.value = [...selectedFiles.value, ...files]
}

function clearFiles() {
  selectedFiles.value = []
}

async function executeImport() {
  if (!defectStore.currentDefect?.id) {
    uiStore.notify('请先选择一个缺陷类别', 'error', '错误')
    return
  }

  isUploading.value = true
  uploadProgress.value = 0
  uploadStatus.value = '准备上传...'

  const defectId = defectStore.currentDefect.id
  const total = selectedFiles.value.length
  let uploaded = 0

  try {
    for (const file of selectedFiles.value) {
      const formData = new FormData()
      formData.append('files', file)
      formData.append('is_positive', sampleType.value === 'positive' ? 'true' : 'false')

      await axiosInstance.post(`/api/defect/${defectId}/testcases`, formData)

      uploaded++
      uploadProgress.value = Math.round((uploaded / total) * 100)
      uploadStatus.value = `上传中... ${uploaded}/${total}`
    }

    uiStore.notify(`成功导入 ${total} 张图片`, 'success', '导入完成')
    close()
  } catch (error) {
    uiStore.notify('导入失败: ' + error.message, 'error', '错误')
  } finally {
    isUploading.value = false
  }
}

function close() {
  selectedFiles.value = []
  isUploading.value = false
  uploadProgress.value = 0
  uiStore.closeBatchImportModal()
}
</script>

<style scoped>
.batch-import-area {
  border: 2px dashed var(--glass-border);
  border-radius: 12px;
  padding: 40px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s;
}

.batch-import-area:hover,
.batch-import-area.drag-over {
  border-color: var(--primary-color);
  background: var(--hover-bg);
}

.batch-import-area .material-icons {
  font-size: 48px;
  color: var(--text-muted);
  margin-bottom: 16px;
}

.batch-import-area p {
  margin: 8px 0;
  color: var(--text-secondary);
}

.hint-text {
  font-size: 12px;
  color: var(--text-muted);
}

.hint-text.warning {
  color: var(--warning-color);
  margin-top: 8px;
}

.import-buttons {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-top: 16px;
}

.batch-import-preview {
  margin-top: 20px;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.preview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 8px;
  max-height: 200px;
  overflow-y: auto;
}

.preview-item {
  position: relative;
  aspect-ratio: 1;
  border-radius: 8px;
  overflow: hidden;
  background: var(--card-bg);
}

.preview-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.preview-name {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  font-size: 10px;
  padding: 2px 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.batch-import-options {
  margin-top: 20px;
}

.sample-type-selector {
  display: flex;
  gap: 16px;
}

.sample-type-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.sample-type-text {
  padding: 6px 16px;
  border-radius: 20px;
  font-size: 14px;
}

.sample-type-text.positive {
  background: rgba(16, 185, 129, 0.2);
  color: var(--success-color);
}

.sample-type-text.negative {
  background: rgba(239, 68, 68, 0.2);
  color: var(--error-color);
}

.batch-import-progress {
  margin-top: 20px;
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
</style>
