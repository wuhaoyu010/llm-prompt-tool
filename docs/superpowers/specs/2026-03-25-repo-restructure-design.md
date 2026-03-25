# 仓库规范化重构设计文档

## 概述

本文档描述了对 `llm_auto_update_prompt` 仓库的规范化重构方案，目标是参照专业项目规范整理目录结构、清理冗余文件、补充标准配置。

## 目标

1. 符合 Python + Node.js 混合项目的最佳实践
2. 清理不应纳入版本控制的临时文件和测试产物
3. 整合分散的脚本文件
4. 补充标准项目文件

## 变更清单

### 1. 目录结构重组

**原结构 → 新结构：**

```
llm_auto_update_prompt/
├── app/                    → src/backend/
│   ├── routes/             → src/backend/routes/
│   ├── services/           → src/backend/services/
│   ├── static/             → src/backend/static/
│   ├── templates/          → src/backend/templates/
│   ├── utils/              → src/backend/utils/
│   ├── database.py         → src/backend/database.py
│   └── main.py             → src/backend/main.py
├── frontend/               → src/frontend/
├── scripts/                ← 新增
│   ├── build/              ← 构建脚本
│   ├── run/                ← 运行脚本
│   └── migrations/         ← 数据库迁移脚本
├── tests/                  ← 保持不变
├── docs/                   ← 保持不变
└── ...其他根目录文件
```

### 2. 需要删除的文件

以下文件/目录已纳入 git 追踪，应从版本控制中移除：

| 文件/目录 | 原因 |
|----------|------|
| `node_modules/` | 依赖目录，应在本地安装 |
| `artifacts/` | 测试产物 |
| `test-results/` | 测试产物 |
| `playwright-report/` | 测试产物 |
| `playwright-results.json` | 测试产物 |
| `test_response.html` | 临时测试文件 |
| `test_response.txt` | 临时测试文件 |
| `test_upload.png` | 临时测试文件 |
| `.pytest_cache/` | pytest 缓存目录 |

**操作命令：**
```bash
git rm -r --cached node_modules/
git rm -r --cached artifacts/
git rm -r --cached test-results/
git rm -r --cached playwright-report/
git rm --cached playwright-results.json
git rm --cached test_response.html test_response.txt test_upload.png
git rm -r --cached .pytest_cache/
```

### 3. .gitignore 更新

**修复合并冲突：**

当前 `.gitignore` 包含冲突标记：
```
<<<<<<< HEAD

artifacts/
test-results/
=======
>>>>>>> 975b1e21b4d97f7d3cd9d5cbcb5947b9aaa5ca66
```

**修复后的完整内容：**

```gitignore
# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
venv/
.venv/
ENV/
.pytest_cache/

# IDE
.idea/
.vscode/
*.swp
*.swo

# Claude Code
.claude/

# Project specific
.trae/
.playwright-cli/
output/

# Database (keep structure, ignore data)
*.db
*.db-journal

# Uploads
app/uploads/*
!app/uploads/.gitkeep

# Distribution / Packaging
/dist
/build
/build_env
/release
*.egg-info/
*.egg
llm_auto_update_prompt/
llm_auto_update_prompt.zip
*.zip

# Docker
data/

# Logs
*.log

# OS
.DS_Store

# Node.js
node_modules/

# Test artifacts
artifacts/
test-results/
playwright-report/
playwright-results.json

# Root temp files
test_response.*
test_upload.png

# Frontend build output (after restructure)
src/frontend/dist/
```

### 4. 脚本整合

**构建脚本 → `scripts/build/`：**

| 原位置 | 新位置 |
|-------|--------|
| `build.sh` | `scripts/build/build-docker.sh` |
| `build.bat` | `scripts/build/build-docker.bat` |
| `build_exe.bat` | `scripts/build/build-exe.bat` |
| `create_dist.sh` | `scripts/build/create-dist.sh` |
| `create_dist.bat` | `scripts/build/create-dist.bat` |

**运行脚本 → `scripts/run/`：**

| 原位置 | 新位置 |
|-------|--------|
| `run.sh` | `scripts/run/run.sh` |
| `run.bat` | `scripts/run/run.bat` |
| `start.bat` | `scripts/run/start.bat` |

**数据库迁移 → `scripts/migrations/`：**

| 原位置 | 新位置 |
|-------|--------|
| `init_db.py` | `scripts/migrations/init_db.py` |
| `migrate_db.py` | `scripts/migrations/migrate_db.py` |
| `migrate_auto_annotate.py` | `scripts/migrations/migrate_auto_annotate.py` |

