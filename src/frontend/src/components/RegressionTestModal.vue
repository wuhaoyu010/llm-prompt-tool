<template>
  <div v-if="show" class="modal" @click.self="close">
    <div class="modal-content modal-xl">
      <div class="modal-header">
        <h3>📊 回归测试报告</h3>
        <span class="material-icons modal-close" @click="close">close</span>
      </div>
      <div class="modal-body">
        <div v-if="!report" class="regression-intro">
          <p class="hint">对当前选中版本执行完整回归测试，验证缺陷检测准确性。</p>
          <button class="btn btn-primary" @click="runRegression" :disabled="isRunning">
            <span v-if="isRunning" class="material-icons spinning">sync</span>
            <span>{{ isRunning ? '运行中...' : '开始运行' }}</span>
          </button>
        </div>
        
        <div v-else class="regression-report">
          <div class="report-summary">
            <div class="summary-item">
              <span class="label">总样本数</span>
              <span class="value">{{ report.total_samples || 0 }}</span>
            </div>
            <div class="summary-item correct">
              <span class="label">正确</span>
              <span class="value">{{ report.correct_count || 0 }}</span>
            </div>
            <div class="summary-item wrong">
              <span class="label">错误</span>
              <span class="value">{{ report.wrong_count || 0 }}</span>
            </div>
            <div class="summary-item error">
              <span class="label">异常</span>
              <span class="value">{{ report.error_count || 0 }}</span>
            </div>
            <div class="summary-item accuracy">
              <span class="label">准确率</span>
              <span class="value">{{ report.accuracy || '0%' }}</span>
            </div>
          </div>
          
          <div class="report-actions">
            <button class="btn btn-secondary" @click="exportReport">
              <span class="material-icons">download</span>
              导出CSV
            </button>
            <button class="btn btn-primary" @click="runRegression">
              重新运行
            </button>
          </div>
          
          <div class="report-table-container">
            <table class="regression-table">
              <thead>
                <tr>
                  <th>图片</th>
                  <th>预期结果</th>
                  <th>实际结果</th>
                  <th>状态</th>
                  <th>详情</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(item, index) in report.results" :key="index" :class="getRowClass(item)">
                  <td>{{ item.filename }}</td>
                  <td>{{ item.expected ? '有缺陷' : '无缺陷' }}</td>
                  <td>{{ item.actual ? '有缺陷' : '无缺陷' }}</td>
                  <td>
                    <span class="status-badge" :class="getStatusClass(item)">
                      {{ getStatusText(item) }}
                    </span>
                  </td>
                  <td>
                    <pre v-if="item.details">{{ item.details }}</pre>
                    <span v-else>-</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useDefectStore } from '../stores/defect'
import { useUIStore } from '../stores/ui'
import { api } from '../api'

const props = defineProps({
  show: Boolean
})

const emit = defineEmits(['close'])

const defectStore = useDefectStore()
const uiStore = useUIStore()

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

const isRunning = ref(false)
const report = ref(null)

async function runRegression() {
  if (!defectStore.currentDefect?.id) {
    uiStore.notify('请先选择一个缺陷类别', 'error', '错误')
    return
  }

  isRunning.value = true
  report.value = null

  try {
    const result = await api.post('/api/regression_test', {
      defect_id: defectStore.currentDefect.id,
      version_id: defectStore.currentVersionId || undefined
    })
    report.value = {
      total_samples: result.summary?.total_cases || 0,
      correct_count: result.summary?.correct_predictions || 0,
      wrong_count: (result.summary?.fp || 0) + (result.summary?.fn || 0),
      error_count: 0,
      accuracy: (result.summary?.accuracy || 0) + '%',
      results: (result.details || []).map(item => ({
        ...item,
        actual: item.predicted === 'Y',
        correct: item.result === 'correct',
        status: item.result === 'error' ? 'error' : (item.result === 'correct' ? 'correct' : 'wrong')
      }))
    }
    uiStore.notify('回归测试完成', 'success', '成功')
  } catch (error) {
    uiStore.notify('回归测试失败: ' + error.message, 'error', '错误')
  } finally {
    isRunning.value = false
  }
}

function getRowClass(item) {
  if (item.status === 'error') return 'row-error'
  if (item.correct) return 'row-correct'
  return 'row-wrong'
}

function getStatusClass(item) {
  if (item.status === 'error') return 'status-error'
  if (item.correct) return 'status-correct'
  return 'status-wrong'
}

function getStatusText(item) {
  if (item.status === 'error') return '异常'
  if (item.correct) return '正确'
  return '错误'
}

function exportReport() {
  if (!report.value?.results) return
  
  let csv = '图片,预期结果,实际结果,状态,详情\n'
  report.value.results.forEach(item => {
    csv += `${item.filename},${item.expected ? '有缺陷' : '无缺陷'},${item.actual ? '有缺陷' : '无缺陷'},${getStatusText(item)},"${item.details || ''}"\n`
  })
  
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', `回归测试报告_${new Date().toISOString().slice(0, 10)}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

function close() {
  report.value = null
  emit('close')
}
</script>

<style scoped>
.modal-xl {
  max-width: 90vw;
  width: 1200px;
}

.regression-intro {
  text-align: center;
  padding: 40px;
}

.hint {
  color: var(--text-secondary);
  margin-bottom: 20px;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.report-summary {
  display: flex;
  gap: 16px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.summary-item {
  flex: 1;
  min-width: 120px;
  padding: 16px;
  background: var(--card-bg);
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

.summary-item.error .value {
  color: var(--warning-color);
}

.summary-item.accuracy .value {
  color: var(--primary-color);
}

.report-actions {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.report-table-container {
  max-height: 500px;
  overflow-y: auto;
}

.regression-table {
  width: 100%;
  border-collapse: collapse;
}

.regression-table th,
.regression-table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid var(--glass-border);
}

.regression-table th {
  background: var(--card-bg);
  font-weight: 500;
  color: var(--text-secondary);
  position: sticky;
  top: 0;
}

.regression-table tbody tr.row-correct {
  background: rgba(16, 185, 129, 0.1);
}

.regression-table tbody tr.row-wrong {
  background: rgba(239, 68, 68, 0.1);
}

.regression-table tbody tr.row-error {
  background: rgba(245, 158, 11, 0.1);
}

.status-badge {
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
}

.status-badge.status-correct {
  background: rgba(16, 185, 129, 0.2);
  color: var(--success-color);
}

.status-badge.status-wrong {
  background: rgba(239, 68, 68, 0.2);
  color: var(--error-color);
}

.status-badge.status-error {
  background: rgba(245, 158, 11, 0.2);
  color: var(--warning-color);
}

.regression-table pre {
  margin: 0;
  font-size: 12px;
  color: var(--text-muted);
  white-space: pre-wrap;
  max-width: 300px;
}
</style>
