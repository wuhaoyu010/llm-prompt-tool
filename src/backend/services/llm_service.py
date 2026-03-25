"""
LLM 服务层

提供大模型调用相关功能，包括：
- 真实 LLM API 调用
- Mock LLM 模拟调用
- Prompt 格式化
- 图片动态缩放（防止超过大模型token限制）
"""

import json
import base64
import requests
import logging

from src.backend.database import db, LLMConfig, GlobalPromptTemplate
from src.backend.utils.api_url import normalize_api_url

logger = logging.getLogger(__name__)

# 图片缩放配置常量
MAX_IMAGE_DIMENSION = 1920  # 最大图片边长，超过此值触发缩放
TARGET_IMAGE_DIMENSION = 1904  # 目标最大边长 (28 * 68)
IMAGE_SIZE_MULTIPLE = 28  # VLM要求图片尺寸为该值的倍数

# cv2 延迟导入，避免启动时版本冲突
_cv2 = None


def _get_cv2():
    """延迟加载 cv2，避免 numpy 版本冲突"""
    global _cv2
    if _cv2 is None:
        import cv2
        _cv2 = cv2
    return _cv2


def _resize_image_for_vlm(image):
    """
    将大图压缩到宽或高为28的倍数（最接近的尺寸），保持纵横比
    触发条件: 宽 > MAX_IMAGE_DIMENSION 或 高 > MAX_IMAGE_DIMENSION

    参数:
        image: numpy数组格式的图片 (H, W, C) 或 (H, W)

    返回:
        tuple: (resized_img, scale)
            - resized_img: 缩放后的图片
            - scale: 如果未缩放返回 1.0，否则返回 (scale_w, scale_h) 元组
    """
    cv2 = _get_cv2()

    h, w = image.shape[:2]

    # 判断是否需要缩放：长边超过阈值才触发
    max_side = max(w, h)
    if max_side <= MAX_IMAGE_DIMENSION:
        return image, 1.0

    # 计算缩放比例：以长边为基准，缩放到最接近的28倍数
    scale = TARGET_IMAGE_DIMENSION / max_side

    # 计算新的宽高（保持纵横比）
    new_w = int(w * scale)
    new_h = int(h * scale)

    # 调整为28的倍数（四舍五入）
    target_w = round(new_w / IMAGE_SIZE_MULTIPLE) * IMAGE_SIZE_MULTIPLE
    target_h = round(new_h / IMAGE_SIZE_MULTIPLE) * IMAGE_SIZE_MULTIPLE

    # 防止调整后超过限制
    target_w = min(target_w, TARGET_IMAGE_DIMENSION)
    target_h = min(target_h, TARGET_IMAGE_DIMENSION)

    # 确保尺寸至少为28
    target_w = max(target_w, IMAGE_SIZE_MULTIPLE)
    target_h = max(target_h, IMAGE_SIZE_MULTIPLE)

    resized_img = cv2.resize(
        image, (target_w, target_h), interpolation=cv2.INTER_AREA
    )

    # 计算实际缩放因子（用于坐标映射）
    scale_w = target_w / w
    scale_h = target_h / h

    logger.info(
        f"Image resized: {w}x{h} -> {target_w}x{target_h} "
        f"(scale_w={scale_w:.4f}, scale_h={scale_h:.4f})"
    )

    return resized_img, (scale_w, scale_h)


def format_prompt(defect_version, boxes_str):
    """
    格式化缺陷验证 Prompt

    参数:
        defect_version: 缺陷版本对象
        boxes_str: 标注框详情字符串

    返回:
        格式化后的 Prompt 字符串
    """
    template = GlobalPromptTemplate.query.first().template_text
    return template.format(
        defect_cn=defect_version.defect_cn,
        defect_class=defect_version.defect_class,
        judgment_points=defect_version.judgment_points,
        exclusions=defect_version.exclusions,
        box_details=boxes_str
    )


