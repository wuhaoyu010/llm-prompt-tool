<template>
  <div class="annotation-canvas-container">
    <!-- 工具栏 -->
    <div class="canvas-toolbar">
      <!-- 预设标签输入框 -->
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
          title="标注模式 (N) - 绘制标注框"
        >
          <span class="material-icons">crop_din</span>
          <span class="tool-label">标注 (N)</span>
        </button>
        <button
          class="btn btn-sm tool-btn"
          :class="{ 'btn-primary': currentTool === 'select', 'btn-secondary': currentTool !== 'select' }"
          @click="setTool('select')"
          title="选择模式 (V) - 选中/移动/调整大小"
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
        <span class="zoom-level">{{ Math.round(scale * 100) }}%</span>
        <button class="btn btn-sm btn-secondary" @click="zoomIn" title="放大">
          <span class="material-icons">add</span>
        </button>
        <button class="btn btn-sm btn-secondary" @click="fitToScreen" title="适应屏幕">
          <span class="material-icons">fit_screen</span>
        </button>
      </div>
      
      <div class="toolbar-spacer"></div>

      <button 
        v-if="selectedBox"
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
          <div class="shortcut-item"><kbd>双击框</kbd> 编辑标签</div>
        </div>
        <div class="shortcut-group">
          <div class="shortcut-title">视图操作</div>
          <div class="shortcut-item"><kbd>滚轮</kbd> 缩放</div>
          <div class="shortcut-item"><kbd>双击画布</kbd> 适应屏幕</div>
        </div>
        <div class="shortcut-group">
          <div class="shortcut-title">导航操作</div>
          <div class="shortcut-item"><kbd>D</kbd> / <kbd>←</kbd> 上一张</div>
          <div class="shortcut-item"><kbd>F</kbd> / <kbd>→</kbd> 下一张</div>
        </div>
      </div>
    </div>
    
    <!-- 图片和标注区域 -->
    <div 
      class="canvas-wrapper" 
      ref="canvasWrapper"
      @wheel="handleWheel"
      @dblclick="handleDoubleClick"
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
      
      <div 
        v-else 
        class="image-container" 
        :style="containerStyle"
      >
        <img 
          ref="imageEl"
          :src="imageUrl" 
          class="annotation-image"
          @load="onImageLoad"
          crossorigin="anonymous"
          draggable="false"
        />
        
        <!-- Canvas 标注层 -->
        <canvas 
          ref="canvasEl"
          class="annotation-canvas"
          :width="canvasSize.width"
          :height="canvasSize.height"
          @mousedown="handleMouseDown"
          @mousemove="handleMouseMove"
          @mouseup="handleMouseUp"
          @mouseleave="handleMouseUp"
        ></canvas>
        
        <!-- 绘制时的提示 -->
        <div v-if="currentTool !== 'select'" class="drawing-hint">
          {{ drawingHint }}
        </div>
      </div>
    </div>
    
    <!-- 标签编辑器弹窗 -->
    <div v-if="showLabelEditor" class="label-editor-modal" @click.self="closeLabelEditor">
      <div class="label-editor-content">
        <h4>编辑标签</h4>
        <input 
          ref="labelInput"
          v-model="editingLabel" 
          type="text"
          placeholder="输入标签名称..."
          @keyup.enter="saveLabel"
          @keyup.esc="closeLabelEditor"
        >
        <div class="label-editor-actions">
          <button class="btn btn-secondary" @click="closeLabelEditor">取消</button>
          <button class="btn btn-primary" @click="saveLabel">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
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

// DOM 引用
const canvasWrapper = ref(null)
const imageEl = ref(null)
const canvasEl = ref(null)
const fileInput = ref(null)

// 状态
const currentTool = ref('select') // 默认选择模式
const scale = ref(1)
const isDragOver = ref(false)
const selectedBox = ref(null)
const naturalSize = ref({ width: 0, height: 0 })

// 预设标签
const presetLabel = ref('')

// 空格拖动状态
const spacePressed = ref(false)
const isCanvasDragging = ref(false)
const canvasDragStart = ref({ x: 0, y: 0 })
const canvasScrollStart = ref({ x: 0, y: 0 })

