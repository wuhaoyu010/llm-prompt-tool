<template>
  <nav class="top-nav glass">
    <div class="logo-container">
      <span class="material-icons logo-icon">psychology</span>
      <h1>大模型提示词管理与测试工具</h1>
    </div>
    <div class="service-status-container">
      <div class="status-item" :class="llmStatus" :title="llmMessage">
        <span class="status-dot"></span>
        <span class="status-label">LLM</span>
      </div>
      <div v-if="trueno3Configured" class="status-item" :class="trueno3Status" :title="trueno3Message">
        <span class="status-dot"></span>
        <span class="status-label">Trueno3</span>
      </div>
    </div>
    <div class="nav-icons">
      <span class="material-icons nav-icon" @click="toggleTheme" title="切换主题">
        {{ theme === 'dark' ? 'dark_mode' : 'light_mode' }}
      </span>
      <span class="material-icons nav-icon">search</span>
      <span class="material-icons nav-icon">notifications</span>
      <span class="material-icons nav-icon settings" @click="openSettings" title="系统设置">settings</span>
      <span class="material-icons nav-icon user-avatar">account_circle</span>
    </div>
  </nav>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useUIStore } from '../stores/ui'
import { api } from '../api'

const uiStore = useUIStore()
const theme = computed(() => uiStore.theme)

const llmStatus = ref('offline')
const llmMessage = ref('检测中...')
const trueno3Status = ref('disabled')
const trueno3Message = ref('未启用')
const trueno3Configured = ref(false)

async function fetchServiceStatus() {
  try {
    const result = await api.get('/api/service_status')
    if (result.llm) {
      llmStatus.value = result.llm.status || 'offline'
      llmMessage.value = result.llm.message || ''
    }
    if (result.trueno3) {
      trueno3Configured.value = result.trueno3.configured || false
      if (result.trueno3.configured) {
        trueno3Status.value = result.trueno3.status || 'offline'
        trueno3Message.value = result.trueno3.message || ''
      }
    }
  } catch (error) {
    console.error('Failed to fetch service status:', error)
    llmStatus.value = 'offline'
    llmMessage.value = '获取状态失败'
  }
}

function toggleTheme() {
  uiStore.toggleTheme()
}

function openSettings() {
  uiStore.openSettingsModal()
}

onMounted(() => {
  fetchServiceStatus()
  setInterval(fetchServiceStatus, 60000)
})
</script>

<style scoped>
.top-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 64px;
  padding: 0 24px;
  border-bottom: 1px solid var(--glass-border);
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
}

.logo-container {
  display: flex;
  align-items: center;
  gap: 16px;
}

.logo-icon {
  color: var(--primary-color);
  font-size: 28px;
  filter: drop-shadow(0 0 12px rgba(79, 70, 229, 0.6));
}

.top-nav h1 {
  font-size: 22px;
  font-weight: 400;
  color: var(--text-secondary);
}

.nav-icons {
  display: flex;
  align-items: center;
  gap: 20px;
  color: var(--text-secondary);
}

.nav-icon {
  cursor: pointer;
  transition: color 0.2s;
}

.nav-icon:hover {
  color: var(--primary-color);
}

.service-status-container {
  display: flex;
  align-items: center;
  gap: 20px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 20px;
  background: var(--card-bg);
  font-size: 12px;
  cursor: default;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-muted);
}

.status-label {
  color: var(--text-secondary);
  font-weight: 500;
}

.status-item.online .status-dot {
  background: var(--success-color);
  box-shadow: 0 0 8px var(--success-color);
}

.status-item.offline .status-dot {
  background: var(--error-color);
  box-shadow: 0 0 8px var(--error-color);
}

.status-item.disabled .status-dot {
  background: var(--text-muted);
}

.status-item.checking .status-dot {
  background: var(--warning-color);
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
</style>