**保留在根目录的文件：**
- `run_standalone.py` — 独立运行入口，被 Dockerfile 和打包引用
- `prompt_tool.spec` — PyInstaller 配置
- `check_annotations.py` — 工具脚本（可后续移入 `scripts/tools/`）
- `check_testcases.py` — 工具脚本（可后续移入 `scripts/tools/`）

### 5. 补充标准文件

**LICENSE (MIT)：**
```
MIT License

Copyright (c) 2026 [作者名称]

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

**CONTRIBUTING.md：**
```markdown
# 贡献指南

## 开发环境设置

### 后端

```bash
python -m venv venv
source venv/bin/activate  # Linux/Mac
# 或 venv\Scripts\activate  # Windows
pip install -r requirements.txt
```

### 前端

```bash
cd src/frontend
npm install
```

## 运行测试

```bash
pytest tests/
```

## 提交规范

请遵循 Conventional Commits 格式：
- `feat:` 新功能
- `fix:` 修复 bug
- `docs:` 文档更新
- `refactor:` 代码重构
- `test:` 测试相关
- `chore:` 构建/工具相关
```

**pyproject.toml：**
```toml
[project]
name = "llm-auto-update-prompt"
version = "1.0.0"
description = "LLM Prompt Auto Update Tool"
readme = "README.md"
requires-python = ">=3.10"
license = {text = "MIT"}
authors = [
    {name = "Your Name", email = "your@email.com"}
]

dependencies = [
    # 从 requirements.txt 迁移
]

[project.optional-dependencies]
dev = [
    "pytest>=7.0.0",
    "pyinstaller>=5.0.0",
]

[build-system]
requires = ["setuptools>=61.0"]
build-backend = "setuptools.build_meta"
```

### 6. 需要更新的配置文件

**Dockerfile：**
```diff
- COPY app/ ./app/
- COPY init_db.py .
- COPY migrate_db.py .
+ COPY src/backend/ ./app/
+ COPY scripts/migrations/init_db.py .
+ COPY scripts/migrations/migrate_db.py .
```

**docker-compose.yml：**
```diff
- - ./data/app:/app/app
- - ./data/uploads:/app/app/uploads
+ - ./data/app:/app/data
+ - ./data/uploads:/app/uploads
```

**prompt_tool.spec：**
```diff
- ['run_standalone.py'],
+ ['run_standalone.py'],
- datas=[
-     (os.path.join(project_root, 'app', '*.py'), 'app'),
-     (os.path.join(project_root, 'app', 'templates'), 'app/templates'),
-     (os.path.join(project_root, 'app', 'static'), 'app/static'),
- ],
+ datas=[
+     (os.path.join(project_root, 'src', 'backend', '*.py'), 'app'),
+     (os.path.join(project_root, 'src', 'backend', 'templates'), 'app/templates'),
+     (os.path.join(project_root, 'src', 'backend', 'static'), 'app/static'),
+ ],
```

**所有 Python 文件中的导入语句：**
```diff
- from app.xxx import yyy
+ from src.backend.xxx import yyy
```

**tests/conftest.py：**
```diff
- from app.database import db
+ from src.backend.database import db
```

**frontend/vite.config.ts：**
```diff
- outDir: '../app/static/vue-dist',
+ outDir: '../src/backend/static/vue-dist',
```

## 实施步骤

### 阶段 1：清理（低风险）

1. 修复 `.gitignore` 合并冲突
2. 更新 `.gitignore` 添加新规则
3. 执行 `git rm --cached` 移除不需要追踪的文件
4. 提交清理变更

### 阶段 2：脚本整合（中等风险）

1. 创建 `scripts/` 目录结构
2. 移动脚本文件到新位置
3. 更新 `Dockerfile` 中的路径引用
4. 测试 Docker 构建流程
5. 提交脚本整合变更

### 阶段 3：目录重组（高风险）

1. 创建 `src/` 目录结构
2. 移动 `app/` 到 `src/backend/`
3. 移动 `frontend/` 到 `src/frontend/`
4. 批量更新所有 Python 导入路径
5. 更新 `prompt_tool.spec`、`Dockerfile`、`vite.config.ts`
6. 更新所有测试文件
7. 运行完整测试套件验证
8. 提交目录重组变更

### 阶段 4：补充标准文件（低风险）

1. 添加 `LICENSE`
2. 添加 `CONTRIBUTING.md`
3. 添加 `pyproject.toml`
4. 提交标准文件

## 回滚策略

每个阶段独立提交，便于回滚：

```bash
# 回滚到特定阶段
git revert <commit-hash>
```

## 验证清单

- [ ] `.gitignore` 无冲突标记
- [ ] `git status` 显示工作区干净
- [ ] Docker 构建成功
- [ ] Python 测试通过
- [ ] 前端构建成功
- [ ] 应用可正常启动