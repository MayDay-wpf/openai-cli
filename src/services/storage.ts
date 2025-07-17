import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { getCurrentMessages } from '../locales';
import { Language } from '../types/language';

export interface ApiConfig {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  contextTokens?: number;
  maxConcurrency?: number;
  role?: string;
  maxToolCalls?: number;
  terminalSensitiveWords?: string[];
}

// 配置变更监听器类型
export type ConfigChangeListener = (config: ApiConfig) => void;

export interface McpFunctionConfirmationConfig {
  [functionName: string]: boolean; // true表示需要确认，false表示自动执行
}

export interface McpServer {
  url?: string;
  command?: string;
  args?: string[];
  transport?: string;
  [key: string]: any; // 允许额外的配置项
}

export interface McpConfig {
  mcpServers: Record<string, McpServer>;
}

export interface LspServer {
  disabled?: boolean;
  command: string;
  args?: string[];
  [key: string]: any; // 允许额外的配置项
}

export interface LspConfig {
  lsp: Record<string, LspServer>;
}

/**
 * 配置存储服务
 * 处理用户偏好设置的持久化
 */
export class StorageService {
  private static readonly CONFIG_DIR = path.join(os.homedir(), '.openai-cli');
  private static readonly CONFIG_FILE = path.join(StorageService.CONFIG_DIR, 'config.json');
  private static configChangeListeners: ConfigChangeListener[] = [];

  /**
   * 添加配置变更监听器
   */
  static onConfigChange(listener: ConfigChangeListener): void {
    StorageService.configChangeListeners.push(listener);
  }

  /**
   * 移除配置变更监听器
   */
  static removeConfigChangeListener(listener: ConfigChangeListener): void {
    const index = StorageService.configChangeListeners.indexOf(listener);
    if (index > -1) {
      StorageService.configChangeListeners.splice(index, 1);
    }
  }

  /**
   * 通知所有监听器配置已变更
   */
  private static notifyConfigChange(): void {
    const apiConfig = StorageService.getApiConfig();
    StorageService.configChangeListeners.forEach(listener => {
      try {
        listener(apiConfig);
      } catch (error) {
        console.warn('配置变更监听器执行失败:', error);
      }
    });
  }

  /**
   * 确保配置目录存在
   */
  private static ensureConfigDir(): void {
    if (!fs.existsSync(StorageService.CONFIG_DIR)) {
      fs.mkdirSync(StorageService.CONFIG_DIR, { recursive: true });
    }
  }

  /**
   * 读取配置文件
   */
  private static readConfig(): Record<string, any> {
    try {
      if (fs.existsSync(StorageService.CONFIG_FILE)) {
        const content = fs.readFileSync(StorageService.CONFIG_FILE, 'utf8');
        return JSON.parse(content);
      }
    } catch (error) {
      console.warn('Failed to read config file:', error);
    }
    return {};
  }

  /**
   * 写入配置文件
   */
  private static writeConfig(config: Record<string, any>): void {
    try {
      StorageService.ensureConfigDir();
      fs.writeFileSync(StorageService.CONFIG_FILE, JSON.stringify(config, null, 2));
    } catch (error) {
      console.warn('Failed to write config file:', error);
    }
  }

  /**
   * 初始化配置文件
   * 如果配置文件不存在，则创建一个包含默认值的配置文件
   */
  static initializeConfig(): void {
    StorageService.ensureConfigDir();
    if (!fs.existsSync(StorageService.CONFIG_FILE)) {
      const defaultConfig = {
        language: 'en',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: '',
        model: 'gpt-4.1',
        contextTokens: 128000,
        maxConcurrency: 5,
        role: 'You are a professional software engineer.',
        maxToolCalls: 25,
        terminalSensitiveWords: [
          'rm -rf',
          'mv',
          'cp',
          'dd',
          'npm install',
          'yarn add',
          'pnpm install',
          'git commit --amend',
          'git push --force',
        ],
        mcpConfig: {
          mcpServers: {}
        },
        lspConfig: {
          lsp: {}
        }
      };
      // 确保内置服务也添加到默认配置中
      const finalConfig = {
        ...defaultConfig,
        mcpConfig: StorageService.ensureBuiltInMcpServices(defaultConfig.mcpConfig),
        lspConfig: StorageService.ensureBuiltInLspServices(defaultConfig.lspConfig)
      };
      StorageService.writeConfig(finalConfig);
    }
  }

