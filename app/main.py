
import os
import json
import requests
import uuid
import threading
import paramiko
import re
from flask import Flask, request, jsonify, render_template, send_from_directory
from werkzeug.utils import secure_filename
from .database import db, init_db, GlobalPromptTemplate, LLMConfig, Trueno3Config, Defect, DefectVersion, TestCase, BoundingBox, TestResult
from PIL import Image, ImageDraw

# --- App Initialization ---
def create_app():
    app = Flask(__name__, template_folder='templates', static_folder='static')
    app.config['SQLALCHEMY_DATABASE_URI'] = f"sqlite:///{os.path.join(os.path.dirname(os.path.abspath(__file__)), 'prompt_tool_v2.db')}"
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['UPLOAD_FOLDER'] = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
    app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024

    if not os.path.exists(app.config['UPLOAD_FOLDER']):
        os.makedirs(app.config['UPLOAD_FOLDER'])
    preview_folder = os.path.join(app.config['UPLOAD_FOLDER'], 'previews')
    if not os.path.exists(preview_folder):
        os.makedirs(preview_folder)

    db.init_app(app)
    return app

app = create_app()
TASKS = {}

# --- Helper Functions ---

def create_preview_image(test_case):
    try:
        original_path = test_case.filepath
        if not os.path.exists(original_path):
            return None

        preview_dir = os.path.join(app.config['UPLOAD_FOLDER'], 'previews')
        preview_filename = f"preview_{test_case.id}_{os.path.basename(original_path)}"
        preview_path = os.path.join(preview_dir, preview_filename)

        if os.path.exists(preview_path):
            return f"uploads/previews/{preview_filename}"

        with Image.open(original_path) as img:
            draw = ImageDraw.Draw(img)
            img_width, img_height = img.size

            for box in test_case.bounding_boxes:
                x_min = box.norm_x_min / 999 * img_width
                y_min = box.norm_y_min / 999 * img_height
                x_max = box.norm_x_max / 999 * img_width
                y_max = box.norm_y_max / 999 * img_height
                draw.rectangle([x_min, y_min, x_max, y_max], outline="red", width=3)
            
            img.save(preview_path)
        
        return f"uploads/previews/{preview_filename}"
    except Exception as e:
        print(f"Error creating preview for test case {test_case.id}: {e}")
        return None

def format_prompt(defect_version, boxes_str):
    template = GlobalPromptTemplate.query.first().template_text
    return template.format(
        defect_cn=defect_version.defect_cn,
        defect_class=defect_version.defect_class,
        judgment_points=defect_version.judgment_points,
        exclusions=defect_version.exclusions,
        box_details=boxes_str
    )

def test_ssh_connection(config):
    """测试SSH连接"""
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
    """更新Trueno3的defect_definitions.py文件"""
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
            # 找到DEFECT_CLASSES = { 后的位置
            match = re.search(r'(DEFECT_CLASSES\s*=\s*\{)', content)
            if match:
                insert_pos = match.end()
                # 检查是否需要添加逗号
                next_char = content[insert_pos:insert_pos+1]
                if next_char.strip() and next_char != '}':
                    new_defect_entry = ',\n' + new_defect_entry
                content = content[:insert_pos] + '\n' + new_defect_entry + content[insert_pos:]
            else:
                # 如果没有DEFECT_CLASSES，添加它
                content += f'\nDEFECT_CLASSES = {{\n{new_defect_entry}\n}}\n'
        
        # 写回文件
        with sftp.file(file_path, 'w') as f:
            f.write(content.encode('utf-8'))
        
        sftp.close()
        client.close()
        
        return {'success': True, 'message': f'成功更新缺陷定义: {defect_name}'}
    except Exception as e:
        return {'success': False, 'error': f'更新失败: {str(e)}'}

def run_real_llm(model_name, formatted_prompt, image_path, boxes_count):
    # 从数据库获取LLM配置
    config = LLMConfig.query.first()
    if not config or not config.api_key:
        return [{
            "box_id": i,
            "status": "E",
            "reason": "API Key 未配置，请在系统设置中配置"
        } for i in range(boxes_count)]
    
    api_key = config.api_key
    api_url = config.api_url or "https://api.siliconflow.cn/v1/chat/completions"
    temperature = config.temperature if config.temperature is not None else 0.7
    max_tokens = config.max_tokens if config.max_tokens is not None else 1000
    
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    
    import base64
    try:
        with open(image_path, "rb") as image_file:
            image_base64 = base64.b64encode(image_file.read()).decode('utf-8')
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
            results = [{
                "box_id": i,
                "status": "E",
                "reason": f"API返回格式错误: {content_str}"
            } for i in range(boxes_count)]
        return results
    except requests.exceptions.RequestException as e:
        return [{
            "box_id": i,
            "status": "E",
            "reason": f"API请求失败: {e}"
        } for i in range(boxes_count)]

def run_mock_llm(formatted_prompt, boxes_count):
    import time
    time.sleep(2)
    return [{
        "box_id": i,
        "status": "Y",
        "reason": "模拟结果：检测到缺陷"
    } for i in range(boxes_count)]

