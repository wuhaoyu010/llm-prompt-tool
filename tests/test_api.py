"""API路由单元测试"""
import pytest
import json
from io import BytesIO
from app.database import db, LLMConfig, Defect, DefectVersion, TestCase, BoundingBox


class TestGlobalTemplateAPI:
    """全局模板API测试"""
    
    def test_get_global_template(self, client, app):
        """测试获取全局模板"""
        with app.app_context():
            # 创建默认模板
            from app.database import GlobalPromptTemplate
            template = GlobalPromptTemplate(
                name='default',
                template_text='Test template {defect_cn}'
            )
            db.session.add(template)
            db.session.commit()
        
        response = client.get('/api/global_template')
        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'template_text' in data
    
    def test_update_global_template(self, client, app):
        """测试更新全局模板"""
        with app.app_context():
            from app.database import GlobalPromptTemplate
            template = GlobalPromptTemplate(
                name='default',
                template_text='Original'
            )
            db.session.add(template)
            db.session.commit()
        
        new_content = 'Updated template {defect_cn}'
        response = client.post('/api/global_template',
            json={'template_text': new_content},
            content_type='application/json'
        )
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['template_text'] == new_content


class TestLLMConfigAPI:
    """LLM配置API测试"""
    
    def test_get_llm_config(self, client, app):
        """测试获取LLM配置"""
        response = client.get('/api/llm_config')
        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'api_key' in data
        assert 'default_model' in data
    
    def test_update_llm_config(self, client, app):
        """测试更新LLM配置"""
        response = client.post('/api/llm_config', json={
            'api_key': 'test_api_key',
            'temperature': 0.9,
            'max_tokens': 2000
        })
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['api_key'] == 'test_api_key'
        assert data['temperature'] == 0.9
        assert data['max_tokens'] == 2000
    
    def test_partial_update_llm_config(self, client, app):
        """测试部分更新LLM配置"""
        # 只更新 api_url
        response = client.post('/api/llm_config', json={
            'api_url': 'https://custom.api.com'
        })
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['api_url'] == 'https://custom.api.com'
        # 其他字段保持默认值
        assert data['default_model'] == 'Pro/Qwen/Qwen2.5-VL-7B-Instruct'


class TestTrueno3ConfigAPI:
    """Trueno3配置API测试"""
    
    def test_get_trueno3_config(self, client, app):
        """测试获取Trueno3配置"""
        response = client.get('/api/trueno3_config')
        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'enabled' in data
        assert data['enabled'] is False
    
    def test_update_trueno3_config(self, client, app):
        """测试更新Trueno3配置"""
        response = client.post('/api/trueno3_config', json={
            'enabled': True,
            'ssh_host': '192.168.1.100',
            'ssh_port': 2222,
            'ssh_username': 'deploy',
            'ssh_password': 'secret'
        })
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['enabled'] is True
        assert data['ssh_host'] == '192.168.1.100'
        assert data['ssh_port'] == 2222


class TestDefectsAPI:
    """缺陷管理API测试"""
    
    def test_get_defects_empty(self, client, app):
        """测试获取空缺陷列表"""
        response = client.get('/api/defects')
        assert response.status_code == 200
        data = json.loads(response.data)
        assert isinstance(data, list)
        assert len(data) == 0
    
    def test_create_defect(self, client, app):
        """测试创建缺陷"""
        response = client.post('/api/defect', json={
            'name': 'hand_detection',
            'defect_cn': '手持检测',
            'defect_class': '行为识别',
            'judgment_points': '检测是否手持手机',
            'exclusions': '手机在桌面上'
        })
        
        assert response.status_code == 201
        data = json.loads(response.data)
        assert data['name'] == 'hand_detection'
    
    def test_create_defect_missing_required(self, client, app):
        """测试缺少必填字段"""
        response = client.post('/api/defect', json={
            'name': 'missing_field',
            # 缺少 defect_cn
        })
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'error' in data
    
    def test_create_duplicate_defect(self, client, app):
        """测试创建重复缺陷名"""
        # 第一次创建
        client.post('/api/defect', json={
            'name': 'duplicate_test',
            'defect_cn': '重复测试'
        })
        
        # 第二次创建同名的
        response = client.post('/api/defect', json={
            'name': 'duplicate_test',
            'defect_cn': '重复测试2'
        })
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'error' in data
    
    def test_get_defect_details(self, client, app):
        """测试获取缺陷详情"""
        # 先创建缺陷
        create_response = client.post('/api/defect', json={
            'name': 'detail_test',
            'defect_cn': '详情测试',
            'judgment_points': '测试判断点'
        })
        defect_id = json.loads(create_response.data)['id']
        
        # 获取详情
        response = client.get(f'/api/defect/{defect_id}')
        assert response.status_code == 200
        
        data = json.loads(response.data)
        assert 'defect' in data
        assert 'versions' in data
        assert 'test_cases' in data
        assert data['defect']['name'] == 'detail_test'