  /**
   * 获取保存的语言设置
   */
  static getSavedLanguage(): Language | null {
    const config = StorageService.readConfig();
    return config.language || null;
  }

  /**
   * 保存语言设置
   */
  static saveLanguage(language: Language): void {
    const config = StorageService.readConfig();
    config.language = language;
    StorageService.writeConfig(config);
  }

  /**
   * 获取API配置
   */
  static getApiConfig(): ApiConfig {
    const config = StorageService.readConfig();
    return {
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      model: config.model,
      contextTokens: config.contextTokens || 128000,
      maxConcurrency: config.maxConcurrency || 5,
      role: config.role,
      maxToolCalls: config.maxToolCalls || 25,
      terminalSensitiveWords: config.terminalSensitiveWords || [
        'rm -rf',
        'mv',
        'cp',
        'dd',
        'npm install',
        'yarn add',
        'pnpm install',
        'git commit --amend',
        'git push --force',
      ],
    };
  }

  /**
   * 保存API基础地址
   */
  static saveBaseUrl(baseUrl: string): void {
    const config = StorageService.readConfig();
    config.baseUrl = baseUrl;
    StorageService.writeConfig(config);
    StorageService.notifyConfigChange();
  }

  /**
   * 保存API密钥
   */
  static saveApiKey(apiKey: string): void {
    const config = StorageService.readConfig();
    config.apiKey = apiKey;
    StorageService.writeConfig(config);
    StorageService.notifyConfigChange();
  }

  /**
   * 保存模型
   */
  static saveModel(model: string): void {
    const config = StorageService.readConfig();
    config.model = model;
    StorageService.writeConfig(config);
    StorageService.notifyConfigChange();
  }

  /**
   * 保存上下文token数量
   */
  static saveContextTokens(contextTokens: number): void {
    const config = StorageService.readConfig();
    config.contextTokens = contextTokens;
    StorageService.writeConfig(config);
    StorageService.notifyConfigChange();
  }

  /**
   * 保存最大并发数
   */
  static saveMaxConcurrency(maxConcurrency: number): void {
    const config = StorageService.readConfig();
    config.maxConcurrency = maxConcurrency;
    StorageService.writeConfig(config);
    StorageService.notifyConfigChange();
  }

  /**
   * 保存最大工具调用次数
   */
  static saveMaxToolCalls(maxToolCalls: number): void {
    const config = StorageService.readConfig();
    config.maxToolCalls = maxToolCalls;
    StorageService.writeConfig(config);
    StorageService.notifyConfigChange();
  }

  /**
   * 保存角色
   */
  static saveRole(role: string): void {
    const config = StorageService.readConfig();
    config.role = role;
    StorageService.writeConfig(config);
    StorageService.notifyConfigChange();
  }

  /**
   * 保存终端敏感词
   */
  static saveTerminalSensitiveWords(words: string[]): void {
    const config = StorageService.readConfig();
    config.terminalSensitiveWords = words;
    StorageService.writeConfig(config);
    StorageService.notifyConfigChange();
  }

  /**
   * 获取MCP配置
   */
  static getMcpConfig(): McpConfig {
    const config = StorageService.readConfig();
    let mcpConfig = config.mcpConfig || { mcpServers: {} };

    // 确保系统自带的MCP服务存在，如果有更新则保存
    const originalJson = JSON.stringify(mcpConfig);
    mcpConfig = StorageService.ensureBuiltInMcpServices(mcpConfig);
    const updatedJson = JSON.stringify(mcpConfig);

    // 如果配置有变化，立即保存
    if (originalJson !== updatedJson) {
      config.mcpConfig = mcpConfig;
      StorageService.writeConfig(config);
    }

    return mcpConfig;
  }

  /**
   * 确保系统自带的MCP服务存在
   */
  private static ensureBuiltInMcpServices(mcpConfig: McpConfig): McpConfig {
    // 使用默认语言'en'获取消息，避免循环依赖
    const messages = getCurrentMessages('en');
    const builtInServices = StorageService.getBuiltInMcpServices();

    // 检查所有内置服务
    for (const [serviceName, serviceConfig] of Object.entries(builtInServices)) {
      const existingConfig = mcpConfig.mcpServers[serviceName];

      if (!existingConfig) {
        // 没有配置，添加新的内置服务配置
        mcpConfig.mcpServers[serviceName] = { ...serviceConfig };
      } else if (existingConfig.command === 'openai-cli-mcp' ||
        existingConfig.transport === 'stdio' ||
        existingConfig.description?.includes('系统自带') ||
        existingConfig.description?.includes('Built-in')) {
        // 存在旧配置，更新为内置服务配置
        mcpConfig.mcpServers[serviceName] = { ...serviceConfig };
      }
    }

    return mcpConfig;
  }

