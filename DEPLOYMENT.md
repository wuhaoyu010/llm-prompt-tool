# Prompt Tool 部署指南

## 目录
- [系统要求](#系统要求)
- [部署方式](#部署方式)
  - [方式一: EXE 打包 (Windows 推荐)](#方式一-exe-打包-windows-推荐)
  - [方式二: Docker 部署](#方式二-docker-部署)
  - [方式三: 直接运行](#方式三-直接运行)
- [配置说明](#配置说明)
- [数据备份](#数据备份)
- [常见问题](#常见问题)

---

## 系统要求

### EXE 打包
- Windows 10/11 64位
- 无需安装任何依赖

### Docker 部署
- Docker 20.10+
- Docker Compose 2.0+
- 2GB+ 内存

### 直接运行
- Python 3.10+
- 2GB+ 内存

---

## 部署方式

### 方式一: EXE 打包 (Windows 推荐)

最适合分发给其他 Windows 用户，无需安装 Python。

#### 开发者打包步骤

```cmd
# 1. 在开发机上执行打包脚本
build_exe.bat
```

脚本会自动:
- 检查并安装 PyInstaller
- 打包成单个 EXE 文件
- 创建发布包

#### 输出目录
```
release/PromptTool/
├── PromptTool.exe    # 可执行文件 (~50MB)
└── 使用说明.txt      # 说明文档
```

#### 分发
将 `release/PromptTool/` 文件夹打包成 ZIP 发给用户。

#### 用户使用
1. 解压到任意目录
2. 双击 `PromptTool.exe`
3. 浏览器自动打开 http://localhost:5001
4. 按 Ctrl+C 停止服务

---

### 方式二: Docker 部署

适合服务器部署或 Linux/Mac 环境。

#### Windows
```cmd
# 构建镜像
build.bat

# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f
```

#### Linux/Mac
```bash
# 添加执行权限
chmod +x build.sh run.sh

# 构建并启动
./build.sh
docker-compose up -d
```

#### 访问应用
浏览器打开: http://localhost:5001

---

### 方式三: 直接运行

适合开发环境。

```bash
# 安装依赖
pip install -r requirements.txt

# 初始化数据库
python init_db.py

# 启动
python -c "from app.main import app; app.run(port=5001)"
```

---

## 配置说明

### 应用内配置
启动后访问「系统设置」页面配置:

1. **LLM API 配置**
   - API Key: 大模型服务密钥
   - API URL: 服务地址 (如 https://api.siliconflow.cn)
   - 默认模型: 使用的模型名称

2. **Trueno3 配置** (可选)
   - SSH 连接信息用于同步缺陷定义

---

## 数据备份

### EXE 版本
数据存储在程序同级目录:
```
PromptTool/
├── PromptTool.exe
├── app/
│   ├── prompt_tool_v2.db    # 数据库
│   └── uploads/             # 上传的图片
```

备份 `app/` 目录即可。

### Docker 版本
```bash
# 备份数据库
docker cp prompt-tool:/app/app/prompt_tool_v2.db ./backup/

# 备份上传文件
docker cp prompt-tool:/app/app/uploads ./backup/
```

---

## 常见问题

### Q: EXE 启动后闪退？
检查是否有杀毒软件拦截，或将程序添加到白名单。

### Q: 端口被占用？
修改 `run_standalone.py` 中的端口号:
```python
app.run(host='0.0.0.0', port=5002, ...)  # 改为其他端口
```

### Q: 如何更新？
重新下载最新版本替换 EXE 文件，数据会自动保留。

### Q: EXE 打包失败？
确保:
- 已安装 Python 3.10+
- 已安装所有依赖: `pip install -r requirements.txt`
- 已安装 PyInstaller: `pip install pyinstaller`

---

## 生产环境建议

1. **使用 HTTPS**: 配置反向代理 (Nginx/Caddy)
2. **定期备份**: 每天备份数据库文件
3. **监控日志**: 检查应用运行状态