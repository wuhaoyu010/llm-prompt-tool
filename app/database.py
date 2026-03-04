
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
import datetime

db = SQLAlchemy()

# 新增：大模型配置
class LLMConfig(db.Model):
    """大模型API配置"""
    id = db.Column(db.Integer, primary_key=True)
    api_key = db.Column(db.String(500), nullable=False, default='')
    api_url = db.Column(db.String(500), nullable=False, default='https://api.siliconflow.cn/v1/chat/completions')
    default_model = db.Column(db.String(100), nullable=False, default='Pro/Qwen/Qwen2.5-VL-7B-Instruct')
    temperature = db.Column(db.Float, nullable=False, default=0.7)
    max_tokens = db.Column(db.Integer, nullable=False, default=1000)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'api_key': self.api_key,
            'api_url': self.api_url,
            'default_model': self.default_model,
            'temperature': self.temperature,
            'max_tokens': self.max_tokens,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

# 新增：Trueno3 配置
class Trueno3Config(db.Model):
    """Trueno3服务器配置"""
    id = db.Column(db.Integer, primary_key=True)
    enabled = db.Column(db.Boolean, default=False)  # 是否启用自动同步
    code_path = db.Column(db.String(500), nullable=False, default='/home/user/trueno3/src/algorithm/vlm_qwen3_server')
    ssh_host = db.Column(db.String(100), nullable=False, default='')
    ssh_port = db.Column(db.Integer, nullable=False, default=22)
    ssh_username = db.Column(db.String(100), nullable=False, default='')
    ssh_password = db.Column(db.String(100), nullable=False, default='')  # 生产环境应使用密钥
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'enabled': self.enabled,
            'code_path': self.code_path,
            'ssh_host': self.ssh_host,
            'ssh_port': self.ssh_port,
            'ssh_username': self.ssh_username,
            'ssh_password': self.ssh_password,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

# 新增：全局提示词模板
class GlobalPromptTemplate(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False, default='default')
    template_text = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'template_text': self.template_text
        }

class Defect(db.Model):
    """缺陷定义 (基本信息)"""
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False) # 英文名, e.g., hand_phone
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    
    # 关联关系
    versions = db.relationship('DefectVersion', backref='defect', lazy=True, cascade="all, delete-orphan")
    test_cases = db.relationship('TestCase', backref='defect', lazy=True, cascade="all, delete-orphan")

    def to_dict(self):
        latest_version = self.get_latest_version()
        return {
            "id": self.id,
            "name": self.name,
            "defect_cn": latest_version.defect_cn if latest_version else 'N/A',
            "created_at": self.created_at.isoformat()
        }
    
    def get_latest_version(self):
        return DefectVersion.query.filter_by(defect_id=self.id).order_by(DefectVersion.version.desc()).first()

# 原 PromptVersion -> DefectVersion
class DefectVersion(db.Model):
    """缺陷的具体参数版本"""
    id = db.Column(db.Integer, primary_key=True)
    defect_id = db.Column(db.Integer, db.ForeignKey('defect.id'), nullable=False)
    version = db.Column(db.Integer, nullable=False)
    
    # 版本化的参数
    defect_cn = db.Column(db.String(100), nullable=False)
    defect_class = db.Column(db.String(200))
    judgment_points = db.Column(db.Text)
    exclusions = db.Column(db.Text)

    # 历史记录字段
    modifier = db.Column(db.String(100), default='system')
    summary = db.Column(db.String(500), default='Initial version')
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    test_results = db.relationship('TestResult', backref='defect_version', lazy=True, cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "defect_id": self.defect_id,
            "version": self.version,
            "defect_cn": self.defect_cn,
            "defect_class": self.defect_class,
            "judgment_points": self.judgment_points,
            "exclusions": self.exclusions,
            "modifier": self.modifier,
            "summary": self.summary,
            "created_at": self.created_at.isoformat()
        }

# 原 TestImage -> TestCase
class TestCase(db.Model):
    """测试用例 (图片 + 标注)"""
    id = db.Column(db.Integer, primary_key=True)
    defect_id = db.Column(db.Integer, db.ForeignKey('defect.id'), nullable=False)
    filename = db.Column(db.String(200), nullable=False)
    filepath = db.Column(db.String(500), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    bounding_boxes = db.relationship('BoundingBox', backref='test_case', lazy=True, cascade="all, delete-orphan")
    test_results = db.relationship('TestResult', backref='test_case', lazy=True, cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "defect_id": self.defect_id,
            "filename": self.filename,
            "filepath": self.filepath,
            "created_at": self.created_at.isoformat(),
            "bounding_boxes": [bbox.to_dict() for bbox in self.bounding_boxes]
        }

class BoundingBox(db.Model):
    """标注框"""
    id = db.Column(db.Integer, primary_key=True)
    test_case_id = db.Column(db.Integer, db.ForeignKey('test_case.id'), nullable=False)
    # 归一化坐标 [0, 999]
    norm_x_min = db.Column(db.Integer, nullable=False)
    norm_y_min = db.Column(db.Integer, nullable=False)
    norm_x_max = db.Column(db.Integer, nullable=False)
    norm_y_max = db.Column(db.Integer, nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'test_case_id': self.test_case_id,
            'norm_x_min': self.norm_x_min,
            'norm_y_min': self.norm_y_min,
            'norm_x_max': self.norm_x_max,
            'norm_y_max': self.norm_y_max,
        }

    def to_dict(self):
        return {
            "id": self.id,
            "test_case_id": self.test_case_id,
            "norm_box": [self.norm_x_min, self.norm_y_min, self.norm_x_max, self.norm_y_max]
        }

class TestResult(db.Model):
    """测试结果"""
    id = db.Column(db.Integer, primary_key=True)
    defect_version_id = db.Column(db.Integer, db.ForeignKey('defect_version.id'), nullable=False)
    test_case_id = db.Column(db.Integer, db.ForeignKey('test_case.id'), nullable=False)
    result_json = db.Column(db.Text) # 存储LLM返回的JSON结果
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "defect_version_id": self.defect_version_id,
            "test_case_id": self.test_case_id,
            "result_json": self.result_json,
            "created_at": self.created_at.isoformat()
        }

def init_db(app: Flask):
    """初始化数据库"""
    with app.app_context():
        db.create_all()