  /**
   * 保存MCP配置
   */
  static saveMcpConfig(mcpConfig: McpConfig): void {
    const config = StorageService.readConfig();
    // 确保保存时也包含系统自带的服务
    mcpConfig = StorageService.ensureBuiltInMcpServices(mcpConfig);
    config.mcpConfig = mcpConfig;
    StorageService.writeConfig(config);
  }

  /**
   * 获取MCP配置的JSON字符串（用于编辑）
   */
  static getMcpConfigJson(): string {
    const mcpConfig = StorageService.getMcpConfig();
    return JSON.stringify(mcpConfig, null, 2);
  }

  /**
   * 从JSON字符串保存MCP配置
   */
  static saveMcpConfigFromJson(jsonString: string): void {
    try {
      const mcpConfig = JSON.parse(jsonString) as McpConfig;
      StorageService.saveMcpConfig(mcpConfig);
    } catch (error) {
      throw new Error('Invalid JSON format for MCP configuration');
    }
  }

  /**
   * 批量保存API配置
   */
  static saveApiConfig(apiConfig: ApiConfig): void {
    const config = StorageService.readConfig();
    if (apiConfig.baseUrl !== undefined) config.baseUrl = apiConfig.baseUrl;
    if (apiConfig.apiKey !== undefined) config.apiKey = apiConfig.apiKey;
    if (apiConfig.model !== undefined) config.model = apiConfig.model;
    if (apiConfig.contextTokens !== undefined) config.contextTokens = apiConfig.contextTokens;
    if (apiConfig.maxConcurrency !== undefined) config.maxConcurrency = apiConfig.maxConcurrency;
    if (apiConfig.maxToolCalls !== undefined) config.maxToolCalls = apiConfig.maxToolCalls;
    if (apiConfig.role !== undefined) config.role = apiConfig.role;
    StorageService.writeConfig(config);
    StorageService.notifyConfigChange();
  }

  /**
   * 获取所有配置
   */
  static getConfig(): Record<string, any> {
    return StorageService.readConfig();
  }

  /**
   * 设置配置项
   */
  static setConfig(key: string, value: any): void {
    const config = StorageService.readConfig();
    config[key] = value;
    StorageService.writeConfig(config);
  }

  /**
   * 清除所有配置
   */
  static clearConfig(): void {
    const config = StorageService.readConfig();
    delete config.baseUrl;
    delete config.apiKey;
    delete config.model;
    delete config.contextTokens;
    delete config.maxConcurrency;
    delete config.role;
    delete config.mcpConfig;
    delete config.mcpFunctionConfirmation;
    delete config.maxToolCalls;
    delete config.terminalSensitiveWords;
    delete config.lspConfig;
    // 保留语言设置
    // delete config.language;
    StorageService.writeConfig(config);
    StorageService.notifyConfigChange();
  }

  /**
   * 检查配置是否存在
   */
  static hasConfig(): boolean {
    return fs.existsSync(StorageService.CONFIG_FILE);
  }

  /**
   * 验证API配置完整性
   */
  static validateApiConfig(): { isValid: boolean; missing: string[] } {
    const config = StorageService.getApiConfig();
    const missing: string[] = [];

    if (!config.baseUrl) missing.push('baseUrl');
    if (!config.apiKey) missing.push('apiKey');
    if (!config.model) missing.push('model');

    return {
      isValid: missing.length === 0,
      missing
    };
  }

  /**
   * 强制更新MCP配置（修复旧配置）
   */
  static updateMcpConfig(): void {
    const config = StorageService.readConfig();
    let mcpConfig = config.mcpConfig || { mcpServers: {} };

    // 强制重新检查和更新内置服务配置
    mcpConfig = StorageService.ensureBuiltInMcpServices(mcpConfig);

    // 保存更新后的配置
    config.mcpConfig = mcpConfig;
    StorageService.writeConfig(config);
  }

