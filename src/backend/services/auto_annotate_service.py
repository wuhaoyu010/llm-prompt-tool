"""
自动标注服务层

提供基于 Trueno3 API 的自动标注功能：
- 构建分析请求
- 发送图片到 Trueno3
- 处理回调结果
- 坐标转换
- 服务连通性检测
"""

import uuid
import base64
import requests
import datetime
import socket
from PIL import Image

from src.backend.database import db, Defect, TestCase, BoundingBox, Trueno3Config, AutoAnnotationTask, AutoAnnotationItem


# 自动标注超时配置
AUTO_ANNOTATE_TIMEOUT_SECONDS = 20
AUTO_ANNOTATE_MAX_RETRIES = 2


def _get_local_ip():
    """获取本机 IP 地址"""
    try:
        # 创建一个 UDP socket 连接到外部地址来获取本机 IP
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
        return local_ip
    except Exception:
        return None


def test_trueno3_service_connection(config=None, service_host=None, service_port=None):
    """
    测试 Trueno3 服务连通性

    参数:
        config: Trueno3Config 对象（可选）
        service_host: 服务主机地址（可选，用于测试未保存的配置）
        service_port: 服务端口（可选）

    返回:
        {
            'success': bool,
            'message': str,
            'functions': [{'funID': str, 'funDesc': str}],  # 可用功能列表
            'matched_defects': [{'name': str, 'defect_cn': str}]  # 匹配的缺陷列表
        }
    """
    # 确定服务地址
    if service_host is None:
        if config is None:
            config = Trueno3Config.query.first()
        if not config:
            return {
                'success': False,
                'error': 'Trueno3 服务配置不存在'
            }
        service_host = config.service_host or config.ssh_host
        service_port = config.service_port or 20011

    if not service_host:
        return {
            'success': False,
            'error': '服务地址未配置'
        }

    # 构建 QueryFunctionList 接口 URL
    api_url = f'http://{service_host}:{service_port}/AICalibration/QueryFunctionList'

    try:
        response = requests.post(
            api_url,
            json={},
            headers={'Content-Type': 'application/json'},
            timeout=10
        )

        if response.status_code != 200:
            return {
                'success': False,
                'error': f'HTTP {response.status_code}',
                'service_host': service_host,
                'service_port': service_port
            }

        data = response.json()

        # 解析返回结果
        if data.get('code') != 200:
            return {
                'success': False,
                'error': data.get('message', '服务返回错误'),
                'service_host': service_host,
                'service_port': service_port
            }

        # 提取功能列表
        fun_list = data.get('data', {}).get('funList', [])
        functions = []
        for item in fun_list:
            functions.append({
                'funID': item.get('funID', ''),
                'funDesc': item.get('funDesc', ''),
                'hasConfig': bool(item.get('config'))
            })

        # 查找匹配的缺陷
        matched_defects = []
        if fun_list:
            fun_ids = [f.get('funID') for f in fun_list if f.get('funID')]
            if fun_ids:
                defects = Defect.query.filter(Defect.name.in_(fun_ids)).all()
                for defect in defects:
                    latest = defect.get_latest_version()
                    matched_defects.append({
                        'name': defect.name,
                        'defect_cn': latest.defect_cn if latest else defect.name,
                        'matched': True
                    })

        return {
            'success': True,
            'message': f'服务连接成功，共 {len(functions)} 个可用功能',
            'service_host': service_host,
            'service_port': service_port,
            'api_version': data.get('data', {}).get('apiVersion', 'unknown'),
            'functions': functions,
            'matched_defects': matched_defects,
            'total_functions': len(functions),
            'total_matched': len(matched_defects)
        }

    except requests.exceptions.Timeout:
        return {
            'success': False,
            'error': '连接超时，请检查服务地址和端口',
            'service_host': service_host,
            'service_port': service_port
        }
    except requests.exceptions.ConnectionError:
        return {
            'success': False,
            'error': '无法连接到服务，请检查服务是否启动',
            'service_host': service_host,
            'service_port': service_port
        }
    except Exception as e:
        return {
            'success': False,
            'error': f'检测失败: {str(e)}',
            'service_host': service_host,
            'service_port': service_port
        }


def create_auto_annotation_task(defect_id, test_case_ids=None, clear_existing_boxes=False):
    """
    创建自动标注任务

    参数:
        defect_id: 缺陷 ID
        test_case_ids: 指定测试用例 ID 列表，为 None 则处理全部
        clear_existing_boxes: 是否清除现有标注框

    返回:
        (success, task_or_error_message)
    """
    # 检查配置
    config = Trueno3Config.query.first()
    print(f"[DEBUG] Trueno3Config: enabled={config.enabled if config else None}, host={config.service_host if config else None}")
    if not defect:
        return False, '缺陷不存在'

    # 获取测试用例
    query = TestCase.query.filter_by(defect_id=defect_id)
    if test_case_ids:
        query = query.filter(TestCase.id.in_(test_case_ids))
    test_cases = query.all()
    print(f"[DEBUG] TestCases: count={len(test_cases)}")

    thread = threading.Thread(target=send_requests_async)
    thread.start()

    return True, task