def run_real_llm(model_name, formatted_prompt, image_path, boxes_count):
    """
    调用真实 LLM API 进行缺陷验证

    参数:
        model_name: 模型名称
        formatted_prompt: 格式化后的 Prompt
        image_path: 图片路径
        boxes_count: 标注框数量

    返回:
        验证结果列表
    """
    cv2 = _get_cv2()  # 延迟加载，避免启动时版本冲突

    # 从数据库获取LLM配置
    config = LLMConfig.query.first()
    if not config or not config.api_key:
        return [{
            "box_id": i,
            "status": "E",
            "reason": "API Key 未配置，请在系统设置中配置"
        } for i in range(boxes_count)]

    api_key = config.api_key
    # 用户只需填写基础URL，后台自动拼接路由
    base_url = config.api_url.rstrip('/') if config.api_url else "https://api.siliconflow.cn"
    # 避免重复拼接
    if not base_url.endswith('/v1/chat/completions'):
        api_url = f"{base_url}/v1/chat/completions"
    else:
        api_url = base_url
    temperature = config.temperature if config.temperature is not None else 0.7
    max_tokens = config.max_tokens if config.max_tokens is not None else 1000

    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

    try:
        # 使用 OpenCV 读取图片以支持动态缩放
        image = cv2.imread(image_path)
        if image is None:
            raise ValueError(f"无法读取图片: {image_path}")

        # 动态缩放大图，防止超过大模型token限制
        resized_image, scale_info = _resize_image_for_vlm(image)

        # 编码为 JPEG 并转为 base64
        success, buffer = cv2.imencode('.jpg', resized_image, [cv2.IMWRITE_JPEG_QUALITY, 95])
        if not success:
            raise ValueError("图片编码失败")
        image_base64 = base64.b64encode(buffer).decode('utf-8')

    except Exception as e:
        return [{
            "box_id": i,
            "status": "E",
            "reason": f"读取图片失败: {e}"
        } for i in range(boxes_count)]

    payload = {
        "model": model_name,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": formatted_prompt},
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"}
                    }
                ]
            }
        ],
        "max_tokens": max_tokens,
        "temperature": temperature
    }

    try:
        response = requests.post(api_url, headers=headers, json=payload, timeout=120)
        response.raise_for_status()
        api_result = response.json()
        content_str = api_result['choices'][0]['message']['content']

        try:
            cleaned_content_str = content_str.strip().lstrip('```json').rstrip('```').strip()
            results = json.loads(cleaned_content_str)
            if not isinstance(results, list):
                results = [results]
        except (json.JSONDecodeError, TypeError):
            # 尝试解析多个连在一起的JSON对象
            results = []
            cleaned = cleaned_content_str.strip()

            # 方法1: 使用字符遍历找到所有JSON对象（最可靠的方法）
            if not results:
                try:
                    objects = []
                    depth = 0
                    start = -1
                    in_string = False
                    escape_next = False

                    for i, char in enumerate(cleaned):
                        if escape_next:
                            escape_next = False
                            continue
                        if char == '\\':
                            escape_next = True
                            continue
                        if char == '"':
                            in_string = not in_string
                            continue
                        if not in_string:
                            if char == '{':
                                if depth == 0:
                                    start = i
                                depth += 1
                            elif char == '}':
                                depth -= 1
                                if depth == 0 and start != -1:
                                    obj_str = cleaned[start:i+1]
                                    try:
                                        obj = json.loads(obj_str)
                                        if isinstance(obj, dict):
                                            objects.append(obj)
                                    except json.JSONDecodeError:
                                        pass
                                    start = -1
                    if objects:
                        results = objects
                except Exception:
                    pass

            # 方法2: 使用正则表达式匹配JSON对象
            if not results:
                try:
                    import re
                    pattern = r'\{[^}]*\}'
                    matches = re.findall(pattern, cleaned)
                    for match in matches:
                        try:
                            obj = json.loads(match)
                            if isinstance(obj, dict) and ('box_id' in obj or 'status' in obj):
                                results.append(obj)
                        except json.JSONDecodeError:
                            continue
                except Exception:
                    pass

            # 方法3: 按行分割解析
            if not results:
                lines = cleaned.split('\n')
                for line in lines:
                    line = line.strip()
                    if line and line.startswith('{') and line.endswith('}'):
                        try:
                            obj = json.loads(line)
                            if isinstance(obj, dict):
                                results.append(obj)
                        except json.JSONDecodeError:
                            continue

            # 如果所有解析方法都失败，返回错误
            if not results:
                results = [{
                    "box_id": i,
                    "status": "E",
                    "reason": f"API返回格式错误: {content_str[:200]}"
                } for i in range(boxes_count)]

        # 确保每个结果都有必要的字段
        for i, result in enumerate(results):
            if not isinstance(result, dict):
                results[i] = {"box_id": i, "status": "E", "reason": "Invalid result format"}
            if 'box_id' not in result:
                result['box_id'] = i
            if 'status' not in result:
                result['status'] = 'E'
            if 'reason' not in result:
                result['reason'] = 'No reason provided'

        return results
    except requests.exceptions.RequestException as e:
        return [{
            "box_id": i,
            "status": "E",
            "reason": f"API请求失败: {e}"
        } for i in range(boxes_count)]


