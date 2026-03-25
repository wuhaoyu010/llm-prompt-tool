# 标注功能交互优化设计

> **目标**: 提升标注工具的使用效率，实现预设标签和快捷键切换模式

## 背景

当前标注功能存在以下问题：
1. 每次画框都需要输入标签，操作繁琐
2. 画框后无法选中和修改标注框
3. 缺少专业标注工具的快捷键支持

## 设计方案

### 1. 预设标签输入框

**位置**: 图片标注区域顶部工具栏

**功能**:
- 输入框默认显示当前缺陷名称（从 `defectStore.currentDefect.name` 获取）
- 用户可修改为任意标签文本
- 标注模式下绘制新框时自动使用输入框中的标签
- 支持快捷键 Enter 确认

**UI**:
```
[标签: ______xy_defect______ ] 当前模式: 选择 (V) | 标注 (N)
```

### 2. 模式切换系统

**快捷键**:

| 快捷键 | 模式 | 说明 |
|-------|------|------|
| **N** | 标注模式 | 十字光标，拖拽绘制新框 |
| **V** | 选择模式 | 点击选中框，拖拽移动，手柄调整大小 |
| **空格 + 拖拽** | 临时拖动 | 按住空格临时拖动画布 |
| **Delete** | 删除 | 删除选中的标注框 |
| **Ctrl+D** | 复制 | 复制选中的框 |

**默认模式**: 选择模式（V）

**视觉反馈**:

| 模式 | 光标 | 状态栏提示 |
|-----|------|-----------|
| 标注模式 | 十字线 `crosshair` | "标注模式 (N)" |
| 选择模式 | 默认/移动箭头 | "选择模式 (V)" |
| 拖动模式 | 手形 `grab` | "拖动画布" |

### 3. 选择模式交互

**选中框**:
- 点击标注框 → 选中该框
- 选中框显示 8 个调整手柄（四角 + 四边中点）
- 悬停在框上时显示高亮边框（`rgba(239, 68, 68, 0.3)`）

**移动框**:
- 在选中框内部拖拽 → 移动整个框
- 移动时显示虚线预览位置

**调整大小**:
- 拖拽调整手柄 → 调整框的大小
- 四角手柄：同时调整宽高
- 四边中点手柄：调整单边

**删除框**:
- 选中框后按 Delete 键删除
- 或右键菜单选择"删除"

### 4. 标注模式交互

**绘制新框**:
- 鼠标按下开始绘制
- 拖拽确定框的大小
- 松开鼠标完成绘制
- 新框自动使用预设标签

**Shift 强制绘制**:
- 在选择模式下，按住 Shift + 拖拽可强制绘制新框
- 用于在现有框内部或重叠区域绘制新框

### 5. 画布拖动

**空格临时拖动**:
- 在任意模式下，按住空格键进入临时拖动模式
- 鼠标变为手形，可拖动画布查看不同区域
- 松开空格键恢复之前的模式

**滚轮缩放**:
- 鼠标滚轮缩放画布（已支持）

## 技术实现

### 状态管理

```javascript
// ImageAnnotationCanvas.vue
const mode = ref('select') // 'select' | 'annotate'
const isDraggingCanvas = ref(false)
const spacePressed = ref(false)

// 预设标签
const presetLabel = computed(() => defectStore.currentDefect?.name || '')
const customLabel = ref('')
const currentLabel = computed(() => customLabel.value || presetLabel.value)
```

### 事件处理

```javascript
// 键盘事件
function handleKeyDown(e) {
  if (e.key === 'n' || e.key === 'N') {
    mode.value = 'annotate'
  } else if (e.key === 'v' || e.key === 'V') {
    mode.value = 'select'
  } else if (e.key === ' ') {
    e.preventDefault()
    spacePressed.value = true
  } else if (e.key === 'Delete' && selectedBoxId.value) {
    deleteSelectedBox()
  }
}

function handleKeyUp(e) {
  if (e.key === ' ') {
    spacePressed.value = false
  }
}

// 鼠标事件
function handleMouseDown(e) {
  if (spacePressed.value) {
    // 拖动画布
    startCanvasDrag(e)
  } else if (mode.value === 'annotate' || e.shiftKey) {
    // 绘制新框
    startDrawing(e)
  } else {
    // 选择模式：检测点击位置
    const clickedBox = getBoxAtPosition(e.offsetX, e.offsetY)
    if (clickedBox) {
      selectBox(clickedBox)
      startMoveOrResize(e, clickedBox)
    } else {
      deselectAll()
    }
  }
}
```

### UI 组件

**工具栏**:
```vue
<div class="annotation-toolbar">
  <div class="label-input">
    <label>标签:</label>
    <input v-model="customLabel" :placeholder="presetLabel" />
  </div>
  <div class="mode-indicator">
    当前模式: {{ mode === 'annotate' ? '标注 (N)' : '选择 (V)' }}
  </div>
</div>
```

**光标样式**:
```css
.canvas-container.annotate-mode { cursor: crosshair; }
.canvas-container.select-mode { cursor: default; }
.canvas-container.dragging-canvas { cursor: grab; }
```

## 文件修改

### 前端

- `src/frontend/src/components/ImageAnnotationCanvas.vue`
  - 添加模式状态管理
  - 添加键盘事件监听
  - 重构鼠标事件处理逻辑
  - 添加预设标签输入框 UI
  - 添加调整手柄绘制和交互

- `src/frontend/src/stores/annotation.js`
  - 添加选中框状态
  - 添加删除/复制框的 actions

### 后端

- 无需修改（标签通过现有 API 传递）

## 测试计划

1. 快捷键切换模式正常
2. 预设标签正确应用到新框
3. 选择模式下可选中、移动、调整框大小
4. 空格临时拖动正常工作
5. Delete 键删除选中框
6. Shift 强制绘制在重叠区域正常工作