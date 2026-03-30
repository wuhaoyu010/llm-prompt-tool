<template>
  <div class="home-view" @keydown="handleGlobalKeyDown">
    <!-- 缺陷详情编辑区 -->
    <div
      class="card scroll-section"
      id="defect-section"
      v-if="currentDefect"
      @mouseenter="focusArea = 'defect'"
      @mouseleave="focusArea = null"
    >
        <div class="card-header">
          <h2>{{ currentDefect.name }}</h2>
          <div class="header-actions">
            <select v-model="selectedVersionId" @change="changeVersion" class="version-select">
              <option v-for="v in versions" :key="v.id" :value="v.id">
                V{{ v.version }}{{ v.summary ? ' - ' + v.summary : '' }}
              </option>
            </select>
            <button class="btn btn-ghost btn-sm" @click="cancelEdit" v-if="hasDefectDataChanges">取消</button>
            <button class="btn btn-primary btn-sm" @click="saveDefectDescription" :disabled="!hasDefectDataChanges">保存修改</button>
            <button class="btn btn-ghost btn-sm" @click="openGlobalTemplate">编辑全局模板</button>
            <button class="btn btn-ghost btn-sm" @click="publishVersion">发布新版本</button>
          </div>
        </div>

        <div class="editor-grid">
          <div class="editor-card">
            <h4>DEFECT_CN</h4>
            <textarea v-model="defectData.defect_cn" placeholder="中文名称..." @input="recordDefectHistory"></textarea>
          </div>
          <div class="editor-card">
            <h4>DEFECT_CLASS</h4>
            <textarea v-model="defectData.defect_class" placeholder="缺陷分类..." @input="recordDefectHistory"></textarea>
          </div>
          <div class="editor-card">
            <h4>JUDGMENT_POINTS</h4>
            <textarea v-model="defectData.judgment_points" placeholder="判断点..." @input="recordDefectHistory"></textarea>
          </div>
          <div class="editor-card">
            <h4>EXCLUSIONS</h4>
            <textarea v-model="defectData.exclusions" placeholder="排除项..." @input="recordDefectHistory"></textarea>
          </div>
        </div>
      </div>
      
      <div v-else class="placeholder-text">
        从左侧选择一个缺陷类别以开始。
      </div>
      
      <!-- 图片标注区 -->
      <div
        class="card scroll-section"
        id="annotation-section"
        v-if="currentDefect"
        @mouseenter="focusArea = 'canvas'"
        @mouseleave="focusArea = null"
      >
        <div class="card-header">
          <h2>图片标注</h2>
          <div class="header-actions">
            <span class="stats">{{ totalCount }}张 · 正{{ positiveCount }} · 反{{ negativeCount }} · 已标注{{ annotatedCount }}</span>
            <button class="btn btn-primary btn-sm" @click="saveAnnotations" :disabled="!isDirty">
              <span class="material-icons">save</span>
              <span class="btn-text">保存</span>
            </button>
            <button class="btn btn-ghost btn-sm" @click="openBatchAnnotate">
              <span class="material-icons">auto_awesome</span>
              <span class="btn-text">批量标注</span>
            </button>
            <button class="btn btn-ghost btn-sm" @click="openBatchImport">
              <span class="material-icons">add_photo_alternate</span>
              <span class="btn-text">批量导入</span>
            </button>
            <div class="autosave-select">
              <label>自动保存:</label>
              <select v-model="autoSaveInterval" @change="startAutoSave" class="autosave-dropdown">
                <option v-for="opt in autoSaveOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
            </div>
          </div>
        </div>
        <div class="card-body">
          <div class="annotation-workspace">
            <!-- 左侧：标注画布 -->
            <div class="canvas-panel">
              <ImageAnnotationCanvas
                v-if="currentTestCase"
                :imageUrl="currentTestCase.preview_url"
                @upload="handleUpload"
                @navigate="handleNavigate"
                @boxes-changed="onBoxesChanged"
              />
              <div v-else class="no-image-placeholder">
                <span class="material-icons" style="font-size: 48px; opacity: 0.5;">image</span>
                <p>请选择一张图片进行标注</p>
              </div>
            </div>
            
            <!-- 右侧：缩略图列表 -->
            <div class="thumbnail-panel">
              <ThumbnailGallery 
                :test-cases="testCases"
                :current-id="currentTestCaseId"
                :selected-ids="selectedIds"
                @select="selectTestCase"
                @delete="deleteTestCase"
                @batch-delete="batchDeleteTestCases"
                @batch-set-type="batchSetType"
                @auto-annotate="singleAutoAnnotate"
                @batch-annotate="batchAutoAnnotate"
                @update:selected-ids="selectedIds = $event"
              />
            </div>
          </div>
        </div>
      </div>
      
      <!-- 实时推理对比区域 -->
      <div class="card scroll-section" id="inference-section" v-if="currentDefect">
        <div class="card-header">
          <h2>
            实时推理对比
            <span class="status-badge" :class="llmHealthStatus" :title="llmHealthText"></span>
          </h2>
          <div class="header-actions">
            <div class="version-compare-compact">
              <span class="version-tag">V{{ currentVersionNumber }}</span>
              <span class="compare-sep">vs</span>
              <span class="version-tag muted">V{{ baseVersionNumber }}</span>
            </div>
            <div class="model-select-wrapper">
              <input
                type="text"
                v-model="inferenceModelSearch"
                @focus="showInferenceModelDropdown = true"
                @blur="handleInferenceModelBlur"
                @keydown.enter.prevent="handleInferenceModelEnter"
                :placeholder="inferenceModel || '选择模型...'"
                class="model-input"
              />
              <button class="btn btn-icon" @click="fetchInferenceModels" :disabled="isLoadingInferenceModels" title="刷新模型列表">
                <span class="material-icons" :class="{ 'spinning': isLoadingInferenceModels }">refresh</span>
              </button>
              <div v-if="showInferenceModelDropdown && filteredInferenceModels.length > 0" class="model-dropdown">
                <div
                  v-for="model in filteredInferenceModels"
                  :key="model.id || model"
                  class="model-option"
                  :class="{ selected: inferenceModel === (model.id || model) }"
                  @mousedown.prevent="selectInferenceModel(model.id || model)"
                >
                  {{ model.id || model }}
                </div>
              </div>
            </div>
            <button class="btn btn-primary btn-sm" @click="runVersionComparison" :disabled="!currentTestCaseId">
              运行对比
            </button>
          </div>
        </div>
        <div class="card-body">
          <div v-if="inferenceComparisonResult" class="inference-comparison">
            <div class="comparison-header">
              <div class="version-label version-a">当前版本: V{{ getVersionNumber(inferenceComparisonResult.versionA) }}</div>
              <div class="version-label version-b">基准版本: V{{ getVersionNumber(inferenceComparisonResult.versionB) }}</div>
            </div>
            <div class="comparison-content">
              <div class="comparison-panel version-a-panel">
                <div class="panel-header">
                  <span class="material-icons">check_circle</span>
                  <span>当前版本 结果</span>
                </div>
                <div class="panel-body">
                  <div class="result-item" v-for="(item, index) in inferenceComparisonResult.resultA" :key="'a-' + index">
                    <span class="box-id">框 {{ index + 1 }}</span>
                    <span class="result-status" :class="item.status?.toLowerCase()">{{ item.status || 'N/A' }}</span>
                    <span class="result-reason">{{ item.reason || '-' }}</span>
                  </div>
                </div>
                <div class="panel-footer" v-if="inferenceComparisonResult.promptA">
                  <details class="prompt-details">
                    <summary>查看完整提示词</summary>
                    <pre class="prompt-text">{{ inferenceComparisonResult.promptA }}</pre>
                  </details>
                </div>
              </div>
              <div class="comparison-panel version-b-panel">
                <div class="panel-header">
                  <span class="material-icons">check_circle</span>
                  <span>基准版本 结果</span>
                </div>
                <div class="panel-body">
                  <div class="result-item" v-for="(item, index) in inferenceComparisonResult.resultB" :key="'b-' + index">
                    <span class="box-id">框 {{ index + 1 }}</span>
                    <span class="result-status" :class="item.status?.toLowerCase()">{{ item.status || 'N/A' }}</span>
                    <span class="result-reason">{{ item.reason || '-' }}</span>
                  </div>
                </div>
                <div class="panel-footer" v-if="inferenceComparisonResult.promptB">
                  <details class="prompt-details">
                    <summary>查看完整提示词</summary>
                    <pre class="prompt-text">{{ inferenceComparisonResult.promptB }}</pre>
                  </details>
                </div>
              </div>
            </div>
          </div>
          <div v-else-if="isRunningComparison" class="comparison-loading">
            <div class="spinner"></div>
            <span>正在对比两个版本...</span>
          </div>
          <div v-else class="empty-state">
            <span class="material-icons">compare</span>
            <p>选择两个版本并点击"运行对比"</p>
          </div>
        </div>
      </div>
      
      <!-- 回归测试报告区域 -->
      <div class="card scroll-section" v-if="currentDefect">
        <div class="card-header">
          <h2>回归测试报告</h2>
          <div class="header-actions">
            <button class="btn btn-primary btn-sm" @click="runRegressionTest" :disabled="isRunningRegression">
              <span v-if="isRunningRegression" class="material-icons spinning">sync</span>
              <span>{{ isRunningRegression ? '运行中...' : '运行' }}</span>
            </button>
          </div>
        </div>
        <div class="card-body">
          <div v-if="isRunningRegression" class="regression-progress">
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: regressionProgress + '%' }"></div>
            </div>
            <span class="progress-text">{{ regressionProgressText }}</span>
          </div>
          <div v-else-if="regressionReport" class="regression-report">
            <div class="report-header">
              <h4>📊 回归测试报告</h4>
              <button class="btn btn-secondary btn-sm" @click="exportRegressionReport">
                导出报告
              </button>
            </div>
            <div class="accuracy-summary-single">
              <span class="accuracy-label">总体准确率:</span>
              <span class="accuracy-value">{{ regressionReport.summary?.accuracy || 0 }}%</span>
              <span class="accuracy-detail">({{ regressionReport.summary?.correct_predictions }}/{{ regressionReport.summary?.total_cases }})</span>
            </div>
            <div class="confusion-matrix">
              <h5>混淆矩阵</h5>
              <table class="matrix-table">
                <tbody>
                  <tr>
                    <td></td>
                    <td>预测: 有缺陷</td>
                    <td>预测: 无缺陷</td>
                  </tr>
                  <tr>
                    <td>实际: 正例</td>
                    <td class="tp">{{ regressionReport.summary?.tp }} (TP)</td>
                    <td class="fn">{{ regressionReport.summary?.fn }} (FN)</td>
                  </tr>
                  <tr>
                    <td>实际: 反例</td>
                    <td class="fp">{{ regressionReport.summary?.fp }} (FP)</td>
                    <td class="tn">{{ regressionReport.summary?.tn }} (TN)</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="llm-results-section" v-if="regressionReport.details?.length">
              <h5>大模型检测结果</h5>
              <div class="llm-results-list">
                <div v-for="res in visibleRegressionDetails" :key="res.test_case_id" :class="['llm-result-item', 'result-' + res.result]">
                  <div class="result-header">
                    <span class="result-id">测试用例 #{{ res.test_case_id }}</span>
                    <span :class="['result-type', res.is_positive ? 'positive' : 'negative']">
                      {{ res.is_positive ? '正例' : '反例' }}
                    </span>
                    <span class="result-expected">预期: {{ res.expected }}</span>
                    <span class="result-predicted">实际: {{ res.predicted }}</span>
                    <span :class="['result-status', res.result]">
                      {{ res.result === 'correct' ? '✓ 正确' : (res.result === 'wrong' ? '✗ 错误' : '⚠ 异常') }}
                    </span>
                  </div>
                  <div class="result-boxes" v-if="res.results?.length">
                    <div v-for="box in res.results" :key="box.box_id" class="box-result">
                      <span class="box-id">Box {{ box.box_id }}</span>
                      <span :class="['box-status', box.status === 'Y' ? 'defect' : 'normal']">{{ box.status }}</span>
                      <span class="box-reason">{{ box.reason }}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div class="results-toggle" v-if="hasMoreRegressionResults">
                <span class="results-count">
                  共 {{ regressionReport.details.length }} 条，当前显示 {{ showAllRegressionResults ? regressionReport.details.length : DEFAULT_VISIBLE_RESULTS }} 条
                </span>
                <button class="btn btn-secondary btn-sm" @click="showAllRegressionResults = !showAllRegressionResults">
                  <span class="material-icons">{{ showAllRegressionResults ? 'expand_less' : 'expand_more' }}</span>
                  {{ showAllRegressionResults ? '收起' : '展开全部' }}
                </button>
              </div>
            </div>
          </div>
          <div v-else class="empty-state">
            <span class="material-icons">assessment</span>
            <p>点击"运行"对当前选中版本执行完整回归测试</p>
          </div>
        </div>
      </div>

      <!-- 提示词修改历史 -->
      <div class="card scroll-section" v-if="currentDefect && versions.length > 0">
        <div class="card-header">
          <h2>
            修改历史
            <span class="history-count">{{ versions.length }}</span>
          </h2>
          <div class="header-actions">
            <button class="btn btn-ghost btn-sm" @click="exportHistory" title="导出CSV">
              <span class="material-icons">download</span>
            </button>
          </div>
        </div>
        <div class="card-body">
          <table class="data-table">
            <thead>
              <tr>
                <th>版本</th>
                <th>修改人</th>
                <th>摘要</th>
                <th>时间</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="v in versions" :key="v.id">
                <td>V{{ v.version }}</td>
                <td>{{ v.modifier || 'system' }}</td>
                <td>{{ v.summary || '-' }}</td>
                <td>{{ formatDate(v.created_at) }}</td>
                <td>
                  <button class="btn btn-sm btn-ghost" @click="loadVersion(v.id)">加载</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      
      <SettingsModal />
      <BatchAnnotateModal @completed="refreshAfterBatchAnnotate" />
      <GlobalTemplateModal />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useDefectStore } from '../stores/defect'
