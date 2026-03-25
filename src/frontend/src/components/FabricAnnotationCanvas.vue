<template>
  <div class="annotation-canvas-container">
    <!-- 工具栏 -->
    <div class="canvas-toolbar">
      <button 
        class="btn btn-sm tool-btn" 
        :class="{ 'btn-primary': isDrawingMode, 'btn-secondary': !isDrawingMode }"
        @click="toggleDrawingMode"
        title="画框 (N)"
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
        title="重做 (Ctrl+Shift+Z)"
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
        <button class="btn btn-sm btn-secondary" @click="resetZoom" title="重置缩放 (Ctrl+0)">
          <span class="material-icons">fit_screen</span>
        </button>
      </div>
      <div class="toolbar-spacer"></div>
      <button 
        v-if="selectedBox"
        class="btn btn-sm btn-danger tool-btn" 
        @click="deleteSelectedBox"
        title="删除选中框 (Delete)"
      >
        <span class="material-icons">delete</span>
        <span class="tool-label">删除</span>
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
    
    <!-- Canvas 容器 -->
    <div 
      class="canvas-wrapper" 
      ref="canvasContainer"
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
      
      <canvas v-else ref="canvasEl" class="annotation-canvas"></canvas>
    </div>
    
    <!-- 标注框标签编辑器 -->
    <div v-if="showLabelEditor" class="box-label-editor" :style="labelEditorStyle">
      <input 
        type="text" 
        v-model="editingLabel" 
        placeholder="输入标注标签..."
        @keyup.enter="saveLabel"
        @keyup.esc="cancelEditLabel"
        ref="labelInput"
      >
      <button class="btn btn-primary btn-sm" @click="saveLabel">保存</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { Canvas, Rect, Image as FabricImage } from 'fabric'
import { useAnnotationStore } from '../stores/annotation'
import { useUIStore } from '../stores/ui'

const props = defineProps({
  imageUrl: String,
  width: { type: Number, default: 800 },
  height: { type: Number, default: 600 }
})

const emit = defineEmits(['upload', 'navigate', 'boxes-changed'])

const annotationStore = useAnnotationStore()
const uiStore = useUIStore()

const canvasContainer = ref(null)
const canvasEl = ref(null)
const fileInput = ref(null)
const labelInput = ref(null)

let canvas = null
let fabricImage = null

const isDrawingMode = ref(false)
const isPanningMode = ref(false)
const zoom = ref(1)
const isDragOver = ref(false)
const selectedBox = ref(null)

// 标签编辑器
const showLabelEditor = ref(false)
const editingLabel = ref('')
const editingBoxId = ref(null)
const labelEditorStyle = ref({ left: '0px', top: '0px' })

// 历史记录
const history = ref([])
const redoStack = ref([])

// 初始化 Fabric Canvas
function initCanvas() {
  if (!canvasEl.value) return

  // 如果 canvas 已存在，先销毁
  if (canvas) {
    canvas.dispose()
    canvas = null
  }

  canvas = new Canvas(canvasEl.value, {
    width: canvasContainer.value?.clientWidth || props.width,
    height: canvasContainer.value?.clientHeight || props.height,
    selection: false,
    preserveObjectStacking: true
  })

  // 设置画布背景
  canvas.backgroundColor = '#1e293b'

  // 事件监听
  canvas.on('mouse:down', handleMouseDown)
  canvas.on('mouse:move', handleMouseMove)
  canvas.on('mouse:up', handleMouseUp)
  canvas.on('object:modified', handleObjectModified)
  canvas.on('object:selected', handleObjectSelected)
  canvas.on('selection:cleared', handleSelectionCleared)
  canvas.on('object:moving', handleObjectMoving)
  canvas.on('object:scaling', handleObjectScaling)

  // 键盘事件
  canvasContainer.value?.focus()
}

