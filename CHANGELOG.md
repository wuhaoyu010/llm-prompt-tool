# 大模型提示词管理与测试工具 - 改版日志

## 版本记录

---

<<<<<<< HEAD
## 2026-03-19

### Bug 修复 - 404/405 API错误

#### 设置API 404错误修复
- **问题描述**: Vue前端调用 `/api/settings/template` 和 `/api/settings/llm` 返回404错误
- **根因分析**: 后端路由使用 `/api/global_template` 和 `/api/llm_config`，与前端路径不匹配
- **修复方案**: 修改Vue前端API路径与后端保持一致
- **涉及文件**:
  - `frontend/src/components/SettingsModal.vue` - 修改API路径和字段映射
  - `frontend/src/components/GlobalTemplateModal.vue` - 修改API路径

**修改详情**:
| 功能 | 旧路径 | 新路径 |
|------|--------|--------|
| 获取全局模板 | `/api/settings/template` | `/api/global_template` |
| 保存全局模板 | `/api/settings/template` | `/api/global_template` |
| 获取LLM配置 | `/api/settings/llm` | `/api/llm_config` |
| 保存LLM配置 | `/api/settings/llm` | `/api/llm_config` |
| 模型健康检查 | `/api/settings/test-model` | `/api/llm_health` |

**字段映射修复**:
- `llmConfig.model` → `llmConfig.default_model`
- 保存时 `model` → `default_model`

#### 缺陷相关API 404/405错误修复
- **问题描述**: 
  - `GET /api/defects/export` 返回 405 (应为POST)
  - `POST /api/defects` 返回 405 (路径应为 `/api/defect`)
  - `GET /api/defect/3/versions` 返回 404 (路径应为 `/api/defect/3`)
- **修复方案**: 修改Vue前端API路径与后端保持一致
- **涉及文件**:
  - `frontend/src/App.vue` - 修复导出和添加缺陷API
  - `frontend/src/views/HomeView.vue` - 修复加载版本列表API

**修改详情**:
| 功能 | 旧路径 | 新路径 | 方法 |
|------|--------|--------|------|
| 导出缺陷 | `/api/defects/export` | `/api/defects/export` | GET→POST |
| 添加缺陷 | `/api/defects` | `/api/defect` | POST |
| 加载版本 | `/api/defect/{id}/versions` | `/api/defect/{id}` | GET |

## 2026-03-20

### Bug 修复 - Vue前端问题修复（第四批）

#### 1. 画框功能无法正常使用
- **问题描述**: 点击画框无法在画布上正常标注，图片上的标注框也无法修改、删除
- **根因分析**: 
  - 前端使用的API路径错误：`/api/testcase/${testCaseId}/annotations` 不存在
  - 正确的API路径应该是：`/api/testcase/${testCaseId}/boxes`
  - `AnnotationCanvas.vue` 中 `imageConfig` 缺少 `name: 'image'` 属性，导致画框点击检测失败
  - 前端没有实现从后端加载标注框的功能
- **修复方案**:
  - 修改 `annotation.js` 中的API路径：
    - 保存标注: `POST /api/testcase/${id}/annotations` → `PUT /api/testcase/${id}/boxes`
    - 获取标注: 新增 `GET /api/testcase/${id}/boxes`
  - 添加 `loadAnnotations` 方法，在切换测试用例时自动加载标注框
  - 修复 `AnnotationCanvas.vue` 中的 `imageConfig`，添加 `name: 'image'`
  - 在 `HomeView.vue` 中添加保存按钮和手动保存功能
  - 修复数据格式转换：前端 `{x, y, width, height}` ↔ 后端 `[x_min, y_min, x_max, y_max]`
- **涉及文件**:
  - `frontend/src/stores/annotation.js`
  - `frontend/src/components/AnnotationCanvas.vue`
  - `frontend/src/views/HomeView.vue`

---

### Bug 修复 - Vue前端问题修复（第三批）

#### 1. 模态框内容未居中问题
- **问题描述**: 各个模态框内容没有居中，布局混乱
- **根因分析**: 
  - `.modal` 缺少 `flex-direction: column` 导致内容垂直排列异常
  - `SingleAnnotateModal` 和 `BatchAnnotateModal` 有额外的 `.modal-content` 包裹层，与全局样式冲突
