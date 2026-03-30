<template>
  <div v-if="uiStore.showSettingsModal" class="modal" @click.self="close">
    <div class="modal-content modal-lg">
      <div class="modal-header">
        <h3>⚙️ 系统设置</h3>
        <span class="material-icons modal-close" @click="close">close</span>
      </div>
      <div class="modal-body">
        <div class="settings-tabs">
          <button 
            v-for="tab in tabs" 
            :key="tab.id"
            class="settings-tab" 
            :class="{ active: activeTab === tab.id }"
            @click="activeTab = tab.id"
          >
            {{ tab.label }}
          </button>
        </div>
        
        <!-- Prompt模板设置 -->
        <div v-if="activeTab === 'prompt'" class="settings-tab-content active">
          <div class="form-item">
            <label>全局 Prompt 模板</label>
            <textarea 
              v-model="settings.templateText" 
              rows="12" 
              placeholder="输入全局 Prompt 模板..."
            ></textarea>
          </div>
        </div>
        
        <!-- 大模型配置 -->
        <div v-if="activeTab === 'llm'" class="settings-tab-content active">
          <div class="form-item">
            <label>API Key <span class="hint">（SiliconFlow API密钥）</span></label>
            <input 
              type="password" 
              v-model="settings.apiKey" 
              placeholder="sk-xxxxxxxxxxxxxxxx"
            >
          </div>
          <div class="form-item">
            <label>API URL</label>
            <input 
              type="text" 
              v-model="settings.apiUrl" 
              placeholder="https://api.siliconflow.cn/v1/chat/completions"
            >
          </div>
          <div class="form-item">
            <label>默认模型 <span class="hint">（可选择或手动输入）</span></label>
            <div class="model-select-container">
              <input
                type="text"
                v-model="modelSearchQuery"
                @focus="showModelDropdown = true"
                @blur="handleModelInputBlur"
                @input="handleModelInput"
                @keydown.enter.prevent="handleModelEnter"
                :placeholder="settings.model || '请输入或选择模型'"
                class="model-search-input"
              />
              <button 
                v-if="settings.model" 
                class="clear-model-btn" 
                @click="clearModel"
                title="清除"
              >
                <span class="material-icons">close</span>
              </button>
              <button 
                class="refresh-models-btn" 
                @click="fetchAvailableModels"
                :disabled="isLoadingModels"
                title="刷新模型列表"
              >
                <span class="material-icons" :class="{ 'spinning': isLoadingModels }">refresh</span>
              </button>
              
              <!-- 下拉列表 -->
              <div v-if="showModelDropdown && filteredModels.length > 0" class="model-dropdown">
                <div
                  v-for="model in filteredModels"
                  :key="model.id || model"
                  class="model-option"
                  :class="{ selected: settings.model === (model.id || model) }"
                  @mousedown.prevent="selectModel(model.id || model)"
                >
                  <span class="model-name">{{ model.id || model }}</span>
                  <span v-if="model.owned_by" class="model-provider">{{ model.owned_by }}</span>
                </div>
              </div>
              
              <!-- 无结果提示 -->
              <div v-if="showModelDropdown && filteredModels.length === 0 && modelSearchQuery" class="model-dropdown">
                <div class="model-option no-results">
                  未找到匹配的模型，按回车使用 "{{ modelSearchQuery }}"
                </div>
              </div>
            </div>
          </div>
          <div class="form-row">
            <div class="form-item">
              <label>Temperature <span class="hint">（0-2，越小越确定）</span></label>
              <input 
                type="number" 
                v-model.number="settings.temperature" 
                min="0" 
                max="2" 
                step="0.1"
              >
            </div>
            <div class="form-item">
              <label>Max Tokens <span class="hint">（最大输出长度）</span></label>
              <input 
                type="number" 
                v-model.number="settings.maxTokens" 
                min="100" 
                max="4000" 
                step="100"
              >
            </div>
          </div>
          <div class="form-item">
            <button class="btn btn-secondary" @click="testModel">
              🧪 测试模型可用性
            </button>
            <span v-if="testResult" class="hint" :class="{ error: testError }">
              {{ testResult }}
            </span>
          </div>
        </div>
        
        <!-- Trueno3配置 -->
        <div v-if="activeTab === 'trueno3'" class="settings-tab-content active">
          <div class="form-item">
            <label>
              <input type="checkbox" v-model="settings.trueno3Enabled">
              启用Trueno3自动同步
            </label>
            <p class="hint">发布新版本时自动同步到Trueno3服务器的defect_definitions.py</p>
          </div>
          <div class="form-item">
            <label>代码目录路径</label>
            <input 
              type="text" 
              v-model="settings.trueno3CodePath" 
              placeholder="/home/user/trueno3/src/algorithm/vlm_qwen3_server"
            >
          </div>
          <div class="form-row">
            <div class="form-item">
              <label>SSH主机</label>
              <input 
                type="text" 
                v-model="settings.trueno3SshHost" 
                placeholder="192.168.1.100"
              >
            </div>
            <div class="form-item">
              <label>SSH端口</label>
              <input 
                type="number" 
                v-model.number="settings.trueno3SshPort" 
                min="1" 
                max="65535"
              >
            </div>
          </div>
          <div class="form-row">
            <div class="form-item">
              <label>SSH用户名</label>
              <input 
                type="text" 
                v-model="settings.trueno3SshUsername" 
                placeholder="root"
              >
            </div>
            <div class="form-item">
              <label>SSH密码</label>
              <input 
                type="password" 
                v-model="settings.trueno3SshPassword" 
                placeholder="密码"
              >
            </div>
          </div>
          <div class="form-item">
            <button class="btn btn-secondary" @click="testTrueno3SSH">
              🧪 测试SSH连接
            </button>
            <span v-if="trueno3TestResult" class="hint" :class="{ error: trueno3TestError }">
              {{ trueno3TestResult }}
            </span>
          </div>

          <!-- Trueno3 服务配置 (自动标注) -->
          <div class="settings-section-divider">
            <h4>🔧 自动标注服务配置</h4>
            <p class="hint">配置Trueno3分析服务地址，用于自动标注功能</p>
          </div>
          <div class="form-row">
            <div class="form-item">
              <label>服务主机</label>
              <input 
                type="text" 
                v-model="settings.trueno3ServiceHost" 
                placeholder="默认使用SSH主机"
              >
            </div>
            <div class="form-item">
              <label>服务端口</label>
              <input 
                type="number" 
                v-model.number="settings.trueno3ServicePort" 
                min="1" 
                max="65535"
              >
            </div>
          </div>
          <div class="form-item">
            <label>API路径</label>
            <input 
              type="text" 
              v-model="settings.trueno3ApiPath" 
              placeholder="/picAnalyse"
            >
          </div>

          <!-- 回调配置 -->
          <div class="settings-section-divider">
            <h4>📥 回调配置</h4>
            <p class="hint">本服务的地址，用于接收Trueno3的异步回调结果</p>
          </div>
          <div class="form-row">
            <div class="form-item">
              <label>本服务IP</label>
              <input 
                type="text" 
                v-model="settings.trueno3CallbackHost" 
                placeholder="192.168.1.50"
              >
            </div>
            <div class="form-item">
              <label>本服务端口</label>
              <input 
                type="number" 
                v-model.number="settings.trueno3CallbackPort" 
                min="1" 
                max="65535"
              >
            </div>
          </div>
          <div class="form-item">
            <button class="btn btn-secondary" @click="testTrueno3Service">
              🔍 测试服务连通性
            </button>
            <span v-if="trueno3ServiceTestResult" class="hint" :class="{ error: trueno3ServiceTestError }">
              {{ trueno3ServiceTestResult }}
            </span>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" @click="close">取消</button>
        <button class="btn btn-primary" @click="saveSettings">保存设置</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useUIStore } from '../stores/ui'
