<template>
  <div v-if="uiStore.showImportDefectsModal" class="modal" @click.self="close">
    <div class="modal-content modal-lg">
      <div class="modal-header">
        <h3>📥 批量导入缺陷定义</h3>
        <span class="material-icons modal-close" @click="close">close</span>
      </div>
      <div class="modal-body">
        <!-- 导入标签页 -->
        <div class="import-tabs">
          <button 
            class="import-tab" 
            :class="{ active: activeTab === 'paste' }"
            @click="activeTab = 'paste'"
          >
            粘贴导入
          </button>
          <button 
            class="import-tab" 
            :class="{ active: activeTab === 'file' }"
            @click="activeTab = 'file'"
          >
            文件上传
          </button>
        </div>
        
        <!-- 粘贴导入 -->
        <div v-show="activeTab === 'paste'" class="import-tab-content">
          <p class="import-hint">粘贴 Python 格式的 DEFECT_CLASSES 字典：</p>
          <textarea 
            v-model="pasteText" 
            rows="12" 
            placeholder='DEFECT_CLASSES = {
    "defect_name": {
        "defect_cn": "中文名称",
        "defect_class": "分类",
        "judgment_points": "判断要点",
        "exclusions": "排除项"
    }
}'
          ></textarea>
        </div>
        
        <!-- 文件上传 -->
        <div v-show="activeTab === 'file'" class="import-tab-content">
          <p class="import-hint">上传 Python 文件（.py）：</p>
          <div 
            class="file-upload-area" 
            :class="{ 'drag-over': isDragOver }"
            @dragover.prevent="isDragOver = true"
            @dragleave.prevent="isDragOver = false"
            @drop.prevent="handleFileDrop"
            @click="triggerFileInput"
          >
            <span class="material-icons">upload_file</span>
            <p>拖放文件或点击选择</p>
            <input 
              ref="fileInput"
              type="file" 
              accept=".py,.txt" 
              hidden
              @change="handleFileSelect"
            >
          </div>
          <p v-if="selectedFileName" class="file-name">已选择: {{ selectedFileName }}</p>
        </div>
        
        <!-- 导入结果 -->
        <div v-if="importResult" class="import-result">
          <div class="result-item success">
            <span class="material-icons">check_circle</span>
            <span>{{ importResult.imported?.length || 0 }}</span> 条导入成功
          </div>
          <div class="result-item skipped">
            <span class="material-icons">skip_next</span>
            <span>{{ importResult.skipped?.length || 0 }}</span> 条已跳过
          </div>
          <div class="result-item error">
            <span class="material-icons">error</span>
            <span>{{ importResult.errors?.length || 0 }}</span> 条导入失败
          </div>
          <div v-if="importResult.errors?.length > 0" class="import-details">
            <h4>详细信息</h4>
            <div class="import-details-list">
              <div v-for="(error, index) in importResult.errors" :key="index" class="detail-item error">
                {{ error }}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" @click="close">取消</button>
        <button 
          class="btn btn-primary" 
          :disabled="!canImport || isImporting"
          @click="executeImport"
        >
          <span v-if="isImporting" class="material-icons spinning">sync</span>
          <span>{{ isImporting ? '导入中...' : '开始导入' }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useUIStore } from '../stores/ui'
import { useDefectStore } from '../stores/defect'
import { api } from '../api'

const uiStore = useUIStore()
const defectStore = useDefectStore()

const activeTab = ref('paste')
const pasteText = ref('')
const fileContent = ref('')
const selectedFileName = ref('')
const isDragOver = ref(false)
const isImporting = ref(false)
const importResult = ref(null)
const fileInput = ref(null)

const canImport = computed(() => {
  if (activeTab.value === 'paste') {
    return pasteText.value.trim().length > 0
  } else {
    return fileContent.value.length > 0
  }
})

// ESC键关闭模态框
function handleEscKey(e) {
  if (e.key === 'Escape' && uiStore.showImportDefectsModal) {
    close()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleEscKey)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleEscKey)
})

