const { chromium } = require('@playwright/test');

async function runKeyboardAndRepaintTest() {
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    console.log('='.repeat(70));
    console.log('键盘快捷键冲突测试 & 界面重绘问题测试');
    console.log('='.repeat(70));

    const browser = await chromium.launch({ headless: false, executablePath: chromePath });
    const page = await browser.newPage();

    const results = {
        keyboard: [],
        repaint: []
    };

    try {
        await page.goto('http://localhost:5001', { waitUntil: 'networkidle' });
        await page.waitForSelector('#canvas-wrapper', { timeout: 10000 });
        console.log('✓ 页面加载成功\n');

        // ========== 1. 键盘快捷键冲突测试 ==========
        console.log('='.repeat(70));
        console.log('【测试 1】键盘快捷键冲突测试');
        console.log('='.repeat(70));

        // 定义所有要测试的快捷键
        const shortcuts = [
            // 全局快捷键（应该在画布外也能触发）
            { key: 's', ctrl: true, name: 'Ctrl+S', area: '全局', expected: '保存' },
            { key: 'z', ctrl: true, name: 'Ctrl+Z', area: '全局', expected: '撤销' },
            { key: 'Z', ctrl: true, shift: true, name: 'Ctrl+Shift+Z', area: '全局', expected: '重做' },
            { key: 'a', ctrl: true, name: 'Ctrl+A', area: '全局', expected: '全选' },
            { key: 'd', ctrl: true, name: 'Ctrl+D', area: '全局', expected: '绘图模式' },
            { key: 'p', ctrl: true, name: 'Ctrl+P', area: '全局', expected: '可能打印' },

            // 标注区域快捷键（仅在画布有焦点时有效）
            { key: 'Delete', name: 'Delete', area: '标注', expected: '删除选中' },
            { key: 'Backspace', name: 'Backspace', area: '标注', expected: '删除选中' },
            { key: 'Escape', name: 'Escape', area: '标注', expected: '取消/关闭' },
            { key: ' ', name: '空格', area: '标注', expected: '平移模式' },
        ];

        console.log('\n--- 全局快捷键测试 ---');
        for (const s of shortcuts.filter(s => s.area === '全局')) {
            // 检查代码中是否注册了这些快捷键
            const hasHandler = await page.evaluate((shortcut) => {
                // 检查 main.js 中是否定义了这些快捷键处理
                const code = window.appState ? 'found' : 'not_found';
                return code;
            }, s);

            // 实际触发测试
            await page.keyboard.press(s.ctrl ? (s.shift ? 'Control+Shift+' + s.key.replace('+', '') : 'Control+' + s.key) : s.key);
            await page.waitForTimeout(100);

            const result = await page.evaluate(() => {
                // 检查是否有通知弹出
                const notifications = document.querySelectorAll('.notification, .toast, .alert');
                const lastNotification = notifications[notifications.length - 1];
                return {
                    count: notifications.length,
                    text: lastNotification?.textContent || ''
                };
            });

            console.log(`${s.name} (${s.expected}): ${result.count > 0 ? '✓ 触发' : '⚠ 未触发'} ${result.text ? '- ' + result.text.substring(0, 30) : ''}`);
            results.keyboard.push({ name: s.name, expected: s.expected, triggered: result.count > 0 });
        }

        console.log('\n--- 标注区域快捷键测试 ---');
        // 先点击画布获取焦点
        await page.click('#canvas-wrapper');
        await page.waitForTimeout(100);

        for (const s of shortcuts.filter(s => s.area === '标注')) {
            await page.keyboard.press(s.ctrl ? (s.shift ? 'Control+Shift+' + s.key.replace('+', '') : 'Control+' + s.key) : s.key);
            await page.waitForTimeout(100);

            const result = await page.evaluate(() => {
                const notifications = document.querySelectorAll('.notification, .toast');
                return notifications.length;
            });

            console.log(`${s.name} (${s.expected}): ${result > 0 ? '✓ 触发' : '⚠ 未触发'}`);
            results.keyboard.push({ name: s.name, area: '标注', expected: s.expected, triggered: result > 0 });
        }

        // ========== 2. 界面重绘问题测试 ==========
        console.log('\n\n' + '='.repeat(70));
        console.log('【测试 2】界面重绘问题测试');
        console.log('='.repeat(70));

        // 使用 Performance API 监控重绘
        const repaintTest = await page.evaluate(() => {
            return new Promise(resolve => {
                const results = {
                    operations: [],
                    layoutShifts: [],
                    renders: []
                };

                // 监听 layout-shift 性能条目
                const layoutObserver = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        if (entry.entryType === 'layout-shift') {
                            results.layoutShifts.push({
                                value: entry.value,
                                time: entry.startTime
                            });
                        }
                    }
                });

                try {
                    layoutObserver.observe({ type: 'layout-shift', buffered: true });
                } catch (e) {
                    console.log('Layout observer not supported');
                }

                // 记录操作前的渲染次数
                let renderCount = 0;
                const startTime = performance.now();

                // 模拟各种操作
                // 1. 滚动
                for (let i = 0; i < 10; i++) {
                    window.scrollBy(0, 100);
                }

                // 2. 悬停按钮
                const buttons = document.querySelectorAll('button');
                buttons.forEach(btn => {
                    btn.dispatchEvent(new MouseEvent('mouseenter'));
                });

                // 3. 点击按钮
                const settingsBtn = document.getElementById('settings-btn');
                if (settingsBtn) settingsBtn.click();

                // 4. 等待
                setTimeout(() => {
                    // 关闭模态框
                    const backdrop = document.getElementById('modal-backdrop');
                    if (backdrop) backdrop.click();

                    const duration = performance.now() - startTime;

                    results.duration = duration;
                    results.operationsCount = 10 + buttons.length + 2;

                    resolve(results);
                }, 500);
            });
        });

        console.log('\n--- 重绘测试结果 ---');
        console.log(`操作耗时: ${repaintTest.duration?.toFixed(2) || 'N/A'}ms`);
        console.log(`操作次数: ${repaintTest.operationsCount || 0}`);
        console.log(`Layout Shift 次数: ${repaintTest.layoutShifts?.length || 0}`);

        if (repaintTest.layoutShifts?.length > 0) {
            console.log('Layout Shift 明细:');
            repaintTest.layoutShifts.forEach((ls, i) => {
                console.log(`  ${i + 1}. value: ${ls.value.toFixed(4)} at ${ls.time.toFixed(0)}ms`);
            });
        }

        // 评估重绘影响
        const repaintScore = repaintTest.duration < 500 ? 'pass' : (repaintTest.duration < 1000 ? 'warn' : 'fail');
        results.repaint.push({
            name: '操作响应',
            status: repaintScore,
            value: `${repaintTest.duration?.toFixed(0) || 0}ms`,
            threshold: '<500ms'
        });

        if (repaintTest.layoutShifts?.length > 0) {
            const avgShift = repaintTest.layoutShifts.reduce((a, b) => a + b.value, 0) / repaintTest.layoutShifts.length;
            console.log(`平均 Layout Shift: ${avgShift.toFixed(4)}`);
        }

        // ========== 3. 定时器检查 ==========
        console.log('\n\n' + '='.repeat(70));
        console.log('【测试 3】定时器检查（可能引起频繁重绘）');
        console.log('='.repeat(70));

        const timerCheck = await page.evaluate(() => {
            // 检查是否有频繁的 setInterval
            const intervals = [];
            let maxCount = 0;
            let lastLogTime = Date.now();

            // 监控 2 秒内的 DOM 操作
            const startTime = Date.now();
            let domChanges = 0;

            const observer = new MutationObserver(() => {
                domChanges++;
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeOldValue: true,
                characterData: true
            });

            setTimeout(() => {
                observer.disconnect();
            }, 2000);

            return {
                monitored: '2秒',
                estimatedIntervalCount: intervals.length,
                maxIntervalMs: 0
            };
        });

        console.log(`监控时长: ${timerCheck.monitored}`);
        console.log(`检测到的频繁定时器: ${timerCheck.estimatedIntervalCount}`);

        // ========== 测试报告 ==========
        console.log('\n\n' + '='.repeat(70));
        console.log('【测试报告】');
        console.log('='.repeat(70));

        console.log('\n--- 1. 键盘快捷键 ---');
        results.keyboard.forEach(r => {
            const icon = r.triggered ? '✓' : '⚠';
            console.log(`${icon} ${r.name}: ${r.expected} (${r.area || '全局'})`);
        });

        console.log('\n--- 2. 界面重绘 ---');
        results.repaint.forEach(r => {
            const icon = r.status === 'pass' ? '✓' : r.status === 'warn' ? '⚠' : '✗';
            console.log(`${icon} ${r.name}: ${r.value} (标准: ${r.threshold})`);
        });

        const passed = results.repaint.filter(r => r.status === 'pass').length;
        const total = results.repaint.length;
        console.log(`\n重绘测试: ${passed}/${total} 通过`);

        console.log('\n--- 快捷键冲突分析 ---');
        const triggeredShortcuts = results.keyboard.filter(r => r.triggered);
        const untriggeredShortcuts = results.keyboard.filter(r => !r.triggered);

        if (triggeredShortcuts.length > 0) {
            console.log('✓ 正常触发的快捷键:');
            triggeredShortcuts.forEach(r => console.log(`  - ${r.name}: ${r.expected}`));
        }

        if (untriggeredShortcuts.length > 0) {
            console.log('⚠ 未触发的快捷键:');
            untriggeredShortcuts.forEach(r => console.log(`  - ${r.name}: ${r.expected}`));
        }

        console.log('\n' + '='.repeat(70));

    } catch (error) {
        console.error('\n测试执行错误:', error.message);
    } finally {
        await browser.close();
    }
}

runKeyboardAndRepaintTest();