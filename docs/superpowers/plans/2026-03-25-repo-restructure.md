# 仓库规范化重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 llm_auto_update_prompt 仓库规范化，清理冗余文件，重组目录结构，补充标准配置文件。

**Architecture:** 分四个阶段执行：清理 → 脚本整合 → 目录重组 → 补充标准文件。每阶段独立提交，便于回滚。

**Tech Stack:** Python 3.10, Flask, Node.js, Vue 3, Docker, PyInstaller

---

## 文件结构变更总览

**创建：**
- `scripts/build/` - 构建脚本目录
- `scripts/run/` - 运行脚本目录
- `scripts/migrations/` - 数据库迁移目录
- `src/backend/` - 后端代码（原 app/）
- `src/frontend/` - 前端代码（原 frontend/）
- `LICENSE` - MIT 许可证
- `CONTRIBUTING.md` - 贡献指南
- `pyproject.toml` - Python 项目元数据

**修改：**
- `.gitignore` - 修复合并冲突，添加新规则
- `Dockerfile` - 更新路径引用
- `docker-compose.yml` - 更新挂载路径
- `prompt_tool.spec` - 更新打包路径
- `frontend/vite.config.ts` - 更新输出路径
- 所有 Python 文件 - 更新导入路径
- 所有测试文件 - 更新导入路径

**删除（从 git 追踪中移除）：**
- `node_modules/`
- `artifacts/`
- `test-results/`
- `playwright-report/`
- `playwright-results.json`
- `test_response.html`
- `test_response.txt`
- `test_upload.png`
- `.pytest_cache/`

---

## 阶段 1：清理（低风险）

### Task 1.1: 修复 .gitignore 合并冲突

**Files:**
- Modify: `.gitignore:57-62`

- [ ] **Step 1: 读取当前 .gitignore 内容**

运行：`cat .gitignore`

- [ ] **Step 2: 重写 .gitignore 文件**

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

- [ ] **Step 3: 验证文件无冲突标记**

运行：`grep -E "<<<<<<|======|>>>>>>" .gitignore`
预期：无输出（表示无冲突标记）

---

### Task 1.2: 从 git 追踪中移除不需要的文件

**Files:**
- Remove from tracking: 多个临时文件和目录

- [ ] **Step 1: 移除 node_modules 目录**

运行：
```bash
git rm -r --cached node_modules/ 2>/dev/null || echo "node_modules not tracked"
```
预期：输出确认移除或"not tracked"

- [ ] **Step 2: 移除测试产物目录**

运行：
```bash
git rm -r --cached artifacts/ 2>/dev/null || echo "artifacts not tracked"
git rm -r --cached test-results/ 2>/dev/null || echo "test-results not tracked"
git rm -r --cached playwright-report/ 2>/dev/null || echo "playwright-report not tracked"
```

- [ ] **Step 3: 移除测试产物文件**

运行：
```bash
git rm --cached playwright-results.json 2>/dev/null || echo "playwright-results.json not tracked"
```

- [ ] **Step 4: 移除临时测试文件**

运行：
```bash
git rm --cached test_response.html test_response.txt test_upload.png 2>/dev/null || echo "temp files not tracked"
```

- [ ] **Step 5: 移除 pytest 缓存**

运行：
```bash
git rm -r --cached .pytest_cache/ 2>/dev/null || echo "pytest_cache not tracked"
```

---

### Task 1.3: 提交清理变更

- [ ] **Step 1: 查看暂存状态**

运行：`git status`

- [ ] **Step 2: 提交清理变更**

运行：
```bash
git add .gitignore
git commit -m "chore: fix .gitignore merge conflict and remove tracked temp files"
```

- [ ] **Step 3: 验证提交**

运行：`git log -1 --oneline`

---

## 阶段 2：脚本整合（中等风险）

### Task 2.1: 创建 scripts 目录结构

**Files:**
- Create: `scripts/build/.gitkeep`
- Create: `scripts/run/.gitkeep`
- Create: `scripts/migrations/.gitkeep`

- [ ] **Step 1: 创建目录结构**

运行：
```bash
mkdir -p scripts/build scripts/run scripts/migrations
```

- [ ] **Step 2: 创建 .gitkeep 文件**

运行：
```bash
touch scripts/build/.gitkeep scripts/run/.gitkeep scripts/migrations/.gitkeep
```

---

### Task 2.2: 移动构建脚本

**Files:**
- Move: `build.sh` → `scripts/build/build-docker.sh`
- Move: `build.bat` → `scripts/build/build-docker.bat`
- Move: `build_exe.bat` → `scripts/build/build-exe.bat`
- Move: `create_dist.sh` → `scripts/build/create-dist.sh`
- Move: `create_dist.bat` → `scripts/build/create-dist.bat`