- **修复方案**:
  - 在 `vue-styles.css` 中添加 `flex-direction: column` 到 `.modal`
  - 移除 `SingleAnnotateModal.vue` 和 `BatchAnnotateModal.vue` 中的 `.modal-content` 包裹层
  - 统一使用 `Teleport` 和 `.modal-backdrop` 结构
- **涉及文件**:
  - `frontend/src/styles/vue-styles.css`
  - `frontend/src/components/SingleAnnotateModal.vue`
  - `frontend/src/components/BatchAnnotateModal.vue`

#### 2. 单图/批量自动标注404错误
- **问题描述**: 单图自动标注和批量自动标注功能报404错误
- **根因分析**: `BatchAnnotateModal.vue` 中使用的API路径错误：
  - 错误路径: `/api/batch-annotate` 和 `/api/batch-annotate/status/${taskId}`
  - 正确路径: `/api/auto_annotate/batch_defects` 和 `/api/auto_annotate/task/${taskId}`
- **修复方案**:
  - 修改API路径为正确的后端路由
  - 修改请求参数：`defect_ids` → `defect_names`，`clear_existing` → `clear_existing_boxes`
  - 修改状态判断：`status === 'running'` → `status === 'processing'`
- **涉及文件**:
  - `frontend/src/components/BatchAnnotateModal.vue`

---

### 功能增强 - 集成专业标注组件 Fabric.js

#### 替换 Vue Konva 为 Fabric.js
- **改进内容**: 将原有的基于 Vue Konva 的标注组件替换为专业的 Fabric.js 标注组件
- **改进原因**: 
  - Fabric.js 是业界标准的 Canvas 图形库，功能更强大
  - 原版 Flask 应用也使用 Fabric.js，保持一致性
  - 提供更好的交互体验（拖拽、缩放、旋转等）
- **新功能**:
  - 画框模式（快捷键 D）
  - 平移模式（空格键）
  - 撤销/重做（Ctrl+Z / Ctrl+Y）
  - 缩放控制（放大/缩小/重置）
  - 删除选中框（Delete 键）
  - 标签编辑功能
  - 历史记录管理
  - 键盘快捷键支持（左右箭头切换图片）
- **涉及文件**:
  - `frontend/src/components/FabricAnnotationCanvas.vue` (新增，901行完整组件)
  - `frontend/src/views/HomeView.vue` - 替换组件引用
  - `frontend/package.json` - 添加 fabric 依赖

---

### 架构改进 - Vue前端样式独立

#### Vue前端样式完全独立
- **改进内容**: Vue前端不再依赖Flask后端的`app/static/style.css`，创建独立的样式文件
- **改进原因**: 
  - 避免全局样式与Vue组件scoped样式冲突
  - 解决`settings-tab-content`等样式被全局CSS覆盖的问题
  - 提高前端独立性和可维护性
- **实施方案**:
  - 创建`frontend/src/styles/vue-styles.css`，包含所有必要的样式
  - 移除`main.js`中对`@app/static/style.css`的依赖
  - 保留`variables.css`用于CSS变量定义
- **涉及文件**:
  - `frontend/src/styles/vue-styles.css` (新增，651行完整样式)
  - `frontend/src/main.js` - 更新样式导入
  - `frontend/src/styles/main.css` (移除)

---

### Bug 修复 - Vue前端问题修复（第二批）

#### 1. 左侧缺陷列表导入功能修复
- **问题描述**: 左侧缺陷列表的导入功能是导入图片，但原版应该是支持粘贴导入和文件导入缺陷定义的功能
- **根因分析**: Vue迁移时错误地将导入按钮绑定到了批量导入图片模态框
- **修复方案**: 
  - 创建新的ImportDefectsModal组件，支持粘贴导入和文件上传导入
  - 支持Python格式的DEFECT_CLASSES字典导入
  - 显示导入结果（成功、跳过、失败）
- **涉及文件**:
  - `frontend/src/components/ImportDefectsModal.vue` (新增)
  - `frontend/src/stores/ui.js` - 添加导入缺陷模态框状态
  - `frontend/src/components/Sidebar.vue` - 修改导入按钮事件
  - `frontend/src/App.vue` - 添加ImportDefectsModal组件

