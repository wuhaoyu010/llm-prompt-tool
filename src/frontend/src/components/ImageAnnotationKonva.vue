<template>
  <div class="annotation-canvas-container">
    <!-- 工具栏 -->
    <div class="canvas-toolbar">
      <div class="label-preset-group">
        <label class="label-preset-label">标签:</label>
        <input
          v-model="presetLabel"
          type="text"
          class="label-preset-input"
          placeholder="输入标签..."
          @keydown.enter.stop
        />
      </div>

      <div class="toolbar-divider"></div>

      <div class="tool-group">
        <button
          class="btn btn-sm tool-btn"
          :class="{ 'btn-primary': currentTool === 'rectangle', 'btn-secondary': currentTool !== 'rectangle' }"
          @click="setTool('rectangle')"
          title="标注模式 (N)"
        >
          <span class="material-icons">crop_din</span>
          <span class="tool-label">标注 (N)</span>
        </button>
        <button
          class="btn btn-sm tool-btn"
          :class="{ 'btn-primary': currentTool === 'select', 'btn-secondary': currentTool !== 'select' }"
          @click="setTool('select')"
          title="选择模式 (V)"
        >
          <span class="material-icons">mouse_pointer</span>
          <span class="tool-label">选择 (V)</span>
        </button>
        <button
          class="btn btn-sm btn-secondary tool-btn"
          @click="handleUndo"
          title="撤销 (Ctrl+Z)"
          :disabled="!canUndo"
        >
          <span class="material-icons">undo</span>
        </button>
        <button
          class="btn btn-sm btn-secondary tool-btn"
          @click="handleRedo"
          title="重做 (Ctrl+Y)"
          :disabled="!canRedo"
        >
          <span class="material-icons">redo</span>
        </button>
        <button
          class="btn btn-sm btn-secondary tool-btn"
          @click="clearAll"
          title="清空所有"
        >
          <span class="material-icons">clear_all</span>
          <span class="tool-label">清空</span>
        </button>
      </div>

      <div class="toolbar-divider"></div>

      <div class="zoom-controls">
        <button class="btn btn-sm btn-secondary" @click="zoomOut" title="缩小">
          <span class="material-icons">remove</span>
        </button>
        <span class="zoom-level">{{ Math.round(stageScale * 100) }}%</span>
        <button class="btn btn-sm btn-secondary" @click="zoomIn" title="放大">
          <span class="material-icons">add</span>
        </button>
        <button class="btn btn-sm btn-secondary" @click="fitToScreen" title="适应屏幕">
          <span class="material-icons">fit_screen</span>
        </button>
      </div>

      <div class="toolbar-spacer"></div>

      <button
        v-if="selectedBoxId"
        class="btn btn-sm btn-danger tool-btn"
        @click="deleteSelected"
        title="删除选中 (Delete)"
      >
        <span class="material-icons">delete</span>
        <span class="tool-label">删除</span>
      </button>

      <button
        class="btn btn-sm btn-secondary tool-btn"
        @click="showShortcutsPanel = !showShortcutsPanel"
        title="快捷键说明"
      >
        <span class="material-icons">keyboard</span>
      </button>
    </div>

    <!-- 快捷键说明面板 -->
    <div v-if="showShortcutsPanel" class="shortcuts-panel">
      <div class="shortcuts-header">
        <h4>快捷键说明</h4>
        <button class="btn btn-sm btn-icon" @click="showShortcutsPanel = false">
          <span class="material-icons">close</span>
        </button>
      </div>
      <div class="shortcuts-content">
        <div class="shortcut-group">
          <div class="shortcut-title">工具切换</div>
          <div class="shortcut-item"><kbd>N</kbd> 标注模式</div>
          <div class="shortcut-item"><kbd>V</kbd> 选择模式</div>
          <div class="shortcut-item"><kbd>空格</kbd>+拖动 临时拖动画布</div>
        </div>
        <div class="shortcut-group">
          <div class="shortcut-title">标注操作</div>
          <div class="shortcut-item"><kbd>Ctrl</kbd>+<kbd>S</kbd> 保存</div>
          <div class="shortcut-item"><kbd>Ctrl</kbd>+<kbd>Z</kbd> 撤销</div>
          <div class="shortcut-item"><kbd>Ctrl</kbd>+<kbd>Y</kbd> 重做</div>
          <div class="shortcut-item"><kbd>Del</kbd> 删除选中</div>
        </div>
        <div class="shortcut-group">
          <div class="shortcut-title">视图操作</div>
          <div class="shortcut-item"><kbd>Z</kbd> 缩放到选中框</div>
          <div class="shortcut-item"><kbd>双击框</kbd> 缩放到该框</div>
          <div class="shortcut-item"><kbd>Ctrl</kbd>+<kbd>滚轮</kbd> 缩放</div>
          <div class="shortcut-item"><kbd>双击画布</kbd> 适应屏幕</div>
        </div>
        <div class="shortcut-group">
          <div class="shortcut-title">导航操作</div>
          <div class="shortcut-item"><kbd>D</kbd> / <kbd>←</kbd> 上一张</div>
          <div class="shortcut-item"><kbd>F</kbd> / <kbd>→</kbd> 下一张</div>
        </div>
      </div>
    </div>

    <!-- Konva Stage -->
    <div ref="containerRef" class="canvas-wrapper">
      <div v-if="!imageUrl" class="upload-placeholder" @click="triggerUpload"
        @dragover.prevent="isDragOver = true" @dragleave.prevent="isDragOver = false" @drop.prevent="handleDrop"
        :class="{ 'drag-over': isDragOver }">
        <span class="material-icons">cloud_upload</span>
        <p>点击或拖拽上传图片</p>
        <p class="hint-text">支持多选 | 快捷键: D 上一张 | F 下一张</p>
        <input ref="fileInput" type="file" accept="image/*" multiple hidden @change="handleFileSelect">
      </div>

      <v-stage v-else ref="stageRef" :config="stageConfig" @wheel="handleWheel" @mousedown="handleStageMouseDown"
        @mousemove="handleStageMouseMove" @mouseup="handleStageMouseUp" @mouseleave="handleStageMouseUp"
        @dblclick="handleDoubleClick">
        <v-layer ref="layerRef">
          <!-- 图片 -->
          <v-image v-if="imageObj" :config="imageConfig" />

          <!-- 已有的标注矩形 -->
          <v-rect v-for="box in boxes" :key="box.id" :config="getBoxConfig(box)" @click="handleBoxClick($event, box)"
            @dblclick="handleBoxDblClick($event, box)" @transformend="handleTransformEnd($event, box)" />

          <!-- Transformer for selected box -->
          <v-transformer ref="transformerRef" :config="transformerConfig" />

          <!-- 正在绘制的矩形 -->
          <v-rect v-if="isDrawing && drawingRect" :config="drawingRectConfig" />
        </v-layer>
      </v-stage>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick, shallowRef } from 'vue'