import { useAnnotationStore } from '../stores/annotation'
import { useUIStore } from '../stores/ui'
import { api, ApiError, TimeoutError, NetworkError } from '../api'
import ThumbnailGallery from '../components/ThumbnailGallery.vue'
import ImageAnnotationCanvas from '../components/ImageAnnotationKonva.vue'
import SettingsModal from '../components/SettingsModal.vue'
import BatchAnnotateModal from '../components/BatchAnnotateModal.vue'
import GlobalTemplateModal from '../components/GlobalTemplateModal.vue'

const defectStore = useDefectStore()
const annotationStore = useAnnotationStore()
const uiStore = useUIStore()

const defects = computed(() => defectStore.defects)
const currentDefect = computed(() => defectStore.currentDefect)
const currentVersionId = computed(() => defectStore.currentVersionId)
const versions = computed(() => defectStore.versions)
const testCases = computed(() => annotationStore.testCases)
const currentTestCaseId = computed(() => annotationStore.currentTestCaseId)
const isDirty = computed(() => annotationStore.isDirty)

const searchQuery = ref('')
const canvasWidth = ref(1200)
const canvasHeight = ref(800)
const selectedVersionId = ref(null)
const batchSelectedIds = ref([])
const selectedIds = ref([])
const autoSaveInterval = ref(60000) // 默认1分钟
const autoSaveTimer = ref(null)
const isRunningRegression = ref(false)
const regressionProgress = ref(0)
const regressionProgressText = ref('')
const regressionReport = ref(null)
const showAllRegressionResults = ref(false)
const DEFAULT_VISIBLE_RESULTS = 5
const autoSaveOptions = [
  { label: '30秒', value: 30000 },
  { label: '1分钟', value: 60000 },
  { label: '5分钟', value: 300000 },
  { label: '10分钟', value: 600000 }
]