def _send_analysis_requests(task_id, defect, test_cases, config, callback_host, callback_port):
    """异步发送分析请求到 Trueno3"""
    from flask import current_app

    task = AutoAnnotationTask.query.get(task_id)
    if not task:
        return

    task.status = 'processing'
    db.session.commit()

    service_host = config['service_host']
    api_url = f"http://{service_host}:{config['service_port']}{config['api_path']}"

    for tc in test_cases:
        item = AutoAnnotationItem.query.filter_by(
            task_id=task_id,
            test_case_id=tc['id']
        ).first()

        if not item:
            continue

        retry_count = 0
        last_error = None

        while retry_count <= AUTO_ANNOTATE_MAX_RETRIES:
            try:
                request_body = _build_analyze_request(tc, defect, config, task.request_id, callback_host, callback_port)

                response = requests.post(
                    api_url,
                    json=request_body,
                    headers={'Content-Type': 'application/json'},
                    timeout=AUTO_ANNOTATE_TIMEOUT_SECONDS
                )

                if response.status_code == 200:
                    item.status = 'processing'
                    item.error_message = None
                    break
                else:
                    last_error = f'HTTP {response.status_code}: {response.text[:200]}'
                    retry_count += 1
                    if retry_count > AUTO_ANNOTATE_MAX_RETRIES:
                        item.status = 'failed'
                        item.error_message = last_error
                        task.processed_images += 1

            except Exception as e:
                last_error = str(e)
                retry_count += 1
                if retry_count > AUTO_ANNOTATE_MAX_RETRIES:
                    item.status = 'failed'
                    item.error_message = last_error
                    task.processed_images += 1

            if retry_count <= AUTO_ANNOTATE_MAX_RETRIES and item.status != 'processing':
                import time
                time.sleep(1)

        db.session.commit()

    # 检查是否所有请求都已发送完成 (可能还在等待回调)
    _check_task_completion(task_id)

    # 启动持续超时检查线程
    import threading
    def timeout_checker():
        import time
        max_wait = AUTO_ANNOTATE_TIMEOUT_SECONDS * 3
        checked_times = 0
        while checked_times < 5:
            time.sleep(max_wait / 5)
            with app.app_context():
                task = AutoAnnotationTask.query.get(task_id)
                if not task or task.status not in ['pending', 'processing']:
                    return
                _check_task_completion(task_id)
                checked_times += 1

    checker_thread = threading.Thread(target=timeout_checker)
    checker_thread.daemon = True
    checker_thread.start()


def _build_analyze_request(test_case, defect, config, request_id, callback_host, callback_port):
    """
    构建 Trueno3 API 请求参数
    """
    # 读取图片并转 base64
    tc_id = test_case['id']
    tc_filepath = test_case['filepath']
    defect_name = defect['name']

    try:
        with open(tc_filepath, 'rb') as f:
            image_base64 = base64.b64encode(f.read()).decode('utf-8')
    except Exception as e:
        raise ValueError(f'读取图片失败: {e}')

    return {
        'requestHostIp': callback_host,
        'requestHostPort': str(callback_port),
        'requestId': request_id,
        'objectList': [
            {
                'objectId': f'testcase-{tc_id}',
                'typeList': [defect_name],
                'imageUrlList': [''],
                'imageBase64': image_base64,
                'imageRecogType': defect_name,
                'parameter': {}
            }
        ]
    }


def process_callback(request_id, results_list, desc):
    """
    处理 Trueno3 回调结果

    参数:
        request_id: 请求 ID
        results_list: 结果列表
        desc: 描述信息
    """
    task = AutoAnnotationTask.query.filter_by(request_id=request_id).first()
    if not task:
        print(f'Warning: Received callback for unknown request_id: {request_id}')
        return {'code': 404, 'message': 'Task not found'}

    if desc and desc.startswith('ERROR'):
        task.status = 'failed'
        task.error_message = desc
        task.completed_at = datetime.datetime.utcnow()
        db.session.commit()
        return {'code': 200, 'message': 'received'}

    # 处理每个结果
    for result_item in results_list:
        object_id = result_item.get('objectId', '')
        results = result_item.get('results', [])

        # 找到对应的子任务
        item = AutoAnnotationItem.query.filter_by(
            task_id=task.id,
            object_id=object_id
        ).first()

        if not item:
            print(f'Warning: Unknown object_id: {object_id}')
            continue

        # 保存原始回调数据
        import json
        item.callback_data = json.dumps(result_item, ensure_ascii=False)

        # 获取图片尺寸用于坐标转换
        test_case = TestCase.query.get(item.test_case_id)
        if not test_case:
            item.status = 'failed'
            item.error_message = '测试用例不存在'
            continue

        img_width, img_height = _get_image_dimensions(test_case.filepath)

        boxes_created = 0
        for result in results:
            if result.get('code') != '2000':
                continue  # 跳过异常结果

            pos_list = result.get('pos', [])
            if not pos_list:
                continue

            # 转换坐标并保存
            boxes = convert_pos_to_normalized(pos_list, img_width, img_height)
            for norm_box in boxes:
                bbox = BoundingBox(
                    test_case_id=test_case.id,
                    norm_x_min=norm_box[0],
                    norm_y_min=norm_box[1],
                    norm_x_max=norm_box[2],
                    norm_y_max=norm_box[3]
                )
                db.session.add(bbox)
                boxes_created += 1

        item.boxes_created = boxes_created
        item.status = 'completed'
        item.completed_at = datetime.datetime.utcnow()
        task.processed_images += 1
        task.total_boxes_created += boxes_created

    db.session.commit()

    # 检查任务是否完成
    _check_task_completion(task.id)

    return {'code': 200, 'message': 'received'}


