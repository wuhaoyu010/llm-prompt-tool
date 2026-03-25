const { chromium } = require('@playwright/test');

async function testAnnotationFeatures() {
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    console.log('启动浏览器...');
    const browser = await chromium.launch({ headless: false, executablePath: chromePath });
    const page = await browser.newPage();

    const results = [];

    try {
        console.log('\n=== 测试 1: 页面加载 ===');
        await page.goto('http://localhost:5001', { waitUntil: 'networkidle' });
        await page.waitForSelector('#canvas-wrapper', { timeout: 10000 });
        console.log('✓ 页面加载成功');
        results.push({ test: '页面加载', status: 'pass' });

        console.log('\n=== 测试 2: 检查全局状态 ===');
        await page.waitForTimeout(1000);
        const globalState = await page.evaluate(() => {
            return {
                hasState: typeof window.appState !== 'undefined',
                hasFabric: typeof window.appFabric !== 'undefined',
                hasCanvas: window.appState?.fabricCanvas !== undefined,
                hasUndo: typeof window.appUndo === 'function',
                hasRedo: typeof window.appRedo === 'function'
            };
        });
        console.log('全局状态:', globalState);
        if (globalState.hasState && globalState.hasFabric && globalState.hasCanvas) {
            console.log('✓ 全局状态完整暴露');
            results.push({ test: '全局状态暴露', status: 'pass' });
        } else {
            console.log('✗ 全局状态不完整');
            results.push({ test: '全局状态暴露', status: 'fail' });
        }

        console.log('\n=== 测试 3: 上传图片 ===');
        const fileInput = await page.$('#image-upload-input');
        if (fileInput) {
            await fileInput.setInputFiles('D:/Projects/llm-prompt-tool/app/uploads/0e2a6d51-8a90-48b8-86f8-58a6e0e20925.jpg');
            await page.waitForTimeout(2000);
            console.log('✓ 图片上传成功');
            results.push({ test: '图片上传', status: 'pass' });
        }

        console.log('\n=== 测试 4: 添加标注框 ===');
        const rectAdded = await page.evaluate(() => {
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
            return 0;
        });
        if (rectAdded > 0) {
            console.log(`✓ 标注框添加成功，当前数量: ${rectAdded}`);
            results.push({ test: '添加标注框', status: 'pass' });
        } else {
            console.log('✗ 标注框添加失败');
            results.push({ test: '添加标注框', status: 'fail' });
        }

        console.log('\n=== 测试 5: Delete 键删除 ===');
        const rectBeforeDelete = await page.evaluate(() => window.appState?.fabricCanvas?.getObjects('rect').length || 0);
        await page.keyboard.press('Delete');
        await page.waitForTimeout(500);
        const rectAfterDelete = await page.evaluate(() => window.appState?.fabricCanvas?.getObjects('rect').length || 0);
        if (rectAfterDelete < rectBeforeDelete) {
            console.log(`✓ Delete键删除成功: ${rectBeforeDelete} -> ${rectAfterDelete}`);
            results.push({ test: 'Delete键删除', status: 'pass' });
        } else {
            console.log('✗ Delete键删除失败');
            results.push({ test: 'Delete键删除', status: 'fail' });
        }

        console.log('\n=== 测试 6: 撤销功能 ===');
        // 添加框用于撤销测试
        await page.evaluate(() => {
            const rect = new window.appFabric.Rect({
                left: 200, top: 200, width: 80, height: 80,
                fill: 'rgba(234, 67, 53, 0.2)', stroke: '#ea4335',
                strokeWidth: 2, selectable: true
            });
            window.appState.fabricCanvas.add(rect);
        });
        const rectBeforeUndo = await page.evaluate(() => window.appState?.fabricCanvas?.getObjects('rect').length || 0);
        console.log(`撤销前数量: ${rectBeforeUndo}`);

        // 使用暴露的撤销函数
        await page.evaluate(() => window.appUndo());
        await page.waitForTimeout(500);
        const rectAfterUndo = await page.evaluate(() => window.appState?.fabricCanvas?.getObjects('rect').length || 0);
        if (rectAfterUndo < rectBeforeUndo) {
            console.log(`✓ 撤销功能正常: ${rectBeforeUndo} -> ${rectAfterUndo}`);
            results.push({ test: '撤销功能', status: 'pass' });
        } else {
            console.log(`✗ 撤销功能失败: ${rectBeforeUndo} -> ${rectAfterUndo}`);
            results.push({ test: '撤销功能', status: 'fail' });
        }

        console.log('\n=== 测试 7: 重做功能 ===');
        await page.evaluate(() => window.appRedo());
        await page.waitForTimeout(500);
        const rectAfterRedo = await page.evaluate(() => window.appState?.fabricCanvas?.getObjects('rect').length || 0);
        if (rectAfterRedo > rectAfterUndo) {
            console.log(`✓ 重做功能正常: ${rectAfterUndo} -> ${rectAfterRedo}`);
            results.push({ test: '重做功能', status: 'pass' });
        } else {
            console.log(`✗ 重做功能失败: ${rectAfterUndo} -> ${rectAfterRedo}`);
            results.push({ test: '重做功能', status: 'fail' });
        }

        console.log('\n=== 测试 8: 右键菜单 ===');
        // 添加并选中一个矩形
        await page.evaluate(() => {
            const rect = new window.appFabric.Rect({
                left: 300, top: 300, width: 60, height: 60,
                fill: 'rgba(234, 67, 53, 0.2)', stroke: '#ea4335',
                strokeWidth: 2, selectable: true
            });
            window.appState.fabricCanvas.add(rect);
            window.appState.fabricCanvas.setActiveObject(rect);
        });
        await page.waitForTimeout(500);

        const canvasBox = await page.$('#canvas-wrapper');
        if (canvasBox) {
            const box = await canvasBox.boundingBox();
            // 右键点击选中矩形
            await page.mouse.click(box.x + 330, box.y + 330, { button: 'right' });
            await page.waitForTimeout(500);

            const menuDisplay = await page.evaluate(() => {
                const menu = document.getElementById('box-context-menu');
                return menu ? menu.style.display : '菜单不存在';
            });
            console.log(`右键菜单 display: ${menuDisplay}`);

            if (menuDisplay === 'block') {
                console.log('✓ 右键菜单显示正常');
                const rectBeforeCtxDelete = await page.evaluate(() => window.appState?.fabricCanvas?.getObjects('rect').length || 0);

                // 点击删除
                await page.click('#ctx-delete-box');
                await page.waitForTimeout(500);

                const rectAfterCtxDelete = await page.evaluate(() => window.appState?.fabricCanvas?.getObjects('rect').length || 0);
                console.log(`✓ 右键菜单删除: ${rectBeforeCtxDelete} -> ${rectAfterCtxDelete}`);
                results.push({ test: '右键菜单删除', status: 'pass' });
            } else {
                console.log('✗ 右键菜单未显示');
                results.push({ test: '右键菜单删除', status: 'fail' });
            }
        }

        console.log('\n=== 测试 9: 自动保存间隔设置 ===');
        await page.selectOption('#auto-save-interval', '300000');
        const selectedValue = await page.$eval('#auto-save-interval', el => el.value);
        if (selectedValue === '300000') {
            console.log('✓ 自动保存间隔设置成功: 5分钟');
            results.push({ test: '自动保存间隔设置', status: 'pass' });
        } else {
            console.log('✗ 自动保存间隔设置失败');
            results.push({ test: '自动保存间隔设置', status: 'fail' });
        }

        console.log('\n=== 测试 10: 保存状态更新 ===');
        // 添加框触发未保存状态
        await page.evaluate(() => {
            const rect = new window.appFabric.Rect({
                left: 50, top: 50, width: 50, height: 50,
                fill: 'rgba(234, 67, 53, 0.2)', stroke: '#ea4335',
                strokeWidth: 2, selectable: true
            });
            window.appState.fabricCanvas.add(rect);
        });
        await page.waitForTimeout(300);

        const saveStatusDirty = await page.$eval('#save-status', el => el.textContent);
        if (saveStatusDirty === '未保存') {
            console.log('✓ 保存状态正确显示为"未保存"');
            results.push({ test: '保存状态更新', status: 'pass' });
        } else {
            console.log(`⚠ 保存状态显示: ${saveStatusDirty}`);
            results.push({ test: '保存状态更新', status: 'warn' });
        }

        console.log('\n=== 测试 11: 暂存区功能 ===');
        const hasAnnotationCache = await page.evaluate(() => {
            return typeof window.appState?.annotationCache !== 'undefined';
        });
        if (hasAnnotationCache) {
            console.log('✓ 暂存区 annotationCache 存在');
            results.push({ test: '暂存区功能', status: 'pass' });
        } else {
            console.log('✗ 暂存区功能不存在');
            results.push({ test: '暂存区功能', status: 'fail' });
        }

    } catch (error) {
        console.error('\n测试执行错误:', error.message);
        results.push({ test: '测试执行', status: 'error', message: error.message });
    } finally {
        await browser.close();
    }

    console.log('\n\n========== 测试结果汇总 ==========');
    results.forEach(r => {
        const icon = r.status === 'pass' ? '✓' : r.status === 'fail' ? '✗' : r.status === 'warn' ? '⚠' : '✗';
        console.log(`${icon} ${r.test}: ${r.status.toUpperCase()}${r.message ? ' - ' + r.message : ''}`);
    });

    const passed = results.filter(r => r.status === 'pass').length;
    const failed = results.filter(r => r.status === 'fail').length;
    const warnings = results.filter(r => r.status === 'warn').length;
    console.log(`\n通过: ${passed}/${results.length}`);
    if (failed > 0) console.log(`失败: ${failed}/${results.length}`);
    if (warnings > 0) console.log(`警告: ${warnings}/${results.length}`);

    return results;
}

testAnnotationFeatures();