<template>
  <div class="thumbnail-gallery">
    <!-- 工具栏 -->
    <div class="gallery-toolbar">
      <!-- 第一行：基础操作 -->
      <div class="toolbar-row toolbar-row-main">
        <label class="select-all-label">
          <input type="checkbox" :checked="isAllSelected" @change="toggleSelectAll">
          <span>全选</span>
        </label>
        
        <!-- 筛选器 -->
        <select v-model="filterType" class="filter-select" title="筛选类型">
          <option :value="FILTER_TYPES.ALL">全部</option>
          <option :value="FILTER_TYPES.POSITIVE">正例</option>
          <option :value="FILTER_TYPES.NEGATIVE">反例</option>
          <option :value="FILTER_TYPES.ANNOTATED">已标注</option>
          <option :value="FILTER_TYPES.UNANNOTATED">未标注</option>
        </select>

        <!-- 排序 -->
        <select v-model="sortBy" class="sort-select" title="排序方式">
          <option :value="SORT_OPTIONS.DEFAULT">默认排序</option>
          <option :value="SORT_OPTIONS.NAME">按名称</option>
          <option :value="SORT_OPTIONS.TIME">按时间</option>
          <option :value="SORT_OPTIONS.ANNOTATIONS">按标注数</option>
        </select>
        
        <div class="toolbar-spacer"></div>
        
        <!-- 视图模式切换 -->
        <div class="view-mode-toggle">
          <button
            class="btn btn-icon"
            :class="{ active: viewMode === VIEW_MODES.GRID }"
            @click="viewMode = VIEW_MODES.GRID"
            title="网格视图"
          >
            <span class="material-icons">grid_view</span>
          </button>
          <button
            class="btn btn-icon"
            :class="{ active: viewMode === VIEW_MODES.LIST }"
            @click="viewMode = VIEW_MODES.LIST"
            title="列表视图"
          >
            <span class="material-icons">view_list</span>
          </button>
        </div>
      </div>
      
      <!-- 第二行：批量操作（只有选中时才显示） -->
      <div v-if="selectedIds.length > 0" class="toolbar-row toolbar-row-batch">
        <div class="batch-actions">
          <button class="btn btn-sm btn-success" @click="batchSetPositive" title="设为正例">
            <span class="material-icons">check_circle</span>
            <span>正例</span>
          </button>
          <button class="btn btn-sm btn-warning" @click="batchSetNegative" title="设为反例">
            <span class="material-icons">cancel</span>
            <span>反例</span>
          </button>
          <button class="btn btn-sm btn-primary" @click="batchAutoAnnotate" title="自动标注">
            <span class="material-icons">auto_awesome</span>
            <span>自动标注</span>
          </button>
          <button class="btn btn-sm btn-danger" @click="batchDelete" title="批量删除">
            <span class="material-icons">delete</span>
            <span>删除</span>
          </button>
        </div>
        <div class="selected-count">
          已选择 <strong>{{ selectedIds.length }}</strong> 张
        </div>
      </div>
    </div>
    
    <!-- 缩略图区域 -->
    <div
      ref="thumbnailScrollWrapper"
      class="thumbnail-scroll-wrapper"
      :class="viewMode"
      @mouseenter="handleThumbnailMouseEnter"
      @mouseleave="handleThumbnailMouseLeave"
    >
      <!-- 网格视图 -->
      <div v-if="viewMode === VIEW_MODES.GRID" class="thumbnail-container grid">
        <div 
          v-for="tc in filteredAndSortedTestCases" 
          :key="tc.id"
          class="thumbnail-item"
          :class="{ 
            selected: tc.id === currentId,
            'batch-selected': selectedIdsSet.has(tc.id),
            'negative-sample': tc.is_positive === false,
            'positive-sample': tc.is_positive !== false
          }"
          @click="handleClick(tc.id, $event)"
          @contextmenu.prevent="showContextMenu($event, tc)"
        >
          <input 
            type="checkbox" 
            class="thumbnail-checkbox"
            :checked="selectedIdsSet.has(tc.id)"
            @change="toggleSelect(tc.id)"
            @click.stop
          >
          <div class="image-wrapper">
            <img :src="tc.preview_url" :alt="tc.filename" loading="lazy" />
            <div class="image-overlay">
              <button 
                class="overlay-btn annotate-btn" 
                @click.stop="$emit('auto-annotate', tc.id)"
                title="自动标注"
              >
                <span class="material-icons">auto_awesome</span>
              </button>
            </div>
          </div>
          <div class="thumbnail-info">
            <span class="sample-badge" :class="tc.is_positive === false ? 'negative' : 'positive'">
              {{ tc.is_positive === false ? '✗ 反例' : '✓ 正例' }}
            </span>
            <span v-if="getAnnotationCount(tc.id) > 0" class="annotation-count">
              {{ getAnnotationCount(tc.id) }} 框
            </span>
          </div>
          <div class="thumbnail-filename" :title="tc.filename">{{ tc.filename }}</div>
        </div>
      </div>
      
      <!-- 列表视图 -->
      <div v-else class="thumbnail-container list">
        <div 
          v-for="tc in filteredAndSortedTestCases" 
          :key="tc.id"
          class="list-item"
          :class="{ 
            selected: tc.id === currentId,
            'batch-selected': selectedIdsSet.has(tc.id)
          }"
          @click="handleClick(tc.id, $event)"
        >
          <input
            type="checkbox"
            class="list-checkbox"
            :checked="selectedIdsSet.has(tc.id)"
            @change="toggleSelect(tc.id)"
            @click.stop
          >
          <img :src="tc.preview_url" :alt="tc.filename" class="list-thumb" />
          <div class="list-info">
            <div class="list-filename">{{ tc.filename }}</div>
            <div class="list-meta">
              <span class="sample-badge" :class="tc.is_positive === false ? 'negative' : 'positive'">
                {{ tc.is_positive === false ? '✗ 反例' : '✓ 正例' }}
              </span>
              <span v-if="tc.annotation_count > 0" class="annotation-count">
                {{ tc.annotation_count }} 个标注框
              </span>
            </div>
          </div>
          <div class="list-actions">
            <button class="btn btn-icon" @click.stop="$emit('auto-annotate', tc.id)" title="自动标注">
              <span class="material-icons">auto_awesome</span>
            </button>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 右键菜单 -->
    <div v-if="contextMenu.show" class="context-menu" :style="contextMenu.style">
      <div class="menu-item" @click="contextMenuAction('annotate')">
        <span class="material-icons">auto_awesome</span> 自动标注
      </div>
      <div class="menu-item" @click="contextMenuAction('positive')">
        <span class="material-icons">check_circle</span> 设为正例
      </div>
      <div class="menu-item" @click="contextMenuAction('negative')">
        <span class="material-icons">cancel</span> 设为反例
      </div>
      <div class="menu-divider"></div>
      <div class="menu-item delete" @click="contextMenuAction('delete')">
        <span class="material-icons">delete</span> 删除
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useUIStore } from '../stores/ui'
import { useAnnotationStore } from '../stores/annotation'
import { FILTER_TYPES, SORT_OPTIONS, VIEW_MODES } from '../utils/constants'