const visibleRegressionDetails = computed(() => {
  if (!regressionReport.value?.details) return []
  if (showAllRegressionResults.value) return regressionReport.value.details
  return regressionReport.value.details.slice(0, DEFAULT_VISIBLE_RESULTS)
})

const hasMoreRegressionResults = computed(() => {
  const total = regressionReport.value?.details?.length || 0
  return total > DEFAULT_VISIBLE_RESULTS
})

// 版本对比相关
const inferenceComparisonResult = ref(null)
const isRunningComparison = ref(false)

const currentVersionNumber = computed(() => {
  if (!currentVersionId.value || versions.value.length === 0) return '?'
  const version = versions.value.find(v => v.id === currentVersionId.value)
  return version ? version.version : '?'
})

const baseVersionNumber = computed(() => {
  if (versions.value.length === 0) return '?'
  return versions.value[0].version
})

// 实时推理模型选择相关
const inferenceModel = ref('')
const inferenceModelSearch = ref('')
const inferenceModels = ref([])
const showInferenceModelDropdown = ref(false)
const isLoadingInferenceModels = ref(false)
const llmHealthStatus = ref('unknown') // 'unknown', 'online', 'offline', 'checking'
const llmHealthText = ref('未检测')
let healthCheckInterval = null

const currentTestCase = computed(() => {
  return testCases.value.find(tc => tc.id === currentTestCaseId.value)
})

// 定时检测 LLM 连通性（每10秒）
function startHealthCheck() {
  stopHealthCheck()
  healthCheckInterval = setInterval(() => {
    if (llmHealthStatus.value !== 'checking') {
      checkLLMHealth()
    }
  }, 10000)
}

function stopHealthCheck() {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval)
    healthCheckInterval = null
  }
}

// 切换模型时立即检测
watch(inferenceModel, () => {
  checkLLMHealth()
})

const totalCount = computed(() => testCases.value.length)
const positiveCount = computed(() => testCases.value.filter(tc => tc.is_positive !== false).length)
const negativeCount = computed(() => testCases.value.filter(tc => tc.is_positive === false).length)
const annotatedCount = computed(() => testCases.value.filter(tc => tc.annotation_count > 0).length)

// 过滤后的推理模型列表
const filteredInferenceModels = computed(() => {
  if (!inferenceModelSearch.value) {
    return inferenceModels.value
  }
  const query = inferenceModelSearch.value.toLowerCase()
  return inferenceModels.value.filter(model => {
    const modelName = (model.id || model).toLowerCase()
    return modelName.includes(query)
  })
})

const defectData = ref({
  defect_cn: '',
  defect_class: '',
  judgment_points: '',
  exclusions: ''
})

// 焦点区域追踪：'defect' | 'canvas' | null
const focusArea = ref(null)

// 缺陷描述撤销历史
const defectHistory = ref([])
const defectHistoryIndex = ref(-1)
const isUndoRedo = ref(false) // 防止撤销/重做时触发历史记录

// 记录缺陷描述历史
function recordDefectHistory() {
  if (isUndoRedo.value) return

  // 截断后面的历史
  if (defectHistoryIndex.value < defectHistory.value.length - 1) {
    defectHistory.value = defectHistory.value.slice(0, defectHistoryIndex.value + 1)
  }

  // 添加新历史记录
  defectHistory.value.push({
    defect_cn: defectData.value.defect_cn,
    defect_class: defectData.value.defect_class,
    judgment_points: defectData.value.judgment_points,
    exclusions: defectData.value.exclusions
  })
  defectHistoryIndex.value = defectHistory.value.length - 1

  // 限制历史记录数量
  if (defectHistory.value.length > 50) {
    defectHistory.value.shift()
    defectHistoryIndex.value--
  }
}

// 撤销缺陷描述
function undoDefectDescription() {
  if (defectHistoryIndex.value > 0) {
    defectHistoryIndex.value--
    isUndoRedo.value = true
    defectData.value = { ...defectHistory.value[defectHistoryIndex.value] }
    isUndoRedo.value = false
  }
}

// 重做缺陷描述
function redoDefectDescription() {
  if (defectHistoryIndex.value < defectHistory.value.length - 1) {
    defectHistoryIndex.value++
    isUndoRedo.value = true
    defectData.value = { ...defectHistory.value[defectHistoryIndex.value] }
    isUndoRedo.value = false
  }
}

// 全局键盘事件处理
function handleGlobalKeyDown(e) {
  // 只处理 Ctrl+Z 和 Ctrl+Y
  if (!((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'y' || e.key === 'Z' || e.key === 'Y'))) {
    return
  }

  e.preventDefault()

  // 根据焦点区域决定撤销/重做哪个内容
  if (focusArea.value === 'defect') {
    // 缺陷描述区域
    if (e.key === 'z' || e.key === 'Z') {
      undoDefectDescription()
    } else if (e.key === 'y' || e.key === 'Y') {
      redoDefectDescription()
    }
  } else if (focusArea.value === 'canvas') {
    // 画布区域 - 调用 annotation store 的撤销/重做
    if (e.key === 'z' || e.key === 'Z') {
      annotationStore.undo()
    } else if (e.key === 'y' || e.key === 'Y') {
      annotationStore.redo()
    }
  }
}

// 检测缺陷描述是否有变更
const hasDefectDataChanges = computed(() => {
  if (!currentDefect.value) return false
  return (
    defectData.value.defect_cn !== (currentDefect.value.defect_cn || '') ||
    defectData.value.defect_class !== (currentDefect.value.defect_class || '') ||
    defectData.value.judgment_points !== (currentDefect.value.judgment_points || '') ||
    defectData.value.exclusions !== (currentDefect.value.exclusions || '')
  )
})

