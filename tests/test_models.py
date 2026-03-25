"""数据库模型单元测试"""
import pytest
from src.backend.database import (
    db, LLMConfig, Trueno3Config, GlobalPromptTemplate,
    Defect, DefectVersion, TestCase, BoundingBox, TestResult
)


class TestLLMConfig:
    """LLM配置模型测试"""
    
    def test_create_llm_config(self, app):
        """测试创建LLM配置"""
        with app.app_context():
            config = LLMConfig(
                api_key='test_key',
                api_url='https://api.test.com',
                default_model='test-model',
                temperature=0.5,
                max_tokens=500
            )
            db.session.add(config)
            db.session.commit()
            
            # 验证
            retrieved = LLMConfig.query.first()
            assert retrieved is not None
            assert retrieved.api_key == 'test_key'
            assert retrieved.default_model == 'test-model'
            assert retrieved.temperature == 0.5
            assert retrieved.max_tokens == 500
    
    def test_llm_config_defaults(self, app):
        """测试默认值的正确性"""
        with app.app_context():
            config = LLMConfig()
            db.session.add(config)
            db.session.commit()
            
            retrieved = LLMConfig.query.first()
            assert retrieved.api_url == 'https://api.siliconflow.cn/v1/chat/completions'
            assert retrieved.default_model == 'Pro/Qwen/Qwen2.5-VL-7B-Instruct'
            assert retrieved.temperature == 0.7
            assert retrieved.max_tokens == 1000
    
    def test_llm_config_to_dict(self, app):
        """测试序列化方法"""
        with app.app_context():
            config = LLMConfig(api_key='key123', temperature=0.8)
            db.session.add(config)
            db.session.commit()
            
            result = config.to_dict()
            assert result['api_key'] == 'key123'
            assert result['temperature'] == 0.8
            assert 'id' in result
            assert 'updated_at' in result


class TestTrueno3Config:
    """Trueno3配置模型测试"""
    
    def test_create_trueno3_config(self, app):
        """测试创建Trueno3配置"""
        with app.app_context():
            config = Trueno3Config(
                enabled=True,
                code_path='/test/path',
                ssh_host='192.168.1.1',
                ssh_port=22,
                ssh_username='testuser',
                ssh_password='testpass'
            )
            db.session.add(config)
            db.session.commit()
            
            retrieved = Trueno3Config.query.first()
            assert retrieved.enabled is True
            assert retrieved.ssh_host == '192.168.1.1'
            assert retrieved.ssh_port == 22
    
    def test_trueno3_config_to_dict(self, app):
        """测试序列化"""
        with app.app_context():
            config = Trueno3Config(ssh_host='example.com')
            db.session.add(config)
            db.session.commit()
            
            result = config.to_dict()
            assert result['ssh_host'] == 'example.com'
            assert result['enabled'] is False  # 默认值


class TestGlobalPromptTemplate:
    """全局提示词模板测试"""
    
    def test_create_template(self, app):
        """测试创建模板"""
        with app.app_context():
            template = GlobalPromptTemplate(
                name='test_template',
                template_text='Hello {defect_cn}'
            )
            db.session.add(template)
            db.session.commit()
            
            retrieved = GlobalPromptTemplate.query.first()
            assert retrieved.name == 'test_template'
            assert retrieved.template_text == 'Hello {defect_cn}'


