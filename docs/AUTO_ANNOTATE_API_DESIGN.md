# 自动标注功能 API 设计文档

## 概述

基于 Trueno3 异步分析接口实现自动标注功能，支持批量处理缺陷图片并自动生成标注框。

---

## 1. 数据库模型扩展

### 1.1 Trueno3Config 扩展字段

```python
class Trueno3Config(db.Model):
    """Trueno3 服务器配置"""
    id = db.Column(db.Integer, primary_key=True)
    enabled = db.Column(db.Boolean, default=False)

    # SSH 配置 (用于同步缺陷定义)
    ssh_host = db.Column(db.String(100), nullable=False, default='')
    ssh_port = db.Column(db.Integer, nullable=False, default=22)
    ssh_username = db.Column(db.String(100), nullable=False, default='')
    ssh_password = db.Column(db.String(100), nullable=False, default='')
    code_path = db.Column(db.String(500), nullable=False, default='...')

    # 新增: 服务配置 (用于自动标注 API 调用)
    service_host = db.Column(db.String(100), nullable=False, default='')  # 默认取 ssh_host
    service_port = db.Column(db.Integer, nullable=False, default=20011)
    api_path = db.Column(db.String(100), nullable=False, default='/picAnalyse')

    # 本服务配置 (用于接收回调)
    callback_host = db.Column(db.String(100), nullable=False, default='')  # 本服务 IP
    callback_port = db.Column(db.Integer, nullable=False, default=5001)   # 本服务端口
```

### 1.2 新增 AutoAnnotationTask 模型

```python
class AutoAnnotationTask(db.Model):
    """自动标注任务"""
    id = db.Column(db.Integer, primary_key=True)
    request_id = db.Column(db.String(100), unique=True, nullable=False)  # UUID
    defect_id = db.Column(db.Integer, db.ForeignKey('defect.id'), nullable=False)

    # 任务状态
    status = db.Column(db.String(20), nullable=False, default='pending')  # pending/processing/completed/failed
    total_images = db.Column(db.Integer, default=0)
    processed_images = db.Column(db.Integer, default=0)

    # 结果摘要
    total_boxes_created = db.Column(db.Integer, default=0)
    error_message = db.Column(db.Text)

    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    completed_at = db.Column(db.DateTime)

    # 关联
    items = db.relationship('AutoAnnotationItem', backref='task', lazy=True, cascade="all, delete-orphan")

class AutoAnnotationItem(db.Model):
    """自动标注子任务 (每张图片)"""
    id = db.Column(db.Integer, primary_key=True)
    task_id = db.Column(db.Integer, db.ForeignKey('auto_annotation_task.id'), nullable=False)
    test_case_id = db.Column(db.Integer, db.ForeignKey('test_case.id'), nullable=False)
    object_id = db.Column(db.String(100), nullable=False)  # 对应 API 的 objectId

    # 状态
    status = db.Column(db.String(20), nullable=False, default='pending')  # pending/completed/failed
    boxes_created = db.Column(db.Integer, default=0)
    error_message = db.Column(db.Text)

    # 原始回调数据 (用于调试)
    callback_data = db.Column(db.Text)
```

---

## 2. API 端点设计

### 2.1 启动自动标注

```
POST /api/auto_annotate/defect/<defect_id>
```

**请求参数:**
```json
{
  "clear_existing_boxes": false,  // 是否清除现有标注框
  "test_case_ids": [1, 2, 3]      // 可选: 指定测试用例 ID，为空则处理全部
}
```

**响应:**
```json
{
  "success": true,
  "task_id": 123,
  "request_id": "uuid-xxx",
  "total_images": 10,
  "message": "自动标注任务已启动"
}
```

**状态码:**
- 200: 成功启动
- 400: 缺陷不存在或没有测试用例
- 503: Trueno3 服务未配置或未启用

---

### 2.2 回调接口 (Trueno3 调用)

```
POST /picAnalyseRetNotify
```

**请求体 (来自 Trueno3):**
```json
{
  "requestId": "uuid-xxx",
  "resultsList": [
    {
      "objectId": "testcase-123",
      "results": [
        {
          "type": "hand_phone",
          "value": "detected",
          "code": "2000",
          "pos": [
            {
              "areas": [
                {"x": 100, "y": 200},
                {"x": 300, "y": 400}
              ]
            }
          ],
          "conf": 0.95,
          "desc": "检测成功"
        }
      ]
    }
  ],
  "desc": "ok"
}
```