watch(currentDefect, (defect) => {
  inferenceComparisonResult.value = null
  regressionReport.value = null
  showAllRegressionResults.value = false

  if (defect) {
    defectData.value = {
      defect_cn: defect.defect_cn || '',
      defect_class: defect.defect_class || '',
      judgment_points: defect.judgment_points || '',
      exclusions: defect.exclusions || ''
    }
    // 初始化缺陷描述历史
    defectHistory.value = [{ ...defectData.value }]
    defectHistoryIndex.value = 0
    loadVersions(defect.id)
  }
}, { immediate: true })

watch(() => defectStore.currentDefect?.id, async (defectId) => {
  if (defectId) {
    await annotationStore.fetchTestCases(defectId)
    // 默认选择第一张图片
    if (annotationStore.testCases.length > 0 && !annotationStore.currentTestCaseId) {
      annotationStore.selectTestCase(annotationStore.testCases[0].id)
    }
  }
}, { immediate: true })

async function loadVersions(defectId) {
  try {
    await defectStore.fetchVersions(defectId)
    if (versions.value.length > 0) {
      selectedVersionId.value = versions.value[0].id
    }
  } catch (error) {
    console.error('Failed to load versions:', error)
  }
}

function changeVersion() {
  defectStore.setVersion(selectedVersionId.value)
}

function selectTestCase(id) {
  annotationStore.selectTestCase(id)
}

async function deleteTestCase(id) {
  try {
    await api.delete(`/api/testcase/${id}`)
    await annotationStore.fetchTestCases(currentDefect.value.id)
    uiStore.notify('测试用例已删除', 'success', '成功')
  } catch (error) {
    uiStore.notify('删除失败: ' + error.message, 'error', '错误')
  }
}

async function batchDeleteTestCases(ids) {
  try {
    await api.testcases.batchDelete(ids)
    await annotationStore.fetchTestCases(currentDefect.value.id)
    uiStore.notify(`已删除 ${ids.length} 个测试用例`, 'success', '成功')
  } catch (error) {
    uiStore.notify('批量删除失败: ' + error.message, 'error', '错误')
  }
}

async function batchSetType({ ids, is_positive }) {
  try {
    await api.testcases.batchSetType(ids, is_positive)
    await annotationStore.fetchTestCases(currentDefect.value.id)
    uiStore.notify(`已修改 ${ids.length} 个测试用例类型`, 'success', '成功')
  } catch (error) {
    uiStore.notify('批量修改失败: ' + error.message, 'error', '错误')
  }
}

async function handleUpload(files) {
  if (!currentDefect.value) {
    uiStore.notify('请先选择一个缺陷类别', 'error', '错误')
    return
  }
  for (const file of files) {
    const formData = new FormData()
    formData.append('files', file)
    formData.append('is_positive', 'true')
    try {
      await api.post(`/api/defect/${currentDefect.value.id}/testcases`, formData, {
        headers: { 'Content-Type': undefined }
      })
    } catch (error) {
      console.error('Upload failed:', error)
    }
  }
  await annotationStore.fetchTestCases(currentDefect.value.id)
  uiStore.notify(`已上传 ${files.length} 张图片`, 'success', '成功')
}

function handleNavigate(direction) {
  const currentIndex = testCases.value.findIndex(tc => tc.id === currentTestCaseId.value)
  if (currentIndex === -1) return
  if (direction === 'prev' && currentIndex > 0) {
    selectTestCase(testCases.value[currentIndex - 1].id)
  } else if (direction === 'next' && currentIndex < testCases.value.length - 1) {
    selectTestCase(testCases.value[currentIndex + 1].id)
  }
}

async function runInference() {
  if (!currentDefect.value || !currentTestCaseId.value) return
  try {
    uiStore.showLoading('正在推理...')
    const result = await api.post(`/api/defect/${currentDefect.value.id}/inference`, {
      test_case_id: currentTestCaseId.value,
      model: inferenceModel.value || undefined
    })
    inferenceResult.value = result
    uiStore.hideLoading()
    uiStore.notify('推理完成', 'success', '成功')
  } catch (error) {
    uiStore.hideLoading()
    uiStore.notify('推理失败: ' + error.message, 'error', '错误')
  }
}

async function runVersionComparison() {
  if (!currentTestCaseId.value) {
    uiStore.notify('请先选择一张图片进行对比', 'warning', '提示')
    return
  }

  if (llmHealthStatus.value === 'offline') {
    uiStore.notify('大模型服务连接异常，请检查服务状态', 'error', '错误')
    return
  }

  isRunningComparison.value = true
  inferenceComparisonResult.value = null

  try {
    uiStore.showLoading('正在对比...')

    let resultA, resultB
    const versionLabelA = hasDefectDataChanges.value ? '修改版' : `V${getVersionNumber(currentVersionId.value)}`
    const versionLabelB = hasDefectDataChanges.value ? '当前版' : `V${getVersionNumber(currentVersionId.value)}`

    if (hasDefectDataChanges.value) {
      // 有变更：修改版 vs 当前保存的版本
      console.log('[对比测试] 有修改，发送自定义缺陷描述:', {
        defect_cn: defectData.value.defect_cn,
        defect_class: defectData.value.defect_class,
        judgment_points: defectData.value.judgment_points,
        exclusions: defectData.value.exclusions
      })
      ;[resultA, resultB] = await Promise.all([
        api.post(`/api/defect/${currentDefect.value.id}/inference`, {
          test_case_id: currentTestCaseId.value,
          model: inferenceModel.value || undefined,
          // 传入修改后的自定义缺陷描述
          defect_cn: defectData.value.defect_cn,
          defect_class: defectData.value.defect_class,
          judgment_points: defectData.value.judgment_points,
          exclusions: defectData.value.exclusions
        }),
        api.post(`/api/defect/${currentDefect.value.id}/inference`, {
          test_case_id: currentTestCaseId.value,
          version_id: currentVersionId.value,
          model: inferenceModel.value || undefined
        })
      ])
    } else {
      // 无变更：当前版本 vs 当前版本
      ;[resultA, resultB] = await Promise.all([
        api.post(`/api/defect/${currentDefect.value.id}/inference`, {
          test_case_id: currentTestCaseId.value,
          version_id: currentVersionId.value,
          model: inferenceModel.value || undefined
        }),
        api.post(`/api/defect/${currentDefect.value.id}/inference`, {
          test_case_id: currentTestCaseId.value,
          version_id: currentVersionId.value,
          model: inferenceModel.value || undefined
        })
      ])
    }

    const resultAList = Array.isArray(resultA) ? resultA : (resultA.raw_response || resultA.results || [])
    const resultBList = Array.isArray(resultB) ? resultB : (resultB.raw_response || resultB.results || [])

    if (resultAList.length === 0 && resultBList.length === 0) {
      uiStore.notify('当前版本和基准版本推理结果均为空，请检查提示词配置', 'warning', '提示')
    } else if (resultAList.length === 0) {
      uiStore.notify('当前版本推理结果为空，请检查提示词配置', 'warning', '提示')
    } else if (resultBList.length === 0) {
      uiStore.notify('基准版本推理结果为空，请检查提示词配置', 'warning', '提示')
    }

    inferenceComparisonResult.value = {
      versionA: versionLabelA,
      versionB: versionLabelB,
      resultA: resultAList,
      resultB: resultBList,
      promptA: resultA.prompt_used || '',
      promptB: resultB.prompt_used || ''
    }

    uiStore.hideLoading()
    uiStore.notify('版本对比完成', 'success', '成功')
  } catch (error) {
    uiStore.hideLoading()
    // 清除旧结果，避免显示过时数据
    inferenceComparisonResult.value = null
    console.error('[对比测试] 请求失败:', error)
    uiStore.notify('对比失败: ' + error.message, 'error', '错误')
  } finally {
    isRunningComparison.value = false
  }
}