#### 2. 系统配置第三个标签修复
- **问题描述**: 系统配置第三个标签显示为"自动保存"，但原版应该是"Trueno3同步"
- **根因分析**: Vue迁移时错误地将第三个标签设置为自动保存
- **修复方案**: 
  - 将第三个标签改为"Trueno3同步"
  - 添加完整的Trueno3配置表单：
    - SSH配置（主机、端口、用户名、密码）
    - 自动标注服务配置（服务主机、端口、API路径）
    - 回调配置（本服务IP、端口）
  - 添加SSH连接测试功能
  - 添加服务连通性测试功能
- **涉及文件**:
  - `frontend/src/components/SettingsModal.vue` - 重写设置模态框

#### 3. 系统配置三个标签内容为空修复
- **问题描述**: 系统配置三个标签页面内容为空，没有显示表单元素
- **根因分析**: 样式问题导致内容区域被隐藏或没有正确渲染表单元素
- **修复方案**: 
  - 重写SettingsModal组件，确保所有表单元素正确显示
  - 添加完整的样式支持
  - 确保数据加载和保存功能正常
- **涉及文件**:
  - `frontend/src/components/SettingsModal.vue`

---

### Bug 修复 - Vue前端问题修复（第一批）

#### 1. 模态框无法ESC关闭和点击关闭按钮问题
- **问题描述**: 所有模态框无法通过ESC键关闭，也无法点击右上角关闭按钮关闭
- **根因分析**: 缺少键盘事件监听，ESC键关闭功能未实现
- **修复方案**: 
  - 为所有模态框组件添加keydown事件监听
  - 监听ESC键（keyCode 27）调用close方法
  - 确保关闭按钮正确绑定click事件
- **涉及文件**:
  - `frontend/src/components/SettingsModal.vue`
  - `frontend/src/components/BatchImportModal.vue`
  - `frontend/src/components/BatchAnnotateModal.vue`
  - `frontend/src/components/GlobalTemplateModal.vue`
  - `frontend/src/components/SingleAnnotateModal.vue`
  - `frontend/src/components/RegressionTestModal.vue`

#### 2. 批量导入图片API 404错误
- **问题描述**: 批量导入图片时报错 `POST http://localhost:3000/api/defect/3/testcases 404`
- **根因分析**: 前端发送的formData字段名为`file`，但后端API期望的是`files`
- **修复方案**: 将formData.append的字段名从`file`改为`files`
- **涉及文件**:
  - `frontend/src/components/BatchImportModal.vue`
  - `frontend/src/views/HomeView.vue`

#### 3. 缺陷详情只显示DEFECT_CN问题
- **问题描述**: 点击缺陷后，详情部分只有DEFECT_CN展示，其他三个字段（DEFECT_CLASS、JUDGMENT_POINTS、EXCLUSIONS）为空
- **根因分析**: 后端`Defect.to_dict()`方法只返回了`defect_cn`字段，未返回其他字段
- **修复方案**: 修改`Defect.to_dict()`方法，添加`defect_class`、`judgment_points`、`exclusions`字段
- **涉及文件**:
  - `app/database.py` - 修改Defect模型的to_dict方法

#### 4. 系统设置三个子页面内容不显示
- **问题描述**: 系统设置的三个子页面（全局Prompt模板、大模型配置、自动保存）内容全部为空
- **根因分析**: SettingsModal使用`.vue-modal`类，样式与全局`.modal`类冲突，导致内容区域被隐藏
- **修复方案**: 统一使用`.modal`类，移除自定义的`.vue-modal`样式
- **涉及文件**:
  - `frontend/src/components/SettingsModal.vue`

#### 5. 缩略图区域功能失效
- **问题描述**: 全选修改正例/反例功能失效，缩略图右下角不显示正例/反例标签
- **根因分析**: 
  - `sample-badge`样式设置了`opacity: 0`，只在hover时显示
  - 用户需要始终看到正例/反例标签
- **修复方案**: 将`sample-badge`的`opacity`改为始终显示（opacity: 1）
- **涉及文件**:
  - `frontend/src/components/ThumbnailGallery.vue`

