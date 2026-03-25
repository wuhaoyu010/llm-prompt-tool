const { chromium } = require('@playwright/test');

async function diagnoseLagIssues() {
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    console.log('='.repeat(70));
    console.log('界面卡顿问题深度诊断');
    console.log('='.repeat(70));

    const browser = await chromium.launch({ headless: false, executablePath: chromePath });
    const page = await browser.newPage();

    try {
        await page.goto('http://localhost:5001', { waitUntil: 'networkidle' });
        await page.waitForSelector('#canvas-wrapper', { timeout: 10000 });

        console.log('\n--- 注入性能监控代码 ---\n');

        // 注入监控代码
        const monitorCode = await page.evaluate(() => {
            // 1. 监听长任务
            window.__longTasks = [];
            try {
                const taskObserver = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        if (entry.entryType === 'longtask') {
                            window.__longTasks.push({
                                duration: entry.duration,
                                time: entry.startTime
                            });
                        }
                    }
                });
                taskObserver.observe({ type: 'longtask', buffered: true });
            } catch(e) {}

            // 2. 监听 Layout Shift
            window.__layoutShifts = [];
            try {
                const layoutObserver = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        if (entry.entryType === 'layout-shift') {
                            window.__layoutShifts.push({
                                value: entry.value,
                                time: entry.startTime
                            });
                        }
                    }
                });
                layoutObserver.observe({ type: 'layout-shift', buffered: true });
            } catch(e) {}

            // 3. 追踪 requestAnimationFrame
            window.__rafCalls = [];
            const originalRAF = window.requestAnimationFrame;
            window.requestAnimationFrame = function(callback) {
                window.__rafCalls.push(Date.now());
                return originalRAF.call(window, callback);
            };

            // 4. 追踪 console.log 来自哪里
            return 'Monitor injected';
        });

        console.log(monitorCode);

        // ========== 执行 200 次鼠标移动测试 ==========
        console.log('\n--- 测试: 200次鼠标移动 ---');
        const startTime = Date.now();

        for (let i = 0; i < 200; i++) {
            await page.mouse.move(100 + (i % 50), 100 + Math.floor(i / 50) * 10);
        }

        const moveDuration = Date.now() - startTime;
        console.log(`200次鼠标移动耗时: ${moveDuration}ms (平均 ${(moveDuration/200).toFixed(2)}ms/次)`);

        // ========== 执行 50 次滚动测试 ==========
        console.log('\n--- 测试: 50次页面滚动 ---');
        const scrollStart = Date.now();

        for (let i = 0; i < 50; i++) {
            await page.evaluate(() => window.scrollBy(0, 50));
        }

        const scrollDuration = Date.now() - scrollStart;
        console.log(`50次滚动耗时: ${scrollDuration}ms (平均 ${(scrollDuration/50).toFixed(2)}ms/次)`);

        await page.waitForTimeout(1000);

        // ========== 收集结果 ==========
        console.log('\n--- 收集性能数据 ---\n');

        const results = await page.evaluate(() => {
            return {
                longTasks: window.__longTasks || [],
                layoutShifts: window.__layoutShifts || [],
                rafCalls: window.__rafCalls || []
            };
        });

        // ========== 分析结果 ==========
        console.log('='.repeat(70));
        console.log('【性能分析报告】');
        console.log('='.repeat(70));

        console.log(`\n--- 操作性能 ---`);
        console.log(`鼠标移动 200次: ${moveDuration}ms (${(moveDuration/200).toFixed(2)}ms/次)`);
        console.log(`页面滚动 50次: ${scrollDuration}ms (${(scrollDuration/50).toFixed(2)}ms/次)`);

        const moveAvg = moveDuration / 200;
        const scrollAvg = scrollDuration / 50;

        if (moveAvg > 10) {
            console.log(`\n⚠ 鼠标移动响应过慢 (>10ms/次)`);
        }
        if (scrollAvg > 20) {
            console.log(`\n⚠ 页面滚动响应过慢 (>20ms/次)`);
        }

        console.log(`\n--- 性能指标 ---`);
        console.log(`Long Task 次数: ${results.longTasks.length}`);
        console.log(`Layout Shift 次数: ${results.layoutShifts.length}`);
        console.log(`requestAnimationFrame 调用: ${results.rafCalls.length}`);

        if (results.longTasks.length > 0) {
            console.log(`\n长任务详情:`);
            results.longTasks.slice(0, 10).forEach((t, i) => {
                console.log(`  ${i+1}. ${t.duration.toFixed(2)}ms at ${t.time.toFixed(0)}ms`);
            });
        }

        if (results.layoutShifts.length > 0) {
            console.log(`\nLayout Shift 详情:`);
            const total = results.layoutShifts.reduce((a, b) => a + b.value, 0);
            const avg = total / results.layoutShifts.length;
            const max = Math.max(...results.layoutShifts.map(s => s.value));
            console.log(`  总次数: ${results.layoutShifts.length}`);
            console.log(`  平均值: ${avg.toFixed(4)}`);
            console.log(`  最大值: ${max.toFixed(4)}`);
        }

        // ========== 问题诊断 ==========
        console.log('\n' + '='.repeat(70));
        console.log('【问题诊断】');
        console.log('='.repeat(70));

        const issues = [];

        if (results.longTasks.length > 3) {
            issues.push('HIGH: 检测到多个长任务 (>50ms)，可能导致明显卡顿');
        }

        if (results.layoutShifts.length > 20) {
            issues.push('HIGH: Layout Shift 频繁，可能导致远程桌面卡顿');
        }

        if (moveAvg > 16) {
            issues.push('MEDIUM: 鼠标移动响应慢，可能需要优化事件处理');
        }

        if (issues.length === 0) {
            console.log('\n✓ 未检测到明显性能问题');
        } else {
            issues.forEach((issue, i) => {
                console.log(`\n${i+1}. ${issue}`);
            });
        }

        // ========== 建议 ==========
        console.log('\n' + '='.repeat(70));
        console.log('【优化建议】');
        console.log('='.repeat(70));
        console.log(`
1. 如果检测到长任务:
   - 检查 setInterval 回调
   - 检查 checkLLMHealth 函数
   - 避免在事件处理中执行复杂计算

2. 如果 Layout Shift 频繁:
   - 避免动态修改 DOM 高度
   - 使用 CSS transform 而非 top/left
   - 避免在滚动时触发重绘

3. 远程桌面优化:
   - 启用 GPU 硬件加速
   - 降低远程桌面颜色深度
   - 使用轻量级渲染模式
`);

        console.log('='.repeat(70));

    } catch (error) {
        console.error('测试错误:', error.message);
    } finally {
        await browser.close();
    }
}

diagnoseLagIssues();