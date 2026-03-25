"""
图片缩放功能单元测试

测试 _resize_image_for_vlm 函数的各种场景：
- 小图不触发缩放
- 大图触发缩放
- 缩放后尺寸为28的倍数
- 保持纵横比
- 返回正确的缩放因子
"""
import pytest
import numpy as np


class TestResizeImageForVLM:
    """图片缩放功能测试"""

    def test_small_image_no_resize(self):
        """测试小图不触发缩放（宽高都 <= 1920）"""
        from src.backend.services.llm_service import _resize_image_for_vlm

        # 创建一个 1920x1080 的图片
        image = np.zeros((1080, 1920, 3), dtype=np.uint8)
        result, scale = _resize_image_for_vlm(image)

        # 不应该缩放
        assert result.shape == image.shape
        assert scale == 1.0

    def test_small_square_image_no_resize(self):
        """测试小正方形图不触发缩放"""
        from src.backend.services.llm_service import _resize_image_for_vlm

        # 创建一个 1000x1000 的图片
        image = np.zeros((1000, 1000, 3), dtype=np.uint8)
        result, scale = _resize_image_for_vlm(image)

        assert result.shape == image.shape
        assert scale == 1.0

    def test_large_width_triggers_resize(self):
        """测试宽度超过1920触发缩放"""
        from src.backend.services.llm_service import _resize_image_for_vlm

        # 创建一个 2500x1000 的图片（宽超过1920）
        image = np.zeros((1000, 2500, 3), dtype=np.uint8)
        result, scale = _resize_image_for_vlm(image)

        # 宽度应该被缩放到 <= 1904
        assert result.shape[1] <= 1904
        assert result.shape[0] <= 1904
        # 返回的是元组 (scale_w, scale_h)
        assert isinstance(scale, tuple)
        assert len(scale) == 2
        # 缩放因子应该小于1
        assert scale[0] < 1.0
        assert scale[1] < 1.0

    def test_large_height_triggers_resize(self):
        """测试高度超过1920触发缩放"""
        from src.backend.services.llm_service import _resize_image_for_vlm

        # 创建一个 1000x2500 的图片（高超过1920）
        image = np.zeros((2500, 1000, 3), dtype=np.uint8)
        result, scale = _resize_image_for_vlm(image)

        # 高度应该被缩放到 <= 1904
        assert result.shape[0] <= 1904
        assert result.shape[1] <= 1904
        assert isinstance(scale, tuple)
        assert len(scale) == 2
        assert scale[0] < 1.0
        assert scale[1] < 1.0

    def test_large_both_dimensions_triggers_resize(self):
        """测试宽高都超过1920触发缩放"""
        from src.backend.services.llm_service import _resize_image_for_vlm

        # 创建一个 3000x2000 的图片
        image = np.zeros((2000, 3000, 3), dtype=np.uint8)
        result, scale = _resize_image_for_vlm(image)

        # 长边应该被缩放到 <= 1904
        assert max(result.shape[0], result.shape[1]) <= 1904
        assert isinstance(scale, tuple)
        assert len(scale) == 2

    def test_output_dimensions_multiple_of_28(self):
        """测试输出尺寸是28的倍数"""
        from src.backend.services.llm_service import _resize_image_for_vlm

        # 创建一个 2520x1680 的图片（需要缩放）
        image = np.zeros((1680, 2520, 3), dtype=np.uint8)
        result, _ = _resize_image_for_vlm(image)

        # 宽高都应该是28的倍数
        assert result.shape[0] % 28 == 0, f"Height {result.shape[0]} is not multiple of 28"
        assert result.shape[1] % 28 == 0, f"Width {result.shape[1]} is not multiple of 28"

    def test_aspect_ratio_preserved(self):
        """测试缩放后保持纵横比"""
        from src.backend.services.llm_service import _resize_image_for_vlm

        # 创建一个 2800x1400 的图片（2:1 比例）
        image = np.zeros((1400, 2800, 3), dtype=np.uint8)
        original_ratio = image.shape[1] / image.shape[0]  # width / height

        result, scale = _resize_image_for_vlm(image)

        # 计算缩放后的比例
        new_ratio = result.shape[1] / result.shape[0]

        # 由于四舍五入到28倍数，允许微小的误差
        assert abs(new_ratio - original_ratio) < 0.05, \
            f"Aspect ratio changed: {original_ratio:.4f} -> {new_ratio:.4f}"

    def test_scale_factors_correct(self):
        """测试缩放因子计算正确"""
        from src.backend.services.llm_service import _resize_image_for_vlm

        # 创建一个 2240x1120 的图片
        original_h, original_w = 1120, 2240
        image = np.zeros((original_h, original_w, 3), dtype=np.uint8)
        result, (scale_w, scale_h) = _resize_image_for_vlm(image)

        # 验证缩放因子
        expected_scale_w = result.shape[1] / original_w
        expected_scale_h = result.shape[0] / original_h

        assert abs(scale_w - expected_scale_w) < 0.001
        assert abs(scale_h - expected_scale_h) < 0.001

    def test_very_large_image(self):
        """测试非常大的图片"""
        from src.backend.services.llm_service import _resize_image_for_vlm

        # 创建一个 8000x6000 的图片
        image = np.zeros((6000, 8000, 3), dtype=np.uint8)
        result, scale = _resize_image_for_vlm(image)

        # 长边应该被缩放到 <= 1904
        assert max(result.shape[0], result.shape[1]) <= 1904
        assert result.shape[0] % 28 == 0
        assert result.shape[1] % 28 == 0

    def test_exact_1920_no_resize(self):
        """测试恰好1920不触发缩放"""
        from src.backend.services.llm_service import _resize_image_for_vlm

        # 创建一个 1920x1920 的图片
        image = np.zeros((1920, 1920, 3), dtype=np.uint8)
        result, scale = _resize_image_for_vlm(image)

        # 不应该缩放
        assert result.shape == image.shape
        assert scale == 1.0

    def test_just_over_1920_triggers_resize(self):
        """测试刚好超过1920触发缩放"""
        from src.backend.services.llm_service import _resize_image_for_vlm

        # 创建一个 1921x1080 的图片（宽刚好超过1920）
        image = np.zeros((1080, 1921, 3), dtype=np.uint8)
        result, scale = _resize_image_for_vlm(image)

        # 应该缩放
        assert result.shape[1] <= 1904
        assert scale != 1.0

    def test_grayscale_image(self):
        """测试灰度图（2D数组）"""
        from src.backend.services.llm_service import _resize_image_for_vlm

        # 创建一个 2500x1000 的灰度图
        image = np.zeros((1000, 2500), dtype=np.uint8)
        result, scale = _resize_image_for_vlm(image)

        # 应该正常处理
        assert result.shape[1] <= 1904
        assert isinstance(scale, tuple)


class TestResizeImageIntegration:
    """图片缩放集成测试 - 与坐标转换相关的测试"""

    def test_coordinate_transformation(self):
        """测试坐标转换（模拟bounding box坐标映射）"""
        from src.backend.services.llm_service import _resize_image_for_vlm

        # 创建一个大图
        original_h, original_w = 2000, 3000
        image = np.zeros((original_h, original_w, 3), dtype=np.uint8)
        result, (scale_w, scale_h) = _resize_image_for_vlm(image)

        # 原图中的一个bbox
        original_box = [100, 200, 500, 600]  # [x_min, y_min, x_max, y_max]

        # 转换到缩放后的坐标
        scaled_box = [
            original_box[0] * scale_w,
            original_box[1] * scale_h,
            original_box[2] * scale_w,
            original_box[3] * scale_h
        ]

        # 验证坐标在缩放后的图片范围内
        assert scaled_box[0] >= 0 and scaled_box[0] < result.shape[1]
        assert scaled_box[1] >= 0 and scaled_box[1] < result.shape[0]
        assert scaled_box[2] >= 0 and scaled_box[2] < result.shape[1]
        assert scaled_box[3] >= 0 and scaled_box[3] < result.shape[0]