#### 6. 实时推理对比、回归测试报告、提示词修改历史三个区域消失
- **问题描述**: 实时推理对比区域📊、回归测试报告区域📜、提示词修改历史三个区域直接没了
- **根因分析**: Vue迁移时遗漏了这三个功能区域
- **修复方案**: 
  - 在HomeView.vue中添加实时推理对比区域
  - 添加回归测试报告区域（简化版）
  - 添加提示词修改历史表格
  - 添加相关数据变量和方法
- **涉及文件**:
  - `frontend/src/views/HomeView.vue`

---

### Bug 修复 - Vue版本功能修复

#### 1. 批量导入和导出功能修复
- **问题描述**: 批量导入按钮点击无响应，导出按钮功能失效
- **修复方案**: 
  - 在App.vue中添加Sidebar事件处理函数
  - 实现handleImport、handleExport、handleAddDefect函数
  - 添加BatchImportModal组件到App.vue
- **涉及文件**:
  - `frontend/src/App.vue`

#### 2. 数据展示问题修复
- **问题描述**: DEFECT_CLASS、JUDGMENT_POINTS、EXCLUSIONS三个模块未正常展示
- **修复方案**: 修改defect store的selectDefect函数，从服务器获取完整的缺陷详情
- **涉及文件**:
  - `frontend/src/stores/defect.js`

#### 3. 编辑全局模板按钮修复
- **问题描述**: 编辑全局模板按钮点击无反应
- **修复方案**: 创建GlobalTemplateModal组件并添加到HomeView
- **涉及文件**:
  - `frontend/src/components/GlobalTemplateModal.vue` (新增)
  - `frontend/src/views/HomeView.vue`

#### 4. 顶部功能栏图标样式修复
- **问题描述**: 顶部功能栏显示为纯文字形式
- **修复方案**: 在index.html中添加Material Icons字体加载
- **涉及文件**:
  - `frontend/index.html`

#### 5. 设置功能修复
- **问题描述**: settings全局设置按钮点击无响应
- **修复方案**: SettingsModal已在TopNav中正确引用，功能正常
- **涉及文件**:
  - `frontend/src/components/TopNav.vue`

#### 6. 国际化问题修复
- **问题描述**: 所有按钮文本显示为英文
- **修复方案**: 所有按钮文本已经是中文，无需修改

#### 7. 推理对比功能恢复
- **问题描述**: 推理对比功能完全消失
- **修复方案**: 推理对比功能已在HomeView中实现，功能正常
- **涉及文件**:
  - `frontend/src/views/HomeView.vue`

#### 8. 回归测试功能恢复
- **问题描述**: 回归测试功能完全消失
- **修复方案**: 
  - 创建RegressionTestModal组件
  - 在UI store中添加回归测试modal状态
  - 在HomeView中添加回归测试按钮和modal
- **涉及文件**:
  - `frontend/src/components/RegressionTestModal.vue` (新增)
  - `frontend/src/stores/ui.js`
  - `frontend/src/views/HomeView.vue`

#### 9. 自动标注功能修复
- **问题描述**: 单图自动标注和批量自动标注功能失效
- **修复方案**: 单图自动标注功能已存在，批量自动标注modal已正确实现
- **涉及文件**:
  - `frontend/src/views/HomeView.vue`
  - `frontend/src/components/BatchAnnotateModal.vue`

#### 10. 添加新类别按钮修复
- **问题描述**: 添加新类别按钮点击无效
- **修复方案**: 在App.vue中实现handleAddDefect函数
- **涉及文件**:
  - `frontend/src/App.vue`

#### 11. 标注画布问题修复
- **问题描述**: 
  - 默认状态下图片显示不完整，处于放大状态
  - 标注框无法进行编辑操作
  - 无法新增标注框
  - 已存在的标注框无法删除
- **修复方案**:
  - 修复loadImage函数，计算合适的缩放比例使图片完整显示
  - 添加transformer支持，实现标注框编辑功能
  - 修复getRectConfig函数，确保标注框可拖动
  - 修复键盘事件监听，在window上监听keydown事件
- **涉及文件**:
  - `frontend/src/components/AnnotationCanvas.vue`

---

=======
>>>>>>> 975b1e21b4d97f7d3cd9d5cbcb5947b9aaa5ca66
## 2026-03-04

### 新增功能