  /**
   * 获取系统内置MCP服务列表
   */
  static getBuiltInMcpServices(): Record<string, McpServer> {
    // 使用默认语言'en'获取消息，避免循环依赖
    const messages = getCurrentMessages('en');
    return {
      'file-system': {
        transport: 'builtin',
        description: 'Unified file system service for reading, creating, editing, and managing files and directories'
      },
      'todos': {
        transport: 'builtin',
        description: 'Service for creating and managing a list of tasks (todos) to plan and track work.'
      },
      'terminal': {
        transport: 'builtin',
        description: 'Service for executing shell commands and getting the output.'
      }
    };
  }

  /**
   * 检查并恢复缺失的系统MCP服务
   * @param userMcpConfig 用户编辑的MCP配置
   * @returns 包含系统服务的完整配置和是否有更新
   */
  static validateAndRestoreSystemMcpServices(userMcpConfig: McpConfig): {
    config: McpConfig;
    hasUpdates: boolean;
    restoredServices: string[]
  } {
    const builtInServices = StorageService.getBuiltInMcpServices();
    const restoredServices: string[] = [];
    let hasUpdates = false;

    // 检查每个系统服务是否存在
    for (const [serviceName, serviceConfig] of Object.entries(builtInServices)) {
      const userService = userMcpConfig.mcpServers[serviceName];

      if (!userService) {
        // 系统服务不存在，添加它
        userMcpConfig.mcpServers[serviceName] = { ...serviceConfig };
        restoredServices.push(serviceName);
        hasUpdates = true;
      } else if (userService.transport !== 'builtin') {
        // 系统服务存在但配置不正确，修复它
        userMcpConfig.mcpServers[serviceName] = { ...serviceConfig };
        restoredServices.push(serviceName);
        hasUpdates = true;
      }
    }

    return {
      config: userMcpConfig,
      hasUpdates,
      restoredServices
    };
  }

  /**
 * 检查MCP配置中是否包含受保护的系统服务
 * @param mcpConfigJson 用户提供的JSON字符串
 * @returns 验证结果
 */
  static validateMcpConfigJson(mcpConfigJson: string): {
    isValid: boolean;
    error?: string;
    parsedConfig?: McpConfig;
    hasSystemUpdates?: boolean;
    restoredServices?: string[];
  } {
    try {
      const parsedConfig = JSON.parse(mcpConfigJson) as McpConfig;

      // 验证基本结构
      if (!parsedConfig.mcpServers || typeof parsedConfig.mcpServers !== 'object') {
        // 使用默认语言'en'获取消息，避免循环依赖
        const messages = getCurrentMessages('en');
        return {
          isValid: false,
          error: messages.systemDetector.validation.mcpConfigStructure
        };
      }

      // 检查并恢复系统服务
      const validation = StorageService.validateAndRestoreSystemMcpServices(parsedConfig);

      return {
        isValid: true,
        parsedConfig: validation.config,
        hasSystemUpdates: validation.hasUpdates,
        restoredServices: validation.restoredServices
      };
    } catch (error) {
      // 使用默认语言'en'获取消息，避免循环依赖
      const messages = getCurrentMessages('en');
      return {
        isValid: false,
        error: messages.systemDetector.validation.invalidJson
      };
    }
  }

  /**
   * 获取MCP函数确认配置
   */
  static getMcpFunctionConfirmationConfig(): McpFunctionConfirmationConfig {
    const config = StorageService.readConfig();
    return config.mcpFunctionConfirmation || {};
  }

  /**
   * 保存MCP函数确认配置
   */
  static saveMcpFunctionConfirmationConfig(confirmationConfig: McpFunctionConfirmationConfig): void {
    const config = StorageService.readConfig();
    config.mcpFunctionConfirmation = confirmationConfig;
    StorageService.writeConfig(config);
  }

  /**
   * 检查指定函数是否需要确认
   */
  static isFunctionConfirmationRequired(functionName: string): boolean {
    const config = StorageService.getMcpFunctionConfirmationConfig();
    return config[functionName] === true;
  }

  /**
   * 设置指定函数的确认状态
   */
  static setFunctionConfirmationRequired(functionName: string, required: boolean): void {
    const config = StorageService.getMcpFunctionConfirmationConfig();
    config[functionName] = required;
    StorageService.saveMcpFunctionConfirmationConfig(config);
  }