import { api } from '../api'

const uiStore = useUIStore()

// ESC键关闭模态框
function handleEscKey(e) {
  if (e.key === 'Escape' && uiStore.showSettingsModal) {
    close()
  }
}

let modelBlurTimeout = null

onMounted(() => {
  document.addEventListener('keydown', handleEscKey)
  loadSettings()
  fetchAvailableModels()
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleEscKey)
  if (modelBlurTimeout) {
    clearTimeout(modelBlurTimeout)
  }
})

const tabs = [
  { id: 'prompt', label: '全局Prompt模板' },
  { id: 'llm', label: '大模型配置' },
  { id: 'trueno3', label: 'Trueno3同步' }
]

const activeTab = ref('prompt')
const testResult = ref('')
const testError = ref(false)
const trueno3TestResult = ref('')
const trueno3TestError = ref(false)
const trueno3ServiceTestResult = ref('')
const trueno3ServiceTestError = ref(false)

// 模型选择相关
const availableModels = ref([])
const modelSearchQuery = ref('')
const showModelDropdown = ref(false)
const isLoadingModels = ref(false)

// 过滤后的模型列表
const filteredModels = computed(() => {
  if (!modelSearchQuery.value) {
    return availableModels.value
  }
  const query = modelSearchQuery.value.toLowerCase()
  return availableModels.value.filter(model => {
    const modelName = (model.id || model).toLowerCase()
    return modelName.includes(query)
  })
})