class TestDefectVersionAPI:
    """缺陷版本API测试"""
    
    def test_create_defect_version(self, client, app):
        """测试创建缺陷版本"""
        # 先创建缺陷
        defect_response = client.post('/api/defect', json={
            'name': 'version_test',
            'defect_cn': '版本测试'
        })
        defect_id = json.loads(defect_response.data)['id']
        
        # 创建版本
        response = client.post('/api/defect_version', json={
            'defect_id': defect_id,
            'defect_cn': '版本测试CN',
            'defect_class': '测试分类',
            'judgment_points': '判断点1',
            'exclusions': '排除项1',
            'summary': '更新了判断点'
        })
        
        assert response.status_code == 201
        data = json.loads(response.data)
        assert data['version'] == 1
        assert data['summary'] == '更新了判断点'
    
    def test_create_second_version(self, client, app):
        """测试创建第二个版本"""
        # 创建缺陷和第一个版本
        defect_response = client.post('/api/defect', json={
            'name': 'multi_version',
            'defect_cn': '多版本测试'
        })
        defect_id = json.loads(defect_response.data)['id']
        
        client.post('/api/defect_version', json={
            'defect_id': defect_id,
            'defect_cn': 'V1',
            'summary': 'Version 1'
        })
        
        # 创建第二个版本
        response = client.post('/api/defect_version', json={
            'defect_id': defect_id,
            'defect_cn': 'V2',
            'summary': 'Version 2'
        })
        
        data = json.loads(response.data)
        assert data['version'] == 2
    
    def test_create_version_missing_defect_id(self, client, app):
        """测试缺少defect_id"""
        response = client.post('/api/defect_version', json={
            'defect_cn': '测试'
        })
        
        assert response.status_code == 400


class TestTestCaseAPI:
    """测试用例API测试"""
    
    def test_add_test_case(self, client, app):
        """测试添加测试用例"""
        # 先创建缺陷
        defect_response = client.post('/api/defect', json={
            'name': 'testcase_add',
            'defect_cn': '添加测试'
        })
        defect_id = json.loads(defect_response.data)['id']
        
        # 准备文件上传
        data = {
            'file': (BytesIO(b'fake image content'), 'test.jpg'),
            'defect_id': str(defect_id),
            'boxes': json.dumps([[100, 100, 300, 300]]),
            'is_positive': 'true'
        }
        
        response = client.post('/api/testcase',
            data=data,
            content_type='multipart/form-data'
        )
        
        assert response.status_code == 201
        result = json.loads(response.data)
        assert 'id' in result
    
    def test_add_test_case_missing_file(self, client, app):
        """测试缺少文件"""
        response = client.post('/api/testcase', data={
            'defect_id': '1',
            'boxes': '[]'
        })
        
        assert response.status_code == 400
    
    def test_delete_test_case(self, client, app):
        """测试删除测试用例"""
        # 先创建缺陷和测试用例
        defect_response = client.post('/api/defect', json={
            'name': 'delete_test',
            'defect_cn': '删除测试'
        })
        defect_id = json.loads(defect_response.data)['id']
        
        # 添加测试用例（使用虚拟文件）
        data = {
            'file': (BytesIO(b'content'), 'delete.jpg'),
            'defect_id': str(defect_id),
            'boxes': json.dumps([[50, 50, 200, 200]]),
            'is_positive': 'true'
        }
        add_response = client.post('/api/testcase', data=data, 
            content_type='multipart/form-data')
        test_case_id = json.loads(add_response.data)['id']
        
        # 删除测试用例
        response = client.delete(f'/api/testcase/{test_case_id}')
        assert response.status_code == 200
        
        # 验证已删除
        from app.database import TestCase
        with app.app_context():
            deleted = TestCase.query.get(test_case_id)
            assert deleted is None
    
    def test_get_boxes(self, client, app):
        """测试获取标注框"""
        # 创建缺陷和测试用例
        defect_response = client.post('/api/defect', json={
            'name': 'boxes_test',
            'defect_cn': '标注框测试'
        })
        defect_id = json.loads(defect_response.data)['id']
        
        data = {
            'file': (BytesIO(b'content'), 'boxes.jpg'),
            'defect_id': str(defect_id),
            'boxes': json.dumps([[10, 20, 30, 40]]),
            'is_positive': 'true'
        }
        add_response = client.post('/api/testcase', data=data,
            content_type='multipart/form-data')
        test_case_id = json.loads(add_response.data)['id']
        
        # 获取标注框
        response = client.get(f'/api/testcase/{test_case_id}/boxes')
        assert response.status_code == 200
        
        boxes = json.loads(response.data)
        assert len(boxes) == 1
        assert boxes[0]['norm_box'] == [10, 20, 30, 40]
    
    def test_update_boxes(self, client, app):
        """测试更新标注框"""
        # 创建测试用例
        defect_response = client.post('/api/defect', json={
            'name': 'update_boxes_test',
            'defect_cn': '更新标注'
        })
        defect_id = json.loads(defect_response.data)['id']
        
        data = {
            'file': (BytesIO(b'content'), 'update.jpg'),
            'defect_id': str(defect_id),
            'boxes': json.dumps([[100, 100, 200, 200]]),
            'is_positive': 'true'
        }
        add_response = client.post('/api/testcase', data=data,
            content_type='multipart/form-data')
        test_case_id = json.loads(add_response.data)['id']
        
        # 更新标注框
        new_boxes = [[50, 50, 150, 150], [200, 200, 300, 300]]
        response = client.put(f'/api/testcase/{test_case_id}/boxes',
            json={'boxes': new_boxes},
            content_type='application/json'
        )
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['success'] is True


