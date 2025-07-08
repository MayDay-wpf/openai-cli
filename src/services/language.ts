import { Language, LANGUAGES } from '../types/language';
import { getCurrentMessages, getAvailableLanguages } from '../locales';
import { StorageService } from './storage';

export type LanguageChangeCallback = (language: Language) => void;

/**
 * 语言管理服务
 * 使用单例模式统一管理应用的语言状态
 */
export class LanguageService {
  private static instance: LanguageService;
  private currentLanguage: Language;
  private callbacks: Set<LanguageChangeCallback> = new Set();

  private constructor() {
    // 尝试从存储中读取保存的语言设置，如果没有则使用默认语言
    const savedLanguage = StorageService.getSavedLanguage();
    this.currentLanguage = savedLanguage || 'zh';
  }

  /**
   * 获取语言服务单例实例
   */
  static getInstance(): LanguageService {
    if (!LanguageService.instance) {
      LanguageService.instance = new LanguageService();
    }
    return LanguageService.instance;
  }

  /**
   * 获取当前语言
   */
  getCurrentLanguage(): Language {
    return this.currentLanguage;
  }

  /**
   * 设置当前语言
   */
  setLanguage(language: Language): void {
    if (language !== this.currentLanguage) {
      this.currentLanguage = language;
      // 保存到存储中
      StorageService.saveLanguage(language);
      this.notifyLanguageChange();
    }
  }

  /**
   * 获取当前语言的消息
   */
  getMessages() {
    return getCurrentMessages(this.currentLanguage);
  }

  /**
   * 获取可用的语言列表
   */
  getAvailableLanguages(): Language[] {
    return getAvailableLanguages();
  }

  /**
   * 获取语言配置信息
   */
  getLanguageConfig(language: Language) {
    return LANGUAGES[language];
  }

  /**
   * 获取所有语言配置
   */
  getAllLanguageConfigs() {
    return LANGUAGES;
  }

  /**
   * 注册语言变化回调
   */
  onLanguageChange(callback: LanguageChangeCallback): () => void {
    this.callbacks.add(callback);
    
    // 返回取消注册的函数
    return () => {
      this.callbacks.delete(callback);
    };
  }

  /**
   * 通知所有监听者语言已变化
   */
  private notifyLanguageChange(): void {
    this.callbacks.forEach(callback => {
      try {
        callback(this.currentLanguage);
      } catch (error) {
        console.error('Error in language change callback:', error);
      }
    });
  }

  /**
   * 创建语言选择菜单的选项
   */
  createLanguageMenuChoices() {
    return this.getAvailableLanguages().map(code => {
      const config = this.getLanguageConfig(code);
      return {
        name: config.nativeName,
        value: code,
        description: config.name
      };
    });
  }
}

// 导出单例实例以便直接使用
export const languageService = LanguageService.getInstance(); 