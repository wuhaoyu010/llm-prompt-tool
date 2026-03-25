"""
独立运行入口 - 用于 PyInstaller 打包
"""
import os
import sys
import webbrowser
import threading
import time

# PyInstaller 打包后设置路径
if getattr(sys, 'frozen', False):
    # 打包后，_MEIPASS 是解压目录
    base_path = sys._MEIPASS
    # 添加到 path 以便找到 app 模块
    if base_path not in sys.path:
        sys.path.insert(0, base_path)
    # 切换工作目录到 EXE 所在位置（数据库会在此创建）
    os.chdir(os.path.dirname(sys.executable))

from app.main import app

print("=" * 50)
print("  Prompt Tool - 缺陷检测提示词管理工具")
print("=" * 50)
print("访问地址: http://localhost:5001")
print("按 Ctrl+C 停止服务")
print("-" * 50)

def open_browser():
    time.sleep(2)
    webbrowser.open('http://localhost:5001')

threading.Thread(target=open_browser, daemon=True).start()

app.run(host='0.0.0.0', port=5001, debug=False)