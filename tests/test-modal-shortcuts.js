const { chromium } = require('@playwright/test');

async function testModalAndShortcuts() {
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    console.log('='.repeat(60));
    console.log('模态框和快捷键详细测试');
    console.log('='.repeat(60));

    const browser = await chromium.launch({ headless: false, executablePath: chromePath });
    const page = await browser.newPage();

    try {
        await page.goto('http://localhost:5001', { waitUntil: 'networkidle' });
        await page.waitForSelector('#canvas-wrapper', { timeout: 10000 });
        console.log('✓ 页面加载成功\n');

        // 测试1: 检查模态框元素
        console.log('--- 检查模态框元素 ---');
        const modalInfo = await page.evaluate(() => {
            const backdrop = document.getElementById('modal-backdrop');
            const settingsBtn = document.getElementById('settings-btn');
            const settingsModal = document.getElementById('settings-modal');
            return {
                backdropExists: !!backdrop,
                backdropDisplay: backdrop?.style.display,
                backdropClass: backdrop?.className,
                settingsBtnExists: !!settingsBtn,
                settingsModalExists: !!settingsModal,
                settingsModalDisplay: settingsModal?.style.display
            };
        });
        console.log('模态框信息:', JSON.stringify(modalInfo, null, 2));

        // 测试2: 打开设置模态框
        console.log('\n--- 打开设置模态框 ---');
        await page.click('#settings-btn');
        await page.waitForTimeout(500);

        const afterOpen = await page.evaluate(() => {
            const backdrop = document.getElementById('modal-backdrop');
            const settingsModal = document.getElementById('settings-modal');
            return {
                backdropDisplay: backdrop?.style.display,
                settingsModalDisplay: settingsModal?.style.display,
                anyModalVisible: !!document.querySelector('.modal[style*="block"]')
            };
        });
        console.log('打开后状态:', JSON.stringify(afterOpen, null, 2));

        // 测试3: ESC键
        console.log('\n--- ESC键测试 ---');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);

        const afterEsc = await page.evaluate(() => {
            const backdrop = document.getElementById('modal-backdrop');
            return {
                backdropDisplay: backdrop?.style.display,
                backdropVisible: backdrop?.offsetParent !== null
            };
        });
        console.log('ESC后状态:', JSON.stringify(afterEsc, null, 2));

        // 测试4: 重新打开并测试关闭按钮
        console.log('\n--- 关闭按钮测试 ---');
        await page.click('#settings-btn');
        await page.waitForTimeout(300);

        const closeBtnTest = await page.evaluate(() => {
            const modal = document.getElementById('settings-modal');
            if (!modal) return '无settings-modal';

            // 查找关闭按钮
            const closeBtn = modal.querySelector('.modal-header .close') ||
                           modal.querySelector('.btn-close') ||
                           modal.querySelector('[data-dismiss="modal"]');
            const cancelBtn = modal.querySelector('.btn-secondary, .cancel-btn');

            return {
                closeBtnFound: !!closeBtn,
                closeBtnHTML: closeBtn?.outerHTML?.substring(0, 100),
                cancelBtnFound: !!cancelBtn,
                cancelBtnHTML: cancelBtn?.outerHTML?.substring(0, 100)
            };
        });
        console.log('关闭按钮信息:', JSON.stringify(closeBtnTest, null, 2));

        if (closeBtnTest.closeBtnFound) {
            await page.click('#settings-modal .close');
            await page.waitForTimeout(300);
        } else if (closeBtnTest.cancelBtnFound) {
            await page.click('#settings-modal .btn-secondary, #settings-modal .cancel-btn');
            await page.waitForTimeout(300);
        }

        const afterBtnClose = await page.evaluate(() => {
            const backdrop = document.getElementById('modal-backdrop');
            return { backdropDisplay: backdrop?.style.display };
        });
        console.log('按钮关闭后:', JSON.stringify(afterBtnClose, null, 2));

        // 测试5: 键盘快捷键
        console.log('\n--- 键盘快捷键测试 ---');

        // 测试 Ctrl+S
        console.log('测试 Ctrl+S...');
        await page.keyboard.press('Control+s');
        await page.waitForTimeout(200);
        const ctrlSResult = await page.evaluate(() => {
            const notification = document.querySelector('.notification.success, .toast.success');
            return notification ? '保存成功' : '无响应';
        });
        console.log(`Ctrl+S 结果: ${ctrlSResult}`);

        // 测试 Ctrl+Z
        console.log('测试 Ctrl+Z...');
        await page.keyboard.press('Control+z');
        await page.waitForTimeout(200);
        const ctrlZResult = await page.evaluate(() => {
            const notification = document.querySelector('.notification, .toast');
            return notification ? notification.textContent : '无响应';
        });
        console.log(`Ctrl+Z 结果: ${ctrlZResult}`);

        console.log('\n' + '='.repeat(60));

    } catch (error) {
        console.error('测试错误:', error.message);
    } finally {
        await browser.close();
    }
}

testModalAndShortcuts();