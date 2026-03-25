"""
缺陷路由

处理缺陷定义相关的 API 端点：
- 缺陷列表、创建、详情
- 缺陷版本管理
- 缺陷导入导出
"""

import re
from flask import Blueprint, request, jsonify

from src.backend.database import db, Defect, DefectVersion, TestCase, Trueno3Config
from src.backend.services.ssh_service import update_trueno3_defect_definitions

defect_bp = Blueprint('defect', __name__, url_prefix='/api')


@defect_bp.route('/defects', methods=['GET'])
def get_defects():
    """获取所有缺陷列表"""
    defects = Defect.query.order_by(Defect.created_at.desc()).all()
    result = []
    for d in defects:
        defect_dict = d.to_dict()
        # 添加测试用例数量
        defect_dict['testcase_count'] = TestCase.query.filter_by(defect_id=d.id).count()
        result.append(defect_dict)
    return jsonify(result)


@defect_bp.route('/defect', methods=['POST'])
def create_defect():
    """创建新缺陷"""
    data = request.json
    name = data.get('name')
    if not name or not data.get('defect_cn'):
        return jsonify({'error': '英文名和中文名是必填项'}), 400

    if Defect.query.filter_by(name=name).first():
        return jsonify({'error': '该缺陷英文名已存在'}), 400

    new_defect = Defect(name=name)
    db.session.add(new_defect)
    db.session.commit()

    new_version = DefectVersion(
        defect_id=new_defect.id,
        version=1,
        defect_cn=data.get('defect_cn'),
        defect_class=data.get('defect_class'),
        judgment_points=data.get('judgment_points'),
        exclusions=data.get('exclusions'),
        modifier=data.get('modifier', 'user'),
        summary=data.get('summary', 'Created')
    )
    db.session.add(new_version)
    db.session.commit()
    return jsonify(new_defect.to_dict()), 201


@defect_bp.route('/defects/batch_import', methods=['POST'])
def batch_import_defects():
    """批量导入缺陷定义 - 支持 Python DEFECT_CLASSES 格式"""
    try:
        data = request.json
        import_text = data.get('import_text', '')

        if not import_text.strip():
            return jsonify({'error': '导入内容不能为空'}), 400

        # 提取字典内容
        dict_match = re.search(r'DEFECT_CLASSES\s*=\s*\{(.+)\}', import_text, re.DOTALL)
        if dict_match:
            dict_content = dict_match.group(1)
        else:
            dict_content = import_text

        # 解析每个缺陷条目
        pattern = r'"([^"]+)"\s*:\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}'
        matches = re.findall(pattern, dict_content, re.DOTALL)

        if not matches:
            return jsonify({'error': '未能解析到有效的缺陷定义，请检查格式'}), 400

        imported = []
        skipped = []
        errors = []

        for name, content in matches:
            try:
                def extract_field(field_name, text):
                    pattern = rf'"{field_name}"\s*:\s*"""([^"]*?)"""|"{field_name}"\s*:\s*"([^"]*)"|"{field_name}"\s*:\s*([^\n,\}}]+)'
                    match = re.search(pattern, text, re.DOTALL)
                    if match:
                        return (match.group(1) or match.group(2) or match.group(3) or '').strip()
                    return ''

                defect_cn = extract_field('defect_cn', content)
                defect_class = extract_field('defect_class', content)
                judgment_points = extract_field('judgment_points', content)
                exclusions = extract_field('exclusions', content)

                if not defect_cn:
                    errors.append(f'{name}: 缺少中文名称')
                    continue

                # 检查是否已存在
                existing = Defect.query.filter_by(name=name).first()
                if existing:
                    skipped.append({'name': name, 'defect_cn': defect_cn, 'reason': '已存在'})
                    continue

                # 创建新缺陷
                new_defect = Defect(name=name)
                db.session.add(new_defect)
                db.session.flush()

                new_version = DefectVersion(
                    defect_id=new_defect.id,
                    version=1,
                    defect_cn=defect_cn,
                    defect_class=defect_class,
                    judgment_points=judgment_points,
                    exclusions=exclusions,
                    modifier='batch_import',
                    summary='批量导入'
                )
                db.session.add(new_version)

                imported.append({
                    'name': name,
                    'defect_cn': defect_cn
                })

            except Exception as e:
                errors.append(f'{name}: {str(e)}')

        db.session.commit()

        return jsonify({
            'success': True,
            'imported': imported,
            'skipped': skipped,
            'errors': errors,
            'summary': {
                'imported_count': len(imported),
                'skipped_count': len(skipped),
                'error_count': len(errors)
            }
        })

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'导入失败: {str(e)}'}), 500


