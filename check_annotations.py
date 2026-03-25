import sqlite3

conn = sqlite3.connect('app/prompt_tool_v2.db')
cursor = conn.cursor()

# 查看 defect 表结构
cursor.execute('PRAGMA table_info(defect)')
print('=== defect 字段 ===')
for row in cursor.fetchall():
    print(row)

# 查看有标注的 test_case 及其缺陷
cursor.execute('''
    SELECT tc.id, tc.defect_id, tc.filename, d.name, COUNT(bb.id) as box_count
    FROM test_case tc
    JOIN defect d ON tc.defect_id = d.id
    LEFT JOIN bounding_box bb ON tc.id = bb.test_case_id
    GROUP BY tc.id
    HAVING box_count > 0
    LIMIT 10
''')
print('\n=== 有标注的 test_case ===')
for row in cursor.fetchall():
    print(f'TestCaseID: {row[0]}, DefectID: {row[1]}, Filename: {row[2]}, DefectName: {row[3]}, BoxCount: {row[4]}')

conn.close()