import { useAnnotationStore } from '../stores/annotation'
import { useUIStore } from '../stores/ui'
import { useDefectStore } from '../stores/defect'

const props = defineProps({
  imageUrl: String,
  width: { type: Number, default: 1200 },
  height: { type: Number, default: 800 }
})

const emit = defineEmits(['upload', 'navigate', 'boxes-changed'])

const annotationStore = useAnnotationStore()
const uiStore = useUIStore()
const defectStore = useDefectStore()

// DOM refs
const containerRef = ref(null)
const fileInput = ref(null)
const stageRef = ref(null)
const layerRef = ref(null)
const transformerRef = ref(null)

// State
const currentTool = ref('select')
const presetLabel = ref('')
const isDragOver = ref(false)
const showShortcutsPanel = ref(false)

// Image state
const imageObj = shallowRef(null)
const imageNaturalSize = ref({ width: 0, height: 0 })

// Stage state
const stageScale = ref(1)
const stagePosition = ref({ x: 0, y: 0 })
const containerSize = ref({ width: 0, height: 0 })

// Selection state
const selectedBoxId = ref(null)

// Drawing state
const isDrawing = ref(false)
const drawingRect = ref(null)
const drawStartPoint = ref({ x: 0, y: 0 })

// Space drag state
const spacePressed = ref(false)
const isPanning = ref(false)
const lastPanPosition = ref({ x: 0, y: 0 })

