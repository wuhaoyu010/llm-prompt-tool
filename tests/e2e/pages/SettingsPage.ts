/**
 * Settings Page Object Model
 * Handles the settings modal for Trueno3 configuration
 */

import { Page, Locator, expect } from '@playwright/test'
import { BasePage } from './BasePage'

export interface Trueno3Config {
  enabled: boolean
  sshHost: string
  sshPort: number
  sshUsername: string
  sshPassword: string
  codePath: string
  serviceHost: string
  servicePort: number
  apiPath: string
  callbackHost: string
  callbackPort: number
}

export interface LLMConfig {
  apiKey: string
  apiUrl: string
  defaultModel: string
  temperature: number
  maxTokens: number
}

export class SettingsPage extends BasePage {
  // Locators
  readonly settingsBtn: Locator
  readonly settingsModal: Locator
  readonly closeBtn: Locator

  // Trueno3 Config
  readonly trueno3EnabledCheckbox: Locator
  readonly trueno3SshHostInput: Locator
  readonly trueno3SshPortInput: Locator
  readonly trueno3SshUsernameInput: Locator
  readonly trueno3SshPasswordInput: Locator
  readonly trueno3CodePathInput: Locator
  readonly trueno3ServiceHostInput: Locator
  readonly trueno3ServicePortInput: Locator
  readonly trueno3ApiPathInput: Locator
  readonly trueno3CallbackHostInput: Locator
  readonly trueno3CallbackPortInput: Locator
  readonly testSshBtn: Locator
  readonly testServiceBtn: Locator

  // LLM Config
  readonly llmApiKeyInput: Locator
  readonly llmApiUrlInput: Locator
  readonly llmModelSelect: Locator
  readonly llmTemperatureInput: Locator
  readonly llmMaxTokensInput: Locator

  // Save button
  readonly saveBtn: Locator

  constructor(page: Page) {
    super(page)
    this.settingsBtn = page.locator('#settings-btn, button:has-text("设置")')
    this.settingsModal = page.locator('#settings-modal')
    this.closeBtn = this.settingsModal.locator('.modal-close, .close-btn')

    // Trueno3 SSH Config
    this.trueno3EnabledCheckbox = page.locator('#trueno3-enabled, input[name="trueno3_enabled"]')
    this.trueno3SshHostInput = page.locator('#trueno3-ssh-host, input[name="ssh_host"]')
    this.trueno3SshPortInput = page.locator('#trueno3-ssh-port, input[name="ssh_port"]')
    this.trueno3SshUsernameInput = page.locator('#trueno3-ssh-username, input[name="ssh_username"]')
    this.trueno3SshPasswordInput = page.locator('#trueno3-ssh-password, input[name="ssh_password"]')
    this.trueno3CodePathInput = page.locator('#trueno3-code-path, input[name="code_path"]')

    // Trueno3 Service Config
    this.trueno3ServiceHostInput = page.locator('#trueno3-service-host, input[name="service_host"]')
    this.trueno3ServicePortInput = page.locator('#trueno3-service-port, input[name="service_port"]')
    this.trueno3ApiPathInput = page.locator('#trueno3-api-path, input[name="api_path"]')
    this.trueno3CallbackHostInput = page.locator('#trueno3-callback-host, input[name="callback_host"]')
    this.trueno3CallbackPortInput = page.locator('#trueno3-callback-port, input[name="callback_port"]')

    // Test buttons
    this.testSshBtn = page.locator('#test-ssh-btn, button:has-text("测试 SSH")')
    this.testServiceBtn = page.locator('#test-service-btn, button:has-text("测试服务")')

    // LLM Config
    this.llmApiKeyInput = page.locator('#llm-api-key, input[name="api_key"]')
    this.llmApiUrlInput = page.locator('#llm-api-url, input[name="api_url"]')
    this.llmModelSelect = page.locator('#llm-model, select[name="default_model"]')
    this.llmTemperatureInput = page.locator('#llm-temperature, input[name="temperature"]')
    this.llmMaxTokensInput = page.locator('#llm-max-tokens, input[name="max_tokens"]')

    // Save
    this.saveBtn = this.settingsModal.locator('button:has-text("保存"), button[type="submit"]')
  }

  /**
   * Open settings modal
   */
  async open() {
    await this.settingsBtn.click()
    await this.settingsModal.waitFor({ state: 'visible' })
  }

  /**
   * Close settings modal
   */
  async close() {
    await this.closeBtn.click()
    await this.settingsModal.waitFor({ state: 'hidden' })
  }

  /**
   * Check if settings modal is visible
   */
  async isOpen(): Promise<boolean> {
    const count = await this.settingsModal.count()
    if (count === 0) return false
    return this.settingsModal.isVisible()
  }

