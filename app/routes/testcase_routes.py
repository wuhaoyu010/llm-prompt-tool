"""
测试用例路由

处理测试用例相关的 API 端点：
- 测试用例的增删改查
- 标注框管理
"""

import os
import json
from flask import Blueprint, request, jsonify
from werkzeug.utils import secure_filename

from ..database import db, TestCase, BoundingBox
from ..services.image_service import create_preview_image, delete_preview_image

testcase_bp = Blueprint('testcase', __name__, url_prefix='/api')


@testcase_bp.route('/testcase', methods=['POST'])
def add_test_case():
    """添加测试用例"""
    from flask import current_app

    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400

    file = request.files['file']
    defect_id = request.form.get('defect_id')
    boxes_json = request.form.get('boxes')
    is_positive = request.form.get('is_positive', 'true').lower() == 'true'

    if not all([file, defect_id, boxes_json]):
        return jsonify({'error': 'Missing file, defect_id or boxes'}), 400

    filename = secure_filename(file.filename)
    filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
    file.save(filepath)

    new_case = TestCase(defect_id=defect_id, filename=filename, filepath=filepath, is_positive=is_positive)
    db.session.add(new_case)
    db.session.commit()

    boxes = json.loads(boxes_json)
    for box in boxes:
        new_bbox = BoundingBox(
            test_case_id=new_case.id,
            norm_x_min=box[0], norm_y_min=box[1],
            norm_x_max=box[2], norm_y_max=box[3]
        )
        db.session.add(new_bbox)

    db.session.commit()
    return jsonify(new_case.to_dict()), 201


@testcase_bp.route('/testcase/<int:test_case_id>/boxes', methods=['GET', 'PUT'])
def handle_test_case_boxes(test_case_id):
    """获取或更新测试用例的标注框"""
    from flask import current_app

    if request.method == 'GET':
        boxes = BoundingBox.query.filter_by(test_case_id=test_case_id).all()
        return jsonify([b.to_dict() for b in boxes])

    # PUT: 更新标注框
    data = request.json
    boxes_data = data.get('boxes', [])

    # 删除旧的标注框
    BoundingBox.query.filter_by(test_case_id=test_case_id).delete()

    # 添加新的标注框
    for box in boxes_data:
        new_box = BoundingBox(
            test_case_id=test_case_id,
            norm_x_min=box[0],
            norm_y_min=box[1],
            norm_x_max=box[2],
            norm_y_max=box[3]
        )
        db.session.add(new_box)

    # 删除旧的预览图
    case = TestCase.query.get(test_case_id)
    if case:
        delete_preview_image(test_case_id, case.filepath, current_app.config['UPLOAD_FOLDER'])

    db.session.commit()
    return jsonify({'success': True})


@testcase_bp.route('/testcase/<int:test_case_id>', methods=['DELETE'])
def delete_test_case(test_case_id):
    """删除测试用例"""
    from flask import current_app

    case = TestCase.query.get_or_404(test_case_id)
    BoundingBox.query.filter_by(test_case_id=case.id).delete()

    try:
        if os.path.exists(case.filepath):
            os.remove(case.filepath)
        delete_preview_image(case.id, case.filepath, current_app.config['UPLOAD_FOLDER'])
    except OSError as e:
        print(f"Error deleting files for test case {case.id}: {e}")

    db.session.delete(case)
    db.session.commit()
    return jsonify({'success': True, 'message': 'Test case deleted'})


@testcase_bp.route('/testcase/<int:test_case_id>/type', methods=['PUT'])
def update_test_case_type(test_case_id):
    """更新测试用例类型（正例/反例）"""
    case = TestCase.query.get_or_404(test_case_id)
    data = request.get_json() or {}
    is_positive = data.get('is_positive', True)

    case.is_positive = is_positive
    db.session.commit()

    return jsonify({'success': True, 'message': f'测试用例已更新为{"正例" if is_positive else "反例"}'})