// Undo/Redo
const canUndo = computed(() => annotationStore.history.length > 0)
const canRedo = computed(() => annotationStore.redoStack.length > 0)

// Computed - 确保boxes始终是数组，即使Store返回undefined
const boxes = computed(() => annotationStore.currentAnnotations || [])

// Stage config
const stageConfig = computed(() => ({
  width: containerSize.value.width,
  height: containerSize.value.height,
  scaleX: stageScale.value,
  scaleY: stageScale.value,
  x: stagePosition.value.x,
  y: stagePosition.value.y,
  draggable: spacePressed.value
}))

// Image config
const imageConfig = computed(() => ({
  image: imageObj.value,
  width: imageNaturalSize.value.width,
  height: imageNaturalSize.value.height
}))

// Transformer config - nodes are set dynamically via updateTransformer
const transformerConfig = {
  rotateEnabled: false,
  enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'middle-left', 'middle-right', 'top-center', 'bottom-center'],
  anchorSize: 12,
  anchorCornerRadius: 6,
  borderStroke: '#DC2626',
  anchorStroke: '#DC2626',
  anchorFill: '#fff',
  anchorStrokeWidth: 2,
  borderWidth: 2,
  padding: 4,
  boundBoxFunc: (oldBox, newBox) => {
    // Limit resize
    if (newBox.width < 10 || newBox.height < 10) {
      return oldBox
    }
    return newBox
  }
}

// Drawing rect config
const drawingRectConfig = computed(() => ({
  x: drawingRect.value?.x || 0,
  y: drawingRect.value?.y || 0,
  width: drawingRect.value?.width || 0,
  height: drawingRect.value?.height || 0,
  stroke: '#EF4444',
  strokeWidth: 2 / stageScale.value,
  dash: [5 / stageScale.value, 5 / stageScale.value],
  fill: 'rgba(239, 68, 68, 0.1)'
}))

// Normalize coordinates (0-999)
function pixelToNorm(pixel, dimension) {
  return Math.round((pixel / dimension) * 999)
}

function normToPixel(norm, dimension) {
  return (norm / 999) * dimension
}

// Get box config for Konva
function getBoxConfig(box) {
  const isSelected = selectedBoxId.value === box.id
  const x = normToPixel(box.x, imageNaturalSize.value.width)
  const y = normToPixel(box.y, imageNaturalSize.value.height)
  const w = normToPixel(box.width, imageNaturalSize.value.width)
  const h = normToPixel(box.height, imageNaturalSize.value.height)

  // Check if small box based on screen pixels
  const screenW = w * stageScale.value
  const screenH = h * stageScale.value
  const isSmallBox = screenW < 40 || screenH < 40

  return {
    id: box.id,
    x,
    y,
    width: w,
    height: h,
    // Selected box has no stroke - Transformer will draw the border
    stroke: isSelected ? undefined : '#EF4444',
    strokeWidth: isSelected ? 0 : 1 / stageScale.value,
    fill: isSmallBox ? 'rgba(239, 68, 68, 0.08)' : 'rgba(239, 68, 68, 0.15)',
    draggable: currentTool.value === 'select' && isSelected,
    name: 'box'
  }
}

// Find Konva node by box id
function findNodeById(id) {
  const stage = stageRef.value?.getStage()
  if (!stage) return null
  return stage.findOne(`#${id}`)
}

