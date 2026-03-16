"""
任务路由

处理异步任务相关的 API 端点：
- 比较测试
- 回归测试
- 任务状态查询
"""

import uuid
import threading
from flask import Blueprint, request, jsonify

from ..database import db, TestCase, DefectVersion
from ..services.llm_service import run_real_llm, run_mock_llm, format_prompt

task_bp = Blueprint('task', __name__, url_prefix='/api')

# 任务存储（内存中）
TASKS = {}


def _run_comparison_task(task_id, data, app_context):
    """执行比较任务的内部函数"""
    with app_context:
        TASKS[task_id]['status'] = 'PROCESSING'
        try:
            saved_version_id = data.get('saved_version_id')
            edited_params = data.get('edited_params')
            test_case_id = data.get('test_case_id')
            use_real_llm = data.get('use_real_llm', False)
            model_name = data.get('model_name', 'Pro/Qwen/Qwen2.5-VL-7B-Instruct')

            case = TestCase.query.get_or_404(test_case_id)
            if not case.bounding_boxes:
                raise ValueError("Test case has no bounding boxes")

            box_details_str = "ID|归一化坐标|标签|置信度\n---|---|---|---\n"
            boxes_for_llm = []
            for i, bbox in enumerate(case.bounding_boxes):
                norm_box = [bbox.norm_x_min, bbox.norm_y_min, bbox.norm_x_max, bbox.norm_y_max]
                boxes_for_llm.append(norm_box)
                box_details_str += f"{i}|[{norm_box[0]},{norm_box[1]},{norm_box[2]},{norm_box[3]}]|{case.defect.name}|0.99\n"

            llm_function = run_real_llm if use_real_llm else run_mock_llm

            saved_version = DefectVersion.query.get_or_404(saved_version_id)
            saved_prompt = format_prompt(saved_version, box_details_str)
            saved_results = llm_function(model_name, saved_prompt, case.filepath, len(boxes_for_llm)) if use_real_llm else llm_function(saved_prompt, len(boxes_for_llm))

            edited_version_obj = DefectVersion(**edited_params)
            edited_prompt = format_prompt(edited_version_obj, box_details_str)
            edited_results = llm_function(model_name, edited_prompt, case.filepath, len(boxes_for_llm)) if use_real_llm else llm_function(edited_prompt, len(boxes_for_llm))

            result = {
                'saved_version_results': saved_results,
                'edited_version_results': edited_results,
                'prompt_used': {'saved': saved_prompt, 'edited': edited_prompt}
            }
            TASKS[task_id]['status'] = 'COMPLETE'
            TASKS[task_id]['result'] = result
        except Exception as e:
            print(f"--- TASK FAILED: {task_id}, Error: {e} ---")
            TASKS[task_id]['status'] = 'ERROR'
            TASKS[task_id]['error'] = str(e)


@task_bp.route('/compare', methods=['POST'])
def run_comparison():
    """启动比较任务"""
    from flask import current_app

    data = request.json
    if not all([data.get('saved_version_id'), data.get('edited_params'), data.get('test_case_id')]):
        return jsonify({'error': 'Missing required parameters for comparison'}), 400

    task_id = str(uuid.uuid4())
    TASKS[task_id] = {'status': 'PENDING'}

    thread = threading.Thread(target=_run_comparison_task, args=(task_id, data, current_app.app_context()))
    thread.start()

    return jsonify({'task_id': task_id})


@task_bp.route('/task/<task_id>', methods=['GET'])
def get_task_status(task_id):
    """获取任务状态"""
    task = TASKS.get(task_id)
    if not task:
        return jsonify({'error': 'Task not found'}), 404
    return jsonify(task)


@task_bp.route('/regression_test', methods=['POST'])
def run_regression_test():
    """执行回归测试"""
    data = request.json
    version_id = data.get('version_id')
    use_real_llm = data.get('use_real_llm', False)
    model_name = data.get('model_name', 'Pro/Qwen/Qwen2.5-VL-7B-Instruct')

    if not version_id:
        return jsonify({'error': 'Missing version_id'}), 400

    defect_version = DefectVersion.query.get_or_404(version_id)
    test_cases = TestCase.query.filter_by(defect_id=defect_version.defect_id).all()

    llm_function = run_real_llm if use_real_llm else run_mock_llm
    all_results = []

    # 准确率统计
    total_cases = 0
    correct_predictions = 0
    tp = 0  # True Positive
    tn = 0  # True Negative
    fp = 0  # False Positive
    fn = 0  # False Negative
    positive_count = 0
    negative_count = 0

    for case in test_cases:
        if not case.bounding_boxes:
            continue

        box_details_str = "ID|归一化坐标|标签|置信度\n---|---|---|---\n"
        boxes_for_llm = []
        for i, bbox in enumerate(case.bounding_boxes):
            norm_box = [bbox.norm_x_min, bbox.norm_y_min, bbox.norm_x_max, bbox.norm_y_max]
            boxes_for_llm.append(norm_box)
            box_details_str += f"{i}|[{norm_box[0]},{norm_box[1]},{norm_box[2]},{norm_box[3]}]|{defect_version.defect.name}|0.99\n"

        full_prompt = format_prompt(defect_version, box_details_str)
        results = llm_function(model_name, full_prompt, case.filepath, len(boxes_for_llm)) if use_real_llm else llm_function(full_prompt, len(boxes_for_llm))

        # 计算准确率
        total_cases += 1
        is_positive = case.is_positive

        predicted_status = results[0]['status'] if results else 'E'

        if is_positive:
            positive_count += 1
            if predicted_status == 'Y':
                tp += 1
                correct_predictions += 1
                prediction_result = 'correct'
            elif predicted_status == 'N':
                fn += 1
                prediction_result = 'wrong'
            else:
                prediction_result = 'error'
        else:
            negative_count += 1
            if predicted_status == 'N':
                tn += 1
                correct_predictions += 1
                prediction_result = 'correct'
            elif predicted_status == 'Y':
                fp += 1
                prediction_result = 'wrong'
            else:
                prediction_result = 'error'

        all_results.append({
            'test_case_id': case.id,
            'filename': case.filename,
            'is_positive': is_positive,
            'expected': 'Y' if is_positive else 'N',
            'predicted': predicted_status,
            'result': prediction_result,
            'results': results
        })

    # 计算准确率
    accuracy = (correct_predictions / total_cases * 100) if total_cases > 0 else 0
    positive_accuracy = (tp / positive_count * 100) if positive_count > 0 else 0
    negative_accuracy = (tn / negative_count * 100) if negative_count > 0 else 0

    return jsonify({
        'summary': {
            'total_cases': total_cases,
            'correct_predictions': correct_predictions,
            'accuracy': round(accuracy, 1),
            'positive_count': positive_count,
            'negative_count': negative_count,
            'positive_accuracy': round(positive_accuracy, 1),
            'negative_accuracy': round(negative_accuracy, 1),
            'tp': tp,
            'tn': tn,
            'fp': fp,
            'fn': fn
        },
        'details': all_results
    })