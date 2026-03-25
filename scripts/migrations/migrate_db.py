"""数据库迁移脚本：添加 is_positive 字段"""
import sqlite3
import os

# 数据库路径
db_path = os.path.join('app', 'prompt_tool_v2.db')
print(f"数据库路径: {os.path.abspath(db_path)}")

if not os.path.exists(db_path):
    print(f"❌ 数据库文件不存在: {db_path}")
    exit(1)

# 连接数据库
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# 检查列是否已存在
cursor.execute("PRAGMA table_info(test_case)")
columns = [col[1] for col in cursor.fetchall()]

if 'is_positive' not in columns:
    # 添加新列
    cursor.execute('ALTER TABLE test_case ADD COLUMN is_positive BOOLEAN DEFAULT 1')
    conn.commit()
    print("✅ 已添加 is_positive 列")
else:
    print("ℹ️ is_positive 列已存在")

conn.close()
