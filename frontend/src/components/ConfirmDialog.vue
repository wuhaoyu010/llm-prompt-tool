<template>
  <Teleport to="body">
    <div v-if="uiStore.confirmDialog" class="confirm-dialog-overlay" @click.self="handleCancel">
      <div class="confirm-dialog">
        <div class="confirm-dialog-header">
          <span v-if="iconClass" class="material-icons confirm-dialog-icon" :class="iconClass">
            {{ iconName }}
          </span>
          <h3>{{ uiStore.confirmDialog.title }}</h3>
        </div>
        <div class="confirm-dialog-body">
          <p>{{ uiStore.confirmDialog.message }}</p>
        </div>
        <div class="confirm-dialog-footer">
          <button class="btn btn-secondary" @click="handleCancel">取消</button>
          <button class="btn" :class="confirmButtonClass" @click="handleConfirm">确认</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useUIStore } from '@/stores/ui'

const uiStore = useUIStore()

const iconName = computed(() => {
  const icon = uiStore.confirmDialog?.icon
  switch (icon) {
    case 'warning':
      return 'warning'
    case 'danger':
      return 'error'
    case 'info':
      return 'info'
    default:
      return 'help'
  }
})

const iconClass = computed(() => {
  const icon = uiStore.confirmDialog?.icon
  switch (icon) {
    case 'warning':
      return 'warning'
    case 'danger':
      return 'danger'
    case 'info':
      return 'info'
    default:
      return ''
  }
})

const confirmButtonClass = computed(() => {
  const icon = uiStore.confirmDialog?.icon
  switch (icon) {
    case 'warning':
      return 'btn-warning'
    case 'danger':
      return 'btn-danger'
    default:
      return 'btn-primary'
  }
})

function handleConfirm() {
  if (uiStore.confirmDialog?.onConfirm) {
    uiStore.confirmDialog.onConfirm()
  }
  uiStore.hideConfirm()
}

function handleCancel() {
  if (uiStore.confirmDialog?.onCancel) {
    uiStore.confirmDialog.onCancel()
  }
  uiStore.hideConfirm()
}
</script>

<style scoped>
.confirm-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  backdrop-filter: blur(4px);
}

.confirm-dialog {
  background: var(--card-bg);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  max-width: 420px;
  width: 90%;
  overflow: hidden;
  animation: dialogEnter 0.2s ease-out;
}

@keyframes dialogEnter {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.confirm-dialog-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 24px 16px;
  border-bottom: 1px solid var(--border-color);
}

.confirm-dialog-icon {
  font-size: 28px;
}

.confirm-dialog-icon.warning {
  color: #f59e0b;
}

.confirm-dialog-icon.danger {
  color: #ef4444;
}

.confirm-dialog-icon.info {
  color: #3b82f6;
}

.confirm-dialog-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.confirm-dialog-body {
  padding: 20px 24px;
}

.confirm-dialog-body p {
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.6;
}

.confirm-dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px 20px;
  background: var(--hover-bg);
}
</style>
