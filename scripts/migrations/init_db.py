import os
from app import create_app
from src.backend.database import db, init_db, GlobalPromptTemplate, LLMConfig, Trueno3Config, Defect, DefectVersion

# 创建一个应用实例用于获取应用上下文
app = create_app()

with app.app_context():
    print("Starting database initialization...")
    
    # 基于已有的数据库文件路径，先删除旧的数据库文件（如果存在）
    db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'app', 'prompt_tool_v2.db')
    if os.path.exists(db_path):
        os.remove(db_path)
        print(f"Removed old database file: {db_path}")

    # 初始化数据库 (创建所有表)
    init_db(app)
    print("Database tables created.")
    
    # 填充默认LLM配置
    if not LLMConfig.query.first():
        default_config = LLMConfig(
            api_key='',
            api_url='https://api.siliconflow.cn/v1/chat/completions',
            default_model='Pro/Qwen/Qwen2.5-VL-7B-Instruct',
            temperature=0.7,
            max_tokens=1000
        )
        db.session.add(default_config)
        db.session.commit()
        print("Default LLM config created.")
    
    # 填充默认Trueno3配置
    if not Trueno3Config.query.first():
        default_trueno3 = Trueno3Config(
            enabled=False,
            code_path='/home/user/trueno3/src/algorithm/vlm_qwen3_server',
            ssh_host='',
            ssh_port=22,
            ssh_username='',
            ssh_password=''
        )
        db.session.add(default_trueno3)
        db.session.commit()
        print("Default Trueno3 config created.")

    # 填充全局模板
    if not GlobalPromptTemplate.query.first():
        default_template = GlobalPromptTemplate(
            name='default',
            template_text="""你是一名只根据图像判断缺陷的视觉专家，**验证**以下归一化坐标的检测框。\n\n【任务】\n对**每个输入框**，判断其标注的缺陷是否真实存在。所有坐标已归一化到 [0,999] 范围。请注意：不能根据文字、背景知识或推测回答，只能根据图中可见内容判断。**任意满足一个判断要点即为存在缺陷 {defect_cn}**。\n\n【缺陷定义】\n缺陷类别: {defect_cn}\n类别说明: {defect_class}\n判断要点: {judgment_points}\n排除项: {exclusions}\n\n【输入框】（必须逐一验证，不得修改坐标）\n{box_details}\n\n【判断准则】\n对于每个缺陷框，按以下优先级依次判断：\n1. 若图像整体模糊（无法分辨手部是否接触手机）→ 直接返回 U\n2. 若推理结果含“疑似”“疑似手机”“无法确认是否接触手机”→ 返回 U\n3. 若满足判断要点任意一条（手部接触手机，无论场景/操作/放置方式）→ 返回 Y（优先级最高，绝对优先）\n4. 若未触发判断要点，且满足排除项所有条件（无手机/仅接触非手机物品/手机未被接触）→ 返回 N\n5. 若既不满足判断要点也不满足排除项，且图像清晰无遮挡但无法确认 → 返回 U\n\n【输出格式】\n- 对每个框，输出验证结果\n- **必须包含 reason 字段**，简明说明判断依据（≤20字）\n- **不得输出新的bbox_2d**，直接引用输入框\n- 每个框: {{"box_id":n,"status":"Y/N/U","reason":"..."}}"""
        )
        db.session.add(default_template)
        db.session.commit()
        print("Default global prompt template created.")

    # 填充初始缺陷数据
    if not Defect.query.filter_by(name='hand_phone').first():
        hand_phone_defect = Defect(name='hand_phone')
        db.session.add(hand_phone_defect)
        db.session.commit()
        print("Initial defect 'hand_phone' created.")
        
        initial_version = DefectVersion(
            defect_id=hand_phone_defect.id,
            version=1,
            defect_cn='玩手机',
            defect_class='作业期间使用手机',
            judgment_points='1. 作业人员手接触手机；2.视线聚焦于手机屏幕；3. 手机贴近耳部（通话状态）',
            exclusions='1. 手机放置于口袋、工具包等未使用状态；2. 视角误差导致的误判（如手持类似形状工具）',
            modifier='system',
            summary='Initial data'
        )
        db.session.add(initial_version)
        db.session.commit()
        print("Initial version for 'hand_phone' created.")

    print("Database initialization complete.")