const settings = ref({
  // Prompt模板
  templateText: '',
  // LLM配置
  apiKey: '',
  apiUrl: 'https://api.siliconflow.cn/v1/chat/completions',
  model: '',
  temperature: 0.7,
  maxTokens: 1000,
  // Trueno3配置
  trueno3Enabled: false,
  trueno3CodePath: '/home/user/trueno3/src/algorithm/vlm_qwen3_server',
  trueno3SshHost: '',
  trueno3SshPort: 22,
  trueno3SshUsername: '',
  trueno3SshPassword: '',
  trueno3ServiceHost: '',
  trueno3ServicePort: 20011,
  trueno3ApiPath: '/picAnalyse',
  trueno3CallbackHost: '',
  trueno3CallbackPort: 5001
})

async function loadSettings() {
  try {
    const [template, llmConfig, trueno3Config] = await Promise.all([
      api.get('/api/global_template'),
      api.get('/api/llm_config'),
      api.get('/api/trueno3_config')
    ])

    // Prompt模板
    settings.value.templateText = template.template_text || ''
    
    // LLM配置
    settings.value.apiKey = llmConfig.api_key || ''
    settings.value.apiUrl = llmConfig.api_url || settings.value.apiUrl
    settings.value.model = llmConfig.default_model || ''
    settings.value.temperature = llmConfig.temperature ?? 0.7
    settings.value.maxTokens = llmConfig.max_tokens ?? 1000
    
    // Trueno3配置
    if (trueno3Config) {
      settings.value.trueno3Enabled = trueno3Config.enabled || false
      settings.value.trueno3CodePath = trueno3Config.code_path || settings.value.trueno3CodePath
      settings.value.trueno3SshHost = trueno3Config.ssh_host || ''
      settings.value.trueno3SshPort = trueno3Config.ssh_port || 22
      settings.value.trueno3SshUsername = trueno3Config.ssh_username || ''
      settings.value.trueno3SshPassword = trueno3Config.ssh_password || ''
      settings.value.trueno3ServiceHost = trueno3Config.service_host || ''
      settings.value.trueno3ServicePort = trueno3Config.service_port || 20011
      settings.value.trueno3ApiPath = trueno3Config.api_path || '/picAnalyse'
      settings.value.trueno3CallbackHost = trueno3Config.callback_host || ''
      settings.value.trueno3CallbackPort = trueno3Config.callback_port || 5001
    }
  } catch (error) {
    console.error('Failed to load settings:', error)
  }
}

async function saveSettings() {
  try {
    await Promise.all([
      api.post('/api/global_template', { template_text: settings.value.templateText }),
      api.post('/api/llm_config', {
        api_key: settings.value.apiKey,
        api_url: settings.value.apiUrl,
        default_model: settings.value.model,
        temperature: settings.value.temperature,
        max_tokens: settings.value.maxTokens
      }),
      api.post('/api/trueno3_config', {
        enabled: settings.value.trueno3Enabled,
        code_path: settings.value.trueno3CodePath,
        ssh_host: settings.value.trueno3SshHost,
        ssh_port: settings.value.trueno3SshPort,
        ssh_username: settings.value.trueno3SshUsername,
        ssh_password: settings.value.trueno3SshPassword,
        service_host: settings.value.trueno3ServiceHost,
        service_port: settings.value.trueno3ServicePort,
        api_path: settings.value.trueno3ApiPath,
        callback_host: settings.value.trueno3CallbackHost,
        callback_port: settings.value.trueno3CallbackPort
      })
    ])

    // 保存成功后通知其他组件更新模型
    window.dispatchEvent(new CustomEvent('llm-config-updated', {
      detail: { model: settings.value.model }
    }))

    uiStore.notify('设置已保存', 'success', '成功')
    close()
  } catch (error) {
    uiStore.notify('保存设置失败: ' + error.message, 'error', '错误')
  }
}