@defect_bp.route('/defects/batch_import_file', methods=['POST'])
def batch_import_defects_file():
    """通过文件批量导入缺陷定义"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': '未上传文件'}), 400

        file = request.files['file']
        if not file.filename:
            return jsonify({'error': '文件名为空'}), 400

        content = file.read().decode('utf-8')
        import_request_data = {'import_text': content}

        # 调用批量导入函数
        from flask import current_app
        with current_app.test_request_context(json=import_request_data):
            result = batch_import_defects()
            return result

    except UnicodeDecodeError:
        return jsonify({'error': '文件编码错误，请使用 UTF-8 编码'}), 400
    except Exception as e:
        return jsonify({'error': f'文件导入失败: {str(e)}'}), 500


@defect_bp.route('/defects/export', methods=['POST'])
def export_defects():
    """导出缺陷定义为 Python 文件格式"""
    try:
        data = request.json
        defect_ids = data.get('defect_ids', [])

        if defect_ids:
            defects = Defect.query.filter(Defect.id.in_(defect_ids)).all()
        else:
            defects = Defect.query.order_by(Defect.name).all()

        if not defects:
            return jsonify({'error': '没有可导出的缺陷'}), 400

        # 生成 Python 代码
        lines = [
            '"""',
            '缺陷类别定义文件',
            '键名需与 prv_config["ability"] 完全匹配',
            '"""',
            '',
            'from .prompt import (',
            '    BATCH_VERIFICATION_PROMPT,',
            '    BASE_VERIFICATION_PROMPT,  # 通用提示词，识别缺陷等是否存在',
            ')',
            '',
            'DEFECT_CLASSES = {'
        ]

        for defect in defects:
            latest_version = defect.get_latest_version()
            if not latest_version:
                continue

            def escape_str(s):
                if not s:
                    return ''
                return s.replace('"""', '\\"\\"\\"').replace('"', '\\"')

            defect_cn = escape_str(latest_version.defect_cn or '')
            defect_class = escape_str(latest_version.defect_class or '')
            judgment_points = (latest_version.judgment_points or '').replace('"""', '\\"\\"\\"')
            exclusions = escape_str(latest_version.exclusions or '')

            lines.append(f'    "{defect.name}": {{')
            lines.append(f'        "defect_cn": "{defect_cn}",')
            lines.append(f'        "defect_class": "{defect_class}",')

            if '\n' in judgment_points:
                lines.append(f'        "judgment_points": """{judgment_points}""",')
            else:
                lines.append(f'        "judgment_points": "{judgment_points}",')

            lines.append(f'        "exclusions": "{exclusions}",')
            lines.append('        "prompt_template_key": BASE_VERIFICATION_PROMPT,')
            lines.append(f'        "label": "{defect.name}",')
            lines.append('        "visual_cues": ""')
            lines.append('    },')

        lines.append('}')

        export_content = '\n'.join(lines)

        return jsonify({
            'success': True,
            'content': export_content,
            'filename': 'defect_definitions.py',
            'count': len(defects)
        })

    except Exception as e:
        return jsonify({'error': f'导出失败: {str(e)}'}), 500


@defect_bp.route('/defect/<int:defect_id>', methods=['GET'])
def get_defect_details(defect_id):
    """获取缺陷详情"""
    from src.backend.services.image_service import create_preview_image
    from flask import current_app
    from src.backend.database import BoundingBox

    defect = Defect.query.get_or_404(defect_id)
    versions = DefectVersion.query.filter_by(defect_id=defect.id).order_by(DefectVersion.version.desc()).all()
    test_cases = TestCase.query.filter_by(defect_id=defect.id).order_by(TestCase.created_at.desc()).all()

    test_cases_data = []
    for tc in test_cases:
        tc_data = tc.to_dict()
        tc_data['filepath'] = f"uploads/{tc.filename}"
        tc_data['preview_url'] = create_preview_image(tc, current_app.config['UPLOAD_FOLDER']) or tc_data['filepath']
        # 添加标注框数量
        tc_data['annotation_count'] = BoundingBox.query.filter_by(test_case_id=tc.id).count()
        test_cases_data.append(tc_data)

    return jsonify({
        'defect': defect.to_dict(),
        'versions': [v.to_dict() for v in versions],
        'test_cases': test_cases_data
    })