// Load image
function loadImage() {
  if (!props.imageUrl) {
    imageObj.value = null
    imageNaturalSize.value = { width: 0, height: 0 }
    return
  }

  const img = new window.Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => {
    imageObj.value = img
    imageNaturalSize.value = { width: img.width, height: img.height }

    nextTick(() => {
      fitToScreen()
    })
  }
  img.src = props.imageUrl
}

// Fit image to screen
function fitToScreen() {
  if (!containerSize.value.width || !imageNaturalSize.value.width) return

  const padding = 40
  const availableWidth = containerSize.value.width - padding * 2
  const availableHeight = containerSize.value.height - padding * 2

  const scaleX = availableWidth / imageNaturalSize.value.width
  const scaleY = availableHeight / imageNaturalSize.value.height

  stageScale.value = Math.min(scaleX, scaleY, 1)

  // Center the image
  stagePosition.value = {
    x: (containerSize.value.width - imageNaturalSize.value.width * stageScale.value) / 2,
    y: (containerSize.value.height - imageNaturalSize.value.height * stageScale.value) / 2
  }
}

// Zoom controls
function zoomIn() {
  stageScale.value = Math.min(5, stageScale.value * 1.2)
}

function zoomOut() {
  stageScale.value = Math.max(0.1, stageScale.value / 1.2)
}

// Zoom to box
function zoomToBox(box) {
  if (!box || !containerSize.value.width) return

  const boxW = normToPixel(box.width, imageNaturalSize.value.width)
  const boxH = normToPixel(box.height, imageNaturalSize.value.height)
  const boxX = normToPixel(box.x, imageNaturalSize.value.width)
  const boxY = normToPixel(box.y, imageNaturalSize.value.height)
  const boxCX = boxX + boxW / 2
  const boxCY = boxY + boxH / 2

  // Target scale: box occupies 70% of screen
  const targetScale = Math.min(
    (containerSize.value.width * 0.7) / boxW,
    (containerSize.value.height * 0.7) / boxH,
    5
  )

  stageScale.value = targetScale

  // Center on box
  stagePosition.value = {
    x: containerSize.value.width / 2 - boxCX * targetScale,
    y: containerSize.value.height / 2 - boxCY * targetScale
  }
}

// Tool switching
function setTool(tool) {
  currentTool.value = tool
  if (tool !== 'select') {
    selectedBoxId.value = null
    updateTransformer()
  }
}

// Update transformer
function updateTransformer() {
  const transformer = transformerRef.value?.getNode()
  if (!transformer) return

  if (selectedBoxId.value) {
    const node = findNodeById(selectedBoxId.value)
    if (node) {
      transformer.nodes([node])
      transformer.moveToTop()
    } else {
      transformer.nodes([])
    }
  } else {
    transformer.nodes([])
  }
}

// Event handlers
function handleStageMouseDown(e) {
  const stage = stageRef.value?.getStage()
  if (!stage) return

  // If space is pressed, we're panning
  if (spacePressed.value) {
    isPanning.value = true
    lastPanPosition.value = stage.getPointerPosition()
    return
  }

  // Drawing mode
  if (currentTool.value === 'rectangle') {
    const pos = stage.getRelativePointerPosition()

    isDrawing.value = true
    drawStartPoint.value = { x: pos.x, y: pos.y }
    drawingRect.value = { x: pos.x, y: pos.y, width: 0, height: 0 }
  }
}

function handleBoxClick(e, box) {
  if (currentTool.value !== 'select') return

  e.cancelBubble = true

  selectedBoxId.value = box.id
  updateTransformer()
}

function handleBoxDblClick(e, box) {
  e.cancelBubble = true
  zoomToBox(box)
}