async function testModel() {
  testResult.value = '测试中...'
  testError.value = false

  try {
    // 先保存当前配置
    await api.post('/api/llm_config', {
      api_key: settings.value.apiKey,
      api_url: settings.value.apiUrl,
      default_model: settings.value.model,
      temperature: settings.value.temperature,
      max_tokens: settings.value.maxTokens
    })

    // 调用模型健康检查API
    const result = await api.get('/api/llm_health')

    if (result.status === 'online') {
      testResult.value = '✓ 模型服务正常'
      testError.value = false

      // 测试成功后通知其他组件更新模型
      window.dispatchEvent(new CustomEvent('llm-config-updated', {
        detail: { model: settings.value.model }
      }))
    } else {
      testResult.value = '✗ ' + (result.message || '模型服务异常')
      testError.value = true
    }
  } catch (error) {
    testResult.value = '✗ 测试失败: ' + error.message
    testError.value = true
  }
}

async function testTrueno3SSH() {
  trueno3TestResult.value = '测试中...'
  trueno3TestError.value = false

  try {
    const result = await api.post('/api/trueno3_test', {
      code_path: settings.value.trueno3CodePath,
      ssh_host: settings.value.trueno3SshHost,
      ssh_port: settings.value.trueno3SshPort,
      ssh_username: settings.value.trueno3SshUsername,
      ssh_password: settings.value.trueno3SshPassword
    })

    if (result.success) {
      trueno3TestResult.value = '✓ SSH连接成功'
      trueno3TestError.value = false
    } else {
      trueno3TestResult.value = '✗ ' + (result.error || 'SSH连接失败')
      trueno3TestError.value = true
    }
  } catch (error) {
    trueno3TestResult.value = '✗ 测试失败: ' + error.message
    trueno3TestError.value = true
  }
}

async function testTrueno3Service() {
  trueno3ServiceTestResult.value = '测试中...'
  trueno3ServiceTestError.value = false

  try {
    const result = await api.post('/api/trueno3_service_test', {
      service_host: settings.value.trueno3ServiceHost,
      service_port: settings.value.trueno3ServicePort
    })

    if (result.success) {
      trueno3ServiceTestResult.value = '✓ 服务连接成功'
      trueno3ServiceTestError.value = false
    } else {
      trueno3ServiceTestResult.value = '✗ ' + (result.error || '服务连接失败')
      trueno3ServiceTestError.value = true
    }
  } catch (error) {
    trueno3ServiceTestResult.value = '✗ 测试失败: ' + error.message
    trueno3ServiceTestError.value = true
  }
}

function close() {
  uiStore.closeSettingsModal()
}

// 获取可用模型列表
async function fetchAvailableModels() {
  isLoadingModels.value = true
  try {
    const result = await api.get('/api/models')
    if (result.models) {
      availableModels.value = result.models
      // 刷新成功后自动显示下拉列表
      showModelDropdown.value = true
    }
  } catch (error) {
    console.error('Failed to fetch models:', error)
    // 如果获取失败，使用默认列表
    availableModels.value = [
      { id: 'Qwen/Qwen2.5-7B-Instruct', owned_by: 'Qwen' },
      { id: 'Qwen/Qwen2.5-14B-Instruct', owned_by: 'Qwen' },
      { id: 'Qwen/Qwen2.5-32B-Instruct', owned_by: 'Qwen' },
      { id: 'Qwen/Qwen2.5-72B-Instruct', owned_by: 'Qwen' },
      { id: 'deepseek-ai/DeepSeek-V2.5', owned_by: 'DeepSeek' },
      { id: 'THUDM/glm-4-9b-chat', owned_by: 'THUDM' }
    ]
  } finally {
    isLoadingModels.value = false
  }
}

// 选择模型
function selectModel(modelId) {
  settings.value.model = modelId
  modelSearchQuery.value = ''
  showModelDropdown.value = false
}

