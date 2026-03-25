# 前端问题修复与布局优化实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标：** 修复前端功能 Bug（删除按钮、批量导入 400 错误）、优化交互（移除 Ctrl 多选、缩略图滚动）、优化布局（紧凑布局）

**架构：** 分三个阶段实施：阶段一修复功能 Bug，阶段二优化交互，阶段三优化布局。采用紧凑布局，缩略图列表固定在右侧，画布自适应填充。

**技术栈：** Vue 3, TypeScript, axios, Flask (后端)

---

## 阶段一：功能修复

### 任务 1.1: 修复批量导入 400 错误

**Files:**
- Modify: `frontend/src/api/index.ts:30-45`
- Modify: `frontend/src/components/BatchImportModal.vue:180-185`
- Test: 手动测试批量导入功能

- [ ] **Step 1: 修改 api.post 支持 headers 覆盖**

当前代码 `api.post` 方法的 headers 配置未正确传递：

```typescript
async post<T>(url: string, data?: unknown, config?: { timeout?: number; headers?: Record<string, unknown> }): Promise<T> {
  try {
    const axiosConfig: any = {}
    if (config?.timeout) axiosConfig.timeout = config.timeout
    if (config?.headers) axiosConfig.headers = config.headers  // 这里需要更深层次的合并
    const response = await axiosInstance.post<any>(url, data, axiosConfig)
    return handleResponse<T>(response.data)
  } catch (error) {
    throw new Error(getErrorMessage(error))
  }
}
```

问题在于 axiosInstance 默认有 `Content-Type: application/json`，当传入 `headers: { 'Content-Type': undefined }` 时，应该删除该 header 让浏览器自动设置。

修复方案：需要先读取 axios.ts 的默认配置，然后正确合并。

- [ ] **Step 2: 验证 axios.ts 默认配置**

检查 `frontend/src/api/axios.ts` 第 30-40 行：
```typescript
const axiosInstance: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: DEFAULT_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
})
```

- [ ] **Step 3: 修改 api/index.ts 的 post 方法**

需要正确处理 headers 覆盖逻辑：

```typescript
async post<T>(url: string, data?: unknown, config?: { timeout?: number; headers?: Record<string, unknown> }): Promise<T> {
  try {
    const axiosConfig: any = {}
    if (config?.timeout) axiosConfig.timeout = config.timeout
    if (config?.headers) {
      // 如果传入的 headers 中有 undefined 值，表示要删除该 header
      const headers: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(config.headers)) {
        if (value !== undefined) {
          headers[key] = value
        }
      }
      axiosConfig.headers = headers
    }
    const response = await axiosInstance.post<any>(url, data, axiosConfig)
    return handleResponse<T>(response.data)
  } catch (error) {
    throw new Error(getErrorMessage(error))
  }
}
```

- [ ] **Step 4: 测试批量导入**

手动测试：选择图片 → 点击导入 → 观察是否成功

---

### 任务 1.2: 修复全选后删除按钮不生效

**Files:**
- Modify: `frontend/src/views/HomeView.vue:100-120`
- Modify: `frontend/src/components/ThumbnailGallery.vue:270-300`
- Test: 手动测试全选删除功能

- [ ] **Step 1: 检查 HomeView.vue 中 batch-delete 事件处理**

在 `HomeView.vue` 中找到 `@batch-delete` 绑定，验证 `batchDeleteTestCases` 方法实现。

- [ ] **Step 2: 检查 ThumbnailGallery.vue 的 batchDelete 函数**

查看 `ThumbnailGallery.vue` 第 270-285 行的 `batchDelete` 函数：

```typescript
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
```

这里 emit 了 `batch-delete` 事件，但需要确认 HomeView.vue 是否正确处理。

- [ ] **Step 3: 在 HomeView.vue 中搜索 batch-delete**

查找 `@batch-delete` 或 `handleBatchDelete` 方法，确认实现正确。

- [ ] **Step 4: 检查 batchDeleteTestCases 方法**

HomeView.vue 中应该有类似这样的方法：

```typescript
const batchDeleteTestCases = async (ids: number[]) => {
  try {
    await api.testcases.batchDelete(ids)
    await defectStore.loadTestCases()
    uiStore.notify('删除成功', 'success')
  } catch (error) {
    uiStore.notify('删除失败: ' + error.message, 'error', '错误')
  }
}
```

- [ ] **Step 5: 手动测试全选删除**

1. 选择多个图片
2. 点击全选
3. 点击删除按钮
4. 确认删除
5. 观察是否成功删除

---

## 阶段二：交互优化

### 任务 2.1: 移除 Ctrl 多选

**Files:**
- Modify: `frontend/src/components/ThumbnailGallery.vue:270-285`
- Test: 手动测试点击选中

- [ ] **Step 1: 检查 handleClick 函数**

当前 `handleClick` 函数（大约在 270 行）：

```typescript
function handleClick(id, event) {
  // 点击图片直接选中该图片（单选模式）
  emit('select', id)
}
```

已经不需要 Ctrl 判断了，确认代码如上即可。

- [ ] **Step 2: 测试点击选中**

点击缩略图，确认直接选中并显示在画布上。

---

### 任务 2.2: 优化缩略图滚动方向

**Files:**
- Modify: `frontend/src/components/ThumbnailGallery.vue`
- Modify: `frontend/src/styles/main.css`
- Test: 手动测试滚动

- [ ] **Step 1: 查找网格视图滚动样式**

在 `ThumbnailGallery.vue` 中找到 `.thumbnail-container.grid` 样式，确保 `overflow-x: auto` 和 `overflow-y: hidden`。

- [ ] **Step 2: 检查 thumbnail-scroll-wrapper 样式**

确认 `.thumbnail-scroll-wrapper` 类的样式设置。

- [ ] **Step 3: 测试横向滚动**

在网格视图下，横向滑动应该能滚动图片列表，纵向应该被阻止。

---

## 阶段三：布局优化

### 任务 3.1: 实现紧凑布局

**Files:**
- Modify: `frontend/src/views/HomeView.vue`
- Modify: `frontend/src/components/ThumbnailGallery.vue`
- Modify: `frontend/src/styles/main.css`
- Test: 手动测试布局

- [ ] **Step 1: 分析当前 HomeView.vue 布局**

查看 `.annotation-workspace` 和 `.canvas-panel`、`.thumbnail-panel` 的样式。

- [ ] **Step 2: 修改布局为 flex 横向排列**

目标布局：
```
┌─────────────────────────────────────────────────────────────┐
│                           │                                  │
│    标注画布 (flex: 1)     │      缩略图列表 (width: 280px)    │
│                           │                                  │
└─────────────────────────────────────────────────────────────┘
```

- [ ] **Step 3: 调整画布自适应**

移除固定宽度/高度，使用 `flex: 1` 和 `object-fit: contain`。

- [ ] **Step 4: 调整缩略图列表宽度**

固定宽度 280px，横向滚动。

- [ ] **Step 5: 测试窗口缩放**

缩小窗口，观察布局是否合理调整。

---

## 联调测试

### 后端启动

- [ ] **启动后端服务**

```bash
cd app
python main.py
```

### 前端启动

- [ ] **启动前端服务**

```bash
cd frontend
npm run dev
```

### 测试清单

- [ ] 测试全选 + 删除功能
- [ ] 测试批量导入功能（无 400 错误）
- [ ] 测试点击选中图片
- [ ] 测试缩略图横向滚动
- [ ] 测试布局自适应

---

## 文档更新

- [ ] 更新 `CHANGELOG.md` 记录所有变更

