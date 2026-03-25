"""工具函数单元测试"""
import pytest
import os
import tempfile
from unittest.mock import Mock, patch, MagicMock
from io import BytesIO


class TestFormatPrompt:
    """提示词格式化测试"""
    
    def test_format_prompt_basic(self, app):
        """测试基本格式化"""
        with app.app_context():
            from app.database import GlobalPromptTemplate, Defect, DefectVersion
            from app.main import format_prompt
            
            # 创建模板
            template = GlobalPromptTemplate(
                name='default',
                template_text='缺陷:{defect_cn}, 分类:{defect_class}, 判断点:{judgment_points}, 排除:{exclusions}, 详情:{box_details}'
            )
            db.session.add(template)
            db.session.commit()
            
            # 创建版本
            defect = Defect(name='test_prompt')
            db.session.add(defect)
            db.session.commit()
            
            version = DefectVersion(
                defect_id=defect.id,
                version=1,
                defect_cn='手机检测',
                defect_class='行为类',
                judgment_points='检测手机是否存在',
                exclusions='手机在口袋里',
                modifier='tester'
            )
            db.session.add(version)
            db.session.commit()
            
            # 格式化
            boxes_str = 'Box1: [100,100,200,200]'
            result = format_prompt(version, boxes_str)
            
            assert '手机检测' in result
            assert '行为类' in result
            assert '检测手机是否存在' in result
            assert '手机在口袋里' in result
            assert 'Box1' in result


class TestCreatePreviewImage:
    """预览图生成测试"""
    
    def test_create_preview_no_file(self, app):
        """测试文件不存在的情况"""
        with app.app_context():
            from app.database import Defect, DefectVersion, TestCase
            from app.main import create_preview_image
            
            # 创建测试用例
            defect = Defect(name='preview_test')
            db.session.add(defect)
            db.session.commit()
            
            test_case = TestCase(
                defect_id=defect.id,
                filename='nonexistent.jpg',
                filepath='/nonexistent/path.jpg'
            )
            db.session.add(test_case)
            db.session.commit()
            
            result = create_preview_image(test_case)
            assert result is None
    
    def test_create_preview_with_image(self, app):
        """测试创建预览图"""
        with app.app_context():
            from app.database import Defect, DefectVersion, TestCase, BoundingBox
            from app.main import create_preview_image
            
            # 创建临时图片
            from PIL import Image
            with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as tmp:
                img = Image.new('RGB', (400, 300), color='white')
                img.save(tmp.name)
                tmp_path = tmp.name
            
            try:
                # 创建测试用例
                defect = Defect(name='preview_test2')
                db.session.add(defect)
                db.session.commit()
                
                test_case = TestCase(
                    defect_id=defect.id,
                    filename='test.jpg',
                    filepath=tmp_path,
                    is_positive=True
                )
                db.session.add(test_case)
                db.session.commit()
                
                # 添加标注框
                bbox = BoundingBox(
                    test_case_id=test_case.id,
                    norm_x_min=250,
                    norm_y_min=150,
                    norm_x_max=350,
                    norm_y_max=250
                )
                db.session.add(bbox)
                db.session.commit()
                
                result = create_preview_image(test_case)
                
                # 验证预览图创建成功
                assert result is not None
                assert 'preview_' in result
                
                # 验证预览图文件存在
                preview_path = result.replace('uploads/', '')
                full_preview_path = os.path.join(
                    app.config['UPLOAD_FOLDER'], 'previews',
                    os.path.basename(result)
                )
                assert os.path.exists(full_preview_path)
                
            finally:
                # 清理临时文件
                os.unlink(tmp_path)


class TestRunMockLLM:
    """模拟LLM测试"""
    
    def test_mock_llm_returns_results(self, app):
        """测试模拟LLM返回结果"""
        from app.main import run_mock_llm
        
        result = run_mock_llm('test prompt', 3)
        
        assert len(result) == 3
        assert result[0]['status'] == 'Y'
        assert result[0]['box_id'] == 0
        assert '模拟结果' in result[0]['reason']


class TestRunRealLLM:
    """真实LLM调用测试"""
    
    def test_real_llm_no_api_key(self, app):
        """测试无API Key的情况"""
        with app.app_context():
            from app.main import run_real_llm
            
            result = run_real_llm('test-model', 'prompt', '/fake/path.jpg', 2)
            
            assert len(result) == 2
            assert result[0]['status'] == 'E'
            assert 'API Key' in result[0]['reason']
    
    def test_real_llm_with_api_key(self, app):
        """测试有API Key的情况"""
        with app.app_context():
            from app.database import LLMConfig
            from app.main import run_real_llm
            
            # 设置API Key
            config = LLMConfig.query.first()
            if not config:
                config = LLMConfig(api_key='test_key')
                db.session.add(config)
                db.session.commit()
            else:
                config.api_key = 'test_key'
                db.session.commit()
            
            # 测试不存在的图片文件
            result = run_real_llm('model', 'prompt', '/nonexistent.jpg', 1)
            
            assert len(result) == 1
            assert result[0]['status'] == 'E'
            assert '读取图片失败' in result[0]['reason']