function getVersionNumber(versionId) {
  const version = versions.value.find(v => v.id === versionId)
  return version ? version.version : '?'
}

// 获取推理模型列表
async function fetchInferenceModels() {
  isLoadingInferenceModels.value = true
  try {
    const result = await api.get('/api/models')
    if (result.models) {
      inferenceModels.value = result.models
    }
  } catch (error) {
    console.error('Failed to fetch models:', error)
    // 使用默认列表
    inferenceModels.value = [
      { id: 'Qwen/Qwen2.5-7B-Instruct', owned_by: 'Qwen' },
      { id: 'Qwen/Qwen2.5-14B-Instruct', owned_by: 'Qwen' },
      { id: 'Qwen/Qwen2.5-32B-Instruct', owned_by: 'Qwen' },
      { id: 'Qwen/Qwen2.5-72B-Instruct', owned_by: 'Qwen' },
      { id: 'deepseek-ai/DeepSeek-V2.5', owned_by: 'DeepSeek' },
      { id: 'THUDM/glm-4-9b-chat', owned_by: 'THUDM' }
    ]
  } finally {
    if (inferenceModel.value && !inferenceModels.value.find(m => (m.id || m) === inferenceModel.value)) {
      inferenceModels.value.unshift({ id: inferenceModel.value, owned_by: 'Custom' })
    }
    isLoadingInferenceModels.value = false
  }
}

// 选择推理模型
function selectInferenceModel(modelId) {
  inferenceModel.value = modelId
  inferenceModelSearch.value = ''
  showInferenceModelDropdown.value = false
}

// 处理推理模型输入框失焦
function handleInferenceModelBlur() {
  setTimeout(() => {
    showInferenceModelDropdown.value = false
    // 强制保存用户输入的内容
    if (inferenceModelSearch.value) {
      inferenceModel.value = inferenceModelSearch.value
    }
    inferenceModelSearch.value = ''
  }, 200)
}

// 处理推理模型 Enter 键
function handleInferenceModelEnter() {
  if (inferenceModelSearch.value) {
    inferenceModel.value = inferenceModelSearch.value
    inferenceModelSearch.value = ''
    showInferenceModelDropdown.value = false
  }
}

// 检测 LLM 连通性
async function checkLLMHealth() {
  llmHealthStatus.value = 'checking'
  llmHealthText.value = '检测中...'
  try {
    // 构建请求参数，如果有指定模型则传递
    const params = {}
    if (inferenceModel.value) {
      params.model = inferenceModel.value
    }

    const result = await api.get('/api/llm_health', params)
    if (result.status === 'online') {
      llmHealthStatus.value = 'online'
      llmHealthText.value = '服务正常'
    } else {
      llmHealthStatus.value = 'offline'
      llmHealthText.value = result.message || '服务异常'
    }
  } catch (error) {
    llmHealthStatus.value = 'offline'
    llmHealthText.value = '检测失败'
  }
}

async function singleAutoAnnotate(testCaseId) {
  if (!currentDefect.value?.id) {
    uiStore.notify('请先选择一个缺陷类别', 'error', '错误')
    return
  }
  try {
    uiStore.showLoading('正在自动标注...')
    const result = await api.post(`/api/auto_annotate/defect/${currentDefect.value.id}`, {
      clear_existing_boxes: true,
      test_case_ids: [testCaseId]
    })
    uiStore.hideLoading()
    if (result.success) {
      uiStore.notify('自动标注任务已启动', 'success', '成功')
      pollAutoAnnotateStatus(result.task_id)
    } else {
      uiStore.notify(result.error || '自动标注失败', 'error', '错误')
    }
  } catch (error) {
    uiStore.hideLoading()
    uiStore.notify('自动标注失败: ' + error.message, 'error', '错误')
  }
}

async function batchAutoAnnotate(testCaseIds) {
  if (!currentDefect.value?.id) {
    uiStore.notify('请先选择一个缺陷类别', 'error', '错误')
    return
  }
  if (!testCaseIds || testCaseIds.length === 0) {
    uiStore.notify('请先选择要标注的图片', 'error', '错误')
    return
  }
  try {
    uiStore.showLoading(`正在自动标注 ${testCaseIds.length} 张图片...`)
    const result = await api.post(`/api/auto_annotate/defect/${currentDefect.value.id}`, {
      clear_existing_boxes: true,
      test_case_ids: testCaseIds
    })
    uiStore.hideLoading()
    if (result.success) {
      uiStore.notify('自动标注任务已启动', 'success', '成功')
      pollAutoAnnotateStatus(result.task_id)
    } else {
      uiStore.notify(result.error || '自动标注失败', 'error', '错误')
    }
  } catch (error) {
    uiStore.hideLoading()
    uiStore.notify('自动标注失败: ' + error.message, 'error', '错误')
  }
}

async function pollAutoAnnotateStatus(taskId) {
  const poll = async () => {
    try {
      const status = await api.get(`/api/auto_annotate/task/${taskId}`)
      if (status.status === 'completed') {
        uiStore.notify(`自动标注完成！共生成 ${status.total_boxes_created} 个标注框`, 'success', '成功')
        if (currentDefect.value) {
          await annotationStore.fetchTestCases(currentDefect.value.id)
          // 重新加载当前测试用例的标注数据
          if (currentTestCaseId.value) {
            await annotationStore.loadAnnotations(currentTestCaseId.value)
          }
        }
      } else if (status.status === 'failed') {
        uiStore.notify(status.error || '标注失败', 'error', '错误')
      } else if (status.status === 'processing') {
        setTimeout(poll, 2000)
      }
    } catch (error) {
      console.error('Poll error:', error)
    }
  }
  await poll()
}

function openBatchAnnotate() {
  uiStore.openBatchAnnotateModal()
}

async function refreshAfterBatchAnnotate() {
  if (currentDefect.value) {
    await annotationStore.fetchTestCases(currentDefect.value.id)
    // 重新加载当前测试用例的标注数据
    if (currentTestCaseId.value) {
      await annotationStore.loadAnnotations(currentTestCaseId.value)
    }
  }
}

function onBoxesChanged() {
}

async function saveAnnotations() {
  if (!currentTestCaseId.value || !isDirty.value) return
  try {
    await annotationStore.saveAnnotations(currentTestCaseId.value)
    uiStore.notify('标注已保存', 'success', '保存成功')
  } catch (error) {
    uiStore.notify('保存失败: ' + error.message, 'error', '保存失败')
  }
}