// 加载图片
async function loadImage(url) {
  if (!canvas || !url) return

  try {
    // 清除现有内容
    canvas.clear()
    fabricImage = null

    // Fabric.js v6: fromURL 返回 Promise
    const img = await FabricImage.fromURL(url, { crossOrigin: 'anonymous' })
    fabricImage = img
    
    // 计算缩放比例，使图片适应画布
    const canvasWidth = canvas.width
    const canvasHeight = canvas.height
    const imgWidth = img.width
    const imgHeight = img.height

    const scaleX = canvasWidth / imgWidth
    const scaleY = canvasHeight / imgHeight
    const scale = Math.min(scaleX, scaleY) * 0.9

    // 设置图片属性
    img.set({
      left: (canvasWidth - imgWidth * scale) / 2,
      top: (canvasHeight - imgHeight * scale) / 2,
      scaleX: scale,
      scaleY: scale,
      selectable: false,
      evented: true,
      name: 'image'
    })

    canvas.add(img)
    canvas.sendObjectToBack(img)

    // 重置缩放
    zoom.value = 1
    canvas.setZoom(1)
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0])

    // 加载标注框
    loadBoxesFromStore()

    canvas.renderAll()
  } catch (error) {
    console.error('Failed to load image:', error)
  }
}

// 从 store 加载标注框
function loadBoxesFromStore() {
  console.log('=== loadBoxesFromStore 开始 ===')
  console.log('canvas:', canvas ? 'exists' : 'null')
  console.log('fabricImage:', fabricImage ? 'exists' : 'null')
  
  if (!canvas || !fabricImage) {
    console.log('提前返回: canvas 或 fabricImage 不存在')
    return
  }

  // 清除现有的标注框
  const existingBoxes = canvas.getObjects().filter(obj => obj.name === 'box')
  console.log('清除现有标注框:', existingBoxes.length)
  existingBoxes.forEach(box => canvas.remove(box))

  // 从 store 获取标注框
  const boxes = annotationStore.currentAnnotations
  console.log('从 store 获取的标注框:', boxes)
  if (!boxes || boxes.length === 0) {
    console.log('提前返回: 没有标注框数据')
    return
  }

  const imgLeft = fabricImage.left
  const imgTop = fabricImage.top
  const imgScale = fabricImage.scaleX
  const imgWidth = fabricImage.width
  const imgHeight = fabricImage.height
  const NORM_MAX = 999  // 归一化坐标的最大值

  console.log('图片属性:', { imgLeft, imgTop, imgScale, imgWidth, imgHeight })

  boxes.forEach((box, index) => {
    console.log(`处理标注框 ${index}:`, box)
    // box.x, box.y, box.width, box.height 是归一化坐标 (0-999)
    // 需要转换为相对于图片的比例
    const ratioX = box.x / NORM_MAX
    const ratioY = box.y / NORM_MAX
    const ratioW = box.width / NORM_MAX
    const ratioH = box.height / NORM_MAX

    const rectLeft = imgLeft + ratioX * imgWidth * imgScale
    const rectTop = imgTop + ratioY * imgHeight * imgScale
    const rectWidth = ratioW * imgWidth * imgScale
    const rectHeight = ratioH * imgHeight * imgScale

    console.log(`标注框 ${index} 计算结果:`, { rectLeft, rectTop, rectWidth, rectHeight })

    const rect = new Rect({
      left: rectLeft,
      top: rectTop,
      width: rectWidth,
      height: rectHeight,
      fill: 'rgba(79, 70, 229, 0.3)',
      stroke: '#4F46E5',
      strokeWidth: 2,
      strokeUniform: true,
      selectable: true,
      evented: true,
      name: 'box',
      id: box.id,
      label: box.label || ''
    })

    // 添加控制点样式
    rect.setControlsVisibility({
      mt: true, mb: true, ml: true, mr: true,
      tl: true, tr: true, bl: true, br: true,
      mtr: false
    })

    canvas.add(rect)
    console.log(`标注框 ${index} 已添加到画布`)
  })

  canvas.renderAll()
  console.log('=== loadBoxesFromStore 完成 ===')
}

