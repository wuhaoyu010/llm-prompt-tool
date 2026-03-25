"""运行Playwright测试脚本"""
import subprocess
import sys
import time
import threading
import os

# 添加项目根目录到路径
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_root)
os.chdir(project_root)

# 设置环境
os.environ['FLASK_ENV'] = 'development'

def run_server():
    """在后台启动Flask服务器"""
    from src.backend.main import app
    app.run(host='127.0.0.1', port=5000, debug=False, use_reloader=False)

def check_server():
    """检查服务器是否运行"""
    import urllib.request
    try:
        response = urllib.request.urlopen('http://localhost:5000/', timeout=5)
        return response.status == 200
    except:
        return False

def main():
    print("=" * 60)
    print("Playwright 前端测试")
    print("=" * 60)

    # 启动服务器
    print("\n[1/3] 启动Flask服务器...")
    server_thread = threading.Thread(target=run_server, daemon=True)
    server_thread.start()

    # 等待服务器启动
    for i in range(10):
        time.sleep(1)
        if check_server():
            print("      服务器启动成功! http://localhost:5000")
            break
        print(f"      等待服务器启动... ({i+1}/10)")
    else:
        print("      错误: 服务器启动失败")
        return 1

    # 运行测试
    print("\n[2/3] 运行Playwright测试...\n")
    result = subprocess.run(
        [sys.executable, '-m', 'pytest', 'tests/test_frontend.py', '-v', '--tb=short', '-x'],
        cwd=os.path.dirname(os.path.abspath(__file__))
    )

    print("\n[3/3] 测试完成")
    return result.returncode

if __name__ == "__main__":
    sys.exit(main())