  /**
   * 获取LSP配置
   */
  static getLspConfig(): LspConfig {
    const config = StorageService.readConfig();
    let lspConfig = config.lspConfig || { lsp: {} };

    // 确保系统自带的LSP服务存在，如果有更新则保存
    const originalJson = JSON.stringify(lspConfig);
    lspConfig = StorageService.ensureBuiltInLspServices(lspConfig);
    const updatedJson = JSON.stringify(lspConfig);

    // 如果配置有变化，立即保存
    if (originalJson !== updatedJson) {
      config.lspConfig = lspConfig;
      StorageService.writeConfig(config);
    }

    return lspConfig;
  }

  /**
   * 确保系统自带的LSP服务存在
   */
  private static ensureBuiltInLspServices(lspConfig: LspConfig): LspConfig {
    const builtInServices = StorageService.getBuiltInLspServices();

    // 检查所有内置服务
    for (const [serviceName, serviceConfig] of Object.entries(builtInServices)) {
      const existingConfig = lspConfig.lsp[serviceName];

      if (!existingConfig) {
        // 没有配置，添加新的内置服务配置
        lspConfig.lsp[serviceName] = { ...serviceConfig };
      }
    }

    return lspConfig;
  }

  /**
   * 保存LSP配置
   */
  static saveLspConfig(lspConfig: LspConfig): void {
    const config = StorageService.readConfig();
    // 确保保存时也包含系统自带的服务
    lspConfig = StorageService.ensureBuiltInLspServices(lspConfig);
    config.lspConfig = lspConfig;
    StorageService.writeConfig(config);
  }

  /**
   * 获取LSP配置的JSON字符串（用于编辑）
   */
  static getLspConfigJson(): string {
    const lspConfig = StorageService.getLspConfig();
    return JSON.stringify(lspConfig, null, 2);
  }

  /**
   * 从JSON字符串保存LSP配置
   */
  static saveLspConfigFromJson(jsonString: string): void {
    try {
      const lspConfig = JSON.parse(jsonString) as LspConfig;
      StorageService.saveLspConfig(lspConfig);
    } catch (error) {
      throw new Error('Invalid JSON format for LSP configuration');
    }
  }

  /**
   * 获取系统内置LSP服务列表
   */
  static getBuiltInLspServices(): Record<string, LspServer> {
    return {
      'go': {
        disabled: false,
        command: 'gopls'
      },
      'typescript': {
        disabled: false,
        command: 'typescript-language-server',
        args: ['--stdio']
      },
      'javascript': {
        disabled: false,
        command: 'typescript-language-server',
        args: ['--stdio']
      },
      'python': {
        disabled: false,
        command: 'pylsp'
      },
      'rust': {
        disabled: false,
        command: 'rust-analyzer'
      },
      'java': {
        disabled: false,
        command: 'jdtls'
      },
      'cpp': {
        disabled: false,
        command: 'clangd'
      },
      'c': {
        disabled: false,
        command: 'clangd'
      }
    };
  }

  /**
   * 验证LSP配置JSON
   */
  static validateLspConfigJson(lspConfigJson: string): {
    isValid: boolean;
    error?: string;
    parsedConfig?: LspConfig;
  } {
    try {
      const parsedConfig = JSON.parse(lspConfigJson) as LspConfig;

      // 验证基本结构
      if (!parsedConfig.lsp || typeof parsedConfig.lsp !== 'object') {
        const messages = getCurrentMessages('en');
        return {
          isValid: false,
          error: 'LSP configuration must have an "lsp" object'
        };
      }

      // 验证每个LSP服务配置
      for (const [serverName, serverConfig] of Object.entries(parsedConfig.lsp)) {
        if (!serverConfig.command || typeof serverConfig.command !== 'string') {
          return {
            isValid: false,
            error: `LSP server "${serverName}" must have a valid "command" string`
          };
        }

        if (serverConfig.args && !Array.isArray(serverConfig.args)) {
          return {
            isValid: false,
            error: `LSP server "${serverName}" args must be an array if provided`
          };
        }

        if (serverConfig.disabled !== undefined && typeof serverConfig.disabled !== 'boolean') {
          return {
            isValid: false,
            error: `LSP server "${serverName}" disabled flag must be a boolean if provided`
          };
        }
      }

      return {
        isValid: true,
        parsedConfig
      };
    } catch (error) {
      const messages = getCurrentMessages('en');
      return {
        isValid: false,
        error: 'Invalid JSON format'
      };
    }
  }
} 