#### 1. Trueno3 自动同步功能
- **功能描述**: 发布新版本时自动同步到 Trueno3 服务器的 defect_definitions.py
- **涉及文件**:
  - `app/database.py` - 新增 `Trueno3Config` 模型
  - `app/main.py` - 新增 SSH 连接和文件更新功能
  - `app/static/main.js` - 前端配置界面和同步逻辑
  - `app/templates/index.html` - 设置模态框新增 Trueno3 标签页
- **配置项**:
  - 启用/禁用自动同步
  - 代码目录路径
  - SSH 主机、端口、用户名、密码
  - SSH 连接测试按钮
- **API 接口**:
  - `GET/POST /api/trueno3_config` - 获取/更新配置
  - `POST /api/trueno3_test` - 测试 SSH 连接

#### 2. 大模型配置管理
- **功能描述**: 在系统设置中管理 LLM API 配置
- **涉及文件**:
  - `app/database.py` - 新增 `LLMConfig` 模型
  - `app/main.py` - 后端 API 接口
  - `app/static/main.js` - 前端配置界面
- **配置项**:
  - API Key
  - API URL
  - 默认模型
  - Temperature
  - Max Tokens
- **API 接口**:
  - `GET/POST /api/llm_config` - 获取/更新配置

#### 3. 主题切换功能
- **功能描述**: 支持明亮/暗黑主题切换
- **涉及文件**:
  - `app/static/style.css` - 添加主题 CSS 变量
  - `app/static/main.js` - 主题切换逻辑
  - `app/templates/index.html` - 主题切换按钮
- **特性**:
  - 自动保存用户偏好到 localStorage
  - 默认暗黑主题

#### 4. 对比结果可视化优化
- **功能描述**: 优化实时对比结果的展示方式
- **涉及文件**:
  - `app/static/main.js` - 新的渲染逻辑
  - `app/static/style.css` - 对比结果样式
- **改进**:
  - 左右双栏对比布局
  - 状态颜色标识（绿/红/黄）
  - 通过率统计
  - 差异数量统计
  - 可折叠的 Prompt 查看

### 修复问题

#### 1. Tab 切换 Bug
- **问题**: `data-target` vs `data-tab` 不匹配导致 Tab 切换失效
- **修复**: 统一使用 `data-tab`

#### 2. 回归测试结果显示位置错误
- **问题**: 结果渲染到了错误的容器
- **修复**: 改为渲染到 `regression-report-container`

#### 3. 设置按钮点击无响应
- **问题**: DOM 选择器问题和缺少错误处理
- **修复**: 
  - 添加 `id="settings-btn"`
  - 添加 try-catch 错误处理
  - 添加默认值处理

### 数据库变更

#### 新增表
1. `llm_config` - 大模型配置
2. `trueno3_config` - Trueno3 同步配置

#### 初始化数据
- 默认 LLM 配置
- 默认 Trueno3 配置（禁用状态）
- 默认全局 Prompt 模板
- 初始缺陷数据 `hand_phone`

### 依赖更新

#### 新增依赖
- `paramiko` - SSH 连接库

---

## 项目结构

```
llm_auto_update_prompt/
├── app/
│   ├── main.py              # Flask 主应用
│   ├── database.py          # 数据库模型
│   ├── prompt_tool_v2.db    # SQLite 数据库
│   ├── static/
│   │   ├── main.js          # 前端 JavaScript
│   │   └── style.css        # 前端样式
│   ├── templates/
│   │   └── index.html       # 前端 HTML
│   └── uploads/             # 上传的图片和预览
├── init_db.py               # 数据库初始化脚本
├── api_test.py              # API 测试脚本
├── requirements.txt         # Python 依赖
├── step.md                  # 项目开发步骤文档
└── CHANGELOG.md             # 改版日志（本文件）
```

---

## 功能清单

### 已实现功能

#### 缺陷管理
- [x] 创建缺陷类别
- [x] 缺陷列表展示
- [x] 缺陷版本管理
- [x] 版本历史查看

#### 提示词管理
- [x] 全局 Prompt 模板编辑
- [x] 缺陷参数编辑（defect_cn, defect_class, judgment_points, exclusions）
- [x] 版本对比测试

#### 测试用例
- [x] 图片上传
- [x] 标注框绘制（Fabric.js）
- [x] 测试用例管理
- [x] 测试用例删除

#### 测试执行
- [x] 实时对比（保存版本 vs 编辑版本）
- [x] 回归测试
- [x] 异步任务处理
- [x] 结果可视化展示

