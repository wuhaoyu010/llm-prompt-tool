import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E 测试配置
 * 用于测试 LLM Prompt Tool 的自动标注功能
 */
export default defineConfig({
  // 测试目录
  testDir: './tests/e2e',

  // 完全并行运行测试
  fullyParallel: true,

  // CI 环境禁止 only 标记
  forbidOnly: !!process.env.CI,

  // CI 环境重试次数
  retries: process.env.CI ? 2 : 0,

  // CI 环境单线程运行
  workers: process.env.CI ? 1 : undefined,

  // 报告器配置
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'playwright-results.json' }],
    ['list']
  ],

  // 全局测试配置
  use: {
    // 基础 URL - Flask 应用默认端口 5001
    baseURL: process.env.BASE_URL || 'http://localhost:5001',

    // 首次重试时收集追踪
    trace: 'on-first-retry',

    // 失败时截图
    screenshot: 'only-on-failure',

    // 失败时保留视频
    video: 'retain-on-failure',

    // 操作超时时间
    actionTimeout: 10000,

    // 导航超时时间
    navigationTimeout: 30000,

    // 浏览器上下文配置
    contextOptions: {
      // 忽略 HTTPS 错误（开发环境）
      ignoreHTTPSErrors: true,
    },
  },

  // 测试项目配置
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    // 移动端测试（可选）
    // {
    //   name: 'mobile-chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
  ],

  // 开发服务器配置（可选，用于自动启动服务）
  // webServer: {
  //   command: 'python run.py',
  //   url: 'http://localhost:5001',
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 120000,
  // },

  // 测试超时配置
  timeout: 60000,
  expect: {
    // 断言超时时间
    timeout: 10000,
  },
})