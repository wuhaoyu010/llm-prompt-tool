"""
配置路由

处理全局配置相关的 API 端点：
- 全局 Prompt 模板
- LLM 配置
- Trueno3 配置
"""

from flask import Blueprint, request, jsonify

from ..database import db, GlobalPromptTemplate, LLMConfig, Trueno3Config
from ..services.ssh_service import test_ssh_connection

config_bp = Blueprint('config', __name__, url_prefix='/api')


@config_bp.route('/global_template', methods=['GET', 'POST'])
def handle_global_template():
    """获取或更新全局 Prompt 模板"""
    template = GlobalPromptTemplate.query.first()
    if request.method == 'POST':
        data = request.json
        template.template_text = data.get('template_text', template.template_text)
        db.session.commit()
        return jsonify(template.to_dict())
    return jsonify(template.to_dict())


@config_bp.route('/llm_config', methods=['GET', 'POST'])
def handle_llm_config():
    """获取或更新大模型配置"""
    config = LLMConfig.query.first()
    if not config:
        config = LLMConfig(
            api_key='',
            api_url='https://api.siliconflow.cn',
            default_model='Pro/Qwen/Qwen2.5-VL-7B-Instruct',
            temperature=0.7,
            max_tokens=1000
        )
        db.session.add(config)
        db.session.commit()

    if request.method == 'POST':
        data = request.json
        if 'api_key' in data:
            config.api_key = data['api_key']
        if 'api_url' in data:
            config.api_url = data['api_url']
        if 'default_model' in data:
            config.default_model = data['default_model']
        if 'temperature' in data:
            config.temperature = float(data['temperature'])
        if 'max_tokens' in data:
            config.max_tokens = int(data['max_tokens'])
        db.session.commit()
        return jsonify(config.to_dict())

    return jsonify(config.to_dict())


@config_bp.route('/trueno3_config', methods=['GET', 'POST'])
def handle_trueno3_config():
    """获取或更新 Trueno3 配置"""
    config = Trueno3Config.query.first()
    if not config:
        config = Trueno3Config(
            enabled=False,
            code_path='/home/user/trueno3/src/algorithm/vlm_qwen3_server',
            ssh_host='',
            ssh_port=22,
            ssh_username='',
            ssh_password=''
        )
        db.session.add(config)
        db.session.commit()

    if request.method == 'POST':
        data = request.json
        if 'enabled' in data:
            config.enabled = bool(data['enabled'])
        if 'code_path' in data:
            config.code_path = data['code_path']
        if 'ssh_host' in data:
            config.ssh_host = data['ssh_host']
        if 'ssh_port' in data:
            config.ssh_port = int(data['ssh_port'])
        if 'ssh_username' in data:
            config.ssh_username = data['ssh_username']
        if 'ssh_password' in data:
            config.ssh_password = data['ssh_password']
        db.session.commit()
        return jsonify(config.to_dict())

    return jsonify(config.to_dict())


@config_bp.route('/trueno3_test', methods=['POST'])
def test_trueno3_connection():
    """测试 Trueno3 SSH 连接（使用传入的配置或数据库配置）"""
    try:
        data = request.json

        # 如果前端传入了配置，使用传入的配置进行测试
        if data and data.get('ssh_host'):
            # 创建临时配置对象
            class TempConfig:
                pass
            config = TempConfig()
            config.code_path = data.get('code_path', '/home/user/trueno3/src/algorithm/vlm_qwen3_server')
            config.ssh_host = data.get('ssh_host')
            config.ssh_port = data.get('ssh_port', 22)
            config.ssh_username = data.get('ssh_username')
            config.ssh_password = data.get('ssh_password')
        else:
            # 使用数据库中的配置
            config = Trueno3Config.query.first()
            if not config:
                return jsonify({'success': False, 'error': 'Trueno3配置不存在'}), 400

            if not config.ssh_host or not config.ssh_username:
                return jsonify({'success': False, 'error': 'SSH主机或用户名未配置'}), 400

        # 尝试 SSH 连接
        result = test_ssh_connection(config)
        return jsonify(result)
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500