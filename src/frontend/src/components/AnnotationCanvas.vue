<template>
  <div class="annotation-canvas-container">
    <div class="canvas-toolbar">
      <button 
        class="btn btn-sm tool-btn" 
        :class="{ 'btn-primary': isDrawingMode, 'btn-secondary': !isDrawingMode }"
        @click="toggleDrawingMode"
        title="画框 (D)"
      >
        <span class="material-icons">crop_din</span>
        <span class="tool-label">{{ isDrawingMode ? '绘制中' : '画框' }}</span>
      </button>
      <button 
        class="btn btn-sm tool-btn" 
        :class="{ 'btn-primary': isPanningMode, 'btn-secondary': !isPanningMode }"
        @click="togglePanningMode"
        title="平移 (Space)"
      >
        <span class="material-icons">pan_tool</span>
        <span class="tool-label">平移</span>
      </button>
      <div class="toolbar-divider"></div>
      <button 
        class="btn btn-sm btn-secondary tool-btn" 
        @click="undo"
        :disabled="history.length === 0"
        title="撤销 (Ctrl+Z)"
      >
        <span class="material-icons">undo</span>
      </button>
      <button 
        class="btn btn-sm btn-secondary tool-btn" 
        @click="redo"
        :disabled="redoStack.length === 0"
        title="重做 (Ctrl+Y)"
      >
        <span class="material-icons">redo</span>
      </button>
      <div class="toolbar-divider"></div>
      <div class="zoom-controls">
        <button class="btn btn-sm btn-secondary" @click="zoomOut" title="缩小">
          <span class="material-icons">remove</span>
        </button>
        <span class="zoom-level">{{ Math.round(zoom * 100) }}%</span>
        <button class="btn btn-sm btn-secondary" @click="zoomIn" title="放大">
          <span class="material-icons">add</span>
        </button>
        <button class="btn btn-sm btn-secondary" @click="resetZoom" title="重置缩放">
          <span class="material-icons">fit_screen</span>
        </button>
      </div>
      <div class="toolbar-spacer"></div>
      <button 
        v-if="selectedBoxId"
        class="btn btn-sm btn-danger tool-btn" 
        @click="deleteSelectedBox"
        title="删除选中框 (Delete)"
      >
        <span class="material-icons">delete</span>
        <span class="tool-label">删除</span>
      </button>
    </div>
    
    <div 
      class="canvas-wrapper" 
      ref="canvasContainer"
      @keydown="handleKeyDown"
      tabindex="0"
    >
      <div 
        v-if="!imageUrl" 
        class="upload-placeholder"
        @click="triggerUpload"
        @dragover.prevent="isDragOver = true"
        @dragleave.prevent="isDragOver = false"
        @drop.prevent="handleDrop"
        :class="{ 'drag-over': isDragOver }"
      >
        <span class="material-icons">cloud_upload</span>
        <p>点击或拖拽上传图片</p>
        <p class="hint-text">支持多选 | 快捷键: D 上一张 | F 下一张</p>
        <input 
          ref="fileInput"
          type="file" 
          accept="image/*" 
          multiple 
          hidden
          @change="handleFileSelect"
        >
      </div>
      
      <div v-else class="canvas-stage-container" ref="stageContainer">
        <v-stage
          ref="stageRef"
          :config="stageConfig"
          @mousedown="handleMouseDown"
          @mousemove="handleMouseMove"
          @mouseup="handleMouseUp"
          @wheel="handleWheel"
        >
          <v-layer ref="layerRef">
            <v-image :config="imageConfig" />
            <v-rect
              v-for="box in boxes"
              :key="box.id"
              :config="getRectConfig(box)"
              @click="selectBox(box)"
              @tap="selectBox(box)"
              @transformend="handleTransformEnd(box, $event)"
              @dragend="handleDragEnd(box, $event)"
            />
            <v-transformer
              v-if="selectedBoxId && !isDrawingMode"
              ref="transformerRef"
              :config="transformerConfig"
            />
            <v-rect
              v-if="newBox"
              :config="newBoxConfig"
            />
          </v-layer>
        </v-stage>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useAnnotationStore } from '../stores/annotation'
import { useUIStore } from '../stores/ui'

const props = defineProps({
  imageUrl: String,
  width: { type: Number, default: 800 },
  height: { type: Number, default: 600 }
})

const emit = defineEmits(['upload', 'navigate'])

const annotationStore = useAnnotationStore()
const uiStore = useUIStore()

