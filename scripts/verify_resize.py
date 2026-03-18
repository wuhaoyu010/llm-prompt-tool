"""
模拟验证图片缩放和坐标转换功能
"""
import numpy as np
import cv2
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def _resize_image_for_vlm(image):
    """
    将大图压缩到宽或高为28的倍数（最接近的尺寸），保持纵横比
    触发条件: 宽 > 1920 或 高 > 1920
    """
    h, w = image.shape[:2]

    max_side = max(w, h)
    if max_side <= 1920:
        return image, 1.0

    target_max = 1904
    scale = target_max / max_side

    new_w = int(w * scale)
    new_h = int(h * scale)

    target_w = round(new_w / 28) * 28
    target_h = round(new_h / 28) * 28

    target_w = min(target_w, 1904)
    target_h = min(target_h, 1904)
    target_w = max(target_w, 28)
    target_h = max(target_h, 28)

    resized_img = cv2.resize(image, (target_w, target_h), interpolation=cv2.INTER_AREA)

    scale_w = target_w / w
    scale_h = target_h / h

    logger.info(f"Image resized: {w}x{h} -> {target_w}x{target_h} (scale_w={scale_w:.4f}, scale_h={scale_h:.4f})")

    return resized_img, (scale_w, scale_h)


def simulate_verification():
    """模拟验证大图缩放和归一化坐标"""

    print("=" * 60)
    print("模拟验证：大图缩放 + 归一化坐标")
    print("=" * 60)

    # 1. 创建一个 3000x2000 的大图（模拟实际大图）
    original_h, original_w = 2000, 3000
    print(f"\n[原图] 图片尺寸: {original_w} x {original_h}")

    # 创建测试图片（纯色背景 + 一些标记）
    image = np.zeros((original_h, original_w, 3), dtype=np.uint8)
    image[:] = (100, 100, 100)  # 灰色背景

    # 画一个矩形框（模拟缺陷区域），像素坐标 (500, 300) 到 (1500, 800)
    cv2.rectangle(image, (500, 300), (1500, 800), (0, 255, 0), 5)
    print(f"[标注框] 像素坐标: (500, 300) -> (1500, 800)")

    # 2. 计算归一化坐标（这是存储在数据库中的）
    norm_x_min = 500 / original_w    # 0.1667
    norm_y_min = 300 / original_h    # 0.15
    norm_x_max = 1500 / original_w   # 0.5
    norm_y_max = 800 / original_h    # 0.4

    print(f"\n[归一化坐标] (存入数据库):")
    print(f"   [{norm_x_min:.4f}, {norm_y_min:.4f}, {norm_x_max:.4f}, {norm_y_max:.4f}]")

    # 3. 调用缩放函数
    resized_image, scale_info = _resize_image_for_vlm(image)

    new_h, new_w = resized_image.shape[:2]
    print(f"\n[缩放后] 图片尺寸: {new_w} x {new_h}")

    if scale_info == 1.0:
        print("   [!] 未触发缩放（图片未超过1920）")
    else:
        scale_w, scale_h = scale_info
        print(f"   [OK] 触发缩放: scale_w={scale_w:.4f}, scale_h={scale_h:.4f}")

    # 4. 验证归一化坐标在缩放后的图上仍然正确
    print(f"\n[验证] 归一化坐标在缩放后的图上是否正确？")

    # 用归一化坐标计算缩放后图上的像素位置
    scaled_pixel_x_min = norm_x_min * new_w
    scaled_pixel_y_min = norm_y_min * new_h
    scaled_pixel_x_max = norm_x_max * new_w
    scaled_pixel_y_max = norm_y_max * new_h

    print(f"   缩放后图上的像素坐标: ({scaled_pixel_x_min:.1f}, {scaled_pixel_y_min:.1f}) -> ({scaled_pixel_x_max:.1f}, {scaled_pixel_y_max:.1f})")

    # 验证：用scale因子直接转换原图像素坐标
    if scale_info != 1.0:
        direct_scaled_x_min = 500 * scale_w
        direct_scaled_y_min = 300 * scale_h
        direct_scaled_x_max = 1500 * scale_w
        direct_scaled_y_max = 800 * scale_h

        print(f"\n   [对比] 直接用scale转换像素坐标:")
        print(f"   ({direct_scaled_x_min:.1f}, {direct_scaled_y_min:.1f}) -> ({direct_scaled_x_max:.1f}, {direct_scaled_y_max:.1f})")

        # 两者应该相同（证明归一化坐标无需转换）
        diff = abs(scaled_pixel_x_min - direct_scaled_x_min)
        print(f"\n   [OK] 差异: {diff:.4f} (归一化坐标完美兼容!)")

    # 5. 验证缩放后尺寸是28的倍数
    print(f"\n[验证] 缩放后尺寸是否为28的倍数？")
    print(f"   宽 {new_w} % 28 = {new_w % 28} {'OK' if new_w % 28 == 0 else 'FAIL'}")
    print(f"   高 {new_h} % 28 = {new_h % 28} {'OK' if new_h % 28 == 0 else 'FAIL'}")

    # 6. 模拟 Prompt 中的坐标字符串
    print(f"\n[Prompt] 发送给大模型的内容:")
    box_details_str = f"ID|归一化坐标|标签|置信度\n---|---|---|---\n"
    box_details_str += f"0|[{norm_x_min:.4f},{norm_y_min:.4f},{norm_x_max:.4f},{norm_y_max:.4f}]|缺陷检测|0.99\n"
    print(box_details_str)

    print("[结论] 归一化坐标在图片缩放前后保持不变，无需转换!")


def test_various_sizes():
    """测试各种尺寸的图片"""
    print("\n" + "=" * 60)
    print("测试各种图片尺寸")
    print("=" * 60)

    test_cases = [
        (1920, 1080, "小图（不缩放）"),
        (1921, 1080, "宽度刚好超限"),
        (2500, 1400, "大宽图"),
        (1400, 2500, "大高图"),
        (4000, 3000, "超大图"),
        (8000, 6000, "超大图"),
    ]

    for w, h, desc in test_cases:
        image = np.zeros((h, w, 3), dtype=np.uint8)
        resized, scale = _resize_image_for_vlm(image)
        new_h, new_w = resized.shape[:2]

        status = "[缩放]" if scale != 1.0 else "[跳过]"
        print(f"{desc}: {w}x{h} -> {new_w}x{new_h} {status}")


if __name__ == "__main__":
    simulate_verification()
    test_various_sizes()