function openBatchImport() {
  uiStore.openBatchImportModal()
}

function openGlobalTemplate() {
  uiStore.openGlobalTemplateModal()
}

// 自动保存功能
function startAutoSave() {
  stopAutoSave()
  if (autoSaveInterval.value > 0) {
    autoSaveTimer.value = setInterval(async () => {
      // 批量保存所有有未保存修改的标注
      if (annotationStore.totalUnsavedCount > 0) {
        try {
          await annotationStore.saveAllAnnotations()
          console.log(`[自动保存] 已保存 ${annotationStore.totalUnsavedCount} 个测试用例的标注`)
        } catch (error) {
          console.error('[自动保存] 保存失败:', error)
        }
      }
    }, autoSaveInterval.value)
  }
}

function stopAutoSave() {
  if (autoSaveTimer.value) {
    clearInterval(autoSaveTimer.value)
    autoSaveTimer.value = null
  }
}

// 保存缺陷描述
async function saveDefectDescription() {
  if (!currentDefect.value) return
  try {
    if (currentVersionId.value) {
      // 更新现有版本
      await api.put(`/api/defect_version/${currentVersionId.value}`, {
        defect_cn: defectData.value.defect_cn,
        defect_class: defectData.value.defect_class,
        judgment_points: defectData.value.judgment_points,
        exclusions: defectData.value.exclusions
      })
    } else {
      // 创建新版本
      await api.post('/api/defect_version', {
        defect_id: currentDefect.value.id,
        defect_cn: defectData.value.defect_cn,
        defect_class: defectData.value.defect_class,
        judgment_points: defectData.value.judgment_points,
        exclusions: defectData.value.exclusions,
        summary: '保存修改'
      })
    }
    // 更新当前缺陷数据
    defectStore.updateCurrentDefect({
      defect_cn: defectData.value.defect_cn,
      defect_class: defectData.value.defect_class,
      judgment_points: defectData.value.judgment_points,
      exclusions: defectData.value.exclusions
    })
    // 刷新版本列表
    await defectStore.fetchVersions(currentDefect.value.id)
    uiStore.notify('缺陷描述已保存', 'success', '保存成功')
  } catch (error) {
    uiStore.notify('保存失败: ' + error.message, 'error', '保存失败')
  }
}

async function publishVersion() {
  if (!currentDefect.value) return
  try {
    const result = await api.post('/api/defect_version', {
      defect_id: currentDefect.value.id,
      defect_cn: defectData.value.defect_cn,
      defect_class: defectData.value.defect_class,
      judgment_points: defectData.value.judgment_points,
      exclusions: defectData.value.exclusions
    })
    if (result.success) {
      uiStore.notify('新版本已发布', 'success', '成功')
      loadVersions(currentDefect.value.id)
    }
  } catch (error) {
    uiStore.notify('发布失败: ' + error.message, 'error', '错误')
  }
}

function cancelEdit() {
  if (currentDefect.value) {
    defectData.value = {
      defect_cn: currentDefect.value.defect_cn || '',
      defect_class: currentDefect.value.defect_class || '',
      judgment_points: currentDefect.value.judgment_points || '',
      exclusions: currentDefect.value.exclusions || ''
    }
  }
}

async function runRegressionTest() {
  if (!currentDefect.value) {
    uiStore.notify('请先选择一个缺陷类别', 'error', '错误')
    return
  }

  isRunningRegression.value = true
  regressionProgress.value = 0
  regressionProgressText.value = '准备执行...'
  regressionReport.value = null

  try {
    uiStore.showLoading('正在执行回归测试...')
    regressionProgressText.value = '正在执行...'

    const result = await api.post('/api/regression_test', {
      defect_id: currentDefect.value.id,
      version_id: currentVersionId.value || undefined,
      use_real_llm: false,
      model_name: inferenceModel.value || undefined
    }, { timeout: 300000 })

    regressionReport.value = result

    regressionProgress.value = 100
    regressionProgressText.value = '执行完成'
    uiStore.notify('回归测试完成', 'success', '成功')
  } catch (error) {
    uiStore.notify('回归测试失败: ' + error.message, 'error', '错误')
    regressionProgressText.value = '执行失败'
  } finally {
    isRunningRegression.value = false
    uiStore.hideLoading()
  }
}

function closeRegressionTest() {
  // 不再需要，因为直接在页面执行
}

async function loadRegressionReport() {
  if (!currentDefect.value) return
  try {
    const result = await api.get(`/api/defect/${currentDefect.value.id}/regression_report`)
    if (result && result.total_samples !== undefined) {
      regressionReport.value = result
    }
  } catch (error) {
    console.log('No regression report available')
  }
}

function loadVersion(versionId) {
  defectStore.setVersion(versionId)
  selectedVersionId.value = versionId
  if (currentDefect.value) {
    defectData.value = {
      defect_cn: currentDefect.value.defect_cn || '',
      defect_class: currentDefect.value.defect_class || '',
      judgment_points: currentDefect.value.judgment_points || '',
      exclusions: currentDefect.value.exclusions || ''
    }
  }
  uiStore.notify('版本已加载', 'success', '成功')
}

function exportHistory() {
  if (!versions.value.length) return
  let csv = '版本号,修改人,修改摘要,创建时间\n'
  versions.value.forEach(v => {
    csv += `V${v.version},${v.modifier || 'system'},${v.summary || '无'},${formatDate(v.created_at)}\n`
  })
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', `提示词修改历史_${currentDefect.value?.name || 'export'}_${new Date().toISOString().slice(0, 10)}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

function exportRegressionReport() {
  if (!regressionReport.value?.details?.length) return
  let csv = '测试用例ID,类型,预期,实际,结果,详细结果\n'
  regressionReport.value.details.forEach(res => {
    csv += `${res.test_case_id},${res.is_positive ? '正例' : '反例'},${res.expected},${res.predicted},${res.result === 'correct' ? '正确' : (res.result === 'wrong' ? '错误' : '异常')},"${JSON.stringify(res.results).replace(/"/g, '""')}"\n`
  })
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', `regression_report_${new Date().toISOString().slice(0, 10)}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

function formatDate(dateStr) {
  if (!dateStr) return 'N/A'
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN')
}

onMounted(async () => {
  await defectStore.fetchDefects()
  await fetchLLMConfig()
  await fetchInferenceModels()
  startHealthCheck()
  checkLLMHealth()
  startAutoSave()
})

onUnmounted(() => {
  stopHealthCheck()
  stopAutoSave()
})

async function fetchLLMConfig() {
  try {
    const result = await api.get('/api/llm_config')
    if (result && result.default_model) {
      inferenceModel.value = result.default_model
    }
  } catch (error) {
    console.error('Failed to fetch LLM config:', error)
  }
}
</script>

<style scoped>
.home-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
  scroll-snap-type: y proximity;
  scroll-behavior: smooth;
}

.main-content {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}

.scroll-section {
  scroll-snap-align: start;
  scroll-margin-top: 20px;
}

.editor-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}

.editor-card {
  background: var(--card-bg);
  padding: 16px;
  border-radius: 12px;
  border: 1px solid var(--glass-border);
}