const canvasContainer = ref(null)
const stageContainer = ref(null)
const stageRef = ref(null)
const layerRef = ref(null)
const transformerRef = ref(null)
const fileInput = ref(null)

const isDrawingMode = ref(false)
const isPanningMode = ref(false)
const zoom = ref(1)
const panOffset = ref({ x: 0, y: 0 })
const newBox = ref(null)
const startPoint = ref(null)
const selectedBoxId = ref(null)
const isDragOver = ref(false)
const imageSize = ref({ width: 0, height: 0 })

const transformerConfig = computed(() => ({
  nodes: selectedBoxId.value ? [getSelectedNode()] : [],
  enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
  rotateEnabled: false,
  borderStroke: '#4F46E5',
  anchorStroke: '#4F46E5',
  anchorFill: '#ffffff',
  anchorSize: 8,
  borderDash: [5, 5]
}))

function getSelectedNode() {
  if (!layerRef.value || !selectedBoxId.value) return null
  const stage = stageRef.value?.getStage()
  if (!stage) return null
  return stage.findOne(`#${selectedBoxId.value}`)
}

const stageConfig = computed(() => ({
  width: props.width,
  height: props.height,
  scaleX: zoom.value,
  scaleY: zoom.value,
  x: panOffset.value.x,
  y: panOffset.value.y,
  draggable: isPanningMode.value
}))

const imageConfig = ref({
  x: 0,
  y: 0,
  width: props.width,
  height: props.height,
  image: null,
  name: 'image'
})

const boxes = computed(() => annotationStore.currentAnnotations)

const history = computed(() => annotationStore.history)
const redoStack = computed(() => annotationStore.redoStack)

const newBoxConfig = computed(() => {
  if (!newBox.value) return {}
  return {
    x: newBox.value.x,
    y: newBox.value.y,
    width: newBox.value.width,
    height: newBox.value.height,
    fill: 'rgba(79, 70, 229, 0.3)',
    stroke: '#4F46E5',
    strokeWidth: 2 / zoom.value,
    dash: [5, 5]
  }
})

function getRectConfig(box) {
  const isSelected = box.id === selectedBoxId.value
  return {
    id: box.id,
    name: 'annotation-box',
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    fill: isSelected ? 'rgba(79, 70, 229, 0.5)' : 'rgba(79, 70, 229, 0.3)',
    stroke: isSelected ? '#818CF8' : '#4F46E5',
    strokeWidth: isSelected ? 3 / zoom.value : 2 / zoom.value,
    draggable: !isDrawingMode.value, // 非绘制模式下可拖动
    cornerRadius: 2
  }
}

async function loadImage(url) {
  if (!url) return

  try {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      imageConfig.value.image = img
      imageSize.value = { width: img.width, height: img.height }

      const containerWidth = props.width
      const containerHeight = props.height

      // 计算合适的缩放比例，使图片完整显示在容器中
      const scaleX = containerWidth / img.width
      const scaleY = containerHeight / img.height
      const scale = Math.min(scaleX, scaleY, 1) * 0.95 // 留一些边距

      imageConfig.value.width = img.width
      imageConfig.value.height = img.height

      // 设置初始缩放，使图片完整显示
      zoom.value = scale

      // 居中显示
      const scaledWidth = img.width * scale
      const scaledHeight = img.height * scale
      panOffset.value = {
        x: (containerWidth - scaledWidth) / 2,
        y: (containerHeight - scaledHeight) / 2
      }
    }
    img.src = url
  } catch (error) {
    console.error('Failed to load image:', error)
  }
}

function toggleDrawingMode() {
  isDrawingMode.value = !isDrawingMode.value
  if (isDrawingMode.value) {
    isPanningMode.value = false
  }
}

function togglePanningMode() {
  isPanningMode.value = !isPanningMode.value
  if (isPanningMode.value) {
    isDrawingMode.value = false
  }
}

function handleMouseDown(e) {
  const stage = e.target.getStage()
  const pos = stage.getPointerPosition()
  
  if (isPanningMode.value) return
  
  if (isDrawingMode.value && (e.target === stage || e.target.name() === 'image')) {
    const scaledPos = {
      x: (pos.x - stage.x()) / stage.scaleX(),
      y: (pos.y - stage.y()) / stage.scaleY()
    }
    
    startPoint.value = scaledPos
    newBox.value = {
      x: scaledPos.x,
      y: scaledPos.y,
      width: 0,
      height: 0
    }
    selectedBoxId.value = null
  }
}