// Canvas 尺寸
const canvasSize = ref({ width: 0, height: 0 })

// 绘制状态
const isDrawing = ref(false)
const drawStart = ref({ x: 0, y: 0 })

// 拖拽/调整大小状态
const isDragging = ref(false)
const isResizing = ref(false)
const resizeHandle = ref(null)
const dragStart = ref({ x: 0, y: 0 })
const dragBoxStart = ref(null)

// 标签编辑器状态
const showLabelEditor = ref(false)
const editingLabel = ref('')
const editingBoxId = ref(null)

// 快捷键面板状态
const showShortcutsPanel = ref(false)

// 撤销/重做状态
const canUndo = computed(() => annotationStore.history.length > 0)
const canRedo = computed(() => annotationStore.redoStack.length > 0)

function handleUndo() {
  if (annotationStore.undo()) {
    drawAnnotations()
  }
}

function handleRedo() {
  if (annotationStore.redo()) {
    drawAnnotations()
  }
}

// 计算属性
const boxes = computed(() => annotationStore.currentAnnotations)

const drawingHint = computed(() => {
  switch (currentTool.value) {
    case 'rectangle':
      return '拖动鼠标绘制矩形框'
    default:
      return ''
  }
})

const containerStyle = computed(() => {
  let cursor = 'default'
  if (spacePressed.value) {
    cursor = isCanvasDragging.value ? 'grabbing' : 'grab'
  } else if (currentTool.value === 'rectangle') {
    cursor = 'crosshair'
  } else if (currentTool.value === 'select') {
    cursor = 'default'
  }
  return {
    transform: `scale(${scale.value})`,
    transformOrigin: 'center center',
    cursor
  }
})

// 将归一化坐标转换为像素坐标
function normToPixel(normValue, dimension) {
  return (normValue / 999) * dimension
}

// 将像素坐标转换为归一化坐标
function pixelToNorm(pixelValue, dimension) {
  return Math.round((pixelValue / dimension) * 999)
}

// 图片加载完成
function onImageLoad() {
  if (imageEl.value) {
    naturalSize.value = {
      width: imageEl.value.naturalWidth,
      height: imageEl.value.naturalHeight
    }
    canvasSize.value = { ...naturalSize.value }
    
    // 自动适应屏幕
    nextTick(() => {
      fitToScreen()
      drawAnnotations()
    })
  }
}

// 绘制所有标注
function drawAnnotations() {
  const canvas = canvasEl.value
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // 小框阈值（像素）
  const SMALL_BOX_THRESHOLD = 40

  // 绘制所有标注框
  boxes.value.forEach(box => {
    const x = normToPixel(box.x, naturalSize.value.width)
    const y = normToPixel(box.y, naturalSize.value.height)
    const w = normToPixel(box.width, naturalSize.value.width)
    const h = normToPixel(box.height, naturalSize.value.height)

    const isSelected = selectedBox.value?.id === box.id
    const isSmallBox = w < SMALL_BOX_THRESHOLD || h < SMALL_BOX_THRESHOLD

    // 边框样式
    ctx.strokeStyle = isSelected ? '#DC2626' : '#EF4444'
    ctx.lineWidth = isSelected ? 2 : 1

    // 填充样式：根据框大小和选中状态动态调整
    if (isSelected) {
      // 选中时无填充，通过边框和控制点表示
      ctx.fillStyle = 'transparent'
    } else if (isSmallBox) {
      // 小框：极淡填充或不填充
      ctx.fillStyle = 'rgba(239, 68, 68, 0.08)'
    } else {
      // 大框：适度填充
      ctx.fillStyle = 'rgba(239, 68, 68, 0.15)'
    }

    ctx.fillRect(x, y, w, h)
    ctx.strokeRect(x, y, w, h)

    // 绘制角点标记（帮助识别小框）
    if (!isSelected) {
      drawCornerMarks(ctx, x, y, w, h, isSmallBox ? 4 : 3)
    }

    // 绘制标签
    if (box.label) {
      ctx.fillStyle = 'white'
      ctx.font = 'bold 12px sans-serif'
      ctx.fillText(box.label, x, y - 5)
    }

    // 选中状态绘制控制点
    if (isSelected) {
      drawResizeHandles(ctx, x, y, w, h)
      // 选中时也绘制中心点
      drawCenterMark(ctx, x, y, w, h)
    }
  })

  // 绘制正在绘制的矩形
  if (isDrawing.value && drawStart.value.currentX !== undefined) {
    const x = Math.min(drawStart.value.x, drawStart.value.currentX)
    const y = Math.min(drawStart.value.y, drawStart.value.currentY)
    const w = Math.abs(drawStart.value.currentX - drawStart.value.x)
    const h = Math.abs(drawStart.value.currentY - drawStart.value.y)

    ctx.strokeStyle = '#EF4444'
    ctx.lineWidth = 1
    ctx.setLineDash([5, 5])
    ctx.fillStyle = 'rgba(239, 68, 68, 0.1)'

    ctx.fillRect(x, y, w, h)
    ctx.strokeRect(x, y, w, h)

    ctx.setLineDash([])
  }
}

