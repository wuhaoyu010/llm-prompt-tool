const { chromium } = require('@playwright/test');

async function runFullTest() {
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    console.log('='.repeat(60));
    console.log('LLM Prompt Tool - 前端功能全面测试');
    console.log('='.repeat(60));

    const browser = await chromium.launch({ headless: false, executablePath: chromePath });
    const page = await browser.newPage();

    const results = {
        performance: [],
        modal: [],
        keyboard: [],
        repaint: []
    };

    try {
        // ========== 1. 性能流畅度测试 ==========
        console.log('\n\n' + '='.repeat(60));
        console.log('【测试 1】性能流畅度测试');
        console.log('='.repeat(60));

        await page.goto('http://localhost:5001', { waitUntil: 'networkidle' });
        await page.waitForSelector('#canvas-wrapper', { timeout: 10000 });

        // 1.1 滚动测试
        console.log('\n--- 1.1 上下滚动测试 ---');
        const scrollPerf = await page.evaluate(() => {
            const start = performance.now();
            for (let i = 0; i < 10; i++) {
                window.scrollBy(0, 100);
            }
            return { time: performance.now() - start };
        });
        console.log(`滚动10次耗时: ${scrollPerf.time.toFixed(2)}ms`);
        results.performance.push({
            name: '滚动性能',
            status: scrollPerf.time < 500 ? 'pass' : 'fail',
            value: `${scrollPerf.time.toFixed(2)}ms`,
            threshold: '<500ms'
        });

        // 1.2 模块打开关闭测试
        console.log('\n--- 1.2 功能模块打开关闭测试 ---');
        const moduleTests = [
            { id: '#defect-manager-btn', name: '缺陷管理按钮' },
            { id: '#settings-btn', name: '设置按钮' }
        ];

        for (const mod of moduleTests) {
            const btn = await page.$(mod.id);
            if (btn) {
                const openTime = await page.evaluate((id) => {
                    const start = performance.now();
                    document.querySelector(id)?.click();
                    return performance.now() - start;
                }, mod.id);

                await page.waitForTimeout(300);
                const closeTime = await page.evaluate(() => {
                    const start = performance.now();
                    document.querySelector('.modal-backdrop')?.click();
                    return performance.now() - start;
                });

                console.log(`${mod.name}: 打开${openTime.toFixed(2)}ms, 关闭${closeTime.toFixed(2)}ms`);
                results.performance.push({
                    name: `${mod.name}响应`,
                    status: openTime < 200 && closeTime < 200 ? 'pass' : 'warn',
                    value: `打开${openTime.toFixed(0)}ms/关闭${closeTime.toFixed(0)}ms`,
                    threshold: '<200ms'
                });
            }
        }

        // ========== 2. 模态框关闭功能测试 ==========
        console.log('\n\n' + '='.repeat(60));
        console.log('【测试 2】模态框关闭功能测试');
        console.log('='.repeat(60));

        // 2.1 ESC键关闭
        console.log('\n--- 2.1 ESC键关闭测试 ---');
        const modalTest = await page.evaluate(() => {
            // 打开一个模态框
            const btn = document.querySelector('#settings-btn') || document.querySelector('[data-action="open"]');
            if (btn) btn.click();
            return new Promise(resolve => {
                setTimeout(() => {
                    const modal = document.querySelector('.modal-backdrop, .modal');
                    if (modal) {
                        // 按ESC
                        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
                        setTimeout(() => {
                            const closed = !document.querySelector('.modal-backdrop, .modal.show');
                            resolve({ closed, method: 'ESC键' });
                        }, 300);
                    } else {
                        resolve({ closed: false, method: '无模态框可测试' });
                    }
                }, 500);
            });
        });
        console.log(`ESC键关闭: ${modalTest.closed ? '✓ 成功' : '✗ 失败'} (${modalTest.method})`);
        results.modal.push({
            name: 'ESC键关闭',
            status: modalTest.closed ? 'pass' : 'fail',
            method: modalTest.method
        });

        // 2.2 右上角关闭按钮
        console.log('\n--- 2.2 右上角关闭按钮测试 ---');
        const closeBtnTest = await page.evaluate(() => {
            return new Promise(resolve => {
                // 打开模态框
                const btn = document.querySelector('#settings-btn');
                if (btn) btn.click();
                setTimeout(() => {
                    const closeBtn = document.querySelector('.modal .close, .modal-header .btn-close');
                    if (closeBtn) {
                        closeBtn.click();
                        setTimeout(() => {
                            const closed = !document.querySelector('.modal.show, .modal-backdrop.show');
                            resolve({ closed, method: '关闭按钮' });
                        }, 300);
                    } else {
                        resolve({ closed: false, method: '无关闭按钮' });
                    }
                }, 500);
            });
        });
        console.log(`关闭按钮: ${closeBtnTest.closed ? '✓ 成功' : '✗ 失败'} (${closeBtnTest.method})`);
        results.modal.push({
            name: '右上角关闭按钮',
            status: closeBtnTest.closed ? 'pass' : 'warn',
            method: closeBtnTest.method
        });

        // 2.3 取消按钮
        console.log('\n--- 2.3 取消按钮测试 ---');
        const cancelBtnTest = await page.evaluate(() => {
            return new Promise(resolve => {
                const btn = document.querySelector('#settings-btn');
                if (btn) btn.click();
                setTimeout(() => {
                    const cancelBtn = document.querySelector('.modal .btn-secondary, .modal .cancel-btn, .modal button:not(.btn-primary):not(.close)');
                    if (cancelBtn) {
                        cancelBtn.click();
                        setTimeout(() => {
                            const closed = !document.querySelector('.modal.show, .modal-backdrop.show');
                            resolve({ closed, method: '取消按钮' });
                        }, 300);
                    } else {
                        resolve({ closed: false, method: '无取消按钮' });
                    }
                }, 500);
            });
        });
        console.log(`取消按钮: ${cancelBtnTest.closed ? '✓ 成功' : '✗ 失败'} (${cancelBtnTest.method})`);
        results.modal.push({
            name: '取消按钮关闭',
            status: cancelBtnTest.closed ? 'pass' : 'warn',
            method: cancelBtnTest.method
        });

        // ========== 3. 键盘快捷键测试 ==========
        console.log('\n\n' + '='.repeat(60));
        console.log('【测试 3】键盘快捷键冲突测试');
        console.log('='.repeat(60));

        const shortcutTests = [
            { key: 's', ctrl: true, name: 'Ctrl+S 保存' },
            { key: 'z', ctrl: true, name: 'Ctrl+Z 撤销' },
            { key: 'z', ctrl: true, shift: true, name: 'Ctrl+Shift+Z 重做' },
            { key: 'd', ctrl: true, name: 'Ctrl+D 绘图模式' },
            { key: 'a', ctrl: true, name: 'Ctrl+A 全选' }
        ];

        for (const shortcut of shortcutTests) {
            const result = await page.evaluate((s) => {
                const prevented = [];
                const handler = (e) => {
                    if (e.key === s.key && e.ctrlKey === !!s.ctrl && e.shiftKey === !!s.shift) {
                        prevented.push(e.defaultPrevented);
                        e.preventDefault();
                    }
                };
                document.addEventListener('keydown', handler, { once: true });

                const keys = (s.ctrl ? 'Control+' : '') + (s.shift ? 'Shift+' : '') + s.key.toUpperCase();
                return { keys, prevented: prevented.length > 0 };
            }, shortcut);

            console.log(`${shortcut.name}: ${result.prevented ? '✓ 已阻止默认行为' : '⚠ 未阻止'}`);
            results.keyboard.push({
                name: shortcut.name,
                status: result.prevented ? 'pass' : 'warn',
                detail: result.prevented ? '已处理' : '可能被浏览器拦截'
            });
        }

        // ========== 4. 界面重绘测试 ==========
        console.log('\n\n' + '='.repeat(60));
        console.log('【测试 4】界面重绘问题测试');
        console.log('='.repeat(60));

        const repaintTest = await page.evaluate(() => {
            const observer = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (entry.entryType === 'layout') {
                        console.log('Layout shift:', entry.value);
                    }
                }
            });

            // 监听频繁操作
            let renderCount = 0;
            const startTime = performance.now();

            // 模拟滚动
            for (let i = 0; i < 20; i++) {
                window.scrollBy(0, 50);
            }

            // 模拟悬停
            const elements = document.querySelectorAll('button, .btn, .nav-item');
            elements.forEach(el => el.dispatchEvent(new MouseEvent('mouseenter')));

            const duration = performance.now() - startTime;
            return {
                duration,
                rendersPerSecond: (renderCount / duration * 1000).toFixed(2)
            };
        });

        console.log(`操作完成耗时: ${repaintTest.duration.toFixed(2)}ms`);
        console.log(`FPS: ${repaintTest.rendersPerSecond}`);
        results.repaint.push({
            name: '重绘频率',
            status: repaintTest.duration < 1000 ? 'pass' : 'warn',
            value: `${repaintTest.duration.toFixed(0)}ms / ${repaintTest.rendersPerSecond} FPS`,
            threshold: '<1000ms'
        });

        // ========== 测试报告 ==========
        console.log('\n\n' + '='.repeat(60));
        console.log('【测试报告】');
        console.log('='.repeat(60));

        const allResults = [...results.performance, ...results.modal, ...results.keyboard, ...results.repaint];

        console.log('\n--- 1. 性能流畅度 ---');
        results.performance.forEach(r => {
            const icon = r.status === 'pass' ? '✓' : r.status === 'fail' ? '✗' : '⚠';
            console.log(`${icon} ${r.name}: ${r.value || ''} (标准: ${r.threshold})`);
        });

        console.log('\n--- 2. 模态框关闭 ---');
        results.modal.forEach(r => {
            const icon = r.status === 'pass' ? '✓' : r.status === 'fail' ? '✗' : '⚠';
            console.log(`${icon} ${r.name}: ${r.method || ''}`);
        });

        console.log('\n--- 3. 键盘快捷键 ---');
        results.keyboard.forEach(r => {
            const icon = r.status === 'pass' ? '✓' : r.status === 'fail' ? '✗' : '⚠';
            console.log(`${icon} ${r.name}: ${r.detail || ''}`);
        });

        console.log('\n--- 4. 界面重绘 ---');
        results.repaint.forEach(r => {
            const icon = r.status === 'pass' ? '✓' : r.status === 'fail' ? '✗' : '⚠';
            console.log(`${icon} ${r.name}: ${r.value || ''}`);
        });

        const passed = allResults.filter(r => r.status === 'pass').length;
        const warnings = allResults.filter(r => r.status === 'warn').length;
        const failed = allResults.filter(r => r.status === 'fail').length;

        console.log('\n' + '-'.repeat(40));
        console.log(`测试结果: ${passed} 通过 / ${warnings} 警告 / ${failed} 失败`);

        if (failed > 0) {
            console.log('\n【严重问题】');
            allResults.filter(r => r.status === 'fail').forEach(r => {
                console.log(`✗ ${r.name}: ${r.detail || r.value}`);
            });
        }

        if (warnings.length > 0) {
            console.log('\n【需关注】');
            allResults.filter(r => r.status === 'warn').forEach(r => {
                console.log(`⚠ ${r.name}: ${r.detail || r.value}`);
            });
        }

        console.log('\n' + '='.repeat(60));

    } catch (error) {
        console.error('\n测试执行错误:', error.message);
    } finally {
        await browser.close();
    }

    return results;
}

runFullTest();