def convert_pos_to_normalized(pos_list, img_width, img_height):
    """
    将 Trueno3 的 pos 坐标转换为归一化坐标

    参数:
        pos_list: Trueno3 返回的 pos 数组
        img_width: 图片原始宽度
        img_height: 图片原始高度

    返回:
        List of (norm_x_min, norm_y_min, norm_x_max, norm_y_max)
    """
    boxes = []
    for pos_item in pos_list:
        areas = pos_item.get('areas', [])
        if len(areas) >= 2:
            # areas[0] 是左上角, areas[1] 是右下角
            x1, y1 = areas[0].get('x', 0), areas[0].get('y', 0)
            x2, y2 = areas[1].get('x', 0), areas[1].get('y', 0)

            # 确保坐标顺序正确
            x_min, x_max = min(x1, x2), max(x1, x2)
            y_min, y_max = min(y1, y2), max(y1, y2)

            # 归一化到 0-999
            norm_x_min = int(x_min / img_width * 999)
            norm_y_min = int(y_min / img_height * 999)
            norm_x_max = int(x_max / img_width * 999)
            norm_y_max = int(y_max / img_height * 999)

            # 边界检查
            norm_x_min = max(0, min(999, norm_x_min))
            norm_y_min = max(0, min(999, norm_y_min))
            norm_x_max = max(0, min(999, norm_x_max))
            norm_y_max = max(0, min(999, norm_y_max))

            # 确保最小有效尺寸
            if norm_x_max > norm_x_min and norm_y_max > norm_y_min:
                boxes.append((norm_x_min, norm_y_min, norm_x_max, norm_y_max))

    return boxes


def _get_image_dimensions(filepath):
    """获取图片尺寸"""
    try:
        with Image.open(filepath) as img:
            return img.size  # (width, height)
    except Exception:
        return (1920, 1080)  # 默认尺寸


def _check_task_completion(task_id):
    """检查任务是否完成"""
    task = AutoAnnotationTask.query.get(task_id)
    if not task:
        return

    if task.status not in ['pending', 'processing']:
        return

    _check_timeout_items(task_id)

    total_items = len(task.items)

    completed_items = AutoAnnotationItem.query.filter_by(task_id=task_id).filter(
        AutoAnnotationItem.status.in_(['completed', 'failed'])
    ).count()

    if completed_items >= total_items:
        # 检查是否全部失败
        failed_items = AutoAnnotationItem.query.filter_by(task_id=task_id, status='failed').count()
        if failed_items >= total_items:
            task.status = 'failed'
            task.error_message = '所有图片处理失败'
        else:
            task.status = 'completed'

        task.completed_at = datetime.datetime.utcnow()
        db.session.commit()


def _check_timeout_items(task_id):
    """检查超时的子任务（超过指定时间仍在 processing 状态）"""
    timeout_threshold = datetime.datetime.utcnow() - datetime.timedelta(seconds=AUTO_ANNOTATE_TIMEOUT_SECONDS)

    # 查找超时的 processing 状态子任务
    timeout_items = AutoAnnotationItem.query.filter_by(
        task_id=task_id,
        status='processing'
    ).filter(
        AutoAnnotationItem.created_at < timeout_threshold
    ).all()

    for item in timeout_items:
        item.status = 'failed'
        item.error_message = f'处理超时（超过 {AUTO_ANNOTATE_TIMEOUT_SECONDS} 秒）'
        item.completed_at = datetime.datetime.utcnow()

        # 更新任务计数
        task = AutoAnnotationTask.query.get(task_id)
        if task:
            task.processed_images += 1

    if timeout_items:
        db.session.commit()


def get_task_status(task_id):
    """获取任务状态"""
    task = AutoAnnotationTask.query.get(task_id)
    if not task:
        return None

    result = task.to_dict()
    result['items'] = []

    for item in task.items:
        item_data = item.to_dict()
        # 添加文件名
        test_case = TestCase.query.get(item.test_case_id)
        if test_case:
            item_data['filename'] = test_case.filename
        result['items'].append(item_data)

    return result