// 缩略图滚动区域 ref
const thumbnailScrollWrapper = ref(null)

const props = defineProps({
  testCases: {
    type: Array,
    default: () => []
  },
  currentId: {
    type: [Number, String],
    default: null
  },
  selectedIds: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['select', 'delete', 'auto-annotate', 'batch-annotate', 'batch-delete', 'batch-set-type', 'update:selectedIds'])

const uiStore = useUIStore()
const annotationStore = useAnnotationStore()

// 获取测试用例的标注框数量（优先从store读取，fallback到props）
function getAnnotationCount(tcId) {
  const tcData = annotationStore.annotations[tcId]
  if (tcData) {
    // 如果在暂存模式，返回暂存区数量；否则返回已保存数量
    return tcData.isStaging ? tcData.stagingBoxes.length : tcData.savedBoxes.length
  }
  // Fallback到testCases中的annotation_count
  const tc = props.testCases.find(t => t.id === tcId)
  return tc?.annotation_count || 0
}

// 视图模式
const viewMode = ref(VIEW_MODES.GRID)

// 筛选类型
const filterType = ref(FILTER_TYPES.ALL)

// 排序方式
const sortBy = ref(SORT_OPTIONS.DEFAULT)

// 右键菜单状态
const contextMenu = ref({
  show: false,
  style: {},
  testCase: null
})

// 筛选后的测试用例
const filteredTestCases = computed(() => {
  let result = [...props.testCases]

  switch (filterType.value) {
    case FILTER_TYPES.POSITIVE:
      result = result.filter(tc => tc.is_positive !== false)
      break
    case FILTER_TYPES.NEGATIVE:
      result = result.filter(tc => tc.is_positive === false)
      break
    case FILTER_TYPES.ANNOTATED:
      result = result.filter(tc => getAnnotationCount(tc.id) > 0)
      break
    case FILTER_TYPES.UNANNOTATED:
      result = result.filter(tc => getAnnotationCount(tc.id) === 0)
      break
  }

  return result
})

// 排序后的测试用例
const sortedTestCases = computed(() => {
  const result = [...filteredTestCases.value]

  switch (sortBy.value) {
    case SORT_OPTIONS.NAME:
      result.sort((a, b) => (a.filename || '').localeCompare(b.filename || ''))
      break
    case SORT_OPTIONS.TIME:
      result.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
      break
    case SORT_OPTIONS.ANNOTATIONS:
      result.sort((a, b) => getAnnotationCount(b.id) - getAnnotationCount(a.id))
      break
  }

  return result
})

// 筛选并排序后的测试用例
const filteredAndSortedTestCases = computed(() => sortedTestCases.value)

const isAllSelected = computed(() => {
  return props.testCases.length > 0 &&
         props.selectedIds.length === props.testCases.length
})

// 优化：创建 Set 加速查找
const selectedIdsSet = computed(() => new Set(props.selectedIds))

// 缩略图区域滚动处理
function handleThumbnailMouseEnter() {
  if (thumbnailScrollWrapper.value) {
    thumbnailScrollWrapper.value.addEventListener('wheel', handleThumbnailWheel, { passive: false })
  }
}

function handleThumbnailMouseLeave() {
  if (thumbnailScrollWrapper.value) {
    thumbnailScrollWrapper.value.removeEventListener('wheel', handleThumbnailWheel)
  }
}

function handleThumbnailWheel(e) {
  if (thumbnailScrollWrapper.value) {
    e.preventDefault()
    e.stopPropagation()
    thumbnailScrollWrapper.value.scrollTop += e.deltaY
  }
}

function handleClick(id, event) {
  // 点击图片直接选中该图片（单选模式）
  emit('select', id)
}

function toggleSelect(id) {
  const newSelected = [...props.selectedIds]
  const index = newSelected.indexOf(id)
  if (index > -1) {
    newSelected.splice(index, 1)
  } else {
    newSelected.push(id)
  }
  emit('update:selectedIds', newSelected)
}

function toggleSelectAll() {
  if (isAllSelected.value) {
    emit('update:selectedIds', [])
  } else {
    const allIds = props.testCases.map(tc => tc.id)
    emit('update:selectedIds', allIds)
  }
}

function batchDelete() {
  if (props.selectedIds.length === 0) return
  
  uiStore.showConfirm({
    title: '确认删除',
    message: `确定要删除选中的 ${props.selectedIds.length} 个测试用例吗？`,
    icon: 'warning',
    onConfirm: () => {
      emit('batch-delete', props.selectedIds)
      emit('update:selectedIds', [])
    }
  })
}

function batchSetPositive() {
  emit('batch-set-type', { ids: props.selectedIds, is_positive: true })
}

function batchSetNegative() {
  emit('batch-set-type', { ids: props.selectedIds, is_positive: false })
}

function batchAutoAnnotate() {
  emit('batch-annotate', props.selectedIds)
}

// 单图删除
function deleteSingle(id) {
  uiStore.showConfirm({
    title: '确认删除',
    message: '确定要删除这张图片吗？此操作不可恢复。',
    icon: 'warning',
    onConfirm: () => {
      emit('delete', id)
    }
  })
}

// 显示右键菜单
function showContextMenu(event, testCase) {
  contextMenu.value = {
    show: true,
    style: {
      left: `${event.clientX}px`,
      top: `${event.clientY}px`
    },
    testCase
  }
}

// 隐藏右键菜单
function hideContextMenu() {
  contextMenu.value.show = false
}

// 右键菜单操作
function contextMenuAction(action) {
  const tc = contextMenu.value.testCase
  if (!tc) return
  
  switch (action) {
    case 'annotate':
      emit('auto-annotate', tc.id)
      break
    case 'positive':
      emit('batch-set-type', { ids: [tc.id], is_positive: true })
      break
    case 'negative':
      emit('batch-set-type', { ids: [tc.id], is_positive: false })
      break
    case 'delete':
      deleteSingle(tc.id)
      break
  }
  
  hideContextMenu()
}

// 点击其他地方隐藏右键菜单
onMounted(() => {
  document.addEventListener('click', hideContextMenu)
})

onUnmounted(() => {
  document.removeEventListener('click', hideContextMenu)
})
</script>

<style scoped>
.thumbnail-gallery {
  background: var(--card-bg);
  border-radius: 12px;
  padding: 10px;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.gallery-toolbar {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex-shrink: 0;
}

.toolbar-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.toolbar-row-main {
  justify-content: space-between;
}

.toolbar-row-batch {
  justify-content: space-between;
  padding: 8px;
  background: var(--input-bg);
  border-radius: 6px;
}

.select-all-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 14px;
  color: var(--text-secondary);
}

.batch-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toolbar-spacer {
  flex: 1;
}

.toolbar-left,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.selected-count {
  padding: 2px 8px;
  background: var(--primary-color);
  color: white;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
}

.selected-count strong {
  font-size: 12px;
}

.operation-hint {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  color: var(--text-secondary);
  padding: 2px 6px;
  background: var(--input-bg);
  border-radius: 4px;
}

.filter-select,
.sort-select {
  padding: 6px 10px;
  border-radius: 6px;
  background: var(--input-bg);
  border: 1px solid var(--glass-border);
  color: var(--text-primary);
  font-size: 13px;
  cursor: pointer;
}

.view-mode-toggle {
  display: flex;
  gap: 4px;
  background: var(--input-bg);
  padding: 4px;
  border-radius: 6px;
}

.view-mode-toggle .btn-icon {
  padding: 4px 8px;
  border-radius: 4px;
}

.view-mode-toggle .btn-icon.active {
  background: var(--primary-color);
  color: white;
}

.thumbnail-scroll-wrapper {
  overflow-x: hidden;
  overflow-y: auto;
  flex: 1;
}

.thumbnail-scroll-wrapper.grid {
  overflow-x: hidden;
  overflow-y: auto;
}

.thumbnail-scroll-wrapper.list {
  overflow-x: auto;
  overflow-y: hidden;
}

/* 网格视图样式 */
.thumbnail-container.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 12px;
  padding: 8px;
}

