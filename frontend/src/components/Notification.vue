<template>
  <Teleport to="body">
    <div class="notification-container">
      <TransitionGroup name="notification">
        <div 
          v-for="notification in notifications" 
          :key="notification.id"
          class="notification"
          :class="notification.type"
        >
          <span class="material-icons">{{ getIcon(notification.type) }}</span>
          <div class="notification-content">
            <div v-if="notification.title" class="notification-title">
              {{ notification.title }}
            </div>
            <div class="notification-message">{{ notification.message }}</div>
          </div>
          <button class="close-btn" @click="remove(notification.id)">
            <span class="material-icons">close</span>
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue'
import { useUIStore } from '../stores/ui'

const uiStore = useUIStore()
const notifications = computed(() => uiStore.notifications)

function getIcon(type) {
  const icons = {
    success: 'check_circle',
    error: 'error',
    warning: 'warning',
    info: 'info'
  }
  return icons[type] || 'info'
}

function remove(id) {
  uiStore.removeNotification(id)
}
</script>

<style scoped>
.notification-container {
  position: fixed;
  top: 80px;
  right: 20px;
  z-index: 9998;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.notification {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  min-width: 300px;
  max-width: 400px;
  box-shadow: var(--glass-shadow);
}

.notification.success {
  border-color: var(--success-color);
}

.notification.error {
  border-color: var(--error-color);
}

.notification.warning {
  border-color: var(--warning-color);
}

.notification .material-icons {
  font-size: 24px;
}

.notification.success .material-icons {
  color: var(--success-color);
}

.notification.error .material-icons {
  color: var(--error-color);
}

.notification.warning .material-icons {
  color: var(--warning-color);
}

.notification-content {
  flex: 1;
}

.notification-title {
  font-weight: 600;
  margin-bottom: 4px;
}

.notification-message {
  color: var(--text-secondary);
  font-size: 14px;
}

.close-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 0;
}

.close-btn:hover {
  color: var(--text-primary);
}

.notification-enter-active,
.notification-leave-active {
  transition: all 0.3s ease;
}

.notification-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.notification-leave-to {
  opacity: 0;
  transform: translateX(100%);
}
</style>
