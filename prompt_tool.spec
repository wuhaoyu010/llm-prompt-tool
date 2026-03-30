# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller 打包配置"""

import sys
import os

block_cipher = None

project_root = os.path.dirname(os.path.abspath(SPEC))

a = Analysis(
    [os.path.join(project_root, 'scripts', 'run_standalone.py')],
    pathex=[project_root],
    binaries=[],
    datas=[
        # 包含 backend 模块
        (os.path.join(project_root, 'src', 'backend'), 'src/backend'),
        # 包含前端构建文件
        (os.path.join(project_root, 'src', 'backend', 'static', 'vue-dist'), 'src/backend/static/vue-dist'),
    ],
    hiddenimports=[
        'src.backend',
        'src.backend.main',
        'src.backend.database',
        'src.backend.routes',
        'src.backend.routes.defect_routes',
        'src.backend.routes.config_routes',
        'src.backend.routes.task_routes',
        'src.backend.services',
        'src.backend.services.llm_service',
        'src.backend.services.image_service',
        'flask',
        'flask_sqlalchemy',
        'PIL',
        'PIL.Image',
        'PIL.ImageDraw',
        'paramiko',
        'requests',
        'cryptography',
        'bcrypt',
        'nacl',
        'cv2',
        'openai',
    ],
    excludes=[
        'tkinter',
        'matplotlib',
        # 'numpy',  # 不能排除numpy，cv2依赖它
        'pandas',
        'pytest',
        'IPython',
        'notebook',
        'sphinx',
    ],
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='PromptTool',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='PromptTool',
)