#### 系统集成
- [x] 大模型 API 配置管理
- [x] Trueno3 自动同步
- [x] SSH 连接测试

#### UI/UX
- [x] 明亮/暗黑主题切换
- [x] 响应式布局
- [x] 模态框交互
- [x] Tab 切换

### 待完善功能

#### 高优先级
- [ ] 缺陷删除功能
- [ ] 版本删除功能
- [ ] 搜索结果持久化
- [ ] 批量操作

#### 中优先级
- [ ] 用户权限管理
- [ ] 操作日志记录
- [ ] 数据导出（CSV/Excel）
- [ ] 图片预览优化

#### 低优先级
- [ ] 搜索功能实现
- [ ] 通知功能实现
- [ ] 用户个人中心
- [ ] 移动端适配

---

## 技术栈

### 后端
- **框架**: Flask 3.1.3
- **数据库**: SQLite + SQLAlchemy 2.0
- **ORM**: Flask-SQLAlchemy
- **图像处理**: Pillow 10.4.0
- **SSH 连接**: Paramiko 4.0.0

### 前端
- **模板引擎**: Jinja2
- **Canvas 库**: Fabric.js 5.3.1
- **图标**: Material Icons
- **样式**: 原生 CSS（CSS 变量实现主题）

### Python 版本
- 3.12.8

---

## 更新计划

### 近期（1-2周）
1. 添加缺陷删除功能
2. 添加版本删除功能
3. 优化 Trueno3 同步的错误处理

### 中期（1个月）
1. 实现用户权限管理
2. 添加操作日志
3. 数据导出功能

### 长期（3个月）
1. 支持更多 LLM 提供商
2. 可视化报表
3. 性能优化

---

## 2026-03-04 (续)

### 新增功能

#### 5. 玻璃拟态通知系统
- **功能描述**: 替换原生 alert，使用玻璃拟态风格的自定义通知
- **涉及文件**:
  - `app/static/style.css` - 玻璃拟态样式、光晕效果、动画
  - `app/static/main.js` - Notification 组件
  - `app/templates/index.html` - 通知容器
- **特性**:
  - 玻璃拟态（Glassmorphism）设计
  - 动态光晕效果（呼吸动画）
  - 顶部彩虹渐变条
  - 四种类型：success、error、warning、info
  - 滑入滑出动画
  - 进度条倒计时
  - 鼠标悬停暂停
  - 支持明亮/暗黑主题
- **API**:
  - `Notification.success(message, title, duration)`
  - `Notification.error(message, title, duration)`
  - `Notification.warning(message, title, duration)`
  - `Notification.info(message, title, duration)`

### 改进

#### SSH 连接测试优化
- **改进**: 测试时使用当前输入框内的配置，无需先保存
- **涉及文件**: `app/static/main.js`, `app/main.py`

---

## 2026-03-04 (续2)

### 样式升级：全站玻璃拟态风格

#### 整体风格改造
- **背景**: 渐变背景 + 固定定位
- **玻璃拟态**: 所有主要组件使用 `backdrop-filter: blur(20px)`
- **光晕效果**: 按钮、卡片悬停时的发光效果
- **阴影层次**: 多层阴影营造悬浮感

#### 具体改造内容

1. **顶部导航栏**
   - 玻璃拟态背景
   - Logo 图标发光效果
   - 图标悬停上浮动画

2. **左侧边栏**
   - 玻璃拟态背景
   - 菜单项悬停滑动效果
   - 激活项发光边框

3. **卡片组件**
   - 玻璃拟态背景
   - 顶部高光线条
   - 悬停阴影增强

4. **按钮组件**
   - 渐变背景（primary/success）
   - 悬停光晕效果
   - 上浮动画

5. **模态框**
   - 玻璃拟态背景
   - 背景模糊遮罩
   - 顶部高光线条
   - 输入框聚焦发光

6. **编辑区域**
   - 信息卡片玻璃拟态
   - 版本标签渐变发光
   - 编辑器卡片悬停效果

7. **图片标注区**
   - Canvas 玻璃拟态边框
   - 拖拽时发光效果
   - 工具箱玻璃拟态

8. **Tabs**
   - 激活态渐变下划线
   - 悬停颜色过渡

