# GitHub CI/CD 自动打包指南

## ✅ 已实现功能

本项目已配置 GitHub Actions，支持以下自动构建：

| 平台 | 输出格式 | 说明 |
|------|----------|------|
| Windows | `PromptTool-Windows.zip` | 包含 .exe 的文件夹 |
| Linux | `PromptTool-Linux.tar.gz` | 可执行文件包 |
| Docker | `prompt-tool-docker.tar.gz` | Docker 镜像 |

## 🚀 使用方法

### 方式一：推送 Tag 自动发布（推荐）

```bash
# 1. 提交代码到 main 分支
git add .
git commit -m "your commit message"
git push origin main

# 2. 创建版本标签并推送
git tag v1.0.0
git push origin v1.0.0
```

推送 tag 后，GitHub Actions 会自动：
1. 并行构建 Windows/Linux/Docker 三个版本
2. 创建 GitHub Release
3. 上传所有打包文件到 Release 页面

### 方式二：手动触发构建

进入仓库页面 → Actions → Build Cross-Platform Executables → Run workflow

### 方式三：每次推送自动构建

推送代码到 `main` 或 `master` 分支时，会自动触发构建并上传 artifacts（可在 Actions 页面下载）

## 📥 下载构建产物

### 从 Release 下载（正式版本）

访问：`https://github.com/你的用户名/仓库名/releases`

### 从 Actions 下载（临时构建）

访问：`https://github.com/你的用户名/仓库名/actions`

点击对应工作流运行 → Artifacts 部分下载

## 📋 配置说明

### 首次使用前的准备

1. **将代码推送到 GitHub**
   ```bash
   # 如果还没有关联远程仓库
   git remote add origin https://github.com/你的用户名/仓库名.git
   git push -u origin main
   ```

2. **检查 Actions 权限**
   - 仓库页面 → Settings → Actions → General
   - 确保 "Workflow permissions" 设置为 "Read and write permissions"

### 工作流触发条件

| 事件 | 行为 |
|------|------|
| `git push origin main` | 构建并上传 artifacts |
| `git push origin v1.0.0` | 构建 + 创建 Release |
| 手动触发 | 构建并上传 artifacts |

## 🔧 自定义配置

### 修改 Python 版本

编辑 `.github/workflows/build.yml`：
```yaml
- uses: actions/setup-python@v5
  with:
    python-version: '3.11'  # 修改此处
```

### 添加 macOS 构建

在工作流 `jobs` 中添加：
```yaml
build-macos:
  runs-on: macos-latest
  steps:
    # 复制 linux 配置并调整
```

### 修改 Artifact 保留时间

```yaml
- uses: actions/upload-artifact@v4
  with:
    retention-days: 90  # 默认 30 天，最大 90 天
```

## ❓ 常见问题

### Q: 构建失败在哪里查看日志？

A: 仓库页面 → Actions → 点击失败的运行 → 查看具体步骤日志

### Q: Artifact 下载后如何使用？

**Windows:**
```powershell
# 解压后进入文件夹运行
Expand-Archive PromptTool-Windows.zip -DestinationPath .\PromptTool
.\PromptTool\PromptTool\PromptTool.exe
```

**Linux:**
```bash
# 解压并运行
tar -xzf PromptTool-Linux.tar.gz
./PromptTool/PromptTool
```

**Docker:**
```bash
# 加载镜像
docker load < prompt-tool-docker.tar.gz
# 运行
docker run -p 5001:5001 prompt-tool:<tag>
```

### Q: 如何添加自动测试？

在工作流中添加测试 job：
```yaml
test:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-python@v5
      with:
        python-version: '3.10'
    - run: pip install -r requirements.txt pytest
    - run: pytest
```

## 📚 相关文档

- [GitHub Actions 文档](https://docs.github.com/cn/actions)
- [PyInstaller 文档](https://pyinstaller.org/)
- [项目打包说明](./DEPLOYMENT.md)