// 切换画框模式
function toggleDrawingMode() {
  isDrawingMode.value = !isDrawingMode.value
  isPanningMode.value = false
  
  if (canvas) {
    canvas.isDrawingMode = false
    canvas.selection = !isDrawingMode.value
    canvas.defaultCursor = isDrawingMode.value ? 'crosshair' : 'default'
  }
}

// 切换平移模式
function togglePanningMode() {
  isPanningMode.value = !isPanningMode.value
  isDrawingMode.value = false
  
  if (canvas) {
    canvas.isDrawingMode = false
    canvas.selection = !isPanningMode.value
    canvas.defaultCursor = isPanningMode.value ? 'grab' : 'default'
  }
}

// 鼠标事件处理
let isDrawing = false
let startPoint = null
let tempRect = null

function handleMouseDown(e) {
  if (!fabricImage) return

  const target = e.target

  // 平移模式
  if (isPanningMode.value) {
    canvas.isDragging = true
    canvas.lastPosX = e.e.clientX
    canvas.lastPosY = e.e.clientY
    canvas.defaultCursor = 'grabbing'
    return
  }

  // 画框模式 - 只在图片上画框
  if (isDrawingMode.value && (target === fabricImage || !target)) {
    isDrawing = true
    const pointer = canvas.getPointer(e.e)
    startPoint = pointer

    tempRect = new Rect({
      left: pointer.x,
      top: pointer.y,
      width: 0,
      height: 0,
      fill: 'rgba(79, 70, 229, 0.3)',
      stroke: '#4F46E5',
      strokeWidth: 2,
      strokeUniform: true,
      selectable: false,
      evented: false,
      name: 'temp-box'
    })

    canvas.add(tempRect)
  }
}

function handleMouseMove(e) {
  if (!fabricImage) return

  // 平移
  if (isPanningMode.value && canvas.isDragging) {
    const vpt = canvas.viewportTransform
    vpt[4] += e.e.clientX - canvas.lastPosX
    vpt[5] += e.e.clientY - canvas.lastPosY
    canvas.lastPosX = e.e.clientX
    canvas.lastPosY = e.e.clientY
    canvas.requestRenderAll()
    return
  }

  // 画框
  if (isDrawing && tempRect) {
    const pointer = canvas.getPointer(e.e)
    
    const width = Math.abs(pointer.x - startPoint.x)
    const height = Math.abs(pointer.y - startPoint.y)
    const left = Math.min(pointer.x, startPoint.x)
    const top = Math.min(pointer.y, startPoint.y)

    tempRect.set({ left, top, width, height })
    canvas.requestRenderAll()
  }
}

function handleMouseUp(e) {
  // 结束平移
  if (isPanningMode.value) {
    canvas.isDragging = false
    canvas.defaultCursor = 'grab'
    return
  }

  // 结束画框
  if (isDrawing && tempRect) {
    isDrawing = false

    // 如果框太小，删除它
    if (tempRect.width < 10 || tempRect.height < 10) {
      canvas.remove(tempRect)
      tempRect = null
      startPoint = null
      canvas.requestRenderAll()
      return
    }

    // 转换为实际的标注框
    const box = createBoxFromRect(tempRect)
    canvas.remove(tempRect)
    tempRect = null
    startPoint = null

    if (box) {
      // 添加到 store
      annotationStore.addBox(box)
      
      // 创建 Fabric 对象
      const rect = createFabricBox(box)
      canvas.add(rect)
      canvas.setActiveObject(rect)
      
      // 保存历史
      saveHistory('add', box)
      
      emit('boxes-changed')
    }

    canvas.requestRenderAll()
  }
}

