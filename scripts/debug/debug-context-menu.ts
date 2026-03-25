import { chromium, BrowserType } from '@playwright/test';
import * as path from 'path';

async function debugContextMenu() {
    // 使用系统 Chrome
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

    console.log('启动浏览器...');
    const browser = await chromium.launch({
        headless: false,
        executablePath: chromePath
    });

    const page = await browser.newPage();

    try {
        // 访问页面
        console.log('访问页面...');
        await page.goto('http://localhost:5001', { waitUntil: 'networkidle' });
        console.log('✓ 页面加载成功');

        // 检查右键菜单是否存在
        const contextMenu = await page.$('#box-context-menu');
        if (contextMenu) {
            console.log('✓ 右键菜单元素存在');
            const menuHTML = await page.evaluate(() => {
                const menu = document.getElementById('box-context-menu');
                return menu ? menu.outerHTML : '不存在';
            });
            console.log(`菜单HTML: ${menuHTML}`);
        } else {
            console.log('✗ 右键菜单元素不存在!');
        }

        // 检查环境
        const envCheck = await page.evaluate(() => {
            return {
                hasFabric: typeof (window as any).fabric !== 'undefined',
                hasState: typeof (window as any).state !== 'undefined',
                hasDom: typeof (window as any).dom !== 'undefined'
            };
        });
        console.log('环境检查:', envCheck);

        // 上传图片
        console.log('上传测试图片...');
        const fileInput = await page.$('#image-upload-input');
        if (fileInput) {
            await fileInput.setInputFiles('D:/Projects/llm-prompt-tool/app/uploads/0e2a6d51-8a90-48b8-86f8-58a6e0e20925.jpg');
            await page.waitForTimeout(2000);
        }

        // 添加测试矩形
        const rectResult = await page.evaluate(() => {
            const state = (window as any).state;
            const fabric = (window as any).fabric;
            if (!state || !state.fabricCanvas || !fabric) {
                return 'state 或 fabricCanvas 不存在';
            }

            const rect = new fabric.Rect({
                left: 100,
                top: 100,
                width: 100,
                height: 100,
                fill: 'rgba(234, 67, 53, 0.2)',
                stroke: '#ea4335',
                strokeWidth: 2,
                selectable: true
            });
            state.fabricCanvas.add(rect);
            state.fabricCanvas.setActiveObject(rect);
            return `矩形已添加，当前矩形数量: ${state.fabricCanvas.getObjects('rect').length}`;
        });
        console.log(rectResult);

        await page.waitForTimeout(1000);

        // 测试右键菜单
        console.log('测试右键菜单...');
        const canvasWrapper = await page.$('#canvas-wrapper');
        if (canvasWrapper) {
            const box = await canvasWrapper.boundingBox();
            if (box) {
                // 右键点击
                await page.mouse.click(box.x + 150, box.y + 150, { button: 'right' });
                await page.waitForTimeout(500);

                const menuVisible = await page.evaluate(() => {
                    const menu = document.getElementById('box-context-menu');
                    return menu ? menu.style.display : '菜单不存在';
                });
                console.log(`右键菜单显示状态: ${menuVisible}`);
            }
        }

        // 测试 Delete 键
        console.log('测试 Delete 键...');
        const rectCountBefore = await page.evaluate(() => {
            const state = (window as any).state;
            return state ? state.fabricCanvas.getObjects('rect').length : -1;
        });
        console.log(`Delete 前矩形数量: ${rectCountBefore}`);

        await page.keyboard.press('Delete');
        await page.waitForTimeout(500);

        const rectCountAfter = await page.evaluate(() => {
            const state = (window as any).state;
            return state ? state.fabricCanvas.getObjects('rect').length : -1;
        });
        console.log(`Delete 后矩形数量: ${rectCountAfter}`);

        console.log('\n=== 调试完成 ===');
        if (rectCountBefore !== rectCountAfter) {
            console.log('✓ Delete 键功能正常');
        } else {
            console.log('✗ Delete 键功能异常');
        }

    } catch (error: any) {
        console.error('错误:', error.message);
    } finally {
        await browser.close();
    }
}

debugContextMenu();