.editor-card h4 {
  margin: 0 0 12px;
  font-size: 14px;
  color: var(--text-secondary);
}

.editor-card textarea {
  width: 100%;
  min-height: 80px;
  padding: 12px;
  border-radius: 8px;
  background: var(--input-bg);
  border: 1px solid var(--glass-border);
  color: var(--text-primary);
  font-family: inherit;
  resize: vertical;
}

.placeholder-text {
  text-align: center;
  padding: 40px;
  color: var(--text-muted);
}

.annotation-workspace {
  display: flex;
  flex-direction: row;
  gap: 12px;
  height: calc(100vh - 280px);
  min-height: 500px;
}

.canvas-panel {
  flex: 1;
  min-width: 0;
  background: var(--input-bg);
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.canvas-panel .annotation-canvas-container {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.canvas-panel .canvas-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.thumbnail-panel {
  width: 280px;
  flex-shrink: 0;
  background: var(--card-bg);
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.no-image-placeholder {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  gap: 16px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.stats {
  font-size: 13px;
  color: var(--text-secondary);
  white-space: nowrap;
}

/* 下拉菜单 */
.dropdown {
  position: relative;
}

.autosave-select {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: 8px;
}

.autosave-select label {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.autosave-dropdown {
  padding: 4px 8px;
  border-radius: 4px;
  background: var(--input-bg);
  border: 1px solid var(--glass-border);
  color: var(--text-primary);
  font-size: 12px;
  cursor: pointer;
}

.autosave-dropdown:focus {
  outline: none;
  border-color: var(--primary-color);
}

/* Ghost 按钮 */
.btn-ghost {
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-secondary);
}

.btn-ghost:hover {
  background: var(--hover-bg);
  color: var(--text-primary);
}

/* 状态徽章 */
.status-badge {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-left: 8px;
  vertical-align: middle;
}

.status-badge.online {
  background: var(--success-color);
  box-shadow: 0 0 6px var(--success-color);
}

.status-badge.offline {
  background: var(--error-color);
}

.status-badge.checking {
  background: var(--warning-color);
  animation: pulse 1s infinite;
}

/* 紧凑版本对比 */
.version-compare-compact {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
}

.version-compare-compact .version-tag {
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--primary-color);
  color: white;
  font-weight: 500;
}

.version-compare-compact .version-tag.muted {
  background: var(--input-bg);
  color: var(--text-secondary);
}

.version-compare-compact .compare-sep {
  color: var(--text-muted);
  font-size: 11px;
}

.history-count {
  margin-left: 8px;
  padding: 2px 8px;
  background: var(--input-bg);
  border-radius: 10px;
  font-size: 12px;
  font-weight: normal;
  color: var(--text-muted);
}

.version-select {
  padding: 6px 12px;
  border-radius: 6px;
  background: var(--input-bg);
  border: 1px solid var(--glass-border);
  color: var(--text-primary);
}

.btn-text {
  margin-left: 4px;
}

/* 推理结果样式 */
.inference-result {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.inference-result h4 {
  margin: 0 0 12px;
  font-size: 14px;
  color: var(--text-secondary);
}

.inference-result pre {
  background: var(--input-bg);
  padding: 16px;
  border-radius: 8px;
  overflow-x: auto;
  font-size: 12px;
  line-height: 1.5;
  margin: 0;
  max-height: 300px;
  overflow-y: auto;
}

/* 回归测试报告样式 */
.regression-summary {
  margin-bottom: 20px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.summary-item {
  background: var(--card-bg);
  padding: 16px;
  border-radius: 12px;
  text-align: center;
}

.summary-item .label {
  display: block;
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.summary-item .value {
  display: block;
  font-size: 24px;
  font-weight: 600;
  color: var(--text-primary);
}

.summary-item.correct .value {
  color: var(--success-color);
}

.summary-item.wrong .value {
  color: var(--error-color);
}

.summary-item.accuracy .value {
  color: var(--primary-color);
}

/* 数据表格样式 */
.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th,
.data-table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid var(--glass-border);
}

.data-table th {
  background: var(--card-bg);
  font-weight: 500;
  color: var(--text-secondary);
}

.data-table tbody tr:hover {
  background: var(--hover-bg);
}

/* 空状态样式 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: var(--text-muted);
}

.empty-state .material-icons {
  font-size: 48px;
  margin-bottom: 16px;
}

/* 回归测试进度样式 */
.regression-progress {
  padding: 20px;
  text-align: center;
}

.regression-progress .progress-bar {
  height: 8px;
  background: var(--card-bg);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 12px;
}

.regression-progress .progress-fill {
  height: 100%;
  background: var(--primary-gradient);
  transition: width 0.3s;
}

.regression-progress .progress-text {
  font-size: 14px;
  color: var(--text-secondary);
}

/* LLM 状态指示器样式 */
.llm-status-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 13px;
  background: var(--input-bg);
}

.llm-status-indicator .status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--muted-color);
}

.llm-status-indicator .status-text {
  color: var(--muted-color);
}

.llm-status-indicator.online .status-dot {
  background: var(--online-color);
}

.llm-status-indicator.online .status-text {
  color: var(--online-color);
}

.llm-status-indicator.offline .status-dot {
  background: var(--offline-color);
}

.llm-status-indicator.offline .status-text {
  color: var(--offline-color);
}

.llm-status-indicator.checking .status-dot {
  background: var(--checking-color);
  animation: pulse 1s infinite;
}

.llm-status-indicator.checking .status-text {
  color: var(--checking-color);
}

.llm-status-indicator.unknown .status-dot {
  background: var(--muted-color);
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* 版本对比样式 */
.compare-arrow {
  padding: 4px 8px;
  background: var(--primary-color);
  color: white;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
}

.version-compare-labels {
  display: flex;
  align-items: center;
  gap: 8px;
}

.version-tag {
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
}

.version-tag.current-version {
  background: rgba(99, 102, 241, 0.2);
  color: var(--primary-color);
}

.version-tag.base-version {
  background: rgba(34, 197, 94, 0.2);
  color: var(--success-color);
}

.comparison-action-wrapper {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}

.comparison-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--warning-color, #f59e0b);
  padding: 4px 8px;
  background: rgba(245, 158, 11, 0.1);
  border-radius: 4px;
  animation: fadeIn 0.3s ease;
}

.comparison-hint-info {
  color: var(--primary-color, #6366f1);
  background: rgba(99, 102, 241, 0.1);
}

.comparison-hint .hint-icon {
  font-size: 14px;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

.inference-comparison {
  padding: 16px;
}

.comparison-header {
  display: flex;
  justify-content: center;
  gap: 40px;
  margin-bottom: 20px;
}

.version-label {
  font-size: 16px;
  font-weight: 600;
  padding: 8px 16px;
  border-radius: 8px;
}

.version-label.version-a {
  background: rgba(99, 102, 241, 0.2);
  color: var(--primary-hover);
}

.version-label.version-b {
  background: rgba(16, 185, 129, 0.2);
  color: var(--success-color);
}

.comparison-content {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}

.comparison-panel {
  background: var(--card-bg);
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--glass-border);
}

.comparison-panel.version-a-panel {
  border-top: 3px solid var(--primary-hover);
}

.comparison-panel.version-b-panel {
  border-top: 3px solid var(--success-color);
}

.comparison-panel .panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: var(--input-bg);
  font-weight: 500;
}

.version-a-panel .panel-header {
  color: var(--primary-hover);
}

.version-b-panel .panel-header {
  color: var(--success-color);
}

.comparison-panel .panel-body {
  padding: 16px;
}

.comparison-panel .panel-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--glass-border);
  background: rgba(0, 0, 0, 0.1);
}