def run_mock_llm(formatted_prompt, boxes_count):
    """
    Mock LLM 调用，用于测试

    参数:
        formatted_prompt: 格式化后的 Prompt
        boxes_count: 标注框数量

    返回:
        模拟验证结果列表
    """
    import time
    time.sleep(2)
    return [{
        "box_id": i,
        "status": "Y",
        "reason": "模拟结果：检测到缺陷"
    } for i in range(boxes_count)]


def test_model_availability(api_key, api_url, model_name):
    """
    测试模型可用性

    参数:
        api_key: API 密钥
        api_url: API URL
        model_name: 模型名称

    返回:
        包含成功/失败信息的字典
    """
    if not api_key:
        return {'success': False, 'error': 'API Key 不能为空'}
    if not api_url:
        return {'success': False, 'error': 'API URL 不能为空'}
    if not model_name:
        return {'success': False, 'error': '模型名称不能为空'}

    _, full_url = normalize_api_url(api_url, 'chat/completions')

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    test_payload = {
        "model": model_name,
        "messages": [{"role": "user", "content": "hi"}],
        "max_tokens": 10
    }

    try:
        response = requests.post(full_url, headers=headers, json=test_payload, timeout=30)

        if response.status_code == 200:
            return {'success': True, 'message': f'模型 "{model_name}" 可用'}
        else:
            try:
                error_data = response.json()
                error_msg = error_data.get('error', {})
                if isinstance(error_msg, dict):
                    error_message = error_msg.get('message', f'HTTP {response.status_code}')
                    if response.status_code == 404:
                        error_message = f'模型 "{model_name}" 不存在或当前 API Key 无权访问'
                    elif response.status_code == 401:
                        error_message = 'API Key 无效或已过期'
                    elif response.status_code == 403:
                        error_message = '无权访问此模型，请检查账户余额或权限'
                    return {'success': False, 'error': error_message, 'details': str(error_data)}
                else:
                    return {'success': False, 'error': str(error_msg)}
            except:
                return {'success': False, 'error': f'HTTP {response.status_code}'}

    except requests.exceptions.Timeout:
        return {'success': False, 'error': '请求超时，请检查网络连接'}
    except requests.exceptions.RequestException as e:
        return {'success': False, 'error': f'请求失败: {str(e)}'}


def fetch_models_list(api_key, api_url):
    """
    获取模型列表

    参数:
        api_key: API 密钥
        api_url: API URL

    返回:
        包含模型列表的字典
    """
    if not api_key:
        return {'error': 'API Key 不能为空', 'models': []}

    base_url, models_url = normalize_api_url(api_url, 'models')
    headers = {"Authorization": f"Bearer {api_key}"}

    try:
        response = requests.get(models_url, headers=headers, timeout=30)
        response.raise_for_status()
        data = response.json()

        models = []
        for model in data.get('data', []):
            models.append({
                'id': model.get('id'),
                'name': model.get('id'),
                'owned_by': model.get('owned_by', '')
            })

        return {'models': models}
    except requests.exceptions.RequestException as e:
        return {'error': f'获取模型列表失败: {str(e)}', 'models': []}


def check_llm_health(config):
    """
    检查大模型服务健康状态

    参数:
        config: LLMConfig 配置对象

    返回:
        健康状态字典
    """
    if not config or not config.api_key:
        return {
            'status': 'offline',
            'message': '未配置 API Key',
            'details': '请在系统设置中配置 API Key'
        }

    base_url, models_url = normalize_api_url(config.api_url, 'models')
    headers = {"Authorization": f"Bearer {config.api_key}"}

    try:
        response = requests.get(models_url, headers=headers, timeout=10)
        response.raise_for_status()
        data = response.json()

        model_count = len(data.get('data', []))

        return {
            'status': 'online',
            'message': '服务正常',
            'details': f'可用模型数量: {model_count}',
            'model_count': model_count,
            'api_url': config.api_url
        }
    except requests.exceptions.Timeout:
        return {
            'status': 'offline',
            'message': '连接超时',
            'details': '服务响应超时，请检查网络连接'
        }
    except requests.exceptions.ConnectionError:
        return {
            'status': 'offline',
            'message': '连接失败',
            'details': '无法连接到服务器，请检查 API URL 是否正确'
        }
    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 401:
            return {
                'status': 'offline',
                'message': '认证失败',
                'details': 'API Key 无效或已过期'
            }
        return {
            'status': 'offline',
            'message': f'HTTP 错误: {e.response.status_code}',
            'details': str(e)
        }
    except Exception as e:
        return {
            'status': 'offline',
            'message': '检查失败',
            'details': str(e)
        }