**响应:**
```json
{
  "code": 200,
  "message": "received"
}
```

---

### 2.3 查询任务状态

```
GET /api/auto_annotate/task/<task_id>
```

**响应:**
```json
{
  "task_id": 123,
  "request_id": "uuid-xxx",
  "defect_id": 1,
  "status": "completed",
  "total_images": 10,
  "processed_images": 10,
  "total_boxes_created": 25,
  "created_at": "2026-03-16T10:00:00Z",
  "completed_at": "2026-03-16T10:05:00Z",
  "items": [
    {
      "test_case_id": 1,
      "filename": "test1.jpg",
      "status": "completed",
      "boxes_created": 3
    }
  ]
}
```

---

### 2.4 更新 Trueno3 配置 (扩展)

```
POST /api/trueno3_config
```

**请求参数:**
```json
{
  "enabled": true,
  "ssh_host": "192.168.1.100",
  "ssh_port": 22,
  "ssh_username": "user",
  "ssh_password": "pass",
  "service_host": "192.168.1.100",  // 新增
  "service_port": 20011,            // 新增
  "api_path": "/picAnalyse",        // 新增
  "callback_host": "192.168.1.50",  // 新增: 本服务 IP
  "callback_port": 5001             // 新增: 本服务端口
}
```

---

## 3. 坐标转换逻辑

### 3.1 Trueno3 返回格式

```json
"pos": [
  {
    "areas": [
      {"x": 100, "y": 200},  // 左上角
      {"x": 300, "y": 400}   // 右下角
    ]
  }
]
```

### 3.2 本程序存储格式

归一化坐标 (0-999 范围):
```
norm_x_min, norm_y_min, norm_x_max, norm_y_max
```

### 3.3 转换公式

```python
def convert_pos_to_normalized(pos_list, img_width, img_height):
    """
    将 Trueno3 的 pos 坐标转换为归一化坐标

    Args:
        pos_list: Trueno3 返回的 pos 数组
        img_width: 图片原始宽度
        img_height: 图片原始高度

    Returns:
        List of (norm_x_min, norm_y_min, norm_x_max, norm_y_max)
    """
    boxes = []
    for pos_item in pos_list:
        for area in pos_item.get('areas', []):
            if len(area) >= 2:
                x1, y1 = area[0]['x'], area[0]['y']
                x2, y2 = area[1]['x'], area[1]['y']

                # 确保坐标顺序正确
                x_min, x_max = min(x1, x2), max(x1, x2)
                y_min, y_max = min(y1, y2), max(y1, y2)

                # 归一化到 0-999
                norm_x_min = int(x_min / img_width * 999)
                norm_y_min = int(y_min / img_height * 999)
                norm_x_max = int(x_max / img_width * 999)
                norm_y_max = int(y_max / img_height * 999)

                boxes.append((norm_x_min, norm_y_min, norm_x_max, norm_y_max))

    return boxes
```

---

## 4. 请求构建逻辑

### 4.1 构建单个图片的请求参数

```python
def build_analyze_request(test_case, defect, config, request_id):
    """
    构建 Trueno3 API 请求参数

    Args:
        test_case: TestCase 对象
        defect: Defect 对象
        config: Trueno3Config 对象
        request_id: 请求 UUID

    Returns:
        请求体字典
    """
    import base64

    # 读取图片并转 base64
    with open(test_case.filepath, 'rb') as f:
        image_base64 = base64.b64encode(f.read()).decode('utf-8')

    return {
        "requestHostIp": config.callback_host,
        "requestHostPort": str(config.callback_port),
        "requestId": request_id,
        "objectList": [
            {
                "objectId": f"testcase-{test_case.id}",
                "typeList": [defect.name],
                "imageUrlList": [""],
                "imageBase64": image_base64,
                "imageRecogType": defect.name,
                "parameter": {}
            }
        ]
    }
```

---

## 5. 流程图

