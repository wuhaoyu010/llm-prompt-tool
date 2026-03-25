# 小目标标注优化实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 改善小目标标注的交互体验，实现手柄外置、双击缩放和 Minimap 导航

**Architecture:** 在现有 ImageAnnotationCanvas.vue 组件中添加三个独立功能模块，保持组件结构不变

**Tech Stack:** Vue 3 + Canvas API + CSS

---

## 文件结构

| 文件 | 职责 |
|-----|------|
| `src/frontend/src/components/ImageAnnotationCanvas.vue` | 唯一修改文件，包含所有功能实现 |

---

### Task 1: 手柄外置

**Files:**
- Modify: `src/frontend/src/components/ImageAnnotationCanvas.vue:343-410`

- [ ] **Step 1: 修改手柄位置计算逻辑**

将手柄从框边界上移到框外侧 12px 处。

找到 `resizeHandlePositions` computed 函数（约第 344 行），修改手柄位置计算：

```javascript
// 计算选中框的调整手柄位置（手柄在框外侧）
const resizeHandlePositions = computed(() => {
  if (!selectedBox.value || !naturalSize.value.width) return []

  const box = selectedBox.value
  // Canvas 内的像素坐标
  const x = normToPixel(box.x, naturalSize.value.width)
  const y = normToPixel(box.y, naturalSize.value.height)
  const w = normToPixel(box.width, naturalSize.value.width)
  const h = normToPixel(box.height, naturalSize.value.height)

  // 基于屏幕像素判断是否为小框
  const screenBoxW = w * scale.value
  const screenBoxH = h * scale.value
  const isSmallBox = screenBoxW < 40 || screenBoxH < 40

  // 手柄大小（屏幕固定像素）
  const handleSize = 10
  // 手柄距离框边的外延距离
  const handleOffset = 12

  // 使用响应式滚动位置
  const scrollLeft = scrollPosition.value.x
  const scrollTop = scrollPosition.value.y

  // 计算图片容器在 wrapper 中的偏移
  const wrapperWidth = wrapperSize.value.width
  const wrapperHeight = wrapperSize.value.height
  const scaledWidth = naturalSize.value.width * scale.value
  const scaledHeight = naturalSize.value.height * scale.value

  // 图片容器的左上角在 wrapper 中的位置（居中偏移）
  const containerOffsetX = Math.max(0, (wrapperWidth - scaledWidth) / 2 - 20)
  const containerOffsetY = Math.max(0, (wrapperHeight - scaledHeight) / 2 - 20)

  // 计算手柄在屏幕上的位置（框的屏幕坐标）
  const screenX = containerOffsetX + x * scale.value - scrollLeft
  const screenY = containerOffsetY + y * scale.value - scrollTop
  const screenW = w * scale.value
  const screenH = h * scale.value

  // 手柄位置：在框角点外侧 handleOffset 像素
  // 小框只有4个角点，大框有8个
  const handles = isSmallBox ? [
    { name: 'nw', cx: screenX - handleOffset, cy: screenY - handleOffset },
    { name: 'ne', cx: screenX + screenW + handleOffset, cy: screenY - handleOffset },
    { name: 'se', cx: screenX + screenW + handleOffset, cy: screenY + screenH + handleOffset },
    { name: 'sw', cx: screenX - handleOffset, cy: screenY + screenH + handleOffset }
  ] : [
    { name: 'nw', cx: screenX - handleOffset, cy: screenY - handleOffset },
    { name: 'n', cx: screenX + screenW / 2, cy: screenY - handleOffset },
    { name: 'ne', cx: screenX + screenW + handleOffset, cy: screenY - handleOffset },
    { name: 'e', cx: screenX + screenW + handleOffset, cy: screenY + screenH / 2 },
    { name: 'se', cx: screenX + screenW + handleOffset, cy: screenY + screenH + handleOffset },
    { name: 's', cx: screenX + screenW / 2, cy: screenY + screenH + handleOffset },
    { name: 'sw', cx: screenX - handleOffset, cy: screenY + screenH + handleOffset },
    { name: 'w', cx: screenX - handleOffset, cy: screenY + screenH / 2 }
  ]

  return handles.map(handle => ({
    name: handle.name,
    style: {
      left: `${handle.cx}px`,
      top: `${handle.cy}px`,
      width: `${handleSize}px`,
      height: `${handleSize}px`,
      marginLeft: `${-handleSize/2}px`,
      marginTop: `${-handleSize/2}px`
    }
  }))
})
```

- [ ] **Step 2: 构建并验证**

```bash
cd d:/Projects/llm_auto_update_prompt/src/frontend && npm run build
```

预期：构建成功，无错误

- [ ] **Step 3: 提交**

```bash
git add -A && git commit -m "feat: 手柄外置到框角点外侧 12px 处"
```