// 绘制角点标记
function drawCornerMarks(ctx, x, y, w, h, size) {
  const corners = [
    { x: x, y: y },           // 左上
    { x: x + w, y: y },       // 右上
    { x: x + w, y: y + h },   // 右下
    { x: x, y: y + h }        // 左下
  ]

  ctx.fillStyle = '#EF4444'
  corners.forEach(corner => {
    ctx.beginPath()
    ctx.arc(corner.x, corner.y, size, 0, Math.PI * 2)
    ctx.fill()
  })
}

// 绘制中心点标记
function drawCenterMark(ctx, x, y, w, h) {
  const cx = x + w / 2
  const cy = y + h / 2
  const markSize = 6

  ctx.strokeStyle = '#DC2626'
  ctx.lineWidth = 1

  // 水平线
  ctx.beginPath()
  ctx.moveTo(cx - markSize, cy)
  ctx.lineTo(cx + markSize, cy)
  ctx.stroke()

  // 垂直线
  ctx.beginPath()
  ctx.moveTo(cx, cy - markSize)
  ctx.lineTo(cx, cy + markSize)
  ctx.stroke()
}

// 绘制调整大小的控制点
function drawResizeHandles(ctx, x, y, w, h) {
  // 小框阈值 - 小于此值的手柄会缩小
  const SMALL_BOX_THRESHOLD = 30
  const isSmallBox = w < SMALL_BOX_THRESHOLD || h < SMALL_BOX_THRESHOLD

  // 根据框大小调整手柄尺寸
  const handleSize = isSmallBox ? 4 : 6

  // 小框只绘制4个角点，大框绘制全部8个
  const handles = isSmallBox ? [
    { x: x, y: y },           // 左上
    { x: x + w, y: y },       // 右上
    { x: x + w, y: y + h },   // 右下
    { x: x, y: y + h }        // 左下
  ] : [
    { x: x, y: y },           // 左上
    { x: x + w/2, y: y },     // 上中
    { x: x + w, y: y },       // 右上
    { x: x + w, y: y + h/2 }, // 右中
    { x: x + w, y: y + h },   // 右下
    { x: x + w/2, y: y + h }, // 下中
    { x: x, y: y + h },       // 左下
    { x: x, y: y + h/2 }      // 左中
  ]

  handles.forEach(handle => {
    // 白色填充 + 红色边框的控制点
    ctx.fillStyle = 'white'
    ctx.strokeStyle = '#DC2626'
    ctx.lineWidth = isSmallBox ? 1 : 1.5
    ctx.beginPath()
    ctx.arc(handle.x, handle.y, handleSize, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  })
}

// 获取鼠标在 Canvas 上的坐标
function getCanvasCoordinates(e) {
  const canvas = canvasEl.value
  const rect = canvas.getBoundingClientRect()
  return {
    x: (e.clientX - rect.left) / scale.value,
    y: (e.clientY - rect.top) / scale.value
  }
}

// 检查是否点击了控制点
function getResizeHandle(x, y, box) {
  const bx = normToPixel(box.x, naturalSize.value.width)
  const by = normToPixel(box.y, naturalSize.value.height)
  const bw = normToPixel(box.width, naturalSize.value.width)
  const bh = normToPixel(box.height, naturalSize.value.height)

  // 小框阈值
  const SMALL_BOX_THRESHOLD = 30
  const isSmallBox = bw < SMALL_BOX_THRESHOLD || bh < SMALL_BOX_THRESHOLD

  // 根据框大小调整检测半径
  const handleRadius = isSmallBox ? 6 : 8

  // 小框只有4个角点，大框有8个
  const handles = isSmallBox ? [
    { name: 'nw', cx: bx, cy: by },
    { name: 'ne', cx: bx + bw, cy: by },
    { name: 'se', cx: bx + bw, cy: by + bh },
    { name: 'sw', cx: bx, cy: by + bh }
  ] : [
    { name: 'nw', cx: bx, cy: by },
    { name: 'n', cx: bx + bw/2, cy: by },
    { name: 'ne', cx: bx + bw, cy: by },
    { name: 'e', cx: bx + bw, cy: by + bh/2 },
    { name: 'se', cx: bx + bw, cy: by + bh },
    { name: 's', cx: bx + bw/2, cy: by + bh },
    { name: 'sw', cx: bx, cy: by + bh },
    { name: 'w', cx: bx, cy: by + bh/2 }
  ]

  for (const handle of handles) {
    const dist = Math.sqrt((x - handle.cx) ** 2 + (y - handle.cy) ** 2)
    if (dist <= handleRadius) {
      return handle.name
    }
  }
  return null
}

// 检查是否点击了标注框
function getBoxAt(x, y) {
  // 从后往前查找（后绘制的在上面）
  for (let i = boxes.value.length - 1; i >= 0; i--) {
    const box = boxes.value[i]
    const bx = normToPixel(box.x, naturalSize.value.width)
    const by = normToPixel(box.y, naturalSize.value.height)
    const bw = normToPixel(box.width, naturalSize.value.width)
    const bh = normToPixel(box.height, naturalSize.value.height)
    
    if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) {
      return box
    }
  }
  return null
}