// 从临时矩形创建标注框数据
function createBoxFromRect(rect) {
  if (!fabricImage) return null

  const imgLeft = fabricImage.left
  const imgTop = fabricImage.top
  const imgScale = fabricImage.scaleX
  const imgWidth = fabricImage.width
  const imgHeight = fabricImage.height
  const NORM_MAX = 999  // 归一化坐标的最大值

  // 转换为图片坐标系（像素）
  const xPixel = (rect.left - imgLeft) / imgScale
  const yPixel = (rect.top - imgTop) / imgScale
  const widthPixel = rect.width / imgScale
  const heightPixel = rect.height / imgScale

  // 转换为归一化坐标 (0-999)
  const xNorm = Math.round((xPixel / imgWidth) * NORM_MAX)
  const yNorm = Math.round((yPixel / imgHeight) * NORM_MAX)
  const widthNorm = Math.round((widthPixel / imgWidth) * NORM_MAX)
  const heightNorm = Math.round((heightPixel / imgHeight) * NORM_MAX)

  return {
    id: `box_${Date.now()}`,
    x: xNorm,
    y: yNorm,
    width: widthNorm,
    height: heightNorm,
    label: ''
  }
}

// 创建 Fabric 标注框
function createFabricBox(box) {
  if (!fabricImage) return null

  const imgLeft = fabricImage.left
  const imgTop = fabricImage.top
  const imgScale = fabricImage.scaleX
  const imgWidth = fabricImage.width
  const imgHeight = fabricImage.height
  const NORM_MAX = 999  // 归一化坐标的最大值

  // 将归一化坐标转换为画布坐标
  const ratioX = box.x / NORM_MAX
  const ratioY = box.y / NORM_MAX
  const ratioW = box.width / NORM_MAX
  const ratioH = box.height / NORM_MAX

  const rect = new Rect({
    left: imgLeft + ratioX * imgWidth * imgScale,
    top: imgTop + ratioY * imgHeight * imgScale,
    width: ratioW * imgWidth * imgScale,
    height: ratioH * imgHeight * imgScale,
    fill: 'rgba(79, 70, 229, 0.3)',
    stroke: '#4F46E5',
    strokeWidth: 2,
    strokeUniform: true,
    selectable: true,
    evented: true,
    name: 'box',
    id: box.id,
    label: box.label || ''
  })

  rect.setControlsVisibility({
    mt: true, mb: true, ml: true, mr: true,
    tl: true, tr: true, bl: true, br: true,
    mtr: false
  })

  return rect
}

// 对象修改事件
function handleObjectModified(e) {
  const obj = e.target
  if (obj.name !== 'box') return

  const box = createBoxFromFabricObject(obj)
  if (box) {
    annotationStore.updateBox(box)
    saveHistory('update', box)
    emit('boxes-changed')
  }
}

function handleObjectSelected(e) {
  const obj = e.target
  if (obj.name === 'box') {
    selectedBox.value = obj
  }
}

function handleSelectionCleared() {
  selectedBox.value = null
  showLabelEditor.value = false
}

function handleObjectMoving(e) {
  // 可以在这里添加边界检查
}

function handleObjectScaling(e) {
  // 可以在这里添加最小尺寸检查
}

// 从 Fabric 对象创建标注框数据
function createBoxFromFabricObject(obj) {
  if (!fabricImage) return null

  const imgLeft = fabricImage.left
  const imgTop = fabricImage.top
  const imgScale = fabricImage.scaleX
  const imgWidth = fabricImage.width
  const imgHeight = fabricImage.height
  const NORM_MAX = 999

  // 转换为图片像素坐标
  const xPixel = (obj.left - imgLeft) / imgScale
  const yPixel = (obj.top - imgTop) / imgScale
  const widthPixel = (obj.width * obj.scaleX) / imgScale
  const heightPixel = (obj.height * obj.scaleY) / imgScale

  // 转换为归一化坐标 (0-999)
  return {
    id: obj.id,
    x: Math.round((xPixel / imgWidth) * NORM_MAX),
    y: Math.round((yPixel / imgHeight) * NORM_MAX),
    width: Math.round((widthPixel / imgWidth) * NORM_MAX),
    height: Math.round((heightPixel / imgHeight) * NORM_MAX),
    label: obj.label || ''
  }
}

// 删除选中的框
function deleteSelectedBox() {
  if (!selectedBox.value || !canvas) return

  const boxId = selectedBox.value.id
  canvas.remove(selectedBox.value)
  annotationStore.removeBox(boxId)
  saveHistory('delete', { id: boxId })
  selectedBox.value = null
  canvas.requestRenderAll()
  emit('boxes-changed')
}

