# Gitee CI/CD 配置与使用指南

## 1. Gitee CI/CD 能力确认

### ✅ 支持的CI/CD功能

| 功能 | 支持情况 | 说明 |
|------|----------|------|
| **Docker构建** | ✅ 支持 | 使用Docker容器执行构建任务 |
| **Linux构建** | ✅ 支持 | 支持Ubuntu/CentOS等Linux环境 |
| **Windows构建** | ⚠️ 有限支持 | 企业版支持，免费版需使用GitHub Actions或自建Runner |
| **Artifacts存储** | ✅ 支持 | 构建产物可下载 |
| **Webhook触发** | ✅ 支持 | 代码推送自动触发构建 |
| **定时触发** | ✅ 支持 | 支持Cron定时任务 |

### ⚠️ 重要限制

**免费版限制：**
- 每月构建时长：1000分钟
- 并发构建数：2个
- Windows构建器：❌ 不支持（需企业版）

**解决方案：**
1. **Linux版本**：使用Gitee CI/CD直接构建
2. **Windows版本**：使用GitHub Actions（免费）或自建Windows Runner

---

## 2. 配置方案

### 方案一：Gitee CI/CD（Linux）+ GitHub Actions（Windows）

这是最实用的方案，同时利用两个平台的优势。

### 方案二：纯Gitee CI/CD（仅Linux）

如果只部署Linux服务器版本，可只用Gitee。

---

## 3. 文件配置

### 3.1 Gitee CI/CD 配置 (`.gitee-ci.yml`)

```yaml
stages:
  - build
  - package
  - release

# Linux版本构建
build_linux:
  stage: build
  image: python:3.10-slim
  script:
    - apt-get update && apt-get install -y --no-install-recommends gcc libjpeg-dev zlib1g-dev
    - pip install --no-cache-dir -r requirements.txt
    - pip install pyinstaller
    - pyinstaller --clean --noconfirm prompt_tool.spec
  artifacts:
    name: "PromptTool-Linux-$CI_COMMIT_SHORT_SHA"
    paths:
      - dist/PromptTool/
    expire_in: 30 days

# Docker镜像构建
docker_build:
  stage: package
  image: docker:latest
  services:
    - docker:dind
  script:
    - docker build -t prompt-tool:latest .
    - docker save prompt-tool:latest -o prompt-tool-docker.tar
  artifacts:
    name: "PromptTool-Docker-$CI_COMMIT_SHORT_SHA"
    paths:
      - prompt-tool-docker.tar
    expire_in: 30 days
  only:
    - tags
    - master

# 发布到Gitee Release
release:
  stage: release
  image: registry.cn-shenzhen.aliyuncs.com/gitee-go/gitee-release-cli:latest
  script:
    - |
      gitee-release create \
        --owner $GITEE_OWNER \
        --repo $GITEE_REPO \
        --tag $CI_COMMIT_TAG \
        --name "Release $CI_COMMIT_TAG" \
        --description "Automated release from Gitee CI" \
        --assets "dist/PromptTool/"
  only:
    - tags
```

### 3.2 GitHub Actions 配置 (`.github/workflows/build.yml`)

用于Windows版本打包（补充Gitee的不足）：