// 清除模型选择
function clearModel() {
  settings.value.model = ''
  modelSearchQuery.value = ''
}

// 处理模型输入
function handleModelInput() {
  // 如果用户输入了内容，可以实时过滤
  showModelDropdown.value = true
}

// 处理输入框失焦
function handleModelInputBlur() {
  // 延迟关闭下拉框，以便点击选项
  modelBlurTimeout = setTimeout(() => {
    showModelDropdown.value = false
    // 如果用户输入了内容，强制使用输入的内容作为模型（优先于已选择的）
    if (modelSearchQuery.value) {
      settings.value.model = modelSearchQuery.value
    }
    modelSearchQuery.value = ''
  }, 200)
}

// 处理 Enter 键
function handleModelEnter() {
  // 强制保存当前输入的内容作为模型
  if (modelSearchQuery.value) {
    settings.value.model = modelSearchQuery.value
    modelSearchQuery.value = ''
    showModelDropdown.value = false
  }
}
</script>

<style scoped>
/* 使用全局 .modal 样式，只覆盖特定样式 */
.modal {
  /* 继承全局样式，确保显示正常 */
  display: flex;
}

.modal-content {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  max-height: 80vh;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid var(--glass-border);
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  color: var(--text-primary);
}

.modal-close {
  cursor: pointer;
  color: var(--text-secondary);
  transition: color 0.2s;
}

.modal-close:hover {
  color: var(--text-primary);
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid var(--glass-border);
}

.settings-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
  border-bottom: 1px solid var(--glass-border);
  padding-bottom: 12px;
}

.settings-tab {
  padding: 8px 16px;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.2s;
}

.settings-tab:hover {
  background: var(--hover-bg);
  color: var(--text-primary);
}

.settings-tab.active {
  background: var(--primary-color);
  color: white;
}

.settings-tab-content {
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.form-item {
  margin-bottom: 16px;
}

.form-item label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: var(--text-primary);
}

.form-item .hint {
  font-weight: normal;
  color: var(--text-muted);
  font-size: 12px;
  margin-left: 8px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.form-row .form-item {
  margin-bottom: 0;
}

.hint.error {
  color: var(--error-color);
}

.settings-section-divider {
  margin-top: 24px;
  margin-bottom: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--glass-border);
}

.settings-section-divider h4 {
  margin: 0 0 8px;
  font-size: 14px;
  color: var(--text-primary);
}

.settings-section-divider .hint {
  margin: 0;
  font-size: 12px;
  color: var(--text-muted);
}

textarea {
  width: 100%;
  padding: 12px;
  border-radius: 8px;
  background: var(--input-bg);
  border: 1px solid var(--glass-border);
  color: var(--text-primary);
  font-family: inherit;
  resize: vertical;
}

input[type="text"],
input[type="password"],
input[type="number"],
select {
  width: 100%;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--input-bg);
  border: 1px solid var(--glass-border);
  color: var(--text-primary);
}

input[type="checkbox"] {
  margin-right: 8px;
}

/* 模型选择器样式 */
.model-select-container {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
}

.model-search-input {
  flex: 1;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--input-bg);
  border: 1px solid var(--glass-border);
  color: var(--text-primary);
  font-size: 14px;
}

.model-search-input:focus {
  outline: none;
  border-color: var(--primary-color);
}

.clear-model-btn,
.refresh-models-btn {
  padding: 8px;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.clear-model-btn:hover,
.refresh-models-btn:hover {
  background: var(--hover-bg);
  color: var(--text-primary);
}

.refresh-models-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.refresh-models-btn .material-icons.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.model-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 4px;
  background: var(--card-bg);
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  max-height: 300px;
  overflow-y: auto;
  z-index: 100;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.model-option {
  padding: 10px 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--glass-border);
}

.model-option:last-child {
  border-bottom: none;
}

.model-option:hover {
  background: var(--hover-bg);
}

.model-option.selected {
  background: var(--primary-color);
  color: white;
}

.model-option.selected .model-provider {
  color: rgba(255, 255, 255, 0.8);
}

.model-name {
  font-size: 14px;
}

.model-provider {
  font-size: 12px;
  color: var(--text-muted);
}

.model-option.no-results {
  color: var(--text-muted);
  font-style: italic;
  cursor: default;
}

.model-option.no-results:hover {
  background: transparent;
}
</style>