function handleTransformEnd(e, box) {
  const node = e.target

  // Get new position and size
  const scaleX = node.scaleX()
  const scaleY = node.scaleY()

  node.scaleX(1)
  node.scaleY(1)

  // 添加边界检查，确保坐标在图像范围内
  const imageX = Math.max(0, Math.min(imageNaturalSize.value.width, node.x()))
  const imageY = Math.max(0, Math.min(imageNaturalSize.value.height, node.y()))
  const imageW = Math.max(0, Math.min(imageNaturalSize.value.width - imageX, node.width() * scaleX))
  const imageH = Math.max(0, Math.min(imageNaturalSize.value.height - imageY, node.height() * scaleY))

  const newX = pixelToNorm(imageX, imageNaturalSize.value.width)
  const newY = pixelToNorm(imageY, imageNaturalSize.value.height)
  const newW = pixelToNorm(imageW, imageNaturalSize.value.width)
  const newH = pixelToNorm(imageH, imageNaturalSize.value.height)

  const updatedBox = {
    ...box,
    x: Math.max(0, Math.min(999 - newW, newX)),
    y: Math.max(0, Math.min(999 - newH, newY)),
    width: Math.max(10, newW),
    height: Math.max(10, newH)
  }

  annotationStore.updateBox(updatedBox)
  emit('boxes-changed')
}

function handleDoubleClick(e) {
  const stage = stageRef.value?.getStage()
  if (!stage) return

  const pos = stage.getRelativePointerPosition()

  // Check if clicked on a box (only check annotation boxes, not transformer helpers)
  for (const box of boxes.value) {
    const x = normToPixel(box.x, imageNaturalSize.value.width)
    const y = normToPixel(box.y, imageNaturalSize.value.height)
    const w = normToPixel(box.width, imageNaturalSize.value.width)
    const h = normToPixel(box.height, imageNaturalSize.value.height)

    if (pos.x >= x && pos.x <= x + w && pos.y >= y && pos.y <= y + h) {
      selectedBoxId.value = box.id
      updateTransformer()
      zoomToBox(box)
      return
    }
  }

  // Double click on empty area - fit to screen
  fitToScreen()
}

function handleWheel(e) {
  // 只有按下 Ctrl 键时才进行缩放
  if (!e.evt.ctrlKey && !e.evt.metaKey) {
    // 不阻止默认行为，允许页面滚动
    return
  }

  e.evt.preventDefault()

  const stage = stageRef.value?.getStage()
  if (!stage) return

  const oldScale = stageScale.value
  const pointer = stage.getPointerPosition()

  const scaleBy = 1.1
  const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy

  stageScale.value = Math.max(0.1, Math.min(5, newScale))

  // Zoom to pointer position
  const mousePointTo = {
    x: (pointer.x - stagePosition.value.x) / oldScale,
    y: (pointer.y - stagePosition.value.y) / oldScale
  }

  stagePosition.value = {
    x: pointer.x - mousePointTo.x * stageScale.value,
    y: pointer.y - mousePointTo.y * stageScale.value
  }
}

// Drawing
function handleStageMouseMove(e) {
  if (!isDrawing.value) return

  const stage = stageRef.value?.getStage()
  if (!stage) return

  const pos = stage.getRelativePointerPosition()

  const x = Math.min(drawStartPoint.value.x, pos.x)
  const y = Math.min(drawStartPoint.value.y, pos.y)
  const w = Math.abs(pos.x - drawStartPoint.value.x)
  const h = Math.abs(pos.y - drawStartPoint.value.y)

  drawingRect.value = { x, y, width: w, height: h }
}

function handleStageMouseUp() {
  if (!isDrawing.value) return

  if (drawingRect.value && drawingRect.value.width > 5 && drawingRect.value.height > 5) {
    const label = presetLabel.value || defectStore.currentDefect?.name || ''

    // 转换到图像坐标系并添加边界检查
    const imageX = Math.max(0, Math.min(imageNaturalSize.value.width, drawingRect.value.x))
    const imageY = Math.max(0, Math.min(imageNaturalSize.value.height, drawingRect.value.y))
    const imageW = Math.max(0, Math.min(imageNaturalSize.value.width - imageX, drawingRect.value.width))
    const imageH = Math.max(0, Math.min(imageNaturalSize.value.height - imageY, drawingRect.value.height))

    const newBox = {
      id: `box_${Date.now()}`,
      x: pixelToNorm(imageX, imageNaturalSize.value.width),
      y: pixelToNorm(imageY, imageNaturalSize.value.height),
      width: pixelToNorm(imageW, imageNaturalSize.value.width),
      height: pixelToNorm(imageH, imageNaturalSize.value.height),
      label,
      type: 'rectangle'
    }

    annotationStore.addBox(newBox)
    emit('boxes-changed')

    // Switch to select mode and select new box
    selectedBoxId.value = newBox.id
    currentTool.value = 'select'
    nextTick(updateTransformer)
  }

  isDrawing.value = false
  drawingRect.value = null
}

