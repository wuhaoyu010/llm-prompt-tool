const { chromium } = require('@playwright/test');

async function testAnnotationBugs() {
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    console.log('='.repeat(70));
    console.log('标注系统 Bug 修复验证测试');
    console.log('='.repeat(70));

    const browser = await chromium.launch({ headless: false, executablePath: chromePath });
    const page = await browser.newPage();

    try {
        await page.goto('http://localhost:5001', { waitUntil: 'networkidle' });
        await page.waitForSelector('#canvas-wrapper', { timeout: 10000 });
        console.log('✓ 页面加载成功\n');

        // ========== 测试 1: Delete 删除标注 ==========
        console.log('--- 测试 1: Delete 删除标注 ---');

        // 上传图片
        await page.$eval('#image-upload-input', el => el.style.display = 'block');
        await page.setInputFiles('#image-upload-input', 'D:/Projects/llm-prompt-tool/app/uploads/0e2a6d51-8a90-48b8-86f8-58a6e0e20925.jpg');
        await page.waitForTimeout(2000);
        console.log('✓ 图片上传成功');

        // 添加测试矩形
        const rectResult = await page.evaluate(() => {
            if (window.appState && window.appFabric && window.appState.fabricCanvas) {
                const rect = new window.appFabric.Rect({
                    left: 100, top: 100, width: 100, height: 100,
                    fill: 'rgba(234, 67, 53, 0.2)', stroke: '#ea4335',
                    strokeWidth: 2, selectable: true
                });
                window.appState.fabricCanvas.add(rect);
                window.appState.fabricCanvas.setActiveObject(rect);
                return window.appState.fabricCanvas.getObjects('rect').length;
            }
            return -1;
        });
        console.log(`添加矩形后数量: ${rectResult}`);

        // 记录删除前状态
        const beforeDelete = await page.evaluate(() => window.appState?.hasUnsavedChanges);

        // 按 Delete 删除
        await page.keyboard.press('Delete');
        await page.waitForTimeout(500);

        const afterDelete = await page.evaluate(() => {
            return {
                rectCount: window.appState?.fabricCanvas?.getObjects('rect').length,
                hasUnsaved: window.appState?.hasUnsavedChanges
            };
        });

        console.log(`删除后矩形数量: ${afterDelete.rectCount}`);
        console.log(`删除后 hasUnsavedChanges: ${afterDelete.hasUnsaved}`);

        const bug1Fixed = afterDelete.rectCount === 0 && afterDelete.hasUnsaved === true;
        console.log(`Bug1 (Delete删除) ${bug1Fixed ? '✓ 已修复' : '✗ 未修复'}`);

        // ========== 测试 2: 暂存区状态 ==========
        console.log('\n--- 测试 2: 暂存区状态 ---');

        // 检查 annotationCache 是否存在
        const cacheExists = await page.evaluate(() => typeof window.appState?.annotationCache !== 'undefined');
        console.log(`暂存区 annotationCache 存在: ${cacheExists ? '✓' : '✗'}`);

        // ========== 测试 3: 图片加载 ==========
        console.log('\n--- 测试 3: 图片加载 ---');

        // 检查背景图片是否正确加载
        const bgImageLoaded = await page.evaluate(() => {
            const canvas = window.appState?.fabricCanvas;
            return canvas?.backgroundImage !== undefined;
        });
        console.log(`背景图片已加载: ${bgImageLoaded ? '✓' : '✗'}`);

        // ========== 测试报告 ==========
        console.log('\n' + '='.repeat(70));
        console.log('【Bug 修复验证报告】');
        console.log('='.repeat(70));

        console.log(`
Bug1 - Delete删除不消失: ${bug1Fixed ? '✓ 已修复' : '✗ 未修复'}
  - 删除后矩形数量应为 0，实际: ${afterDelete.rectCount}
  - hasUnsavedChanges 应为 true，实际: ${afterDelete.hasUnsaved}

Bug2 - 切换图片提示确认: 需要手动测试
  - 在标注后切换图片，观察是否正确提示

Bug3 - 图片全黑: 需要手动测试
  - 切换图片后观察是否正常显示
`);

        console.log('='.repeat(70));

    } catch (error) {
        console.error('\n测试执行错误:', error.message);
    } finally {
        await browser.close();
    }
}

testAnnotationBugs();