  /**
   * Get Trueno3 config from form
   */
  async getTrueno3Config(): Promise<Trueno3Config> {
    return {
      enabled: await this.trueno3EnabledCheckbox.isChecked(),
      sshHost: await this.trueno3SshHostInput.inputValue(),
      sshPort: parseInt(await this.trueno3SshPortInput.inputValue() || '22'),
      sshUsername: await this.trueno3SshUsernameInput.inputValue(),
      sshPassword: await this.trueno3SshPasswordInput.inputValue(),
      codePath: await this.trueno3CodePathInput.inputValue(),
      serviceHost: await this.trueno3ServiceHostInput.inputValue(),
      servicePort: parseInt(await this.trueno3ServicePortInput.inputValue() || '20011'),
      apiPath: await this.trueno3ApiPathInput.inputValue(),
      callbackHost: await this.trueno3CallbackHostInput.inputValue(),
      callbackPort: parseInt(await this.trueno3CallbackPortInput.inputValue() || '5001')
    }
  }

  /**
   * Set Trueno3 config
   */
  async setTrueno3Config(config: Partial<Trueno3Config>) {
    if (config.enabled !== undefined) {
      const isChecked = await this.trueno3EnabledCheckbox.isChecked()
      if (isChecked !== config.enabled) {
        await this.trueno3EnabledCheckbox.click()
      }
    }
    if (config.sshHost !== undefined) {
      await this.trueno3SshHostInput.fill(config.sshHost)
    }
    if (config.sshPort !== undefined) {
      await this.trueno3SshPortInput.fill(config.sshPort.toString())
    }
    if (config.sshUsername !== undefined) {
      await this.trueno3SshUsernameInput.fill(config.sshUsername)
    }
    if (config.sshPassword !== undefined) {
      await this.trueno3SshPasswordInput.fill(config.sshPassword)
    }
    if (config.codePath !== undefined) {
      await this.trueno3CodePathInput.fill(config.codePath)
    }
    if (config.serviceHost !== undefined) {
      await this.trueno3ServiceHostInput.fill(config.serviceHost)
    }
    if (config.servicePort !== undefined) {
      await this.trueno3ServicePortInput.fill(config.servicePort.toString())
    }
    if (config.apiPath !== undefined) {
      await this.trueno3ApiPathInput.fill(config.apiPath)
    }
    if (config.callbackHost !== undefined) {
      await this.trueno3CallbackHostInput.fill(config.callbackHost)
    }
    if (config.callbackPort !== undefined) {
      await this.trueno3CallbackPortInput.fill(config.callbackPort.toString())
    }
  }

  /**
   * Test SSH connection
   */
  async testSshConnection(): Promise<{ success: boolean; message: string }> {
    const [response] = await Promise.all([
      this.waitForAPI('/api/trueno3_test'),
      this.testSshBtn.click()
    ])
    const data = await response.json()
    return {
      success: data.success,
      message: data.message || data.error || ''
    }
  }

  /**
   * Test Trueno3 service connection
   */
  async testServiceConnection(): Promise<{ success: boolean; message: string; functions?: any[] }> {
    const [response] = await Promise.all([
      this.waitForAPI('/api/trueno3_service_test'),
      this.testServiceBtn.click()
    ])
    const data = await response.json()
    return {
      success: data.success,
      message: data.message || data.error || '',
      functions: data.functions
    }
  }

  /**
   * Get LLM config from form
   */
  async getLLMConfig(): Promise<LLMConfig> {
    return {
      apiKey: await this.llmApiKeyInput.inputValue(),
      apiUrl: await this.llmApiUrlInput.inputValue(),
      defaultModel: await this.llmModelSelect.inputValue(),
      temperature: parseFloat(await this.llmTemperatureInput.inputValue() || '0.7'),
      maxTokens: parseInt(await this.llmMaxTokensInput.inputValue() || '1000')
    }
  }

  /**
   * Set LLM config
   */
  async setLLMConfig(config: Partial<LLMConfig>) {
    if (config.apiKey !== undefined) {
      await this.llmApiKeyInput.fill(config.apiKey)
    }
    if (config.apiUrl !== undefined) {
      await this.llmApiUrlInput.fill(config.apiUrl)
    }
    if (config.defaultModel !== undefined) {
      await this.llmModelSelect.selectOption(config.defaultModel)
    }
    if (config.temperature !== undefined) {
      await this.llmTemperatureInput.fill(config.temperature.toString())
    }
    if (config.maxTokens !== undefined) {
      await this.llmMaxTokensInput.fill(config.maxTokens.toString())
    }
  }

  /**
   * Save settings
   */
  async save() {
    const [response] = await Promise.all([
      this.waitForAPI('/api/trueno3_config'),
      this.saveBtn.click()
    ])
    return response
  }

  /**
   * Save and close
   */
  async saveAndClose() {
    await this.save()
    await this.close()
  }
}