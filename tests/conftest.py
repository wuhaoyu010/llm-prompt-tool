# Flask应用测试配置
import pytest
import os
import sys
import tempfile

# 确保项目根目录在 Python 路径中
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


@pytest.fixture(scope='session')
def app():
    """创建测试用的Flask应用"""
    from app import create_app
    from src.backend.database import db
    
    # 使用临时数据库
    db_fd, db_path = tempfile.mkstemp(suffix='.db')
    
    test_app = create_app()
    test_app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{db_path}'
    test_app.config['TESTING'] = True
    test_app.config['WTF_CSRF_ENABLED'] = False
    
    with test_app.app_context():
        db.create_all()
        
    yield test_app
    
    # 清理
    os.close(db_fd)
    os.unlink(db_path)


@pytest.fixture
def client(app):
    """创建测试客户端"""
    return app.test_client()


@pytest.fixture
def db_session(app):
    """提供数据库会话"""
    from src.backend.database import db
    with app.app_context():
        yield db.session
        db.session.rollback()