function handleMouseMove(e) {
  if (!isDrawingMode.value || !newBox.value || !startPoint.value) return
  
  const stage = e.target.getStage()
  const pos = stage.getPointerPosition()
  const scaledPos = {
    x: (pos.x - stage.x()) / stage.scaleX(),
    y: (pos.y - stage.y()) / stage.scaleY()
  }
  
  newBox.value = {
    x: Math.min(startPoint.value.x, scaledPos.x),
    y: Math.min(startPoint.value.y, scaledPos.y),
    width: Math.abs(scaledPos.x - startPoint.value.x),
    height: Math.abs(scaledPos.y - startPoint.value.y)
  }
}

function handleMouseUp() {
  if (!isDrawingMode.value || !newBox.value) return
  
  if (newBox.value.width > 10 && newBox.value.height > 10) {
    const box = {
      id: `box_${Date.now()}`,
      x: newBox.value.x,
      y: newBox.value.y,
      width: newBox.value.width,
      height: newBox.value.height,
      label: ''
    }
    annotationStore.addBox(box)
    selectedBoxId.value = box.id
  }
  
  newBox.value = null
  startPoint.value = null
}

function handleWheel(e) {
  e.evt.preventDefault()
  
  const stage = stageRef.value?.getStage()
  if (!stage) return
  
  const oldScale = stage.scaleX()
  const pointer = stage.getPointerPosition()
  
  const scaleBy = 1.1
  const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy
  
  zoom.value = Math.max(0.1, Math.min(5, newScale))
}

function selectBox(box) {
  selectedBoxId.value = box.id
}

function handleTransformEnd(box, e) {
  const node = e.target
  const scaleX = node.scaleX()
  const scaleY = node.scaleY()
  
  node.scaleX(1)
  node.scaleY(1)
  
  const updatedBox = {
    ...box,
    x: node.x(),
    y: node.y(),
    width: Math.max(5, node.width() * scaleX),
    height: Math.max(5, node.height() * scaleY)
  }
  
  annotationStore.updateBox(updatedBox)
}

function handleDragEnd(box, e) {
  const node = e.target
  const updatedBox = {
    ...box,
    x: node.x(),
    y: node.y()
  }
  annotationStore.updateBox(updatedBox)
}

function deleteSelectedBox() {
  if (selectedBoxId.value) {
    annotationStore.removeBox(selectedBoxId.value)
    selectedBoxId.value = null
  }
}

function undo() {
  const action = annotationStore.undo()
  if (action && action.action === 'delete') {
    annotationStore.addBox(action.data)
  } else if (action && action.action === 'add') {
    annotationStore.removeBox(action.data.id)
  }
}

function redo() {
  const action = annotationStore.redo()
  if (action && action.action === 'add') {
    annotationStore.addBox(action.data)
  } else if (action && action.action === 'delete') {
    annotationStore.removeBox(action.data.id)
  }
}

function zoomIn() {
  zoom.value = Math.min(5, zoom.value * 1.2)
}

function zoomOut() {
  zoom.value = Math.max(0.1, zoom.value / 1.2)
}

function resetZoom() {
  zoom.value = 1
  panOffset.value = { x: 0, y: 0 }
}

function handleKeyDown(e) {
  if (e.key === 'd' || e.key === 'D') {
    if (!e.ctrlKey && !e.metaKey) {
      toggleDrawingMode()
    }
  } else if (e.key === ' ') {
    e.preventDefault()
    togglePanningMode()
  } else if (e.key === 'Delete' || e.key === 'Backspace') {
    deleteSelectedBox()
  } else if (e.ctrlKey || e.metaKey) {
    if (e.key === 'z') {
      e.preventDefault()
      undo()
    } else if (e.key === 'y') {
      e.preventDefault()
      redo()
    }
  } else if (e.key === 'ArrowLeft' || e.key === 'd') {
    emit('navigate', 'prev')
  } else if (e.key === 'ArrowRight' || e.key === 'f') {
    emit('navigate', 'next')
  }
}

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

watch(() => props.imageUrl, (newUrl) => {
  loadImage(newUrl)
}, { immediate: true })

onMounted(() => {
  canvasContainer.value?.focus()
  if (props.imageUrl) {
    loadImage(props.imageUrl)
  }
  // 在window上监听键盘事件
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
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
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  outline: none;
}

.canvas-wrapper:focus {
  outline: none;
}

.upload-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px;
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

.canvas-stage-container {
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-danger {
  background: linear-gradient(135deg, var(--error-color), #DC2626);
  color: white;
}
</style>