// 设置工具
function setTool(tool) {
  currentTool.value = tool
  if (tool !== 'select') {
    selectedBox.value = null
  }
  drawAnnotations()
}

// 鼠标按下
function handleMouseDown(e) {
  if (!canvasEl.value) return

  const coords = getCanvasCoordinates(e)
  const x = coords.x
  const y = coords.y

  // 空格拖动画布
  if (spacePressed.value) {
    isCanvasDragging.value = true
    canvasDragStart.value = { x: e.clientX, y: e.clientY }
    const wrapper = canvasWrapper.value
    if (wrapper) {
      canvasScrollStart.value = { x: wrapper.scrollLeft, y: wrapper.scrollTop }
    }
    return
  }

  // 标注模式 或 选择模式下按住Shift强制绘制
  if (currentTool.value === 'rectangle' || e.shiftKey) {
    isDrawing.value = true
    drawStart.value = { x, y }
    drawAnnotations()
    return
  }

  // 选择模式
  if (currentTool.value === 'select') {
    // 检查是否点击了控制点
    if (selectedBox.value) {
      const handle = getResizeHandle(x, y, selectedBox.value)
      if (handle) {
        isResizing.value = true
        resizeHandle.value = handle
        dragStart.value = { x, y }
        dragBoxStart.value = { ...selectedBox.value }
        return
      }
    }

    // 检查是否点击了标注框
    const clickedBox = getBoxAt(x, y)
    if (clickedBox) {
      selectedBox.value = clickedBox
      isDragging.value = true
      dragStart.value = { x: e.clientX, y: e.clientY }
      dragBoxStart.value = { ...clickedBox }
    } else {
      selectedBox.value = null
    }

    drawAnnotations()
  }
}