---

### Task 2: 双击框缩放 + Z 快捷键

**Files:**
- Modify: `src/frontend/src/components/ImageAnnotationCanvas.vue`

- [ ] **Step 1: 添加 zoomToBox 函数**

在 `fitToScreen` 函数附近添加 `zoomToBox` 函数：

```javascript
// 缩放到指定框（框占屏幕 70%）
function zoomToBox(box) {
  if (!box || !naturalSize.value.width || !canvasWrapper.value) return

  const boxW = normToPixel(box.width, naturalSize.value.width)
  const boxH = normToPixel(box.height, naturalSize.value.height)
  const boxCX = normToPixel(box.x, naturalSize.value.width) + boxW / 2
  const boxCY = normToPixel(box.y, naturalSize.value.height) + boxH / 2

  // 计算目标缩放比例（框占屏幕 70%）
  const targetScale = Math.min(
    (wrapperSize.value.width * 0.7) / boxW,
    (wrapperSize.value.height * 0.7) / boxH,
    5 // 最大 5x
  )

  scale.value = targetScale

  // 居中显示
  nextTick(() => {
    const scrollX = boxCX * targetScale - wrapperSize.value.width / 2
    const scrollY = boxCY * targetScale - wrapperSize.value.height / 2
    canvasWrapper.value.scrollTo(scrollX, scrollY)
    updateScrollPosition()
    drawAnnotations()
  })
}
```

- [ ] **Step 2: 修改 handleDoubleClick 函数**

找到 `handleDoubleClick` 函数（约第 947 行），修改为支持双击缩放：

```javascript
function handleDoubleClick(e) {
  // 双击标注框 - 缩放到该框
  if (currentTool.value === 'select') {
    const coords = getCanvasCoordinates(e)
    const clickedBox = getBoxAt(coords.x, coords.y)
    if (clickedBox) {
      selectedBox.value = clickedBox
      zoomToBox(clickedBox)
      return
    }
  }

  // 双击空白区域 - 适应屏幕
  fitToScreen()
  nextTick(() => {
    updateScrollPosition()
    updateWrapperSize()
    drawAnnotations()
  })
}
```

- [ ] **Step 3: 添加 Z 快捷键**

找到 `handleKeyDown` 函数中的 `switch` 语句（约第 1036 行），在 `case 'v'` 后面添加：

```javascript
case 'z':
  e.preventDefault()
  if (selectedBox.value) {
    zoomToBox(selectedBox.value)
  }
  return
```

- [ ] **Step 4: 更新快捷键面板说明**

找到快捷键面板模板（约第 100 行），在 "标注操作" 组中添加：

```html
<div class="shortcut-item"><kbd>Z</kbd> 缩放到选中框</div>
```

- [ ] **Step 5: 构建并验证**

```bash
cd d:/Projects/llm_auto_update_prompt/src/frontend && npm run build
```

- [ ] **Step 6: 提交**

```bash
git add -A && git commit -m "feat: 双击框/按 Z 键自动缩放到选中框"
```

---

### Task 3: Minimap 小地图

**Files:**
- Modify: `src/frontend/src/components/ImageAnnotationCanvas.vue`

- [ ] **Step 1: 添加 Minimap 状态变量**

在 `const wrapperSize` 附近添加：

```javascript
// Minimap 状态
const minimapCanvas = ref(null)
const minimapCollapsed = ref(false)
const minimapSize = computed(() => {
  // 根据图片方向决定 minimap 尺寸
  if (!naturalSize.value.width) return { width: 150, height: 100 }
  const ratio = naturalSize.value.width / naturalSize.value.height
  return ratio > 1
    ? { width: 150, height: Math.round(150 / ratio) }
    : { width: Math.round(100 * ratio), height: 100 }
})
```

- [ ] **Step 2: 添加 drawMinimap 函数**

在 `drawAnnotations` 函数后添加：