class TestComparisonAPI:
    """对比推理API测试"""
    
    def test_run_comparison_missing_params(self, client, app):
        """测试缺少必要参数"""
        response = client.post('/api/compare', json={})
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'error' in data
    
    def test_get_task_status_not_found(self, client, app):
        """测试获取不存在的任务"""
        response = client.get('/api/task/nonexistent-task-id')
        
        assert response.status_code == 404


class TestRegressionTestAPI:
    """回归测试API测试"""
    
    def test_run_regression_missing_version_id(self, client, app):
        """测试缺少版本ID"""
        response = client.post('/api/regression_test', json={})
        
        assert response.status_code == 400
    
    def test_run_regression(self, client, app):
        """测试回归测试"""
        # 创建缺陷、版本和测试用例
        defect_response = client.post('/api/defect', json={
            'name': 'regression_test',
            'defect_cn': '回归测试'
        })
        defect_id = json.loads(defect_response.data)['id']
        
        version_response = client.post('/api/defect_version', json={
            'defect_id': defect_id,
            'defect_cn': '回归测试',
            'summary': 'Test'
        })
        version_id = json.loads(version_response.data)['id']
        
        # 添加测试用例
        data = {
            'file': (BytesIO(b'content'), 'reg.jpg'),
            'defect_id': str(defect_id),
            'boxes': json.dumps([[100, 100, 200, 200]]),
            'is_positive': 'true'
        }
        client.post('/api/testcase', data=data, content_type='multipart/form-data')
        
        # 运行回归测试
        response = client.post('/api/regression_test', json={
            'version_id': version_id,
            'use_real_llm': False
        })
        
        assert response.status_code == 200
        result = json.loads(response.data)
        assert 'summary' in result
        assert 'details' in result
        assert result['summary']['total_cases'] >= 1


class TestIndexRoute:
    """首页路由测试"""
    
    def test_index(self, client):
        """测试首页加载"""
        response = client.get('/')
        assert response.status_code == 200
        # 验证返回的是HTML
        assert b'<!DOCTYPE html>' in response.data
    
    def test_uploaded_file_route(self, client, app):
        """测试文件服务路由"""
        # 创建测试文件
        upload_dir = app.config['UPLOAD_FOLDER']
        import os
        os.makedirs(upload_dir, exist_ok=True)
        
        test_file_path = os.path.join(upload_dir, 'test_file.txt')
        with open(test_file_path, 'w') as f:
            f.write('test content')
        
        try:
            response = client.get('/uploads/test_file.txt')
            assert response.status_code == 200
        finally:
            os.remove(test_file_path)