// 鼠标移动
function handleMouseMove(e) {
  if (!canvasEl.value) return

  // 空格拖动画布
  if (spacePressed.value && isCanvasDragging.value) {
    const wrapper = canvasWrapper.value
    if (wrapper) {
      const dx = canvasDragStart.value.x - e.clientX
      const dy = canvasDragStart.value.y - e.clientY
      wrapper.scrollLeft = canvasScrollStart.value.x + dx
      wrapper.scrollTop = canvasScrollStart.value.y + dy
    }
    return
  }

  const coords = getCanvasCoordinates(e)
  const x = coords.x
  const y = coords.y

  if (isDrawing.value && (currentTool.value === 'rectangle' || e.shiftKey)) {
    drawStart.value.currentX = x
    drawStart.value.currentY = y
    drawAnnotations()
  } else if (isDragging.value && selectedBox.value && dragBoxStart.value) {
    const dx = pixelToNorm((e.clientX - dragStart.value.x) / scale.value, naturalSize.value.width)
    const dy = pixelToNorm((e.clientY - dragStart.value.y) / scale.value, naturalSize.value.height)

    const newX = Math.max(0, Math.min(999 - dragBoxStart.value.width, dragBoxStart.value.x + dx))
    const newY = Math.max(0, Math.min(999 - dragBoxStart.value.height, dragBoxStart.value.y + dy))

    selectedBox.value = {
      ...selectedBox.value,
      x: newX,
      y: newY
    }

    annotationStore.updateBox(selectedBox.value)
    drawAnnotations()
  } else if (isResizing.value && selectedBox.value && dragBoxStart.value) {
    const dx = pixelToNorm((x - dragStart.value.x) / scale.value, naturalSize.value.width)
    const dy = pixelToNorm((y - dragStart.value.y) / scale.value, naturalSize.value.height)

    let newBox = { ...dragBoxStart.value }

    switch (resizeHandle.value) {
      case 'se':
        newBox.width = Math.max(10, Math.min(999 - newBox.x, dragBoxStart.value.width + dx))
        newBox.height = Math.max(10, Math.min(999 - newBox.y, dragBoxStart.value.height + dy))
        break
      case 'nw':
        const newW = Math.max(10, dragBoxStart.value.width - dx)
        const newH = Math.max(10, dragBoxStart.value.height - dy)
        newBox.x = Math.max(0, Math.min(999 - newW, dragBoxStart.value.x + dx))
        newBox.y = Math.max(0, Math.min(999 - newH, dragBoxStart.value.y + dy))
        newBox.width = newW
        newBox.height = newH
        break
      case 'ne':
        newBox.width = Math.max(10, Math.min(999 - newBox.x, dragBoxStart.value.width + dx))
        const newH2 = Math.max(10, dragBoxStart.value.height - dy)
        newBox.y = Math.max(0, Math.min(999 - newH2, dragBoxStart.value.y + dy))
        newBox.height = newH2
        break
      case 'sw':
        const newW2 = Math.max(10, dragBoxStart.value.width - dx)
        newBox.x = Math.max(0, Math.min(999 - newW2, dragBoxStart.value.x + dx))
        newBox.width = newW2
        newBox.height = Math.max(10, Math.min(999 - newBox.y, dragBoxStart.value.height + dy))
        break
      case 'e':
        newBox.width = Math.max(10, Math.min(999 - newBox.x, dragBoxStart.value.width + dx))
        break
      case 'w':
        const newW3 = Math.max(10, dragBoxStart.value.width - dx)
        newBox.x = Math.max(0, Math.min(999 - newW3, dragBoxStart.value.x + dx))
        newBox.width = newW3
        break
      case 's':
        newBox.height = Math.max(10, Math.min(999 - newBox.y, dragBoxStart.value.height + dy))
        break
      case 'n':
        const newH3 = Math.max(10, dragBoxStart.value.height - dy)
        newBox.y = Math.max(0, Math.min(999 - newH3, dragBoxStart.value.y + dy))
        newBox.height = newH3
        break
    }

    selectedBox.value = newBox
    annotationStore.updateBox(selectedBox.value)
    drawAnnotations()
  }
}