@defect_bp.route('/defect_version', methods=['POST'])
def create_defect_version():
    """创建新缺陷版本"""
    data = request.json
    defect_id = data.get('defect_id')
    if not defect_id:
        return jsonify({'error': 'defect_id is required'}), 400

    max_version = db.session.query(db.func.max(DefectVersion.version)).filter_by(defect_id=defect_id).scalar() or 0

    new_version = DefectVersion(
        defect_id=defect_id,
        version=max_version + 1,
        defect_cn=data.get('defect_cn'),
        defect_class=data.get('defect_class'),
        judgment_points=data.get('judgment_points'),
        exclusions=data.get('exclusions'),
        modifier=data.get('modifier', 'user'),
        summary=data.get('summary', 'Updated')
    )
    db.session.add(new_version)
    db.session.commit()

    # 检查是否需要同步到 Trueno3
    trueno3_config = Trueno3Config.query.first()
    trueno3_sync_result = None
    if trueno3_config and trueno3_config.enabled:
        defect = Defect.query.get(defect_id)
        if defect:
            trueno3_sync_result = update_trueno3_defect_definitions(trueno3_config, defect.name, new_version)

    response = new_version.to_dict()
    if trueno3_sync_result:
        response['trueno3_sync'] = trueno3_sync_result

    return jsonify(response), 201


@defect_bp.route('/defect_version/<int:version_id>', methods=['PUT'])
def update_defect_version(version_id):
    """更新当前版本内容（不创建新版本）"""
    version = DefectVersion.query.get_or_404(version_id)
    data = request.json

    if 'defect_cn' in data:
        version.defect_cn = data['defect_cn']
    if 'defect_class' in data:
        version.defect_class = data['defect_class']
    if 'judgment_points' in data:
        version.judgment_points = data['judgment_points']
    if 'exclusions' in data:
        version.exclusions = data['exclusions']

    version.modifier = data.get('modifier', 'user')
    db.session.commit()

    # 检查是否需要同步到 Trueno3
    trueno3_config = Trueno3Config.query.first()
    trueno3_sync_result = None
    if trueno3_config and trueno3_config.enabled:
        defect = Defect.query.get(version.defect_id)
        if defect:
            trueno3_sync_result = update_trueno3_defect_definitions(trueno3_config, defect.name, version)

    response = version.to_dict()
    if trueno3_sync_result:
        response['trueno3_sync'] = trueno3_sync_result

    return jsonify(response)


@defect_bp.route('/defect/<int:defect_id>/inference', methods=['POST'])
def run_defect_inference(defect_id):
    """对单个测试用例进行实时推理"""
    from flask import current_app
    from src.backend.services.image_service import create_preview_image
    from src.backend.services.llm_service import run_real_llm, run_mock_llm, format_prompt

    defect = Defect.query.get_or_404(defect_id)
    data = request.json
    test_case_id = data.get('test_case_id')
    use_real_llm = data.get('use_real_llm', False)
    model_name = data.get('model', 'Pro/Qwen/Qwen2.5-VL-7B-Instruct')

    if not test_case_id:
        return jsonify({'error': 'test_case_id is required'}), 400

    test_case = TestCase.query.get_or_404(test_case_id)
    if not test_case.bounding_boxes:
        return jsonify({'error': 'Test case has no bounding boxes'}), 400

    version_id = data.get('version_id')
    if version_id:
        defect_version = DefectVersion.query.get(version_id)
    else:
        defect_version = DefectVersion.query.filter_by(defect_id=defect_id).order_by(DefectVersion.version.desc()).first()

    if not defect_version:
        return jsonify({'error': 'No version found for this defect'}), 404

    box_details_str = "ID|归一化坐标|标签|置信度\n---|---|---|---\n"
    boxes_for_llm = []
    for i, bbox in enumerate(test_case.bounding_boxes):
        norm_box = [bbox.norm_x_min, bbox.norm_y_min, bbox.norm_x_max, bbox.norm_y_max]
        boxes_for_llm.append(norm_box)
        box_details_str += f"{i}|[{norm_box[0]},{norm_box[1]},{norm_box[2]},{norm_box[3]}]|{defect.name}|0.99\n"

    prompt = format_prompt(defect_version, box_details_str)
    llm_function = run_real_llm if use_real_llm else run_mock_llm
    results = llm_function(model_name, prompt, test_case.filepath, len(boxes_for_llm)) if use_real_llm else llm_function(prompt, len(boxes_for_llm))

    preview_url = create_preview_image(test_case, current_app.config['UPLOAD_FOLDER'])

    return jsonify({
        'result': results[0] if results else {'status': 'E', 'message': 'No results'},
        'raw_response': results,
        'prompt_used': prompt,
        'test_case': {
            'id': test_case.id,
            'filename': test_case.filename,
            'preview_url': preview_url or f"uploads/{test_case.filename}"
        },
        'version': defect_version.to_dict()
    })