.prompt-details {
  margin: 0;
}

.prompt-details summary {
  cursor: pointer;
  font-size: 13px;
  color: var(--text-secondary);
  padding: 4px 0;
  user-select: none;
}

.prompt-details summary:hover {
  color: var(--primary-color);
}

.prompt-details[open] summary {
  margin-bottom: 12px;
}

.prompt-text {
  margin: 0;
  padding: 12px;
  background: var(--input-bg);
  border-radius: 8px;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 300px;
  overflow-y: auto;
  color: var(--text-primary);
}

.result-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: var(--input-bg);
  border-radius: 8px;
  margin-bottom: 8px;
}

.result-item:last-child {
  margin-bottom: 0;
}

.result-item .box-id {
  font-weight: 600;
  color: var(--text-secondary);
  min-width: 50px;
}

.result-item .result-status {
  padding: 4px 12px;
  border-radius: 20px;
  font-weight: 600;
  font-size: 13px;
}

.result-item .result-status.y {
  background: rgba(16, 185, 129, 0.2);
  color: var(--success-color);
}

.result-item .result-status.n {
  background: rgba(239, 68, 68, 0.2);
  color: var(--error-color);
}

.result-item .result-status.u {
  background: rgba(245, 158, 11, 0.2);
  color: var(--warning-color);
}

.result-item .result-status.e {
  background: rgba(107, 114, 128, 0.2);
  color: var(--muted-color);
}

.result-item .result-reason {
  flex: 1;
  color: var(--text-secondary);
  font-size: 13px;
}

.comparison-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px;
  color: var(--text-secondary);
  gap: 16px;
}

.comparison-loading .spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--glass-border);
  border-top-color: var(--primary-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

/* 模型选择器样式 */
.model-selector {
  display: flex;
  align-items: center;
  gap: 8px;
}

.model-selector label {
  font-size: 14px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.model-select-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  gap: 4px;
}

.model-input {
  width: 200px;
  padding: 6px 10px;
  border-radius: 6px;
  background: var(--input-bg);
  border: 1px solid var(--glass-border);
  color: var(--text-primary);
  font-size: 13px;
}

.model-input:focus {
  outline: none;
  border-color: var(--primary-color);
}

.model-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 40px;
  margin-top: 4px;
  background: var(--card-bg);
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  max-height: 200px;
  overflow-y: auto;
  z-index: 100;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.model-option {
  padding: 8px 12px;
  cursor: pointer;
  font-size: 13px;
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

/* 连通性状态样式 */
.connection-status {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  background: var(--input-bg);
}

.connection-status .status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-muted);
}

.connection-status.online .status-dot {
  background: var(--success-color);
  box-shadow: 0 0 4px var(--success-color);
}

.connection-status.online {
  color: var(--success-color);
}

.connection-status.offline .status-dot {
  background: var(--error-color);
  box-shadow: 0 0 4px var(--error-color);
}

.connection-status.offline {
  color: var(--error-color);
}

.connection-status.checking .status-dot {
  background: var(--warning-color);
  animation: pulse 1s infinite;
}

.connection-status.checking {
  color: var(--warning-color);
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.btn-icon {
  padding: 4px;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-icon:hover {
  background: var(--hover-bg);
  color: var(--text-primary);
}

.btn-icon:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.regression-report {
  padding: 16px;
}

.report-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.report-header h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.accuracy-summary-single {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: var(--card-bg);
  border-radius: 8px;
  margin-bottom: 20px;
  border: 1px solid var(--glass-border);
}

.accuracy-summary-single .accuracy-label {
  font-size: 14px;
  color: var(--text-secondary);
}

.accuracy-summary-single .accuracy-value {
  font-size: 20px;
  font-weight: bold;
  color: var(--primary-color);
}

.accuracy-summary-single .accuracy-detail {
  font-size: 13px;
  color: var(--text-muted);
}

.confusion-matrix {
  margin-bottom: 24px;
}

.confusion-matrix h5 {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 500;
}

.matrix-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.matrix-table td {
  padding: 8px 12px;
  border: 1px solid var(--glass-border);
  text-align: center;
}

.matrix-table .tp { background: rgba(76, 175, 80, 0.2); }
.matrix-table .tn { background: rgba(33, 150, 243, 0.2); }
.matrix-table .fp { background: rgba(255, 152, 0, 0.2); }
.matrix-table .fn { background: rgba(244, 67, 54, 0.2); }

.llm-results-section {
  margin-top: 20px;
}

.llm-results-section h5 {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 500;
}

.llm-results-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.llm-result-item {
  background: var(--card-bg);
  border-radius: 8px;
  border: 1px solid var(--glass-border);
  overflow: hidden;
}

.llm-result-item.result-correct { border-left: 3px solid var(--success-color); }
.llm-result-item.result-wrong { border-left: 3px solid var(--error-color); }
.llm-result-item.result-error { border-left: 3px solid var(--warning-color); }

.result-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--input-bg);
  flex-wrap: wrap;
}

.result-id {
  font-weight: 600;
  font-size: 14px;
}

.result-type {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.result-type.positive {
  background: rgba(16, 185, 129, 0.2);
  color: var(--success-color);
}

.result-type.negative {
  background: rgba(59, 130, 246, 0.2);
  color: var(--info-color);
}

.result-expected,
.result-predicted {
  font-size: 13px;
  color: var(--text-secondary);
}

.result-status {
  margin-left: auto;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.result-status.correct {
  background: rgba(16, 185, 129, 0.2);
  color: var(--success-color);
}

.result-status.wrong {
  background: rgba(239, 68, 68, 0.2);
  color: var(--error-color);
}

.result-status.error {
  background: rgba(245, 158, 11, 0.2);
  color: var(--warning-color);
}

.result-boxes {
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.box-result {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: var(--input-bg);
  border-radius: 6px;
  font-size: 13px;
}

.box-id {
  font-weight: 500;
  color: var(--text-secondary);
  min-width: 60px;
}

.box-status {
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 600;
  min-width: 40px;
  text-align: center;
}

.box-status.defect {
  background: rgba(239, 68, 68, 0.2);
  color: var(--error-color);
}

.box-status.normal {
  background: rgba(16, 185, 129, 0.2);
  color: var(--success-color);
}

.box-reason {
  color: var(--text-secondary);
  flex: 1;
}

.results-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 12px 16px;
  margin-top: 12px;
  background: var(--input-bg);
  border-radius: 8px;
}

.results-count {
  font-size: 13px;
  color: var(--text-muted);
}

.results-toggle .btn {
  display: flex;
  align-items: center;
  gap: 4px;
}

.results-toggle .material-icons {
  font-size: 18px;
}
</style>
