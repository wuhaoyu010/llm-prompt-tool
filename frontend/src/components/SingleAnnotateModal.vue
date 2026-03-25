<template>
  <Teleport to="body">
    <div v-if="show" class="modal-backdrop" @click.self="close">
      <div class="modal single-defect-annotate-modal">
        <div class="modal-header">
          <h3>🤖 单图自动标注</h3>
          <span class="material-icons modal-close" @click="close">close</span>
        </div>
        <div class="modal-body">
          <div class="single-defect-info">
            <p class="hint">将对选中的图片进行自动标注。</p>
          </div>
          <div class="form-item">
            <label>
              <input type="checkbox" v-model="clearExisting" />
              清除现有标注框
            </label>
          </div>
          <div class="single-defect-target">
            <p><strong>目标图片：</strong>{{ targetName }}</p>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary modal-cancel" @click="close">取消</button>
          <button class="btn btn-primary" @click="confirm">开始标注</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAutoAnnotateStore } from '../stores/autoAnnotate'
import { useDefectStore } from '../stores/defect'

// ESC键关闭模态框
function handleEscKey(e) {
  if (e.key === 'Escape' && props.show) {
    close()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleEscKey)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleEscKey)
})

const props = defineProps({
  show: Boolean,
  testCaseId: Number,
  targetName: String
})

const emit = defineEmits(['close', 'confirm'])

const autoAnnotateStore = useAutoAnnotateStore()
const defectStore = useDefectStore()
const clearExisting = ref(true)

async function confirm() {
  if (!defectStore.currentDefect?.id) {
    return
  }
  
  try {
    await autoAnnotateStore.startSingleAnnotate(
      defectStore.currentDefect.id,
      props.testCaseId,
      clearExisting.value
    )
    emit('confirm')
    emit('close')
  } catch (error) {
    console.error('Auto annotate failed:', error)
  }
}

function close() {
  emit('close')
}
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1100;
}

.modal {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: 20px;
  width: 90%;
  max-width: 500px;
  max-height: 80vh;
  overflow: hidden;
}

.modal-header {
  padding: 24px;
  font-size: 20px;
  font-weight: 500;
  border-bottom: 1px solid var(--glass-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-close {
  cursor: pointer;
  color: var(--text-secondary);
}

.modal-close:hover {
  color: var(--error-color);
}

.modal-body {
  padding: 24px;
}

.modal-footer {
  padding: 24px;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  border-top: 1px solid var(--glass-border);
}

.form-item label {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}

.form-item input[type="checkbox"] {
  width: 18px;
  height: 18px;
  accent-color: var(--primary-color);
}
</style>