// Delete
function deleteSelected() {
  if (selectedBoxId.value) {
    annotationStore.removeBox(selectedBoxId.value)
    selectedBoxId.value = null
    updateTransformer()
    emit('boxes-changed')
  }
}

// Clear all
function clearAll() {
  uiStore.showConfirm({
    title: '确认清空',
    message: '确定要清空所有标注吗？此操作不可撤销。',
    icon: 'warning',
    onConfirm: () => {
      annotationStore.clearAnnotations()
      selectedBoxId.value = null
      updateTransformer()
      emit('boxes-changed')
    }
  })
}

// Undo/Redo
function handleUndo() {
  annotationStore.undo()
  updateTransformer()
}

function handleRedo() {
  annotationStore.redo()
  updateTransformer()
}

// File upload
function triggerUpload() {
  fileInput.value?.click()
}

function handleFileSelect(e) {
  const files = Array.from(e.target.files)
  if (files.length > 0) {
    emit('upload', files)
  }
}

function handleDrop(e) {
  isDragOver.value = false
  const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))
  if (files.length > 0) {
    emit('upload', files)
  }
}

// Keyboard shortcuts
function handleKeyDown(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return

  // Ctrl+Z/Y 由父组件根据焦点区域处理，这里不再处理
  if (e.ctrlKey || e.metaKey) {
    if (e.key === 'z' || e.key === 'Z' || e.key === 'y' || e.key === 'Y') {
      // 让事件冒泡到父组件处理
      return
    }
  }

  if (e.key === ' ' && !spacePressed.value) {
    e.preventDefault()
    spacePressed.value = true
    return
  }

  switch (e.key.toLowerCase()) {
    case 'n':
      e.preventDefault()
      setTool('rectangle')
      return
    case 'v':
      e.preventDefault()
      setTool('select')
      return
    case 'z':
      if (!e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        if (selectedBoxId.value) {
          const box = boxes.value.find(b => b.id === selectedBoxId.value)
          if (box) zoomToBox(box)
        }
      }
      return
  }

  if (e.key === 'Delete' || e.key === 'Backspace') {
    deleteSelected()
    return
  }

  if (e.key === 'd' || e.key === 'D') {
    if (!e.ctrlKey && !e.metaKey) {
      emit('navigate', 'prev')
    }
  }
  if (e.key === 'f' || e.key === 'F') {
    if (!e.ctrlKey && !e.metaKey) {
      emit('navigate', 'next')
    }
  }
  if (e.key === 'ArrowLeft') {
    emit('navigate', 'prev')
  }
  if (e.key === 'ArrowRight') {
    emit('navigate', 'next')
  }
}

function handleKeyUp(e) {
  if (e.key === ' ') {
    spacePressed.value = false
    isPanning.value = false
  }
}

// Update container size
function updateContainerSize() {
  if (containerRef.value) {
    containerSize.value = {
      width: containerRef.value.clientWidth,
      height: containerRef.value.clientHeight
    }
  }
}

// Watchers
watch(() => props.imageUrl, (newUrl, oldUrl) => {
  // 切换图片时清除选中状态，防止选中框被带到新图片
  if (newUrl !== oldUrl) {
    selectedBoxId.value = null
    // 清除 transformer 绑定
    nextTick(() => {
      const transformer = transformerRef.value?.getNode()
      if (transformer) {
        transformer.nodes([])
      }
    })
  }
  loadImage()
}, { immediate: true })