// 鼠标释放
function handleMouseUp() {
  // 结束画布拖动
  if (isCanvasDragging.value) {
    isCanvasDragging.value = false
    return
  }

  if (isDrawing.value && (currentTool.value === 'rectangle' || selectedBox.value === null)) {
    if (drawStart.value.currentX !== undefined) {
      const x = Math.min(drawStart.value.x, drawStart.value.currentX)
      const y = Math.min(drawStart.value.y, drawStart.value.currentY)
      const w = Math.abs(drawStart.value.currentX - drawStart.value.x)
      const h = Math.abs(drawStart.value.currentY - drawStart.value.y)

      // 只有大于一定尺寸才创建
      if (w > 10 && h > 10) {
        // 使用预设标签
        const label = presetLabel.value || defectStore.currentDefect?.name || ''

        const normBox = {
          id: `box_${Date.now()}`,
          x: pixelToNorm(x, naturalSize.value.width),
          y: pixelToNorm(y, naturalSize.value.height),
          width: pixelToNorm(w, naturalSize.value.width),
          height: pixelToNorm(h, naturalSize.value.height),
          label: label,
          type: 'rectangle'
        }

        annotationStore.addBox(normBox)
        emit('boxes-changed')

        // 不再弹出标签编辑器，直接使用预设标签
        // 绘制完成后切换到选择模式并选中新框
        selectedBox.value = normBox
        currentTool.value = 'select'
      }
    }

    isDrawing.value = false
    drawStart.value = { x: 0, y: 0 }
    drawAnnotations()
  }

  isDragging.value = false
  isResizing.value = false
  resizeHandle.value = null
  dragBoxStart.value = null
}

// 删除选中的标注框
function deleteSelected() {
  if (selectedBox.value) {
    annotationStore.removeBox(selectedBox.value.id)
    selectedBox.value = null
    emit('boxes-changed')
    drawAnnotations()
  }
}

// 清空所有标注
function clearAll() {
  uiStore.showConfirm({
    title: '确认清空',
    message: '确定要清空所有标注吗？此操作不可撤销。',
    icon: 'warning',
    onConfirm: () => {
      annotationStore.clearAnnotations()
      selectedBox.value = null
      emit('boxes-changed')
      drawAnnotations()
    }
  })
}

// 缩放控制
function zoomIn() {
  scale.value = Math.min(3, scale.value * 1.2)
}

function zoomOut() {
  scale.value = Math.max(0.3, scale.value / 1.2)
}

function fitToScreen() {
  if (!canvasWrapper.value || !naturalSize.value.width) return
  
  const wrapper = canvasWrapper.value
  const wrapperWidth = wrapper.clientWidth - 40
  const wrapperHeight = wrapper.clientHeight - 40
  
  const scaleX = wrapperWidth / naturalSize.value.width
  const scaleY = wrapperHeight / naturalSize.value.height
  
  scale.value = Math.min(scaleX, scaleY, 1)
}

// 滚轮缩放
function handleWheel(e) {
  e.preventDefault()
  
  const delta = e.deltaY > 0 ? 0.9 : 1.1
  scale.value = Math.max(0.3, Math.min(3, scale.value * delta))
}

// 双击恢复 - 无论点击图片还是画布都能触发
function handleDoubleClick(e) {
  // 双击标注框 - 编辑标签
  if (currentTool.value === 'select') {
    const coords = getCanvasCoordinates(e)
    const clickedBox = getBoxAt(coords.x, coords.y)
    if (clickedBox) {
      editingBoxId.value = clickedBox.id
      editingLabel.value = clickedBox.label || ''
      showLabelEditor.value = true
      nextTick(() => {
        const input = document.querySelector('.label-editor-content input')
        input?.focus()
      })
      return
    }
  }

  // 双击空白区域 - 适应屏幕
  fitToScreen()
}

// 标签编辑器
function saveLabel() {
  if (editingBoxId.value) {
    const box = boxes.value.find(b => b.id === editingBoxId.value)
    if (box) {
      annotationStore.updateBox({
        ...box,
        label: editingLabel.value
      })
      emit('boxes-changed')
      drawAnnotations()
    }
  }
  closeLabelEditor()
}