.thumbnail-item {
  position: relative;
  width: 100px;
  flex-shrink: 0;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  border: 2px solid transparent;
  transition: all 0.2s;
  background: var(--input-bg);
}

.thumbnail-item:hover {
  border-color: var(--primary-color);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.thumbnail-item.selected {
  border-color: var(--primary-color);
  box-shadow: var(--glow-primary);
}

.thumbnail-item.batch-selected {
  border-color: var(--accent-color);
  box-shadow: 0 0 12px rgba(6, 182, 212, 0.4);
}

.image-wrapper {
  position: relative;
  width: 100%;
  height: 75px;
  overflow: hidden;
}

.image-wrapper img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s;
}

.thumbnail-item:hover .image-wrapper img {
  transform: scale(1.05);
}

.image-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  padding: 8px;
  gap: 8px;
  opacity: 0;
  transition: opacity 0.2s;
}

.thumbnail-item:hover .image-overlay {
  opacity: 1;
}

.overlay-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.overlay-btn .material-icons {
  font-size: 18px;
}

.overlay-btn.delete-btn {
  background: var(--error-color);
  color: white;
}

.overlay-btn.annotate-btn {
  background: var(--primary-color);
  color: white;
}

.overlay-btn:hover {
  transform: scale(1.1);
}

.thumbnail-checkbox {
  position: absolute;
  top: 8px;
  left: 8px;
  width: 20px;
  height: 20px;
  opacity: 1;
  cursor: pointer;
  z-index: 2;
  accent-color: var(--primary-color);
}

