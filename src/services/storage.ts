import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Language } from '../types/language';

export interface ApiConfig {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  contextTokens?: number;
  maxConcurrency?: number;
  role?: string;
}

export interface McpServer {
  url: string;
  [key: string]: any; // 允许额外的配置项
}

export interface McpConfig {
  mcpServers: Record<string, McpServer>;
}

/**
 * 配置存储服务
 * 处理用户偏好设置的持久化
 */
export class StorageService {
  private static readonly CONFIG_DIR = path.join(os.homedir(), '.openai-cli');
  private static readonly CONFIG_FILE = path.join(StorageService.CONFIG_DIR, 'config.json');

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
      role: config.role
    };
  }

  /**
   * 保存API基础地址
   */
  static saveBaseUrl(baseUrl: string): void {
    const config = StorageService.readConfig();
    config.baseUrl = baseUrl;
    StorageService.writeConfig(config);
  }

  /**
   * 保存API密钥
   */
  static saveApiKey(apiKey: string): void {
    const config = StorageService.readConfig();
    config.apiKey = apiKey;
    StorageService.writeConfig(config);
  }

  /**
   * 保存默认模型
   */
  static saveModel(model: string): void {
    const config = StorageService.readConfig();
    config.model = model;
    StorageService.writeConfig(config);
  }

  /**
   * 保存上下文Token数量
   */
  static saveContextTokens(contextTokens: number): void {
    const config = StorageService.readConfig();
    config.contextTokens = contextTokens;
    StorageService.writeConfig(config);
  }

  /**
   * 保存最大并发数
   */
  static saveMaxConcurrency(maxConcurrency: number): void {
    const config = StorageService.readConfig();
    config.maxConcurrency = maxConcurrency;
    StorageService.writeConfig(config);
  }

  /**
   * 保存系统角色
   */
  static saveRole(role: string): void {
    const config = StorageService.readConfig();
    config.role = role;
    StorageService.writeConfig(config);
  }

  /**
   * 获取MCP配置
   */
  static getMcpConfig(): McpConfig {
    const config = StorageService.readConfig();
    return config.mcpConfig || { mcpServers: {} };
  }

  /**
   * 保存MCP配置
   */
  static saveMcpConfig(mcpConfig: McpConfig): void {
    const config = StorageService.readConfig();
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
    if (apiConfig.role !== undefined) config.role = apiConfig.role;
    StorageService.writeConfig(config);
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
   * 清除配置文件
   */
  static clearConfig(): void {
    try {
      if (fs.existsSync(StorageService.CONFIG_FILE)) {
        fs.unlinkSync(StorageService.CONFIG_FILE);
      }
    } catch (error) {
      console.warn('Failed to clear config file:', error);
    }
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
} 