- [ ] **Step 1: 移动 build.sh**

运行：
```bash
git mv build.sh scripts/build/build-docker.sh
```

- [ ] **Step 2: 移动 build.bat**

运行：
```bash
git mv build.bat scripts/build/build-docker.bat
```

- [ ] **Step 3: 移动 build_exe.bat**

运行：
```bash
git mv build_exe.bat scripts/build/build-exe.bat
```

- [ ] **Step 4: 移动 create_dist.sh**

运行：
```bash
git mv create_dist.sh scripts/build/create-dist.sh
```

- [ ] **Step 5: 移动 create_dist.bat**

运行：
```bash
git mv create_dist.bat scripts/build/create-dist.bat
```

---

### Task 2.3: 移动运行脚本

**Files:**
- Move: `run.sh` → `scripts/run/run.sh`
- Move: `run.bat` → `scripts/run/run.bat`
- Move: `start.bat` → `scripts/run/start.bat`

- [ ] **Step 1: 移动 run.sh**

运行：
```bash
git mv run.sh scripts/run/run.sh
```

- [ ] **Step 2: 移动 run.bat**

运行：
```bash
git mv run.bat scripts/run/run.bat
```

- [ ] **Step 3: 移动 start.bat**

运行：
```bash
git mv start.bat scripts/run/start.bat
```

---

### Task 2.4: 移动数据库迁移脚本

**Files:**
- Move: `init_db.py` → `scripts/migrations/init_db.py`
- Move: `migrate_db.py` → `scripts/migrations/migrate_db.py`
- Move: `migrate_auto_annotate.py` → `scripts/migrations/migrate_auto_annotate.py`

- [ ] **Step 1: 移动 init_db.py**

运行：
```bash
git mv init_db.py scripts/migrations/init_db.py
```

- [ ] **Step 2: 移动 migrate_db.py**

运行：
```bash
git mv migrate_db.py scripts/migrations/migrate_db.py
```

- [ ] **Step 3: 移动 migrate_auto_annotate.py**

运行：
```bash
git mv migrate_auto_annotate.py scripts/migrations/migrate_auto_annotate.py
```

---

### Task 2.5: 更新 Dockerfile 路径引用

**Files:**
- Modify: `Dockerfile:26-29`

- [ ] **Step 1: 更新 COPY 指令**

将：
```dockerfile
# Copy application code
COPY app/ ./app/
COPY init_db.py .
COPY migrate_db.py .
COPY run_standalone.py .
```

改为：
```dockerfile
# Copy application code
COPY app/ ./app/
COPY scripts/migrations/init_db.py .
COPY scripts/migrations/migrate_db.py .
COPY run_standalone.py .
```

- [ ] **Step 2: 验证 Dockerfile 语法**

运行：`docker build --dry-run . 2>&1 | head -5 || echo "Docker syntax OK"`

---

### Task 2.6: 提交脚本整合变更

- [ ] **Step 1: 查看暂存状态**

运行：`git status`

- [ ] **Step 2: 提交变更**

运行：
```bash
git add scripts/ Dockerfile
git commit -m "refactor: consolidate scripts into scripts/ directory"
```

- [ ] **Step 3: 验证提交**

运行：`git log -1 --oneline`

---

## 阶段 3：目录重组（高风险）

### Task 3.1: 创建 src 目录结构

**Files:**
- Create: `src/backend/.gitkeep`
- Create: `src/frontend/.gitkeep`

- [ ] **Step 1: 创建目录结构**

运行：
```bash
mkdir -p src/backend src/frontend
```

---

### Task 3.2: 移动后端代码

**Files:**
- Move: `app/*` → `src/backend/*`

- [ ] **Step 1: 移动 app 目录**

运行：
```bash
git mv app/* src/backend/
rmdir app
```

- [ ] **Step 2: 验证目录结构**

运行：`ls -la src/backend/`

---

### Task 3.3: 移动前端代码

**Files:**
- Move: `frontend/*` → `src/frontend/*`

- [ ] **Step 1: 移动 frontend 目录**

运行：
```bash
git mv frontend/* src/frontend/
rmdir frontend
```

- [ ] **Step 2: 验证目录结构**

运行：`ls -la src/frontend/`

---

### Task 3.4: 更新 run_standalone.py 导入路径

**Files:**
- Modify: `run_standalone.py:20`

- [ ] **Step 1: 更新导入语句**

将：
```python
from app.main import app
```

改为：
```python
from src.backend.main import app
```

---

### Task 3.5: 更新 prompt_tool.spec 打包配置

**Files:**
- Modify: `prompt_tool.spec:17-20`
- Modify: `prompt_tool.spec:22-24`

- [ ] **Step 1: 更新 datas 路径**