.thumbnail-item.batch-selected .thumbnail-checkbox {
  accent-color: var(--accent-color);
}

.thumbnail-info {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
}

.thumbnail-filename {
  padding: 0 8px 8px;
  font-size: 11px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sample-badge {
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
}

.sample-badge.positive {
  background: var(--success-color);
  color: white;
}

.sample-badge.negative {
  background: var(--error-color);
  color: white;
}

.annotation-count {
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
}

/* 列表视图样式 */
.thumbnail-container.list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.list-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  border: 2px solid transparent;
  transition: all 0.2s;
  background: var(--input-bg);
}

.list-item:hover {
  border-color: var(--primary-color);
}

.list-item.selected {
  border-color: var(--primary-color);
  background: rgba(99, 102, 241, 0.1);
}

.list-item.batch-selected {
  border-color: var(--accent-color);
  background: rgba(6, 182, 212, 0.1);
}

.list-checkbox {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.list-thumb {
  width: 60px;
  height: 45px;
  object-fit: cover;
  border-radius: 4px;
}

.list-info {
  flex: 1;
  min-width: 0;
}

.list-filename {
  font-size: 13px;
  color: var(--text-primary);
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.list-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.list-actions {
  display: flex;
  gap: 8px;
}

/* 右键菜单样式 */
.context-menu {
  position: fixed;
  background: var(--card-bg);
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  padding: 8px 0;
  min-width: 160px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  z-index: 1000;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-primary);
  transition: background 0.2s;
}

.menu-item:hover {
  background: var(--hover-bg);
}

.menu-item.delete {
  color: var(--error-color);
}

.menu-item .material-icons {
  font-size: 18px;
}

.menu-divider {
  height: 1px;
  background: var(--glass-border);
  margin: 8px 0;
}

/* 按钮样式 */
.btn-success {
  background: var(--success-color);
  color: white;
}

.btn-warning {
  background: var(--warning-color, #f59e0b);
  color: white;
}

.btn-danger {
  background: var(--error-color);
  color: white;
}
</style>
