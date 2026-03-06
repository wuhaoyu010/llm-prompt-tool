"""Playwright前端测试"""
import pytest
import time
import json
from playwright.sync_api import sync_playwright, Page, expect


# 测试配置
BASE_URL = "http://localhost:5000"
HEADLESS = True  # 设置为 False 可以看到浏览器操作


@pytest.fixture(scope="module")
def browser():
    """创建浏览器实例"""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=HEADLESS)
        yield browser
        browser.close()


@pytest.fixture
def page(browser):
    """创建页面实例"""
    context = browser.new_context()
    page = context.new_page()
    yield page
    context.close()


class TestFrontendBasics:
    """前端基础测试"""

    def test_page_load(self, page: Page):
        """测试页面加载"""
        page.goto(BASE_URL)

        # 验证标题
        expect(page).to_have_title("大模型提示词管理与测试工具")

        # 验证主要元素存在
        expect(page.locator(".top-nav")).to_be_visible()
        expect(page.locator(".sidebar")).to_be_visible()
        expect(page.locator(".main-content")).to_be_visible()

    def test_theme_toggle(self, page: Page):
        """测试主题切换"""
        page.goto(BASE_URL)

        # 获取当前主题
        body = page.locator("body")
        initial_theme = body.get_attribute("data-theme")

        # 点击主题切换按钮
        theme_toggle = page.locator("#theme-toggle")
        theme_toggle.click()

        # 验证主题改变
        new_theme = body.get_attribute("data-theme")
        assert initial_theme != new_theme

        # 再次切换应该回到原主题
        theme_toggle.click()
        final_theme = body.get_attribute("data-theme")
        assert initial_theme == final_theme

    def test_sidebar_toggle(self, page: Page):
        """测试侧边栏折叠"""
        page.goto(BASE_URL)

        sidebar = page.locator("#sidebar")
        toggle_btn = page.locator("#toggle-sidebar-btn")

        # 点击折叠
        toggle_btn.click()
        expect(sidebar).to_have_class(lambda c: "collapsed" in c)

        # 再次点击展开
        toggle_btn.click()
        expect(sidebar).not_to_have_class(lambda c: "collapsed" in c)


class TestDefectManagement:
    """缺陷管理测试"""

    def test_add_defect_modal(self, page: Page):
        """测试添加缺陷模态框"""
        page.goto(BASE_URL)

        # 点击添加按钮
        add_btn = page.locator("#add-defect-btn")
        add_btn.click()

        # 验证模态框显示
        modal = page.locator("#add-defect-modal")
        expect(modal).to_be_visible()

        # 验证背景遮罩
        backdrop = page.locator("#modal-backdrop")
        expect(backdrop).to_be_visible()

        # 关闭模态框
        modal.locator(".modal-close").click()
        expect(modal).not_to_be_visible()

    def test_create_defect(self, page: Page):
        """测试创建缺陷"""
        page.goto(BASE_URL)

        # 打开模态框
        page.locator("#add-defect-btn").click()
        modal = page.locator("#add-defect-modal")

        # 填写表单
        page.fill("#new-defect-name", f"test_defect_{int(time.time())}")
        page.fill("#new-defect-cn", "测试缺陷")

        # 监听响应
        with page.expect_response("**/api/defect") as response_info:
            modal.locator(".btn-primary").click()

        response = response_info.value
        assert response.status == 201 or response.status == 200

        # 验证模态框关闭
        expect(modal).not_to_be_visible()

    def test_defect_search(self, page: Page):
        """测试缺陷搜索"""
        page.goto(BASE_URL)

        # 在搜索框输入
        search_input = page.locator("#defect-search")
        search_input.fill("测试")

        # 验证搜索框有值
        expect(search_input).to_have_value("测试")


class TestAnnotationTool:
    """标注工具测试"""

    def test_annotation_section_visible(self, page: Page):
        """测试标注区域可见"""
        page.goto(BASE_URL)

        # 滚动到标注区域
        annotation_section = page.locator(".annotation-section")
        annotation_section.scroll_into_view_if_needed()

        expect(annotation_section).to_be_visible()

        # 验证关键元素
        expect(page.locator("#canvas-wrapper")).to_be_visible()
        expect(page.locator("#thumbnail-container")).to_be_visible()
        expect(page.locator(".toolbox")).to_be_visible()

    def test_tool_buttons(self, page: Page):
        """测试工具按钮"""
        page.goto(BASE_URL)

        # 测试画框按钮
        draw_btn = page.locator("#draw-box-btn")
        expect(draw_btn).to_be_visible()

        # 点击画框按钮
        draw_btn.click()

        # 验证按钮状态变化
        expect(draw_btn).to_have_class(lambda c: "active" in c)

        # 再次点击取消
        draw_btn.click()
        expect(draw_btn).not_to_have_class(lambda c: "active" in c)

    def test_sample_type_selector(self, page: Page):
        """测试正例/反例选择器"""
        page.goto(BASE_URL)

        # 默认应该是正例
        positive_radio = page.locator('input[name="sample-type"][value="positive"]')
        expect(positive_radio).to_be_checked()

        # 切换到反例
        negative_label = page.locator(".sample-type-label").filter(has_text="反例")
        negative_label.click()

        negative_radio = page.locator('input[name="sample-type"][value="negative"]')
        expect(negative_radio).to_be_checked()

    def test_shortcut_panel_toggle(self, page: Page):
        """测试快捷键面板切换"""
        page.goto(BASE_URL)

        # 点击快捷键切换按钮
        shortcut_toggle = page.locator("#shortcut-toggle")
        shortcut_toggle.click()

        # 验证面板展开
        shortcuts_panel = page.locator("#shortcuts-panel")
        expect(shortcuts_panel).to_have_class(lambda c: "expanded" in c)

        # 再次点击收起
        shortcut_toggle.click()
        expect(shortcuts_panel).not_to_have_class(lambda c: "expanded" in c)


