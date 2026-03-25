"""
SSH 服务层

提供 SSH 连接和远程文件操作功能，用于：
- 测试 SSH 连接
- 更新 Trueno3 的缺陷定义文件
"""

import re
import paramiko


def test_ssh_connection(config):
    """
    测试 SSH 连接

    参数:
        config: 包含 SSH 配置的对象，需要有以下属性：
            - ssh_host: 主机地址
            - ssh_port: 端口号
            - ssh_username: 用户名
            - ssh_password: 密码

    返回:
        包含成功/失败信息的字典
    """
    try:
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        client.connect(
            hostname=config.ssh_host,
            port=config.ssh_port,
            username=config.ssh_username,
            password=config.ssh_password,
            timeout=10
        )

        # 测试执行简单命令
        stdin, stdout, stderr = client.exec_command('pwd')
        result = stdout.read().decode().strip()

        client.close()
        return {'success': True, 'message': f'SSH连接成功，当前目录: {result}'}
    except Exception as e:
        return {'success': False, 'error': f'SSH连接失败: {str(e)}'}


def update_trueno3_defect_definitions(config, defect_name, defect_version):
    """
    更新 Trueno3 的 defect_definitions.py 文件

    参数:
        config: 包含 Trueno3 配置的对象
        defect_name: 缺陷英文名
        defect_version: 缺陷版本对象

    返回:
        包含成功/失败信息的字典
    """
    try:
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        client.connect(
            hostname=config.ssh_host,
            port=config.ssh_port,
            username=config.ssh_username,
            password=config.ssh_password,
            timeout=30
        )

        # 文件路径
        file_path = f"{config.code_path}/defect_definitions.py"

        # 读取远程文件
        sftp = client.open_sftp()
        try:
            with sftp.file(file_path, 'r') as f:
                content = f.read().decode('utf-8')
        except FileNotFoundError:
            # 文件不存在，创建新文件
            content = '''"""
缺陷类别定义文件
键名需与 prv_config["ability"] 完全匹配
"""

from .prompt import (
    BATCH_VERIFICATION_PROMPT,
    BASE_VERIFICATION_PROMPT,  # 通用提示词，识别缺陷等是否存在
)

DEFECT_CLASSES = {
}
'''

        # 构建新的缺陷定义条目
        new_defect_entry = f'''    "{defect_name}": {{
        "defect_cn": "{defect_version.defect_cn}",
        "defect_class": "{defect_version.defect_class or ''}",
        "judgment_points": """{defect_version.judgment_points or ''}""",
        "exclusions": "{defect_version.exclusions or ''}",
        "prompt_template_key": BASE_VERIFICATION_PROMPT,
        "label": "{defect_name}",
        "visual_cues": ""
    }}'''

        # 检查是否已存在该缺陷
        pattern = rf'"{re.escape(defect_name)}"\s*:\s*\{{[^}}]+\}}'
        if re.search(pattern, content):
            # 更新现有条目
            content = re.sub(pattern, new_defect_entry.strip(), content, flags=re.DOTALL)
        else:
            # 添加新条目
            match = re.search(r'(DEFECT_CLASSES\s*=\s*\{)', content)
            if match:
                insert_pos = match.end()
                next_char = content[insert_pos:insert_pos+1]
                if next_char.strip() and next_char != '}':
                    new_defect_entry = ',\n' + new_defect_entry
                content = content[:insert_pos] + '\n' + new_defect_entry + content[insert_pos:]
            else:
                content += f'\nDEFECT_CLASSES = {{\n{new_defect_entry}\n}}\n'

        # 写回文件
        with sftp.file(file_path, 'w') as f:
            f.write(content.encode('utf-8'))

        sftp.close()
        client.close()

        return {'success': True, 'message': f'成功更新缺陷定义: {defect_name}'}
    except Exception as e:
        return {'success': False, 'error': f'更新失败: {str(e)}'}