// 当 boxes 变化时，确保Transformer与boxes同步
watch(boxes, (newBoxes) => {
  // 如果有选中的box，检查是否仍然存在
  if (selectedBoxId.value) {
    const exists = newBoxes.some(b => b.id === selectedBoxId.value)
    if (!exists) {
      selectedBoxId.value = null
    }
  }

  // 无论是否有选中，都更新Transformer以确保同步
  // 这解决了通过JS API直接操作Store时Transformer未更新的问题
  nextTick(() => {
    updateTransformer()
  })
}, { deep: true })

watch(() => defectStore.currentDefect, (defect) => {
  if (defect && !presetLabel.value) {
    presetLabel.value = defect.name
  }
}, { immediate: true })

// Lifecycle
onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)
  window.addEventListener('resize', updateContainerSize)

  updateContainerSize()
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('keyup', handleKeyUp)
  window.removeEventListener('resize', updateContainerSize)
})
</script>

<style scoped>
.annotation-canvas-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-color);
  border-radius: 12px;
  overflow: hidden;
}

.canvas-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: var(--card-bg);
  border-bottom: 1px solid var(--glass-border);
  flex-wrap: wrap;
}

.tool-group {
  display: flex;
  gap: 4px;
}

.label-preset-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.label-preset-label {
  font-size: 14px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.label-preset-input {
  width: 150px;
  padding: 6px 10px;
  border-radius: 6px;
  background: var(--input-bg);
  border: 1px solid var(--glass-border);
  color: var(--text-primary);
  font-size: 13px;
  transition: border-color 0.2s;
}

.label-preset-input:focus {
  outline: none;
  border-color: var(--primary-color);
}

.label-preset-input::placeholder {
  color: var(--text-muted);
}

.tool-btn {
  display: flex;
  align-items: center;
  gap: 6px;
}

.tool-label {
  font-size: 12px;
}

.toolbar-divider {
  width: 1px;
  height: 24px;
  background: var(--glass-border);
  margin: 0 4px;
}

.toolbar-spacer {
  flex: 1;
}

.zoom-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.zoom-level {
  min-width: 50px;
  text-align: center;
  font-size: 14px;
  color: var(--text-secondary);
}

.canvas-wrapper {
  flex: 1;
  overflow: hidden;
  position: relative;
  background: var(--bg-color);
}

.upload-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  border: 2px dashed var(--glass-border);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s;
}

.upload-placeholder:hover,
.upload-placeholder.drag-over {
  border-color: var(--primary-color);
  background: var(--hover-bg);
}

.upload-placeholder .material-icons {
  font-size: 64px;
  color: var(--text-muted);
  margin-bottom: 16px;
}

.upload-placeholder p {
  margin: 4px 0;
  color: var(--text-secondary);
}

.hint-text {
  font-size: 12px;
  color: var(--text-muted);
}

.btn-danger {
  background: linear-gradient(135deg, var(--error-color), #DC2626);
  color: white;
}

/* Shortcuts panel */
.shortcuts-panel {
  position: absolute;
  top: 70px;
  right: 20px;
  width: 280px;
  background: rgba(30, 30, 40, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  z-index: 100;
  overflow: hidden;
  backdrop-filter: blur(10px);
}

.shortcuts-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.shortcuts-header h4 {
  margin: 0;
  font-size: 14px;
  color: #fff;
  font-weight: 600;
}

.shortcuts-content {
  padding: 12px 16px;
  max-height: 400px;
  overflow-y: auto;
}

.shortcut-group {
  margin-bottom: 16px;
}

.shortcut-group:last-child {
  margin-bottom: 0;
}

.shortcut-title {
  font-size: 12px;
  font-weight: 600;
  color: #818cf8;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.shortcut-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.85);
}

.shortcut-item kbd {
  display: inline-block;
  padding: 2px 8px;
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  font-family: monospace;
  font-size: 12px;
  color: #fff;
  font-weight: 500;
}

/* Minimap */
</style>