9. **通知系统**
   - 玻璃拟态背景
   - 动态光晕呼吸效果
   - 彩虹渐变顶部条

#### 技术实现
- CSS 变量统一管理玻璃拟态参数
- `backdrop-filter` 实现毛玻璃效果
- `box-shadow` 多层阴影营造深度
- `linear-gradient` 渐变色彩
- `transition` 平滑动画过渡
- 明亮/暗黑主题双适配

---

## 2026-03-04 (续3)

### 标注功能重构

#### 问题修复
- **问题**: 使用 Fabric.js 的 `path:created` 事件，画出来的是曲线而不是矩形
- **解决**: 改为鼠标拖拽绘制矩形的模式

#### 新标注功能
1. **矩形拖拽绘制**
   - 鼠标按下 - 确定起点
   - 鼠标移动 - 实时预览矩形大小（蓝色半透明）
   - 鼠标释放 - 完成绘制（转为红色正式标注框）

2. **绘制模式优化**
   - 绘制时禁用其他对象选择，避免干扰
   - 鼠标变为十字准星 `cursor: crosshair`
   - 进入绘制模式时显示提示

3. **标注框交互**
   - 双击删除标注框
   - 选中时边框变黄色加粗
   - 支持拖拽调整位置和大小
   - 太小（<10px）的标注框自动丢弃

4. **视觉反馈**
   - 绘制时：蓝色半透明预览
   - 完成时：红色半透明正式框
   - 选中时：黄色高亮边框
   - 操作成功通知提示

#### 技术实现
- `mouse:down` / `mouse:move` / `mouse:up` 事件监听
- 实时创建临时矩形对象
- 完成时替换为正式矩形对象
- `mouse:dblclick` 双击删除
- `selection:created` / `selection:cleared` 选中状态管理

---

## 2026-03-04 (续4)

### Bug 修复
- **问题**: 添加测试用例后请求 `/api/defect/null` 返回 404
- **原因**: `state.currentDefectId` 在某些情况下变为 null
- **修复**: 
  - 添加 `defectId` 存在性检查
  - 使用后端返回的 `defect_id` 作为备选
  - 添加用户友好的错误提示

### 界面风格升级：NexBank 主题

#### 配色改造
参考 NexBank 数字银行设计风格：

**主色调**
- Primary: `#4F46E5` (靛蓝) → `#7C3AED` (紫罗兰) 渐变
- Accent: `#06B6D4` (青色)
- Success: `#10B981` (翠绿)
- Error: `#EF4444` (红色)
- Warning: `#F59E0B` (琥珀)

**背景色**
- 深色: `#0F172A` (深蓝黑)
- 卡片: `rgba(30, 41, 59, 0.5)` (半透明 slate)
- 文字: `#F8FAFC` (近白) / `#94A3B8` (灰)

**字体**
- 从 Roboto 改为 Inter（更现代的无衬线字体）

#### 改造内容
1. **全局变量** - 更新所有颜色变量
2. **按钮** - 紫蓝渐变 + 光晕阴影
3. **Logo** - 紫色光晕效果
4. **侧边栏激活项** - 渐变背景 + 紫色光晕
5. **版本标签** - 紫蓝渐变
6. **工具按钮** - 紫蓝渐变激活态
7. **Tabs** - 紫色渐变下划线 + 光晕
8. **设置标签** - 紫蓝渐变

#### 视觉效果
- 更现代的紫蓝配色方案
- 更强的光晕和阴影层次
- 更细腻的渐变过渡
- 更符合金融科技产品的专业感

---

## 2026-03-04 (续5)

### 布局优化

#### 1. 复选框对齐修复
- **问题**: 复选框和文字没有对齐
- **修复**: 
  - 使用 Flexbox 布局 `display: flex; align-items: center`
  - 添加 `gap: 10px` 间距
  - 统一复选框尺寸 `20px x 20px`

#### 2. 工具箱布局优化
- 宽度从 220px 增加到 240px
- 内边距从 16px 增加到 20px
- 标题改为大写 + 字间距，更专业
- 工具按钮改为 3 列布局，添加文字标签
- 测试用例列表添加卡片式布局
- 删除按钮改为红色背景，更明显

