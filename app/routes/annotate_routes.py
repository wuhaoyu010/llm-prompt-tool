"""
自动标注路由

处理自动标注相关的 API 端点：
- 启动自动标注任务
- 回调接口
- 任务状态查询
"""

from flask import Blueprint, request, jsonify

from ..database import Defect
from ..services.auto_annotate_service import (
    create_auto_annotation_task,
    process_callback,
    get_task_status
)

annotate_bp = Blueprint('annotate', __name__)


@annotate_bp.route('/api/auto_annotate/defect/<int:defect_id>', methods=['POST'])
def start_auto_annotate(defect_id):
    """
    启动自动标注任务

    请求参数:
        clear_existing_boxes: bool - 是否清除现有标注框
        test_case_ids: list - 指定测试用例 ID，为空则处理全部
    """
    data = request.get_json() or {}

    clear_existing = data.get('clear_existing_boxes', False)
    test_case_ids = data.get('test_case_ids', None)

    success, result = create_auto_annotation_task(
        defect_id=defect_id,
        test_case_ids=test_case_ids,
        clear_existing_boxes=clear_existing
    )

    if success:
        task = result
        return jsonify({
            'success': True,
            'task_id': task.id,
            'request_id': task.request_id,
            'total_images': task.total_images,
            'message': '自动标注任务已启动'
        })
    else:
        error_msg = result
        print(f"[DEBUG] auto_annotate failed: {error_msg}, defect_id={defect_id}")
        if '未配置' in error_msg or '未启用' in error_msg:
            return jsonify({'success': False, 'error': error_msg}), 503
        else:
            return jsonify({'success': False, 'error': error_msg}), 400


@annotate_bp.route('/picAnalyseRetNotify', methods=['POST'])
def pic_analyse_callback():
    """
    Trueno3 回调接口

    接收 Trueno3 的异步分析结果
    """
    data = request.get_json() or {}

    request_id = data.get('requestId', '')
    results_list = data.get('resultsList', [])
    desc = data.get('desc', '')

    result = process_callback(request_id, results_list, desc)

    return jsonify(result)


@annotate_bp.route('/api/auto_annotate/task/<int:task_id>', methods=['GET'])
def query_task_status(task_id):
    """查询自动标注任务状态"""
    task_data = get_task_status(task_id)

    if not task_data:
        return jsonify({'error': 'Task not found'}), 404

    return jsonify(task_data)


@annotate_bp.route('/api/auto_annotate/tasks', methods=['GET'])
def list_tasks():
    """列出自动标注任务"""
    from ..database import AutoAnnotationTask

    defect_id = request.args.get('defect_id', type=int)
    status = request.args.get('status', '')
    limit = request.args.get('limit', 20, type=int)

    query = AutoAnnotationTask.query

    if defect_id:
        query = query.filter_by(defect_id=defect_id)
    if status:
        query = query.filter_by(status=status)

    tasks = query.order_by(AutoAnnotationTask.created_at.desc()).limit(limit).all()

    return jsonify({
        'tasks': [t.to_dict() for t in tasks]
    })


@annotate_bp.route('/api/auto_annotate/batch_defects', methods=['POST'])
def batch_defects_auto_annotate():
    """
    批量缺陷自动标注

    请求参数:
        defect_names: list - 缺陷名称列表（对应服务的 funID）
        clear_existing_boxes: bool - 是否清除现有标注框

    返回:
        success: bool
        tasks: list - 创建的任务列表
        message: str
    """
    data = request.get_json() or {}

    defect_names = data.get('defect_names', [])
    clear_existing = data.get('clear_existing_boxes', False)

    if not defect_names:
        return jsonify({'success': False, 'error': '请选择要自动标注的缺陷'}), 400

    # 根据名称查找缺陷
    defects = Defect.query.filter(Defect.name.in_(defect_names)).all()

    if not defects:
        return jsonify({'success': False, 'error': '未找到匹配的缺陷'}), 404

    created_tasks = []
    errors = []

    for defect in defects:
        # 获取缺陷的所有测试用例
        test_cases = defect.test_cases
        if not test_cases:
            errors.append(f'缺陷 {defect.name} 没有测试用例')
            continue

        test_case_ids = [tc.id for tc in test_cases]

        # 创建自动标注任务
        success, result = create_auto_annotation_task(
            defect_id=defect.id,
            test_case_ids=test_case_ids,
            clear_existing_boxes=clear_existing
        )

        if success:
            created_tasks.append({
                'defect_name': defect.name,
                'task_id': result.id,
                'total_images': result.total_images
            })
        else:
            errors.append(f'缺陷 {defect.name}: {result}')

    return jsonify({
        'success': len(created_tasks) > 0,
        'tasks': created_tasks,
        'errors': errors,
        'message': f'已创建 {len(created_tasks)} 个自动标注任务'
    })