class TestComparisonSection:
    """对比推理测试"""

    def test_comparison_section_visible(self, page: Page):
        """测试对比区域可见"""
        page.goto(BASE_URL)

        # 找到对比区域
        comparison_section = page.locator("section.card").filter(has_text="实时推理对比")
        comparison_section.scroll_into_view_if_needed()

        expect(comparison_section).to_be_visible()

        # 验证按钮存在
        run_btn = page.locator("#run-comparison-btn")
        expect(run_btn).to_be_visible()

    def test_run_comparison_without_selection(self, page: Page):
        """测试未选择测试用例时点击运行对比"""
        page.goto(BASE_URL)

        # 滚动到对比区域
        comparison_section = page.locator("section.card").filter(has_text="实时推理对比")
        comparison_section.scroll_into_view_if_needed()

        # 点击运行对比按钮
        run_btn = page.locator("#run-comparison-btn")
        run_btn.click()

        # 应该显示警告通知
        notification = page.locator(".notification.warning")
        expect(notification).to_be_visible(timeout=3000)

    def test_model_selector(self, page: Page):
        """测试模型选择器"""
        page.goto(BASE_URL)

        model_selector = page.locator("#model-selector")
        expect(model_selector).to_be_visible()

        # 等待模型加载
        page.wait_for_timeout(1000)

        # 验证有选项
        options = model_selector.locator("option")
        count = options.count()
        assert count > 0, "模型选择器应该有选项"


class TestRegressionSection:
    """回归测试区域测试"""

    def test_regression_section_visible(self, page: Page):
        """测试回归测试区域可见"""
        page.goto(BASE_URL)

        regression_section = page.locator("section.card").filter(has_text="回归测试报告")
        regression_section.scroll_into_view_if_needed()

        expect(regression_section).to_be_visible()
        expect(page.locator("#run-regression-btn")).to_be_visible()


class TestHistorySection:
    """历史记录测试"""

    def test_history_section_visible(self, page: Page):
        """测试历史记录区域可见"""
        page.goto(BASE_URL)

        history_section = page.locator("section.card").filter(has_text="提示词修改历史")
        history_section.scroll_into_view_if_needed()

        expect(history_section).to_be_visible()
        expect(page.locator("#history-table")).to_be_visible()


class TestBatchImport:
    """批量导入测试"""

    def test_batch_import_modal(self, page: Page):
        """测试批量导入模态框"""
        page.goto(BASE_URL)

        # 点击批量导入按钮
        batch_import_btn = page.locator("#batch-import-btn")
        batch_import_btn.click()

        # 由于没有选择缺陷，应该显示警告
        notification = page.locator(".notification.warning")
        expect(notification).to_be_visible(timeout=3000)


class TestKeyboardShortcuts:
    """键盘快捷键测试"""

    def test_navigation_shortcuts(self, page: Page):
        """测试导航快捷键"""
        page.goto(BASE_URL)

        # 先创建一个缺陷以便有测试用例
        page.locator("#add-defect-btn").click()
        modal = page.locator("#add-defect-modal")
        page.fill("#new-defect-name", f"shortcut_test_{int(time.time())}")
        page.fill("#new-defect-cn", "快捷键测试")
        modal.locator(".btn-primary").click()
        page.wait_for_timeout(500)

        # 选择刚创建的缺陷
        defect_item = page.locator(".defect-list a").filter(has_text="快捷键测试")
        if defect_item.count() > 0:
            defect_item.first.click()
            page.wait_for_timeout(500)

            # 测试 D 键（上一张）和 F 键（下一张）
            # 如果没有测试用例，这些操作不会有效果，但也不应该报错
            page.keyboard.press("d")
            page.keyboard.press("f")


class TestAPICalls:
    """API调用测试"""

    def test_api_defects_list(self, page: Page):
        """测试获取缺陷列表API"""
        page.goto(BASE_URL)

        # 监听API请求
        with page.expect_response("**/api/defects") as response_info:
            page.reload()

        response = response_info.value
        assert response.status == 200

        data = response.json()
        assert isinstance(data, list)

    def test_api_llm_status(self, page: Page):
        """测试LLM状态检查"""
        page.goto(BASE_URL)

        # 等待LLM状态检查完成
        page.wait_for_timeout(2000)

        # 检查状态指示器
        status_indicator = page.locator("#llm-status-indicator")
        expect(status_indicator).to_be_visible()

        # 应该有状态文本
        status_text = status_indicator.locator(".status-text")
        expect(status_text).not_to_be_empty()


class TestNotificationSystem:
    """通知系统测试"""

    def test_notification_appears(self, page: Page):
        """测试通知显示"""
        page.goto(BASE_URL)

        # 触发一个会显示通知的操作
        # 例如：在没有选择测试用例时点击运行对比
        comparison_section = page.locator("section.card").filter(has_text="实时推理对比")
        comparison_section.scroll_into_view_if_needed()
        page.locator("#run-comparison-btn").click()

        # 验证通知出现
        notification = page.locator(".notification")
        expect(notification).to_be_visible(timeout=3000)

        # 验证通知有正确的类
        expect(notification).to_have_class(lambda c: "show" in c)


# 运行测试的入口
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--headed"])