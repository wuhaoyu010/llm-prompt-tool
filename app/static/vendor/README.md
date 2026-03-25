# 离线资源说明

本目录包含项目所需的离线资源，支持在无网络环境下使用。

## 目录结构

```
vendor/
├── fonts/
│   ├── inter.css              # Inter 字体（在线版本）
│   ├── inter-offline.css      # Inter 字体（离线版本）
│   ├── material-icons.css     # Material Icons（在线版本）
│   ├── material-icons-offline.css  # Material Icons（离线版本）
│   └── inter/                 # Inter 字体文件目录
│       ├── inter-300.ttf
│       ├── inter-400.ttf
│       ├── inter-500.ttf
│       ├── inter-600.ttf
│       └── inter-700.ttf
│   └── material-icons/        # Material Icons 字体文件目录
│       └── MaterialIcons-Regular.ttf
└── js/
    └── fabric.min.js          # Fabric.js 库
```

## 已下载的资源

### ✅ Fabric.js
- **文件**: `js/fabric.min.js`
- **版本**: 5.3.1
- **状态**: 已下载，可直接离线使用

### ⚠️ Inter 字体
- **文件**: `fonts/inter.css`（在线版本）
- **状态**: CSS 已下载，但引用了在线字体文件

**手动下载步骤**:
1. 访问 https://github.com/rsms/inter/releases
2. 下载最新版本的 `Inter-4.0.zip`
3. 解压后找到 `InterVariable.ttf`
4. 或者使用 Google Fonts 下载器获取各字重文件
5. 放入 `fonts/inter/` 目录
6. 在 `index.html` 中将 `inter.css` 改为 `inter-offline.css`

### ⚠️ Material Icons
- **文件**: `fonts/material-icons.css`（在线版本）
- **状态**: CSS 已下载，但引用了在线字体文件

**手动下载步骤**:
1. 访问 https://github.com/google/material-design-icons/tree/master/font
2. 下载 `MaterialIcons-Regular.ttf`
3. 放入 `fonts/material-icons/` 目录
4. 在 `index.html` 中将 `material-icons.css` 改为 `material-icons-offline.css`

## 字体文件下载链接

### Inter 字体（Google Fonts）
```bash
# 字重 300
https://gstatic.loli.net/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuOKfMZg.ttf

# 字重 400
https://gstatic.loli.net/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZg.ttf

# 字重 500
https://gstatic.loli.net/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuI6fMZg.ttf

# 字重 600
https://gstatic.loli.net/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuGKYMZg.ttf

# 字重 700
https://gstatic.loli.net/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYMZg.ttf
```

### Material Icons
```bash
https://github.com/google/material-design-icons/raw/master/font/MaterialIcons-Regular.ttf
```

## 备用方案

如果字体文件下载困难，可以使用系统字体作为后备：

```css
body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif;
}
```

系统会自动使用可用的系统字体。

## 切换在线/离线模式

### 在线模式（默认）
```html
<link rel="stylesheet" href="{{ url_for('static', filename='vendor/fonts/inter.css') }}">
<link rel="stylesheet" href="{{ url_for('static', filename='vendor/fonts/material-icons.css') }}">
```

### 离线模式
```html
<link rel="stylesheet" href="{{ url_for('static', filename='vendor/fonts/inter-offline.css') }}">
<link rel="stylesheet" href="{{ url_for('static', filename='vendor/fonts/material-icons-offline.css') }}">
```

## 注意事项

1. 字体文件较大（每个约 500KB-1MB），请确保磁盘空间充足
2. 离线字体需要手动下载并放入对应目录
3. 如果字体文件缺失，浏览器会自动使用系统后备字体
4. 建议在网络良好时下载字体文件，然后切换到离线模式使用
