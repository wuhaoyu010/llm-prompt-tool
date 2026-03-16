"""
模型路由

处理模型相关的 API 端点：
- 获取可用模型列表
- 测试模型可用性
- 预览模型列表
- LLM 健康检查
"""

from flask import Blueprint, request, jsonify

from ..database import LLMConfig
from ..services.llm_service import test_model_availability, fetch_models_list, check_llm_health
from ..utils.api_url import normalize_api_url

model_bp = Blueprint('model', __name__, url_prefix='/api')


@model_bp.route('/models/test', methods=['POST'])
def test_model():
    """测试指定模型是否可用"""
    data = request.get_json() or {}
    api_key = data.get('api_key', '')
    api_url = data.get('api_url', '')
    model_name = data.get('model_name', '')

    result = test_model_availability(api_key, api_url, model_name)

    if result['success']:
        return jsonify(result)
    else:
        return jsonify(result), 400


@model_bp.route('/models/preview', methods=['POST'])
def preview_models():
    """预览指定 API 配置的模型列表（用于设置页面实时刷新）"""
    data = request.get_json() or {}
    api_key = data.get('api_key', '')
    api_url = data.get('api_url', '')

    if not api_key:
        return jsonify({'error': 'API Key 不能为空', 'models': []}), 400

    result = fetch_models_list(api_key, api_url)

    if 'error' in result and result['models'] == []:
        return jsonify(result), 500

    return jsonify(result)


@model_bp.route('/models', methods=['GET'])
def get_available_models():
    """从配置的 API 获取可用模型列表"""
    config = LLMConfig.query.first()
    if not config or not config.api_key:
        return jsonify({'error': 'API Key 未配置', 'models': []}), 400

    result = fetch_models_list(config.api_key, config.api_url)

    if 'error' in result:
        return jsonify({'error': result['error'], 'models': []}), 500

    # 返回模型列表和默认模型
    return jsonify({
        'models': result['models'],
        'default_model': config.default_model if config.default_model else (result['models'][0]['id'] if result['models'] else None)
    })


@model_bp.route('/llm_health', methods=['GET'])
def check_llm_health_endpoint():
    """检查大模型服务健康状态"""
    config = LLMConfig.query.first()
    result = check_llm_health(config)
    return jsonify(result)