function triggerFileInput() {
  fileInput.value?.click()
}

function handleFileSelect(e) {
  const file = e.target.files[0]
  if (file) {
    readFile(file)
  }
}

function handleFileDrop(e) {
  isDragOver.value = false
  const file = e.dataTransfer.files[0]
  if (file && (file.name.endsWith('.py') || file.name.endsWith('.txt'))) {
    readFile(file)
  } else {
    uiStore.notify('请上传 .py 或 .txt 文件', 'error', '错误')
  }
}

function readFile(file) {
  selectedFileName.value = file.name
  const reader = new FileReader()
  reader.onload = (e) => {
    fileContent.value = e.target.result
  }
  reader.readAsText(file)
}

async function executeImport() {
  const importText = activeTab.value === 'paste' ? pasteText.value : fileContent.value
  
  if (!importText.trim()) {
    uiStore.notify('请输入或上传导入内容', 'error', '错误')
    return
  }

  isImporting.value = true
  importResult.value = null

  try {
    const result = await api.post('/api/defects/batch_import', {
      import_text: importText
    })
    
    importResult.value = result
    
    if (result.success) {
      uiStore.notify(`成功导入 ${result.imported?.length || 0} 条缺陷定义`, 'success', '导入完成')
      // 刷新缺陷列表
      await defectStore.fetchDefects()
    } else {
      uiStore.notify('导入完成，但存在错误', 'warning', '警告')
    }
  } catch (error) {
    uiStore.notify('导入失败: ' + error.message, 'error', '错误')
  } finally {
    isImporting.value = false
  }
}

function close() {
  // 重置状态
  activeTab.value = 'paste'
  pasteText.value = ''
  fileContent.value = ''
  selectedFileName.value = ''
  importResult.value = null
  uiStore.closeImportDefectsModal()
}
</script>

<style scoped>
/* 使用全局 .modal 样式 */
.modal {
  display: flex;
}

.import-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
  border-bottom: 1px solid var(--glass-border);
  padding-bottom: 12px;
}

.import-tab {
  padding: 8px 16px;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.2s;
}

.import-tab:hover {
  background: var(--hover-bg);
  color: var(--text-primary);
}

.import-tab.active {
  background: var(--primary-color);
  color: white;
}

.import-tab-content {
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.import-hint {
  color: var(--text-secondary);
  font-size: 14px;
  margin-bottom: 12px;
}

textarea {
  width: 100%;
  min-height: 200px;
  padding: 12px;
  border-radius: 8px;
  background: var(--input-bg);
  border: 1px solid var(--glass-border);
  color: var(--text-primary);
  font-family: monospace;
  font-size: 13px;
  resize: vertical;
}

.file-upload-area {
  border: 2px dashed var(--glass-border);
  border-radius: 12px;
  padding: 40px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s;
}

.file-upload-area:hover,
.file-upload-area.drag-over {
  border-color: var(--primary-color);
  background: var(--hover-bg);
}

.file-upload-area .material-icons {
  font-size: 48px;
  color: var(--text-muted);
  margin-bottom: 16px;
}

.file-upload-area p {
  color: var(--text-secondary);
}

.file-name {
  margin-top: 12px;
  color: var(--text-secondary);
  font-size: 14px;
}

.import-result {
  margin-top: 20px;
  padding: 16px;
  background: var(--card-bg);
  border-radius: 8px;
}

.result-item {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 14px;
}

.result-item.success {
  color: var(--success-color);
}

.result-item.skipped {
  color: var(--warning-color);
}

.result-item.error {
  color: var(--error-color);
}

.import-details {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--glass-border);
}

.import-details h4 {
  margin: 0 0 12px;
  font-size: 14px;
  color: var(--text-secondary);
}

.import-details-list {
  max-height: 150px;
  overflow-y: auto;
}

.detail-item {
  padding: 8px;
  border-radius: 4px;
  font-size: 12px;
  margin-bottom: 4px;
}

.detail-item.error {
  background: rgba(239, 68, 68, 0.1);
  color: var(--error-color);
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
