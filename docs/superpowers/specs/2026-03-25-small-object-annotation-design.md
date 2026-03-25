# 小目标标注优化设计

> **目标**: 改善小目标标注的交互体验，解决手柄拥挤和缩放导航问题

## 背景

当前标注功能在小目标场景下存在以下问题：
1. **手柄拥挤**：手柄放在框边界上，小框时手柄重叠或超出框范围，难以操作
2. **缩放导航困难**：放大后难以定位目标位置，需要反复缩放调整

## 设计方案

### 1. 手柄外置

**原理**：将手柄放在框角点的外侧，而不是角点上

**位置计算**（屏幕像素，相对于框的角点）：

| 手柄 | 当前位置 | 改进后位置 |
|-----|---------|-----------|
| 左上 (nw) | `(x, y)` | `(x - 12, y - 12)` |
| 右上 (ne) | `(x + w, y)` | `(x + w + 12, y - 12)` |
| 右下 (se) | `(x + w, y + h)` | `(x + w + 12, y + h + 12)` |
| 左下 (sw) | `(x, y + h)` | `(x - 12, y + h + 12)` |
| 上中 (n) | `(x + w/2, y)` | `(x + w/2, y - 12)` |
| 右中 (e) | `(x + w, y + h/2)` | `(x + w + 12, y + h/2)` |
| 下中 (s) | `(x + w/2, y + h)` | `(x + w/2, y + h + 12)` |
| 左中 (w) | `(x, y + h/2)` | `(x - 12, y + h/2)` |

**视觉效果**：
```
改进前：                   改进后：
┌────────┐                 ○───────○
│ 框     │                 │ 框     │
│   ○ ○  │ ← 拥挤          │        │
│   │    │                 │        │
└──○─○──┘                 ○───────○
                           ↑ 手柄在框外侧，互不干扰
```

### 2. 双击框缩放

**触发方式**：
- **双击标注框** → 自动缩放并居中显示该框
- **快捷键 Z** → 缩放到当前选中的框

**缩放逻辑**：
```javascript
// 计算让框占屏幕 70% 的缩放比例
const targetFillRatio = 0.7
const scaleX = wrapperWidth / (boxWidth * targetFillRatio)
const scaleY = wrapperHeight / (boxHeight * targetFillRatio)
const newScale = Math.min(scaleX, scaleY, 5) // 最大 5x

// 计算居中位置
const scrollX = (boxCenterX * newScale) - wrapperWidth / 2
const scrollY = (boxCenterY * newScale) - wrapperHeight / 2
```

**交互细节**：
- 缩放时有平滑过渡动画（CSS transition）
- 框居中后自动选中该框
- 如果没有选中框，快捷键 Z 无操作

### 3. Minimap 小地图

**位置与大小**：
- 右下角固定定位
- 尺寸：150px × 100px（横向图片）/ 100px × 150px（纵向图片）
- 可通过按钮收起/展开

**组成元素**：
1. **缩略图**：整张图片的缩小版本
2. **视口标记**：红色矩形，表示当前可视区域
3. **标注标记**：小点显示所有标注框的位置

**交互**：
- 点击缩略图 → 跳转到对应位置
- 拖动视口标记 → 平移视口
- 悬停显示工具提示

**实现方式**：
- 使用独立 Canvas 绘制
- 每次主画布更新时同步更新 minimap
- 响应式计算缩略图比例

## 技术实现

### 文件修改

**ImageAnnotationCanvas.vue**：

1. **手柄位置计算**：修改 `resizeHandlePositions` computed
2. **双击缩放**：添加 `zoomToBox(box)` 函数，修改 `handleDoubleClick`
3. **Minimap 组件**：添加新的 template 部分和样式

### 新增功能

```javascript
// 缩放到指定框
function zoomToBox(box) {
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
  })
}
```

### Minimap 实现

```vue
<template>
  <!-- Minimap -->
  <div class="minimap" :class="{ collapsed: minimapCollapsed }">
    <div class="minimap-header">
      <span>导航</span>
      <button @click="minimapCollapsed = !minimapCollapsed">
        {{ minimapCollapsed ? '◀' : '▼' }}
      </button>
    </div>
    <canvas v-if="!minimapCollapsed" ref="minimapCanvas" class="minimap-canvas"
      @click="handleMinimapClick" />
  </div>
</template>
```

## 测试计划

1. **手柄外置**
   - 小框（<40px）手柄在框外侧，可正常点击
   - 大框手柄也在框外侧，互不干扰
   - 缩放后手柄位置正确

2. **双击缩放**
   - 双击框后自动缩放并居中
   - 快捷键 Z 正常工作
   - 无选中框时 Z 无操作

3. **Minimap**
   - 正确显示缩略图和标注位置
   - 视口标记位置准确
   - 点击跳转正常