class TestDefect:
    """缺陷模型测试"""
    
    def test_create_defect(self, app):
        """测试创建缺陷"""
        with app.app_context():
            defect = Defect(name='hand_phone')
            db.session.add(defect)
            db.session.commit()
            
            retrieved = Defect.query.first()
            assert retrieved.name == 'hand_phone'
            assert retrieved.created_at is not None
    
    def test_defect_unique_name(self, app):
        """测试缺陷名称唯一性"""
        with app.app_context():
            defect1 = Defect(name='unique_defect')
            db.session.add(defect1)
            db.session.commit()
            
            # 尝试创建同名缺陷应失败
            defect2 = Defect(name='unique_defect')
            db.session.add(defect2)
            with pytest.raises(Exception):  # SQLAlchemy会抛出IntegrityError
                db.session.commit()
    
    def test_defect_to_dict(self, app):
        """测试序列化"""
        with app.app_context():
            defect = Defect(name='test_defect')
            db.session.add(defect)
            db.session.commit()
            
            # 创建版本以避免 get_latest_version 返回 None
            version = DefectVersion(
                defect_id=defect.id,
                version=1,
                defect_cn='测试缺陷'
            )
            db.session.add(version)
            db.session.commit()
            
            result = defect.to_dict()
            assert result['name'] == 'test_defect'
            assert 'defect_cn' in result


class TestDefectVersion:
    """缺陷版本模型测试"""
    
    def test_create_defect_version(self, app):
        """测试创建缺陷版本"""
        with app.app_context():
            # 先创建缺陷
            defect = Defect(name='screen_crack')
            db.session.add(defect)
            db.session.commit()
            
            version = DefectVersion(
                defect_id=defect.id,
                version=1,
                defect_cn='屏幕裂纹',
                defect_class='外观缺陷',
                judgment_points='检查屏幕是否有裂纹',
                exclusions='保护膜裂纹',
                modifier='tester',
                summary='初始版本'
            )
            db.session.add(version)
            db.session.commit()
            
            retrieved = DefectVersion.query.first()
            assert retrieved.defect_cn == '屏幕裂纹'
            assert retrieved.version == 1
            assert retrieved.modifier == 'tester'
    
    def test_defect_version_to_dict(self, app):
        """测试序列化"""
        with app.app_context():
            defect = Defect(name='test')
            db.session.add(defect)
            db.session.commit()
            
            version = DefectVersion(
                defect_id=defect.id,
                version=1,
                defect_cn='Test',
                judgment_points='Test points',
                exclusions='Exclusions'
            )
            db.session.add(version)
            db.session.commit()
            
            result = version.to_dict()
            assert result['defect_cn'] == 'Test'
            assert result['version'] == 1
            assert 'created_at' in result


class TestTestCase:
    """测试用例模型测试"""
    
    def test_create_test_case(self, app):
        """测试创建测试用例"""
        with app.app_context():
            defect = Defect(name='test_defect')
            db.session.add(defect)
            db.session.commit()
            
            test_case = TestCase(
                defect_id=defect.id,
                filename='test.jpg',
                filepath='/uploads/test.jpg',
                is_positive=True
            )
            db.session.add(test_case)
            db.session.commit()
            
            retrieved = TestCase.query.first()
            assert retrieved.filename == 'test.jpg'
            assert retrieved.is_positive is True
    
    def test_test_case_cascade_delete(self, app):
        """测试级联删除"""
        with app.app_context():
            defect = Defect(name='cascade_test')
            db.session.add(defect)
            db.session.commit()
            
            # 创建测试用例
            test_case = TestCase(
                defect_id=defect.id,
                filename='test.jpg',
                filepath='/uploads/test.jpg'
            )
            db.session.add(test_case)
            db.session.commit()
            test_case_id = test_case.id
            
            # 添加标注框
            bbox = BoundingBox(
                test_case_id=test_case_id,
                norm_x_min=100,
                norm_y_min=100,
                norm_x_max=400,
                norm_y_max=400
            )
            db.session.add(bbox)
            db.session.commit()
            
            # 验证标注框存在
            assert BoundingBox.query.filter_by(test_case_id=test_case_id).count() == 1
            
            # 删除测试用例
            db.session.delete(test_case)
            db.session.commit()
            
            # 验证标注框也被级联删除
            assert BoundingBox.query.filter_by(test_case_id=test_case_id).count() == 0
    
    def test_test_case_to_dict(self, app):
        """测试序列化"""
        with app.app_context():
            defect = Defect(name='to_dict_test')
            db.session.add(defect)
            db.session.commit()
            
            test_case = TestCase(
                defect_id=defect.id,
                filename='test.jpg',
                filepath='/path/test.jpg',
                is_positive=False
            )
            db.session.add(test_case)
            db.session.commit()
            
            result = test_case.to_dict()
            assert result['filename'] == 'test.jpg'
            assert result['is_positive'] is False
            assert 'bounding_boxes' in result