将：
```python
datas=[
    # 包含 app 模块的所有文件
    (os.path.join(project_root, 'app', '*.py'), 'app'),
    (os.path.join(project_root, 'app', 'templates'), 'app/templates'),
    (os.path.join(project_root, 'app', 'static'), 'app/static'),
],
```

改为：
```python
datas=[
    # 包含 backend 模块的所有文件
    (os.path.join(project_root, 'src', 'backend', '*.py'), 'app'),
    (os.path.join(project_root, 'src', 'backend', 'templates'), 'app/templates'),
    (os.path.join(project_root, 'src', 'backend', 'static'), 'app/static'),
],
```

- [ ] **Step 2: 更新 hiddenimports**

将：
```python
hiddenimports=[
    'app',
    'app.main',
    'app.database',
    ...
],
```

改为：
```python
hiddenimports=[
    'src.backend',
    'src.backend.main',
    'src.backend.database',
    ...
],
```

---

### Task 3.6: 更新 Dockerfile

**Files:**
- Modify: `Dockerfile:7`
- Modify: `Dockerfile:26`

- [ ] **Step 1: 更新 FLASK_APP 环境变量**

将：
```dockerfile
ENV FLASK_APP=app.main:app
```

改为：
```dockerfile
ENV FLASK_APP=src.backend.main:app
```

- [ ] **Step 2: 更新 COPY 指令**

将：
```dockerfile
COPY app/ ./app/
```

改为：
```dockerfile
COPY src/backend/ ./app/
```

---

### Task 3.7: 更新 docker-compose.yml

**Files:**
- Modify: `docker-compose.yml:10-13`

- [ ] **Step 1: 更新挂载路径**

将：
```yaml
volumes:
  # Persist database
  - ./data/app:/app/app
  # Persist uploads
  - ./data/uploads:/app/app/uploads
```

改为：
```yaml
volumes:
  # Persist database
  - ./data/app:/app/data
  # Persist uploads
  - ./data/uploads:/app/uploads
```

---

### Task 3.8: 更新 vite.config.ts

**Files:**
- Modify: `frontend/vite.config.ts:31` (now `src/frontend/vite.config.ts`)

- [ ] **Step 1: 更新输出路径**

将：
```typescript
outDir: '../app/static/vue-dist',
```

改为：
```typescript
outDir: '../backend/static/vue-dist',
```

---

### Task 3.9: 批量更新 Python 导入路径

**Files:**
- Modify: 所有 `from app.xxx import yyy` → `from src.backend.xxx import yyy`

- [ ] **Step 1: 查找所有需要更新的文件**

运行：
```bash
grep -r "from app\." src/backend/ tests/ scripts/migrations/ --include="*.py" | head -20
```

- [ ] **Step 2: 批量替换 src/backend/ 目录中的导入**

运行：
```bash
find src/backend -name "*.py" -exec sed -i 's/from app\./from src.backend./g' {} +
```

- [ ] **Step 3: 批量替换 tests/ 目录中的导入**

运行：
```bash
find tests -name "*.py" -exec sed -i 's/from app\./from src.backend./g' {} +
```

- [ ] **Step 4: 批量替换 scripts/migrations/ 目录中的导入**

运行：
```bash
find scripts/migrations -name "*.py" -exec sed -i 's/from app\./from src.backend./g' {} +
```

- [ ] **Step 5: 更新 run_standalone.py**

运行：
```bash
sed -i 's/from app\./from src.backend./g' run_standalone.py
```

- [ ] **Step 6: 更新根目录的 check_*.py 文件**

运行：
```bash
sed -i 's/from app\./from src.backend./g' check_annotations.py check_testcases.py
```

- [ ] **Step 7: 验证替换结果**

运行：
```bash
grep -r "from app\." src/backend/ tests/ scripts/ --include="*.py" || echo "All imports updated"
```
预期：输出 "All imports updated"

---

### Task 3.10: 更新 .gitignore 中的路径引用

**Files:**
- Modify: `.gitignore:113-115`

- [ ] **Step 1: 更新 uploads 路径**

将：
```gitignore
# Uploads
app/uploads/*
!app/uploads/.gitkeep
```

改为：
```gitignore
# Uploads
src/backend/uploads/*
!src/backend/uploads/.gitkeep
```

---

### Task 3.11: 运行测试验证

- [ ] **Step 1: 运行 Python 测试**

运行：
```bash
cd /d/Projects/llm_auto_update_prompt && python -m pytest tests/ -v --tb=short 2>&1 | head -50
```

- [ ] **Step 2: 检查导入是否正确**

运行：
```bash
python -c "from src.backend.main import app; print('Import OK')"
```
预期：输出 "Import OK"

---

### Task 3.12: 提交目录重组变更