# --- Routes ---
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/uploads/<path:filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)


# --- API Endpoints ---

@app.route('/api/global_template', methods=['GET', 'POST'])
def handle_global_template():
    template = GlobalPromptTemplate.query.first()
    if request.method == 'POST':
        data = request.json
        template.template_text = data.get('template_text', template.template_text)
        db.session.commit()
        return jsonify(template.to_dict())
    return jsonify(template.to_dict())

@app.route('/api/llm_config', methods=['GET', 'POST'])
def handle_llm_config():
    """获取或更新大模型配置"""
    config = LLMConfig.query.first()
    if not config:
        config = LLMConfig(
            api_key='',
            api_url='https://api.siliconflow.cn/v1/chat/completions',
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

@app.route('/api/trueno3_config', methods=['GET', 'POST'])
def handle_trueno3_config():
    """获取或更新Trueno3配置"""
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

@app.route('/api/trueno3_test', methods=['POST'])
def test_trueno3_connection():
    """测试Trueno3 SSH连接（使用传入的配置或数据库配置）"""
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
        
        # 尝试SSH连接
        result = test_ssh_connection(config)
        return jsonify(result)
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/defects', methods=['GET'])
def get_defects():
    defects = Defect.query.order_by(Defect.created_at.desc()).all()
    return jsonify([d.to_dict() for d in defects])

@app.route('/api/defect', methods=['POST'])
def create_defect():
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

@app.route('/api/defect/<int:defect_id>', methods=['GET'])
def get_defect_details(defect_id):
    defect = Defect.query.get_or_404(defect_id)
    versions = DefectVersion.query.filter_by(defect_id=defect.id).order_by(DefectVersion.version.desc()).all()
    test_cases = TestCase.query.filter_by(defect_id=defect.id).order_by(TestCase.created_at.desc()).all()
    
    test_cases_data = []
    for tc in test_cases:
        tc_data = tc.to_dict()
        tc_data['filepath'] = f"uploads/{tc.filename}"
        tc_data['preview_url'] = create_preview_image(tc) or tc_data['filepath']
        test_cases_data.append(tc_data)

    return jsonify({
        'defect': defect.to_dict(),
        'versions': [v.to_dict() for v in versions],
        'test_cases': test_cases_data
    })

@app.route('/api/defect_version', methods=['POST'])
def create_defect_version():
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
    
    # 检查是否需要同步到Trueno3
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

@app.route('/api/testcase', methods=['POST'])
def add_test_case():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    defect_id = request.form.get('defect_id')
    boxes_json = request.form.get('boxes')

    if not all([file, defect_id, boxes_json]):
        return jsonify({'error': 'Missing file, defect_id or boxes'}), 400

    filename = secure_filename(file.filename)
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(filepath)

    new_case = TestCase(defect_id=defect_id, filename=filename, filepath=filepath)
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

@app.route('/api/testcase/<int:test_case_id>/boxes', methods=['GET'])
def get_test_case_boxes(test_case_id):
    boxes = BoundingBox.query.filter_by(test_case_id=test_case_id).all()
    return jsonify([b.to_dict() for b in boxes])

@app.route('/api/testcase/<int:test_case_id>', methods=['DELETE'])
def delete_test_case(test_case_id):
    case = TestCase.query.get_or_404(test_case_id)
    BoundingBox.query.filter_by(test_case_id=case.id).delete()
    try:
        if os.path.exists(case.filepath):
            os.remove(case.filepath)
        preview_dir = os.path.join(app.config['UPLOAD_FOLDER'], 'previews')
        preview_filename = f"preview_{case.id}_{os.path.basename(case.filepath)}"
        preview_path = os.path.join(preview_dir, preview_filename)
        if os.path.exists(preview_path):
            os.remove(preview_path)
    except OSError as e:
        print(f"Error deleting files for test case {case.id}: {e}")
    db.session.delete(case)
    db.session.commit()
    return jsonify({'success': True, 'message': 'Test case deleted'})

# --- Asynchronous Task Handling ---

def _run_comparison_task(task_id, data, app_context):
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

@app.route('/api/compare', methods=['POST'])
def run_comparison():
    data = request.json
    if not all([data.get('saved_version_id'), data.get('edited_params'), data.get('test_case_id')]):
        return jsonify({'error': 'Missing required parameters for comparison'}), 400

    task_id = str(uuid.uuid4())
    TASKS[task_id] = {'status': 'PENDING'}
    
    thread = threading.Thread(target=_run_comparison_task, args=(task_id, data, app.app_context()))
    thread.start()
    
    return jsonify({'task_id': task_id})

@app.route('/api/task/<task_id>', methods=['GET'])
def get_task_status(task_id):
    task = TASKS.get(task_id)
    if not task:
        return jsonify({'error': 'Task not found'}), 404
    return jsonify(task)

@app.route('/api/regression_test', methods=['POST'])
def run_regression_test():
    # This can also be converted to async if needed
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

        all_results.append({
            'test_case_id': case.id,
            'filename': case.filename,
            'results': results
        })

    return jsonify(all_results)


if __name__ == '__main__':
    app.run(debug=False, port=5001)