// 清空所有
function clearAll() {
  if (!canvas) return

  const boxes = canvas.getObjects().filter(obj => obj.name === 'box')
  boxes.forEach(box => {
    canvas.remove(box)
    annotationStore.removeBox(box.id)
  })
  
  saveHistory('clear', { count: boxes.length })
  canvas.requestRenderAll()
  emit('boxes-changed')
}

// 历史记录
function saveHistory(action, data) {
  history.value.push({ action, data, timestamp: Date.now() })
  redoStack.value = []
}

function undo() {
  if (history.value.length === 0) return

  const lastAction = history.value.pop()
  redoStack.value.push(lastAction)

  // 执行撤销
  switch (lastAction.action) {
    case 'add':
      annotationStore.removeBox(lastAction.data.id)
      const addedObj = canvas.getObjects().find(obj => obj.id === lastAction.data.id)
      if (addedObj) canvas.remove(addedObj)
      break
    case 'delete':
      // 需要重新创建
      break
    case 'update':
      // 需要保存之前的状态
      break
  }

  canvas.requestRenderAll()
  emit('boxes-changed')
}

function redo() {
  if (redoStack.value.length === 0) return

  const action = redoStack.value.pop()
  history.value.push(action)

  // 执行重做
  // ...

  canvas.requestRenderAll()
  emit('boxes-changed')
}

// 缩放功能
function zoomIn() {
  if (!canvas) return
  zoom.value = Math.min(5, zoom.value * 1.2)
  canvas.setZoom(zoom.value)
  canvas.requestRenderAll()
}

function zoomOut() {
  if (!canvas) return
  zoom.value = Math.max(0.1, zoom.value / 1.2)
  canvas.setZoom(zoom.value)
  canvas.requestRenderAll()
}

function resetZoom() {
  if (!canvas) return
  zoom.value = 1
  canvas.setZoom(1)
  canvas.setViewportTransform([1, 0, 0, 1, 0, 0])
  canvas.requestRenderAll()
}

// 标签编辑
function editLabel(box) {
  editingBoxId.value = box.id
  editingLabel.value = box.label || ''
  showLabelEditor.value = true

  // 定位编辑器
  const obj = canvas.getObjects().find(o => o.id === box.id)
  if (obj) {
    const canvasRect = canvasEl.value.getBoundingClientRect()
    labelEditorStyle.value = {
      left: `${canvasRect.left + obj.left + obj.width / 2 - 100}px`,
      top: `${canvasRect.top + obj.top - 40}px`
    }
  }

  nextTick(() => {
    labelInput.value?.focus()
  })
}

function saveLabel() {
  if (!editingBoxId.value) return

  const obj = canvas.getObjects().find(o => o.id === editingBoxId.value)
  if (obj) {
    obj.label = editingLabel.value
    annotationStore.updateBox({
      id: editingBoxId.value,
      label: editingLabel.value
    })
  }

  showLabelEditor.value = false
  editingBoxId.value = null
  editingLabel.value = ''
}