```
┌──────────────────────────────────────────────────────────────────┐
│                        自动标注流程                                │
└──────────────────────────────────────────────────────────────────┘

用户操作                    本服务                      Trueno3
    │                         │                           │
    │  POST /auto_annotate    │                           │
    │ ───────────────────────>│                           │
    │                         │                           │
    │                         │  创建 AutoAnnotationTask  │
    │                         │  生成 request_id          │
    │                         │                           │
    │  {task_id, request_id}  │                           │
    │ <───────────────────────│                           │
    │                         │                           │
    │                         │  POST /picAnalyse         │
    │                         │  (每张图片异步发送)         │
    │                         │ ─────────────────────────>│
    │                         │                           │
    │                         │  {code: 200}              │
    │                         │ <─────────────────────────│
    │                         │                           │
    │                         │         (处理中...)         │
    │                         │                           │
    │                         │  POST /picAnalyseRetNotify│
    │                         │ <─────────────────────────│
    │                         │                           │
    │                         │  解析 pos 坐标            │
    │                         │  转换为归一化坐标          │
    │                         │  保存 BoundingBox         │
    │                         │  更新任务状态             │
    │                         │                           │
    │  GET /task/<id>         │                           │
    │ ───────────────────────>│                           │
    │                         │                           │
    │  {status: completed}    │                           │
    │ <───────────────────────│                           │
    │                         │                           │
```

---

## 6. 错误处理

| 错误场景 | 处理方式 |
|---------|---------|
| Trueno3 服务未配置 | 返回 503，提示配置服务地址 |
| 图片读取失败 | 记录错误，跳过该图片，继续处理其他图片 |
| API 调用失败 | 重试 3 次，仍失败则标记子任务失败 |
| 回调超时 (5分钟) | 标记子任务失败 |
| 坐标转换异常 | 记录原始数据，跳过该坐标框 |

---

## 7. 安全考虑

1. **回调验证**: 验证 request_id 是否存在于任务表中
2. **权限检查**: 自动标注需要登录权限
3. **速率限制**: 同一缺陷同时只能有一个进行中的任务
4. **数据备份**: 提供选项是否清除现有标注框

---

## 8. 服务连通性检测

### 8.1 测试 Trueno3 服务连通性

```
POST /api/trueno3_service_test
```

**请求参数 (可选，不传则使用数据库配置):**
```json
{
  "service_host": "192.168.1.100",  // 可选: 服务主机地址
  "service_port": 20011             // 可选: 服务端口
}
```

**成功响应:**
```json
{
  "success": true,
  "message": "服务连接成功，共 5 个可用功能",
  "service_host": "192.168.1.100",
  "service_port": 20011,
  "api_version": "1.0",
  "total_functions": 5,
  "total_matched": 3,
  "functions": [
    {
      "funID": "hand_phone",
      "funDesc": "检测玩手机行为",
      "hasConfig": true
    },
    {
      "funID": "smoke",
      "funDesc": "检测吸烟行为",
      "hasConfig": true
    }
  ],
  "matched_defects": [
    {
      "name": "hand_phone",
      "defect_cn": "玩手机",
      "matched": true
    },
    {
      "name": "smoke",
      "defect_cn": "吸烟",
      "matched": true
    }
  ]
}
```

**失败响应:**
```json
{
  "success": false,
  "error": "无法连接到服务，请检查服务是否启动",
  "service_host": "192.168.1.100",
  "service_port": 20011
}
```

**状态码:**
- 200: 服务正常
- 503: 服务不可用

### 8.2 Trueno3 QueryFunctionList 接口

本服务调用 Trueno3 的 `/AICalibration/QueryFunctionList` 接口来检测服务连通性。

**接口 URL:** `http://{service_host}:{service_port}/AICalibration/QueryFunctionList`

**请求方法:** POST

**请求体:** `{}`

**返回格式:**
```json
{
  "code": 200,
  "message": "",
  "data": {
    "apiVersion": "1.0",
    "funList": [
      {
        "funID": "hand_phone",
        "funDesc": "检测玩手机行为",
        "config": { ... }
      }
    ]
  }
}
```

**字段说明:**
| 字段 | 说明 |
|------|------|
| funID | 功能 ID，对应本系统中的缺陷 name (sn) |
| funDesc | 功能描述 |
| config | 功能配置信息 |

### 8.3 使用场景

1. **配置验证**: 保存 Trueno3 配置前，先测试服务是否可用
2. **功能发现**: 查看 Trueno3 支持哪些检测功能
3. **缺陷匹配**: 自动匹配本系统的缺陷定义与 Trueno3 的功能