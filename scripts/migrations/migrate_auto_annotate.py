"""数据库迁移脚本：添加自动标注相关字段和表"""
import sqlite3
import os
import sys

# 数据库路径
db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'app', 'prompt_tool_v2.db')
print(f"数据库路径: {db_path}")

if not os.path.exists(db_path):
    print(f"数据库文件不存在，将由应用自动创建")
    sys.exit(0)

# 连接数据库
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# =========================================
# 1. 为 trueno3_config 表添加新字段
# =========================================
cursor.execute("PRAGMA table_info(trueno3_config)")
columns = [col[1] for col in cursor.fetchall()]

new_columns = [
    ('service_host', 'VARCHAR(100) DEFAULT ""'),
    ('service_port', 'INTEGER DEFAULT 20011'),
    ('api_path', 'VARCHAR(100) DEFAULT "/picAnalyse"'),
    ('callback_host', 'VARCHAR(100) DEFAULT ""'),
    ('callback_port', 'INTEGER DEFAULT 5001'),
]

for col_name, col_type in new_columns:
    if col_name not in columns:
        cursor.execute(f'ALTER TABLE trueno3_config ADD COLUMN {col_name} {col_type}')
        print(f"已添加 trueno3_config.{col_name} 列")
    else:
        print(f"trueno3_config.{col_name} 列已存在")

# =========================================
# 2. 创建 auto_annotation_task 表
# =========================================
cursor.execute("""
    SELECT name FROM sqlite_master WHERE type='table' AND name='auto_annotation_task'
""")
if not cursor.fetchone():
    cursor.execute('''
        CREATE TABLE auto_annotation_task (
            id INTEGER PRIMARY KEY,
            request_id VARCHAR(100) UNIQUE NOT NULL,
            defect_id INTEGER NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'pending',
            total_images INTEGER DEFAULT 0,
            processed_images INTEGER DEFAULT 0,
            total_boxes_created INTEGER DEFAULT 0,
            error_message TEXT,
            created_at DATETIME,
            completed_at DATETIME,
            FOREIGN KEY (defect_id) REFERENCES defect(id)
        )
    ''')
    print("已创建 auto_annotation_task 表")
else:
    print("auto_annotation_task 表已存在")

# =========================================
# 3. 创建 auto_annotation_item 表
# =========================================
cursor.execute("""
    SELECT name FROM sqlite_master WHERE type='table' AND name='auto_annotation_item'
""")
if not cursor.fetchone():
    cursor.execute('''
        CREATE TABLE auto_annotation_item (
            id INTEGER PRIMARY KEY,
            task_id INTEGER NOT NULL,
            test_case_id INTEGER NOT NULL,
            object_id VARCHAR(100) NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'pending',
            boxes_created INTEGER DEFAULT 0,
            error_message TEXT,
            callback_data TEXT,
            created_at DATETIME,
            completed_at DATETIME,
            FOREIGN KEY (task_id) REFERENCES auto_annotation_task(id),
            FOREIGN KEY (test_case_id) REFERENCES test_case(id)
        )
    ''')
    print("已创建 auto_annotation_item 表")
else:
    print("auto_annotation_item 表已存在")

conn.commit()
conn.close()
print("\n数据库迁移完成!")