function closeLabelEditor() {
  showLabelEditor.value = false
  editingLabel.value = ''
  editingBoxId.value = null
}

// 文件上传
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

// 键盘快捷键
function handleKeyDown(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return

  // Ctrl/Cmd 快捷键
  if (e.ctrlKey || e.metaKey) {
    if (e.key === 'z' || e.key === 'Z') {
      e.preventDefault()
      handleUndo()
      return
    }
    if (e.key === 'y' || e.key === 'Y') {
      e.preventDefault()
      handleRedo()
      return
    }
  }

  // 空格键 - 临时拖动模式
  if (e.key === ' ' && !spacePressed.value) {
    e.preventDefault()
    spacePressed.value = true
    return
  }

  // 工具切换
  switch (e.key.toLowerCase()) {
    case 'n':
      e.preventDefault()
      setTool('rectangle')
      return
    case 'v':
      e.preventDefault()
      setTool('select')
      return
  }

  // 删除
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (selectedBox.value) {
      deleteSelected()
    }
    return
  }

  // 导航
  if (e.key === 'd' || e.key === 'D') {
    if (!e.ctrlKey && !e.metaKey) {
      emit('navigate', 'prev')
      return
    }
  }
  if (e.key === 'f' || e.key === 'F') {
    if (!e.ctrlKey && !e.metaKey) {
      emit('navigate', 'next')
      return
    }
  }

  if (e.key === 'ArrowLeft') {
    emit('navigate', 'prev')
    return
  }
  if (e.key === 'ArrowRight') {
    emit('navigate', 'next')
    return
  }
}

function handleKeyUp(e) {
  // 释放空格键
  if (e.key === ' ') {
    spacePressed.value = false
    isCanvasDragging.value = false
  }
}

// 监听标注变化
watch(() => boxes.value, () => {
  drawAnnotations()
}, { deep: true })

// 监听当前缺陷变化，更新预设标签
watch(() => defectStore.currentDefect, (defect) => {
  if (defect && !presetLabel.value) {
    presetLabel.value = defect.name
  }
}, { immediate: true })

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('keyup', handleKeyUp)
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
  overflow: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  background: var(--bg-color);
  padding: 20px;
}

.image-container {
  position: relative;
  display: inline-block;
  transition: transform 0.1s ease;
}

.annotation-image {
  display: block;
  max-width: none;
  max-height: none;
}

.annotation-canvas {
  position: absolute;
  top: 0;
  left: 0;
  cursor: crosshair;
}

.drawing-hint {
  position: absolute;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 12px;
  pointer-events: none;
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

/* 标签编辑器弹窗 */
.label-editor-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.label-editor-content {
  background: var(--card-bg);
  padding: 24px;
  border-radius: 12px;
  border: 1px solid var(--glass-border);
  min-width: 300px;
}

.label-editor-content h4 {
  margin: 0 0 16px;
  color: var(--text-primary);
}

.label-editor-content input {
  width: 100%;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--input-bg);
  border: 1px solid var(--glass-border);
  color: var(--text-primary);
  font-size: 14px;
  margin-bottom: 16px;
}

.label-editor-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.btn-danger {
  background: linear-gradient(135deg, var(--error-color), #DC2626);
  color: white;
}

/* 快捷键面板样式 */
.shortcuts-panel {
  position: absolute;
  top: 70px;
  right: 20px;
  width: 280px;
  background: var(--card-bg);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
  z-index: 100;
  overflow: hidden;
}

.shortcuts-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--input-bg);
  border-bottom: 1px solid var(--glass-border);
}

.shortcuts-header h4 {
  margin: 0;
  font-size: 14px;
  color: var(--text-primary);
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
  color: var(--primary-color);
  margin-bottom: 8px;
  text-transform: uppercase;
}

.shortcut-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.shortcut-item kbd {
  display: inline-block;
  padding: 2px 6px;
  background: var(--input-bg);
  border: 1px solid var(--glass-border);
  border-radius: 4px;
  font-family: inherit;
  font-size: 11px;
  color: var(--text-primary);
}
</style>
