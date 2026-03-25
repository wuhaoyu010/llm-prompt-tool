"""
图像服务层

提供图像处理功能，包括：
- 生成预览图（带标注框）
"""

import os
from PIL import Image, ImageDraw


def create_preview_image(test_case, upload_folder):
    """
    创建带标注框的预览图

    参数:
        test_case: 测试用例对象
        upload_folder: 上传文件夹路径

    返回:
        预览图相对路径，失败返回 None
    """
    try:
        original_path = test_case.filepath
        if not os.path.exists(original_path):
            return None

        preview_dir = os.path.join(upload_folder, 'previews')
        preview_filename = f"preview_{test_case.id}_{os.path.basename(original_path)}"
        preview_path = os.path.join(preview_dir, preview_filename)

        if os.path.exists(preview_path):
            return f"uploads/previews/{preview_filename}"

        with Image.open(original_path) as img:
            draw = ImageDraw.Draw(img)
            img_width, img_height = img.size

            for box in test_case.bounding_boxes:
                x_min = box.norm_x_min / 999 * img_width
                y_min = box.norm_y_min / 999 * img_height
                x_max = box.norm_x_max / 999 * img_width
                y_max = box.norm_y_max / 999 * img_height
                draw.rectangle([x_min, y_min, x_max, y_max], outline="red", width=3)

            img.save(preview_path)

        return f"uploads/previews/{preview_filename}"
    except Exception as e:
        print(f"Error creating preview for test case {test_case.id}: {e}")
        return None


def delete_preview_image(test_case_id, filepath, upload_folder):
    """
    删除预览图

    参数:
        test_case_id: 测试用例 ID
        filepath: 原始文件路径
        upload_folder: 上传文件夹路径
    """
    try:
        preview_dir = os.path.join(upload_folder, 'previews')
        preview_filename = f"preview_{test_case_id}_{os.path.basename(filepath)}"
        preview_path = os.path.join(preview_dir, preview_filename)
        if os.path.exists(preview_path):
            os.remove(preview_path)
    except Exception as e:
        print(f"Error deleting preview for test case {test_case_id}: {e}")


def ensure_directories(upload_folder):
    """
    确保上传目录和预览目录存在

    参数:
        upload_folder: 上传文件夹路径
    """
    if not os.path.exists(upload_folder):
        os.makedirs(upload_folder)
    preview_folder = os.path.join(upload_folder, 'previews')
    if not os.path.exists(preview_folder):
        os.makedirs(preview_folder)