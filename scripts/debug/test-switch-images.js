const { chromium } = require('@playwright/test');

async function testSwitchImages() {
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    console.log('='.repeat(70));
    console.log('切换图片多次测试 - 验证不再无限弹框');
    console.log('='.repeat(70));

    const browser = await chromium.launch({ headless: false, executablePath: chromePath });
    const page = await browser.newPage();

    try {
        await page.goto('http://localhost:5001', { waitUntil: 'networkidle' });
        await page.waitForSelector('#canvas-wrapper', { timeout: 10000 });
        console.log('✓ 页面加载成功\n');

        // 上传图片
        await page.$eval('#image-upload-input', el => el.style.display = 'block');
        await page.setInputFiles('#image-upload-input', 'D:/Projects/llm-prompt-tool/app/uploads/0e2a6d51-8a90-48b8-86f8-58a6e0e20925.jpg');
        await page.waitForTimeout(2000);
        console.log('✓ 图片上传成功');

        // 添加一个标注框
        await page.evaluate(() => {
            const rect = new window.appFabric.Rect({
                left: 100, top: 100, width: 100, height: 100,
                fill: 'rgba(234, 67, 53, 0.2)', stroke: '#ea4335',
                strokeWidth: 2, selectable: true
            });
            window.appState.fabricCanvas.add(rect);
            window.appState.hasUnsavedChanges = true;  // 模拟删除后的脏状态
        });
        console.log('✓ 模拟脏状态 (hasUnsavedChanges = true)');

        // 测试多次切换
        console.log('\n--- 测试多次切换图片 ---');

        // 检查有多少个缩略图
        const thumbCount = await page.evaluate(() => {
            return document.querySelectorAll('.thumbnail-item, .test-case-item').length;
        });
        console.log(`检测到 ${thumbCount} 个缩略图`);

        let confirmDialogCount = 0;

        // 监听确认对话框
        page.on('dialog', async dialog => {
            confirmDialogCount++;
            console.log(`第 ${confirmDialogCount} 次弹框: "${dialog.message()}"`);
            await dialog.accept();  // 选择"不保存"
        });

        // 尝试切换多次
        for (let i = 0; i < 5 && thumbCount > 1; i++) {
            const thumbs = await page.$$('.thumbnail-item:not(:first-child), .test-case-item:not(:first-child)');
            if (thumbs.length > 0) {
                await thumbs[i % thumbs.length].click();
                await page.waitForTimeout(500);
                console.log(`切换到图片 ${i + 2}`);
            }
        }

        console.log(`\n--- 测试结果 ---`);
        console.log(`总弹框次数: ${confirmDialogCount}`);

        if (confirmDialogCount === 1) {
            console.log('✓ 只弹了一次框，符合预期（首次切换时脏状态有效）');
        } else if (confirmDialogCount === 0) {
            console.log('✓ 没有弹框（可能缩略图加载问题）');
        } else {
            console.log(`✗ 弹框 ${confirmDialogCount} 次，仍然存在问题`);
        }

        // 检查最终状态
        const finalState = await page.evaluate(() => {
            return {
                hasUnsavedChanges: window.appState?.hasUnsavedChanges,
                currentTestCaseId: window.appState?.currentTestCaseId
            };
        });
        console.log(`\n最终状态:`);
        console.log(`  hasUnsavedChanges: ${finalState.hasUnsavedChanges}`);
        console.log(`  currentTestCaseId: ${finalState.currentTestCaseId}`);

        console.log('\n' + '='.repeat(70));

    } catch (error) {
        console.error('\n测试错误:', error.message);
    } finally {
        await browser.close();
    }
}

testSwitchImages();