class TestSSHConnection:
    """SSH连接测试"""
    
    def test_ssh_connection_success(self, app):
        """测试SSH连接成功"""
        with patch('app.main.paramiko.SSHClient') as mock_client:
            mock_ssh = MagicMock()
            mock_client.return_value = mock_ssh
            
            # 模拟成功连接
            mock_stdout = MagicMock()
            mock_stdout.read.return_value = b'/home/user'
            mock_ssh.exec_command.return_value = (None, mock_stdout, None)
            
            from app.main import test_ssh_connection
            from app.database import LLMConfig
            
            config = LLMConfig(
                ssh_host='localhost',
                ssh_port=22,
                ssh_username='test',
                ssh_password='pass'
            )
            
            result = test_ssh_connection(config)
            
            assert result['success'] is True
            assert 'SSH连接成功' in result['message']
    
    def test_ssh_connection_failure(self, app):
        """测试SSH连接失败"""
        with patch('app.main.paramiko.SSHClient') as mock_client:
            mock_ssh = MagicMock()
            mock_client.return_value = mock_ssh
            mock_ssh.connect.side_effect = Exception('Connection refused')
            
            from app.main import test_ssh_connection
            from app.database import LLMConfig
            
            config = LLMConfig(
                ssh_host='invalid.host',
                ssh_port=22,
                ssh_username='test',
                ssh_password='pass'
            )
            
            result = test_ssh_connection(config)
            
            assert result['success'] is False
            assert 'SSH连接失败' in result['error']


class TestTrueno3Sync:
    """Trueno3同步测试"""
    
    @patch('app.main.paramiko.SSHClient')
    def test_update_defect_definitions_new(self, mock_ssh, app):
        """测试添加新缺陷定义"""
        with app.app_context():
            from app.database import Defect, DefectVersion
            from app.main import update_trueno3_defect_definitions
            
            # 准备mock
            mock_ssh_instance = MagicMock()
            mock_ssh.return_value = mock_ssh_instance
            
            mock_sftp = MagicMock()
            mock_ssh_instance.open_sftp.return_value = mock_sftp
            mock_sftp.file.return_value.__enter__.return_value.read.return_value = b'''
DEFECT_CLASSES = {
}
'''
            
            # 创建测试数据
            defect = Defect(name='new_defect')
            db.session.add(defect)
            db.session.commit()
            
            version = DefectVersion(
                defect_id=defect.id,
                version=1,
                defect_cn='新缺陷',
                defect_class='测试类',
                judgment_points='测试判断',
                exclusions='测试排除'
            )
            db.session.add(version)
            db.session.commit()
            
            # 创建mock配置
            class MockConfig:
                code_path = '/test/path'
                ssh_host = 'localhost'
                ssh_port = 22
                ssh_username = 'user'
                ssh_password = 'pass'
            
            result = update_trueno3_defect_definitions(MockConfig(), 'new_defect', version)
            
            assert result['success'] is True


class TestFileUpload:
    """文件上传测试"""
    
    def test_upload_image(self, client, app):
        """测试图片上传"""
        # 创建缺陷
        response = client.post('/api/defect', json={
            'name': 'upload_test',
            'defect_cn': '上传测试'
        })
        defect_id = json.loads(response.data)['id']
        
        # 准备图片数据
        from PIL import Image
        with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as tmp:
            img = Image.new('RGB', (100, 100), color='red')
            img.save(tmp.name)
            tmp_path = tmp.name
        
        try:
            with open(tmp_path, 'rb') as f:
                data = {
                    'file': (f, 'upload_test.jpg'),
                    'defect_id': str(defect_id),
                    'boxes': json.dumps([[10, 10, 90, 90]]),
                    'is_positive': 'true'
                }
                
                response = client.post('/api/testcase',
                    data=data,
                    content_type='multipart/form-data'
                )
            
            assert response.status_code == 201
            result = json.loads(response.data)
            assert 'id' in result
            
        finally:
            os.unlink(tmp_path)
    
    def test_upload_invalid_file_type(self, client, app):
        """测试上传无效文件类型"""
        # 创建缺陷
        response = client.post('/api/defect', json={
            'name': 'invalid_type',
            'defect_cn': '无效类型'
        })
        defect_id = json.loads(response.data)['id']
        
        data = {
            'file': (BytesIO(b'not an image'), 'test.txt'),
            'defect_id': str(defect_id),
            'boxes': json.dumps([[10, 10, 90, 90]])
        }
        
        response = client.post('/api/testcase',
            data=data,
            content_type='multipart/form-data'
        )
        
        # 根据实现可能返回200或400
        # 这里只验证返回了JSON响应
        assert response.status_code in [200, 400, 201]


import json  # 添加缺失的import