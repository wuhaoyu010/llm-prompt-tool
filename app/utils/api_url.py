"""
API URL 工具函数

提供 API URL 标准化和数据目录路径处理功能。
"""

import os
import sys


def normalize_api_url(api_url, endpoint='chat/completions'):
    """
    标准化 API URL，支持各种输入格式

    支持的输入格式:
    - https://api.example.com
    - https://api.example.com/v1
    - https://api.example.com/v1/chat/completions
    - https://api.example.com/compatible-mode
    - https://api.example.com/compatible-mode/v1

    参数:
        api_url: 用户输入的 API URL
        endpoint: 目标端点，默认 'chat/completions'

    返回:
        - base_url: 用于 /v1/models 等接口
        - full_url: 用于指定端点的完整 URL
    """
    if not api_url:
        api_url = "https://api.siliconflow.cn"

    url = api_url.rstrip('/')

    # 提取 base_url（移除 /v1/chat/completions 等路径）
    base_url = url
    if '/chat/completions' in base_url:
        base_url = base_url.split('/chat/completions')[0]
    if base_url.endswith('/v1'):
        base_url = base_url[:-3]

    # 构建完整 URL
    if endpoint == 'chat/completions':
        full_url = base_url + '/v1/chat/completions'
    elif endpoint == 'models':
        full_url = base_url + '/v1/models'
    else:
        full_url = base_url + '/v1/' + endpoint

    return base_url, full_url


def get_data_dir():
    """获取数据目录路径（支持 PyInstaller 打包）"""
    if getattr(sys, 'frozen', False):
        # PyInstaller 打包后，使用 EXE 所在目录
        return os.path.dirname(sys.executable)
    # 开发环境，使用 app 模块所在目录
    return os.path.dirname(os.path.abspath(__file__))