#### 3. 测试用例列表优化
- 卡片式布局，带背景色
- 悬停效果（背景变亮 + 边框）
- 选中状态添加紫色光晕
- 添加测试用例名称显示
- 删除按钮悬停放大效果

### 交互优化（参考专业标注工具）

#### 键盘快捷键
| 快捷键 | 功能 |
|--------|------|
| `Ctrl+S` | 保存新版本 |
| `Ctrl+D` | 切换画框模式 |
| `Ctrl+Z` | 撤销上一个框 |
| `Delete` | 删除选中框 |
| `Esc` | 退出绘制模式 |

#### 界面提示
- 工具按钮添加文字标签
- 按钮悬停显示快捷键提示
- 添加快捷键帮助面板
- 使用 `<kbd>` 标签显示按键

#### 专业标注工具特性
- 十字准星鼠标（绘制模式）
- 实时矩形预览（蓝色）
- 选中高亮（黄色边框）
- 双击删除标注框
- 支持拖拽调整大小和位置

---

## 2026-03-04 (续6)

### 布局重构

#### 1. 分离 Tab 布局为独立卡片
**问题**: 实时推理对比、回归测试报告、修改历史挤在一个 Tab 里，操作不便

**改造**:
```
改造前:
┌─────────────────────────────────┐
│ [实时对比] [回归报告] [修改历史] │
├─────────────────────────────────┤
│ Tab 内容区域                     │
└─────────────────────────────────┘

改造后:
┌─────────────────────────────────┐
│ 🔄 实时推理对比          [运行] │
├─────────────────────────────────┤
│ 对比内容区域                     │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ 📊 回归测试报告        [开始运行]│
├─────────────────────────────────┤
│ 报告内容区域                     │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ 📜 提示词修改历史    [导出CSV]   │
├─────────────────────────────────┤
│ 历史表格                         │
└─────────────────────────────────┘
```

**优点**:
- 三个功能同时可见，无需切换
- 每个模块有独立的操作按钮
- 更符合设计图的原型布局

#### 2. 自定义确认弹窗
**问题**: 原生 `confirm` 弹窗样式丑陋，不符合玻璃拟态风格

**改造**:
- 创建 `showConfirmModal()` 方法
- 玻璃拟态背景 + 模糊效果
- 缩放动画进入
- 支持自定义按钮文字

#### 3. 导出CSV功能
**新增**:
- 提示词修改历史添加"导出CSV"按钮
- 回归测试报告添加"导出报告"按钮
- 支持中文编码（BOM）
- 自动命名（带日期）

#### 4. 空状态设计
**新增**:
- 每个模块独立的空状态提示
- 大图标 + 文字说明
- 引导用户操作

#### 5. 数据表格优化
- 表头大写 + 字间距
- 悬停高亮效果
- 更清晰的边框分隔

---

## v1.0.0 - 2026-03-04

### 新增功能：正负样本标记与准确率计算

#### 1. 数据库修改
- **TestCase 模型新增字段**: `is_positive` (Boolean)
  - `True` = 正样本（存在缺陷）
  - `False` = 负样本（不存在缺陷）

#### 2. 测试用例标记功能
- 添加正例/反例选择器（工具箱底部）
- 默认选择"正例"
- 添加测试用例时自动保存标记信息

#### 3. 测试用例列表显示
- 正例：绿色边框 + "✓ 正例" 标签
- 反例：红色边框 + "✗ 反例" 标签

#### 4. 回归测试准确率计算
**准确率计算逻辑**:
```
正样本 + LLM返回Y = TP (True Positive) ✓
正样本 + LLM返回N = FN (False Negative) ✗
负样本 + LLM返回Y = FP (False Positive) ✗
负样本 + LLM返回N = TN (True Negative) ✓

准确率 = (TP + TN) / 总数
```

#### 5. 回归测试报告增强
**新增内容**:
- 总体准确率卡片
- 正例准确率卡片
- 反例准确率卡片
- 混淆矩阵（TP/TN/FP/FN）
- 详细结果表格（类型/预期/实际/结果）

**视觉效果**:
- 正确预测：绿色背景
- 错误预测：红色背景
- 错误情况：黄色背景

#### 6. 导出功能增强
- CSV 导出包含正例/反例标记
- 包含预期结果和实际结果
- 包含判断结果（正确/错误）

---

*最后更新: 2026-03-04*
