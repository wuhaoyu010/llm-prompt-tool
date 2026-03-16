"""
Flask 应用主入口

重构后的精简版本，只负责：
- 应用初始化
- 蓝图注册
- 基础路由
"""

import os
import sys
from flask import Flask, render_template, send_from_directory

from .database import db, init_db, GlobalPromptTemplate, LLMConfig, Trueno3Config
from .services.image_service import ensure_directories
from .utils.api_url import get_data_dir

# 导入蓝图
from .routes.config_routes import config_bp
from .routes.defect_routes import defect_bp
from .routes.testcase_routes import testcase_bp
from .routes.model_routes import model_bp
from .routes.task_routes import task_bp


def create_app():
    """创建并配置 Flask 应用"""
    data_dir = get_data_dir()

    # 模板和静态文件路径（打包后在 _internal 目录）
    if getattr(sys, 'frozen', False):
        template_folder = os.path.join(sys._MEIPASS, 'app', 'templates')
        static_folder = os.path.join(sys._MEIPASS, 'app', 'static')
    else:
        template_folder = 'templates'
        static_folder = 'static'

    app = Flask(__name__, template_folder=template_folder, static_folder=static_folder)
    app.config['SQLALCHEMY_DATABASE_URI'] = f"sqlite:///{os.path.join(data_dir, 'prompt_tool_v2.db')}"
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['UPLOAD_FOLDER'] = os.path.join(data_dir, 'uploads')
    app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024

    # 确保上传目录存在
    ensure_directories(app.config['UPLOAD_FOLDER'])

    db.init_app(app)

    # 初始化数据库表和默认数据
    with app.app_context():
        db.create_all()
        _init_default_data()

    # 注册蓝图
    app.register_blueprint(config_bp)
    app.register_blueprint(defect_bp)
    app.register_blueprint(testcase_bp)
    app.register_blueprint(model_bp)
    app.register_blueprint(task_bp)

    return app


def _init_default_data():
    """初始化默认配置数据"""
    if not LLMConfig.query.first():
        db.session.add(LLMConfig(
            api_key='',
            api_url='https://api.siliconflow.cn',
            default_model='Pro/Qwen/Qwen2.5-VL-7B-Instruct',
            temperature=0.7,
            max_tokens=1000
        ))

    if not Trueno3Config.query.first():
        db.session.add(Trueno3Config(
            enabled=False,
            code_path='/home/user/trueno3/src/algorithm/vlm_qwen3_server',
            ssh_host='',
            ssh_port=22,
            ssh_username='',
            ssh_password=''
        ))

    if not GlobalPromptTemplate.query.first():
        db.session.add(GlobalPromptTemplate(
            name='default',
            template_text='''你是一名只根据图像判断缺陷的视觉专家，**验证**以下归一化坐标的检测框。

【任务】
对**每个输入框**，判断其标注的缺陷是否真实存在。所有坐标已归一化到 [0,999] 范围。请注意：不能根据文字、背景知识或推测回答，只能根据图中可见内容判断。**任意满足一个判断要点即为存在缺陷 {defect_cn}**。

【缺陷定义】
缺陷类别: {defect_cn}
类别说明: {defect_class}
判断要点: {judgment_points}
排除项: {exclusions}

【输入框】（必须逐一验证，不得修改坐标）
{box_details}

【判断准则】
对于每个缺陷框，按以下优先级依次判断：
1. 若图像整体模糊（无法分辨手部是否接触手机）→ 直接返回 U
2. 若推理结果含"疑似""疑似手机""无法确认是否接触手机"→ 返回 U
3. 若满足判断要点任意一条（手部接触手机，无论场景/操作/放置方式）→ 返回 Y（优先级最高，绝对优先）
4. 若未触发判断要点，且满足排除项所有条件（无手机/仅接触非手机物品/手机未被接触）→ 返回 N
5. 若既不满足判断要点也不满足排除项，且图像清晰无遮挡但无法确认 → 返回 U

【输出格式】
- 对每个框，输出验证结果
- **必须包含 reason 字段**，简明说明判断依据（≤20字）
- **不得输出新的bbox_2d**，直接引用输入框
- 每个框: {{"box_id":n,"status":"Y/N/U","reason":"..."}}'''
        ))

    db.session.commit()


# 创建应用实例
app = create_app()


# --- 基础路由 ---

@app.route('/')
def index():
    """首页"""
    return render_template('index.html')


@app.route('/uploads/<path:filename>')
def uploaded_file(filename):
    """上传文件访问"""
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)


if __name__ == '__main__':
    app.run(debug=False, port=5001)