- [ ] **Step 1: 查看暂存状态**

运行：`git status`

- [ ] **Step 2: 添加所有变更**

运行：
```bash
git add -A
```

- [ ] **Step 3: 提交变更**

运行：
```bash
git commit -m "refactor: reorganize directory structure (app -> src/backend, frontend -> src/frontend)"
```

- [ ] **Step 4: 验证提交**

运行：`git log -1 --oneline`

---

## 阶段 4：补充标准文件（低风险）

### Task 4.1: 添加 LICENSE 文件

**Files:**
- Create: `LICENSE`

- [ ] **Step 1: 创建 LICENSE 文件**

```
MIT License

Copyright (c) 2026 llm-auto-update-prompt contributors

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

---

### Task 4.2: 添加 CONTRIBUTING.md 文件

**Files:**
- Create: `CONTRIBUTING.md`

- [ ] **Step 1: 创建 CONTRIBUTING.md 文件**

```markdown
# 贡献指南

感谢您考虑为本项目做出贡献！

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

## 代码风格

- Python: 遵循 PEP 8 规范
- TypeScript/Vue: 遵循项目现有风格

## 提交规范

请遵循 Conventional Commits 格式：

- `feat:` 新功能
- `fix:` 修复 bug
- `docs:` 文档更新
- `refactor:` 代码重构
- `test:` 测试相关
- `chore:` 构建/工具相关

## Pull Request 流程

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交变更 (`git commit -m 'feat: add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request
```

---

### Task 4.3: 添加 pyproject.toml 文件

**Files:**
- Create: `pyproject.toml`

- [ ] **Step 1: 创建 pyproject.toml 文件**

```toml
[project]
name = "llm-auto-update-prompt"
version = "1.0.0"
description = "LLM Prompt Auto Update Tool"
readme = "README.md"
requires-python = ">=3.10"
license = {text = "MIT"}
keywords = ["llm", "prompt", "annotation", "defect-detection"]
classifiers = [
    "Development Status :: 4 - Beta",
    "Intended Audience :: Developers",
    "License :: OSI Approved :: MIT License",
    "Programming Language :: Python :: 3",
    "Programming Language :: Python :: 3.10",
    "Programming Language :: Python :: 3.11",
    "Programming Language :: Python :: 3.12",
]

[project.optional-dependencies]
dev = [
    "pytest>=7.0.0",
    "pyinstaller>=5.0.0",
]

[build-system]
requires = ["setuptools>=61.0"]
build-backend = "setuptools.build_meta"

[tool.setuptools.packages.find]
where = ["src"]

[tool.pytest.ini_options]
testpaths = ["tests"]
python_files = ["test_*.py"]
python_functions = ["test_*"]
```

---

### Task 4.4: 提交标准文件

- [ ] **Step 1: 查看暂存状态**

运行：`git status`

- [ ] **Step 2: 添加所有标准文件**

运行：
```bash
git add LICENSE CONTRIBUTING.md pyproject.toml
```

- [ ] **Step 3: 提交变更**

运行：
```bash
git commit -m "chore: add standard project files (LICENSE, CONTRIBUTING, pyproject.toml)"
```

- [ ] **Step 4: 验证提交**

运行：`git log -1 --oneline`

---

## 最终验证

### Task 5.1: 完整验证清单

- [ ] **Step 1: 验证 .gitignore 无冲突标记**

运行：`grep -E "<<<<<<|======|>>>>>>" .gitignore || echo "OK"`

- [ ] **Step 2: 验证 git status 干净**

运行：`git status`
预期：`nothing to commit, working tree clean`

- [ ] **Step 3: 验证 Python 导入**

运行：`python -c "from src.backend.main import app; print('OK')"`

- [ ] **Step 4: 验证测试通过**

运行：`python -m pytest tests/ -v --tb=short`

- [ ] **Step 5: 验证目录结构**

运行：`tree -L 2 -d src/ scripts/`

预期输出：
```
src/
├── backend/
└── frontend/
scripts/
├── build/
├── migrations/
└── run/
```

---

## 回滚策略

每个阶段独立提交，可单独回滚：

```bash
# 查看提交历史
git log --oneline -10

# 回滚到特定阶段（保留工作目录）
git revert <commit-hash>

# 硬回滚（丢弃所有后续变更，慎用）
git reset --hard <commit-hash>
```

---

## 预计提交记录

```
49213b3 docs: add repository restructure design specification
xxxxxxx chore: fix .gitignore merge conflict and remove tracked temp files
xxxxxxx refactor: consolidate scripts into scripts/ directory
xxxxxxx refactor: reorganize directory structure (app -> src/backend, frontend -> src/frontend)
xxxxxxx chore: add standard project files (LICENSE, CONTRIBUTING, pyproject.toml)
```