```javascript
// 绘制 Minimap
function drawMinimap() {
  const canvas = minimapCanvas.value
  if (!canvas || !imageUrl.value) return

  const ctx = canvas.getContext('2d')
  const { width: mw, height: mh } = minimapSize.value

  ctx.clearRect(0, 0, mw, mh)

  // 计算缩略图比例
  const scaleX = mw / naturalSize.value.width
  const scaleY = mh / naturalSize.value.height

  // 绘制图片缩略图
  if (imageEl.value) {
    ctx.drawImage(imageEl.value, 0, 0, mw, mh)
  }

  // 绘制所有标注框
  ctx.strokeStyle = '#EF4444'
  ctx.fillStyle = 'rgba(239, 68, 68, 0.3)'
  ctx.lineWidth = 1
  boxes.value.forEach(box => {
    const x = normToPixel(box.x, naturalSize.value.width) * scaleX
    const y = normToPixel(box.y, naturalSize.value.height) * scaleY
    const w = normToPixel(box.width, naturalSize.value.width) * scaleX
    const h = normToPixel(box.height, naturalSize.value.height) * scaleY
    ctx.fillRect(x, y, w, h)
    ctx.strokeRect(x, y, w, h)
  })

  // 绘制视口位置
  ctx.strokeStyle = '#2563EB'
  ctx.lineWidth = 2
  const scaledWidth = naturalSize.value.width * scale.value
  const scaledHeight = naturalSize.value.height * scale.value
  const viewW = (wrapperSize.value.width / scale.value) * scaleX
  const viewH = (wrapperSize.value.height / scale.value) * scaleY
  const viewX = (scrollPosition.value.x / scale.value) * scaleX
  const viewY = (scrollPosition.value.y / scale.value) * scaleY
  ctx.strokeRect(viewX, viewY, Math.min(viewW, mw), Math.min(viewH, mh))
}
```

- [ ] **Step 3: 添加 handleMinimapClick 函数**

```javascript
// 点击 Minimap 跳转
function handleMinimapClick(e) {
  if (!canvasWrapper.value || !naturalSize.value.width) return

  const rect = minimapCanvas.value.getBoundingClientRect()
  const clickX = e.clientX - rect.left
  const clickY = e.clientY - rect.top

  const { width: mw, height: mh } = minimapSize.value
  const scaleX = mw / naturalSize.value.width
  const scaleY = mh / naturalSize.value.height

  // 计算点击位置对应的图片坐标
  const targetX = clickX / scaleX
  const targetY = clickY / scaleY

  // 滚动到该位置（居中）
  const scrollX = targetX * scale.value - wrapperSize.value.width / 2
  const scrollY = targetY * scale.value - wrapperSize.value.height / 2

  canvasWrapper.value.scrollTo(scrollX, scrollY)
  updateScrollPosition()
}
```

- [ ] **Step 4: 添加 Minimap 模板**

在 `.canvas-wrapper` 结束标签后、快捷键面板前添加：

```html
<!-- Minimap 小地图 -->
<div
  v-if="imageUrl"
  class="minimap"
  :class="{ collapsed: minimapCollapsed.value }"
>
  <div class="minimap-header">
    <span class="minimap-title">导航</span>
    <button class="minimap-toggle" @click="minimapCollapsed.value = !minimapCollapsed.value">
      <span class="material-icons">{{ minimapCollapsed.value ? 'expand_less' : 'expand_more' }}</span>
    </button>
  </div>
  <canvas
    v-show="!minimapCollapsed.value"
    ref="minimapCanvas"
    class="minimap-canvas"
    :width="minimapSize.value.width"
    :height="minimapSize.value.height"
    @click="handleMinimapClick"
  />
</div>
```

- [ ] **Step 5: 添加 Minimap 样式**

在 `<style scoped>` 中添加：

```css
/* Minimap 样式 */
.minimap {
  position: absolute;
  right: 20px;
  bottom: 20px;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  z-index: 100;
}

.minimap.collapsed .minimap-canvas {
  display: none;
}

.minimap-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 8px;
  background: rgba(0, 0, 0, 0.2);
  border-bottom: 1px solid var(--glass-border);
}

.minimap-title {
  font-size: 11px;
  color: var(--text-secondary);
}

.minimap-toggle {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  color: var(--text-secondary);
}

.minimap-toggle .material-icons {
  font-size: 16px;
}

.minimap-canvas {
  display: block;
  cursor: pointer;
}
```

- [ ] **Step 6: 在 drawAnnotations 后调用 drawMinimap**

修改 `drawAnnotations` 函数末尾，添加调用：

```javascript
// 在 drawAnnotations 函数最后添加
drawMinimap()
```

- [ ] **Step 7: 在滚动事件中触发 drawMinimap**

修改 `updateScrollPosition` 函数，添加 `drawMinimap()` 调用：

```javascript
function updateScrollPosition() {
  if (canvasWrapper.value) {
    scrollPosition.value = {
      x: canvasWrapper.value.scrollLeft,
      y: canvasWrapper.value.scrollTop
    }
    drawMinimap()
  }
}
```

- [ ] **Step 8: 构建并验证**

```bash
cd d:/Projects/llm_auto_update_prompt/src/frontend && npm run build
```

- [ ] **Step 9: 提交**

```bash
git add -A && git commit -m "feat: 添加 Minimap 小地图导航功能"
```

---

### Task 4: 最终验证与推送

- [ ] **Step 1: 完整构建测试**

```bash
cd d:/Projects/llm_auto_update_prompt/src/frontend && npm run build
```

- [ ] **Step 2: 推送到远程**

```bash
cd d:/Projects/llm_auto_update_prompt && git push
```