```yaml
name: Build Windows EXE

on:
  push:
    branches: [ master, main ]
    tags:
      - 'v*'
  pull_request:
    branches: [ master, main ]

jobs:
  build-windows:
    runs-on: windows-latest

    steps:
    - uses: actions/checkout@v3

    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.10'

    - name: Install dependencies
      run: |
        python -m pip install --upgrade pip
        pip install -r requirements.txt
        pip install pyinstaller

    - name: Build EXE
      run: pyinstaller --clean --noconfirm prompt_tool.spec

    - name: Upload Artifact
      uses: actions/upload-artifact@v3
      with:
        name: PromptTool-Windows
        path: dist/PromptTool/

    - name: Create Release
      if: startsWith(github.ref, 'refs/tags/')
      uses: softprops/action-gh-release@v1
      with:
        files: dist/PromptTool/**
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## 4. 使用步骤

### 步骤1：启用Gitee CI/CD

1. 进入Gitee仓库 → **设置** → **CI/CD**
2. 开启 **Gitee CI/CD** 服务
3. 确保仓库根目录有 `.gitee-ci.yml` 文件

### 步骤2：配置GitHub Actions（用于Windows）

1. 在GitHub创建同名仓库
2. 添加 `.github/workflows/build.yml` 文件
3. 配置GitHub Secrets（如需要）

### 步骤3：双平台同步

方案A：**Gitee为主，GitHub为镜像**
- 代码推送到Gitee
- 配置Gitee的Webhook自动同步到GitHub
- GitHub Actions自动触发Windows构建

方案B：**GitHub为主，Gitee为镜像**
- 代码推送到GitHub
- GitHub Actions构建Windows版本
- 同时触发Gitee镜像并构建Linux版本

---

## 5. 推荐的完整配置

### 同步配置

在Gitee仓库设置中配置 **Webhooks**，推送时自动同步到GitHub：

```bash
# 在本地配置双远程
git remote add gitee https://gitee.com/YOUR_USERNAME/prompt-tool.git
git remote add github https://github.com/YOUR_USERNAME/prompt-tool.git

# 同时推送
git push gitee master
git push github master
```

### 最终项目结构

```
prompt-tool/
├── .gitee-ci.yml           # Gitee CI/CD配置（Linux构建）
├── .github/
│   └── workflows/
│       └── build.yml       # GitHub Actions配置（Windows构建）
├── Dockerfile              # Docker构建
├── docker-compose.yml      # Docker Compose配置
├── prompt_tool.spec        # PyInstaller配置
├── requirements.txt        # Python依赖
└── ...
```

---

## 6. 注意事项

### Gitee CI/CD 限制
1. **构建时长**：免费版每月1000分钟
2. **存储限制**：构建产物有大小限制
3. **Windows不支持**：免费版没有Windows Runner

### 成本考虑
- **Gitee企业版**：约¥99/月起，支持Windows构建
- **GitHub Actions**：免费版2000分钟/月，支持Windows/Linux/macOS

### 推荐方案
对于个人开源项目，建议：
1. **主要开发**：GitHub（功能更全，CI/CD免费额度高）
2. **国内镜像**：Gitee（仅作代码托管，CI/CD可选）
3. **Windows打包**：GitHub Actions
4. **Linux打包**：GitHub Actions或Gitee CI/CD

---

## 7. 替代方案：使用GitHub Actions同时构建双版本

如果只用一个平台，GitHub Actions可以完美支持：

```yaml
name: Build All Platforms

on: [push, pull_request]

jobs:
  build-linux:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.10'
      - name: Install dependencies
        run: |
          pip install -r requirements.txt pyinstaller
      - name: Build
        run: pyinstaller --clean --noconfirm prompt_tool.spec
      - name: Upload
        uses: actions/upload-artifact@v3
        with:
          name: PromptTool-Linux
          path: dist/PromptTool/

  build-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.10'
      - name: Install dependencies
        run: |
          pip install -r requirements.txt pyinstaller
      - name: Build
        run: pyinstaller --clean --noconfirm prompt_tool.spec
      - name: Upload
        uses: actions/upload-artifact@v3
        with:
          name: PromptTool-Windows
          path: dist/PromptTool/
```

---

## 结论

| 需求 | 推荐方案 |
|------|----------|
| 仅用Gitee | ❌ 无法实现Windows打包（免费版） |
| Gitee + GitHub | ✅ 可行，但需维护两个平台 |
| 仅用GitHub | ✅ 最推荐，支持所有平台构建 |

**建议**：如果必须在国内平台，考虑使用**阿里云云效**或**腾讯云CODING**，它们支持Windows构建。