function cancelEditLabel() {
  showLabelEditor.value = false
  editingBoxId.value = null
  editingLabel.value = ''
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

// 复制选中的标注框
function copySelectedBox() {
  if (!selectedBox.value || !canvas || !fabricImage) return

  const imgLeft = fabricImage.left
  const imgTop = fabricImage.top
  const imgScale = fabricImage.scaleX
  const imgWidth = fabricImage.width
  const imgHeight = fabricImage.height
  const NORM_MAX = 999

  // 获取选中框的像素坐标
  const xPixel = (selectedBox.value.left - imgLeft) / imgScale
  const yPixel = (selectedBox.value.top - imgTop) / imgScale
  const widthPixel = selectedBox.value.width * selectedBox.value.scaleX / imgScale
  const heightPixel = selectedBox.value.height * selectedBox.value.scaleY / imgScale

  // 偏移一点位置（像素）
  const offsetX = 20
  const offsetY = 20

  // 转换为归一化坐标 (0-999)
  const newBox = {
    id: `box_${Date.now()}`,
    x: Math.round(((xPixel + offsetX) / imgWidth) * NORM_MAX),
    y: Math.round(((yPixel + offsetY) / imgHeight) * NORM_MAX),
    width: Math.round((widthPixel / imgWidth) * NORM_MAX),
    height: Math.round((heightPixel / imgHeight) * NORM_MAX),
    label: selectedBox.value.label || ''
  }

  // 添加到 store
  annotationStore.addBox(newBox)

  // 创建 Fabric 对象
  const rect = createFabricBox(newBox)
  canvas.add(rect)
  canvas.setActiveObject(rect)

  // 更新选中状态
  selectedBox.value = rect

  // 保存历史
  saveHistory('add', newBox)

  emit('boxes-changed')
  canvas.requestRenderAll()
}

// 键盘快捷键
function handleKeyDown(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return

  // Ctrl/Cmd + S: 保存
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault()
    emit('save')
    return
  }

  // N 键: 切换画框模式
  if (e.key === 'n' || e.key === 'N') {
    e.preventDefault()
    toggleDrawingMode()
    return
  }

  // Ctrl/Cmd + D: 复制选中框
  if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
    e.preventDefault()
    copySelectedBox()
    return
  }

  // Ctrl/Cmd + Z: 撤销
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
    e.preventDefault()
    undo()
    return
  }

  // Ctrl/Cmd + Shift + Z: 重做
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Z') {
    e.preventDefault()
    redo()
    return
  }

  // Delete/Backspace: 删除选中框
  if (e.key === 'Delete' || e.key === 'Backspace') {
    deleteSelectedBox()
    return
  }

  // 空格: 切换平移模式
  if (e.code === 'Space' && !e.ctrlKey && !e.metaKey) {
    e.preventDefault()
    togglePanningMode()
    return
  }

  // Ctrl/Cmd + 0: 重置视图
  if ((e.ctrlKey || e.metaKey) && e.key === '0') {
    e.preventDefault()
    resetZoom()
    uiStore.notify('视图已重置', 'success', '重置成功')
    return
  }

  // D 键: 上一张图片
  if (e.key === 'd' || e.key === 'D') {
    if (!e.ctrlKey && !e.metaKey) {
      emit('navigate', 'prev')
      return
    }
  }

  // F 键: 下一张图片
  if (e.key === 'f' || e.key === 'F') {
    if (!e.ctrlKey && !e.metaKey) {
      emit('navigate', 'next')
      return
    }
  }

  // 左右箭头: 切换图片
  if (e.key === 'ArrowLeft') {
    emit('navigate', 'prev')
    return
  }
  if (e.key === 'ArrowRight') {
    emit('navigate', 'next')
    return
  }
}

// 监听图片变化
watch(() => props.imageUrl, (newUrl) => {
  if (newUrl) {
    nextTick(() => {
      initCanvas()
      loadImage(newUrl)
    })
  }
}, { immediate: true })

// 监听标注框变化
watch(() => annotationStore.currentAnnotations, () => {
  if (canvas && fabricImage) {
    loadBoxesFromStore()
  }
}, { deep: true })

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  if (canvas) {
    canvas.dispose()
    canvas = null
  }
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
  background: var(--bg-color);
}

.canvas-wrapper:focus {
  outline: none;
}

.annotation-canvas {
  display: block;
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

.box-label-editor {
  position: fixed;
  display: flex;
  gap: 8px;
  padding: 8px;
  background: var(--card-bg);
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  box-shadow: var(--glass-shadow);
  z-index: 1000;
}

.box-label-editor input {
  width: 150px;
  padding: 6px 10px;
  border: 1px solid var(--glass-border);
  border-radius: 6px;
  background: var(--input-bg);
  color: var(--text-primary);
  font-size: 13px;
}

.btn-danger {
  background: linear-gradient(135deg, var(--error-color), #DC2626);
  color: white;
}
</style>
