<template>
  <div v-if="uiStore.showGlobalTemplateModal" class="modal" @click.self="close">
    <div class="modal-content modal-lg">
      <div class="modal-header">
        <h3>📝 编辑全局模板</h3>
        <span class="material-icons modal-close" @click="close">close</span>
      </div>
      <div class="modal-body">
        <div class="form-item">
          <label>全局 Prompt 模板</label>
          <textarea 
            v-model="templateText" 
            rows="16" 
            placeholder="输入全局 Prompt 模板..."
          ></textarea>
          <p class="hint-text">此模板将用于所有缺陷的自动标注和推理对比功能</p>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" @click="close">取消</button>
        <button class="btn btn-primary" @click="saveTemplate">保存模板</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onUnmounted } from 'vue'
import { useUIStore } from '../stores/ui'
import { api } from '../api'

const uiStore = useUIStore()

const templateText = ref('')

watch(() => uiStore.showGlobalTemplateModal, (isOpen) => {
  if (isOpen) {
    loadTemplate()
  }
}, { immediate: true })

async function loadTemplate() {
  try {
    const data = await api.get('/api/global_template')
    templateText.value = data.template_text || ''
  } catch (error) {
    console.error('Failed to load template:', error)
  }
}

async function saveTemplate() {
  try {
    await api.post('/api/global_template', { template_text: templateText.value })
    uiStore.notify('模板已保存', 'success', '成功')
    close()
  } catch (error) {
    uiStore.notify('保存模板失败: ' + error.message, 'error', '错误')
  }
}

function close() {
  uiStore.closeGlobalTemplateModal()
}

function handleEscKey(e) {
  if (e.key === 'Escape' && uiStore.showGlobalTemplateModal) {
    close()
  }
}

document.addEventListener('keydown', handleEscKey)

onUnmounted(() => {
  document.removeEventListener('keydown', handleEscKey)
})
</script>

<style scoped>
.form-item {
  margin-bottom: 16px;
}

.form-item label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: var(--text-primary);
}

.form-item textarea {
  width: 100%;
  padding: 12px;
  border-radius: 10px;
  background: var(--input-bg);
  border: 1px solid var(--glass-border);
  color: var(--text-primary);
  font-family: monospace;
  font-size: 14px;
  resize: vertical;
}

.hint-text {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 8px;
}
</style>
