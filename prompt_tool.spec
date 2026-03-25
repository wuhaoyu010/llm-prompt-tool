# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller 打包配置"""

import sys
import os

block_cipher = None

project_root = os.path.dirname(os.path.abspath(SPEC))

a = Analysis(
    ['run_standalone.py'],
    pathex=[project_root],
    binaries=[],
    datas=[
        # 包含 app 模块的所有文件
        (os.path.join(project_root, 'app', '*.py'), 'app'),
        (os.path.join(project_root, 'app', 'templates'), 'app/templates'),
        (os.path.join(project_root, 'app', 'static'), 'app/static'),
    ],
    hiddenimports=[
        'app',
        'app.main',
        'app.database',
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
    ],
    excludes=[
        'tkinter',
        'matplotlib',
        'numpy',
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