class TestBoundingBox:
    """标注框模型测试"""
    
    def test_create_bounding_box(self, app):
        """测试创建标注框"""
        with app.app_context():
            defect = Defect(name='box_test')
            db.session.add(defect)
            db.session.commit()
            
            test_case = TestCase(
                defect_id=defect.id,
                filename='test.jpg',
                filepath='/test.jpg'
            )
            db.session.add(test_case)
            db.session.commit()
            
            bbox = BoundingBox(
                test_case_id=test_case.id,
                norm_x_min=100,
                norm_y_min=200,
                norm_x_max=500,
                norm_y_max=600
            )
            db.session.add(bbox)
            db.session.commit()
            
            retrieved = BoundingBox.query.first()
            assert retrieved.norm_x_min == 100
            assert retrieved.norm_y_max == 600
    
    def test_bounding_box_to_dict(self, app):
        """测试序列化"""
        with app.app_context():
            defect = Defect(name='dict_test')
            db.session.add(defect)
            db.session.commit()
            
            test_case = TestCase(
                defect_id=defect.id,
                filename='test.jpg',
                filepath='/test.jpg'
            )
            db.session.add(test_case)
            db.session.commit()
            
            bbox = BoundingBox(
                test_case_id=test_case.id,
                norm_x_min=10,
                norm_y_min=20,
                norm_x_max=30,
                norm_y_max=40
            )
            db.session.add(bbox)
            db.session.commit()
            
            result = bbox.to_dict()
            assert result['norm_box'] == [10, 20, 30, 40]


class TestTestResult:
    """测试结果模型测试"""
    
    def test_create_test_result(self, app):
        """测试创建测试结果"""
        with app.app_context():
            # 创建缺陷和版本
            defect = Defect(name='result_test')
            db.session.add(defect)
            db.session.commit()
            
            version = DefectVersion(
                defect_id=defect.id,
                version=1,
                defect_cn='Test'
            )
            db.session.add(version)
            db.session.commit()
            
            # 创建测试用例
            test_case = TestCase(
                defect_id=defect.id,
                filename='test.jpg',
                filepath='/test.jpg'
            )
            db.session.add(test_case)
            db.session.commit()
            
            # 创建测试结果
            result = TestResult(
                defect_version_id=version.id,
                test_case_id=test_case.id,
                result_json='{"status": "Y", "reason": "OK"}'
            )
            db.session.add(result)
            db.session.commit()
            
            retrieved = TestResult.query.first()
            assert retrieved.result_json == '{"status": "Y", "reason": "OK"}'
    
    def test_test_result_to_dict(self, app):
        """测试序列化"""
        with app.app_context():
            defect = Defect(name='to_dict_result')
            db.session.add(defect)
            db.session.commit()
            
            version = DefectVersion(defect_id=defect.id, version=1, defect_cn='T')
            db.session.add(version)
            db.session.commit()
            
            test_case = TestCase(defect_id=defect.id, filename='t.jpg', filepath='/t.jpg')
            db.session.add(test_case)
            db.session.commit()
            
            result = TestResult(
                defect_version_id=version.id,
                test_case_id=test_case.id,
                result_json='{}'
            )
            db.session.add(result)
            db.session.commit()
            
            data = result.to_dict()
            assert 'defect_version_id' in data
            assert 'test_case_id' in data
            assert 'created_at' in data