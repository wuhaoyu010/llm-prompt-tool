# 前端问题修复与布局优化设计

## 概述

本次设计旨在解决 LLM Prompt Tool 前端的多个问题，包括功能 Bug、交互不合理和布局问题。采用**功能完整性优先**策略，分阶段实施。

## 用户需求

| 类别 | 具体需求 |
|------|----------|
| 功能完整性 | 所有按钮功能正常可用 |
| 交互优化 | 去掉 Ctrl 多选，优化缩略图滚动 |
| 布局优化 | 采用紧凑布局，画布自适应 |
| 联调测试 | 前后端一起联调验证 |

## 设计方案

### 阶段划分

| 阶段 | 目标 | 主要工作 |
|------|------|----------|
| **阶段一** | 功能修复 | 修复删除按钮、批量导入 400 错误 |
| **阶段二** | 交互优化 | 去掉 Ctrl 多选、优化缩略图滚动 |
| **阶段三** | 布局优化 | 紧凑布局、画布自适应 |

---

## 阶段一：功能修复

### 问题 1.1：全选后删除按钮不生效

**问题描述**：
- 全选图片后，点击删除按钮没有反应
- 批量操作按钮的点击事件未正确触发

**根本原因分析**：
- `ThumbnailGallery.vue` 中 `batchDelete` 函数调用了 `uiStore.showConfirm`
- 确认后 emit `batch-delete` 事件，但父组件 `HomeView.vue` 中未正确处理
- 需要检查事件绑定链路

**修复方案**：
1. 检查 `HomeView.vue` 中 `@batch-delete` 事件处理
2. 确保 `batchDeleteTestCases` 方法正确调用 API
3. 验证删除后的状态更新

**涉及文件**：
- `frontend/src/components/ThumbnailGallery.vue`
- `frontend/src/views/HomeView.vue`

### 问题 1.2：批量导入返回 400 错误

**问题描述**：
- 批量导入图片时返回 400 BAD REQUEST 错误

**根本原因分析**：
- axios 默认 `Content-Type: application/json`
- FormData 上传需要 `Content-Type: multipart/form-data`
- `api.post` 方法未正确支持覆盖默认 headers

**修复方案**：
1. 修改 `api.post` 方法支持 `headers` 配置覆盖
2. `BatchImportModal.vue` 中设置 `Content-Type: undefined`
3. 让浏览器自动设置正确的 Content-Type

**涉及文件**：
- `frontend/src/api/index.ts`
- `frontend/src/api/axios.ts`
- `frontend/src/components/BatchImportModal.vue`

---

## 阶段二：交互优化

### 优化 2.1：移除 Ctrl 多选

**问题描述**：
- 每张缩略图左上角已有复选框，Ctrl 多选功能多余

**优化方案**：
- 移除 `handleClick` 中的 Ctrl 键判断
- 点击图片直接选中该图片（单选模式）
- 复选框用于多选

**涉及文件**：
- `frontend/src/components/ThumbnailGallery.vue`

### 优化 2.2：缩略图滚动方向

**问题描述**：
- 网格视图下上下滚动不方便

**优化方案**：
- 网格视图只保留横向滚动
- 移除纵向滚动（使用 `overflow-x: auto; overflow-y: hidden`）

**涉及文件**：
- `frontend/src/components/ThumbnailGallery.vue`

---

## 阶段三：布局优化

### 紧凑布局设计

**目标**：类似 LabelImg 的专业标注工具布局

```
┌─────────────────────────────────────────────────────────────┐
│  顶部工具栏：批量标注 | 批量导入 | 保存 | 统计信息             │
├─────────────────────────────────────────────────────────────┤
│                           │                                  │
│    标注画布 (自适应)        │      缩略图列表                  │
│    - 图片自适应显示         │      - 横向滚动                  │
│    - 标注框同步缩放         │      - 复选框多选                │
│    - 无滚动条              │      - 批量操作按钮               │
│                           │                                  │
└─────────────────────────────────────────────────────────────┘
```

### 具体实现

**画布区域**：
- 使用 `flex: 1` 自适应填充
- 移除固定尺寸 1200x800
- 使用 `object-fit: contain` 保持图片比例
- 标注框坐标根据实际显示尺寸计算

**缩略图列表**：
- 固定宽度 280px
- 横向滚动显示
- 每张缩略图 80x60px

**涉及文件**：
- `frontend/src/views/HomeView.vue`
- `frontend/src/components/ThumbnailGallery.vue`
- `frontend/src/components/ImageAnnotationCanvas.vue`
- `frontend/src/styles/main.css`

---

## 联调测试计划

### 测试环境

1. 启动后端服务：`cd app && python main.py`
2. 启动前端服务：`cd frontend && npm run dev`
3. 使用浏览器访问前端页面

### 测试用例

| 测试项 | 预期结果 |
|--------|----------|
| 全选 + 删除 | 选中图片被删除，列表更新 |
| 批量导入 | 图片成功导入，无 400 错误 |
| 点击选中 | 点击图片直接选中 |
| 缩略图滚动 | 只支持横向滚动 |
| 布局自适应 | 窗口缩小时布局合理调整 |

---

## 风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 布局改动影响标注功能 | 高 | 先在本地验证，分阶段提交 |
| 删除操作不可逆 | 高 | 添加确认对话框 |
| API 改动影响其他模块 | 中 | 检查所有调用 api.post 的地方 |

---

## 实施顺序

1. **阶段一**：修复功能 Bug（1-2 小时）
2. **验证**：测试所有按钮功能正常
3. **阶段二**：优化交互（1 小时）
4. **验证**：测试交互符合预期
5. **阶段三**：优化布局（2 小时）
6. **最终验证**：完整测试 + 前后端联调

---

## 文档更新

完成实现后需更新以下文档：
- `CHANGELOG.md` - 记录所有变更
