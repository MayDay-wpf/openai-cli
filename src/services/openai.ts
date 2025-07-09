import OpenAI from 'openai';
import { StorageService } from './storage';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface StreamOptions {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'text' | 'json_object';
  onChunk?: (chunk: string) => void;
  onComplete?: (fullResponse: string) => void;
  onError?: (error: Error) => void;
}

/**
 * OpenAI服务
 * 处理与OpenAI API的交互，支持流式输出
 */
export class OpenAIService {
  private client: OpenAI | null = null;

  /**
   * 初始化OpenAI客户端
   */
  private initializeClient(): OpenAI {
    const apiConfig = StorageService.getApiConfig();
    
    if (!apiConfig.apiKey || !apiConfig.baseUrl) {
      throw new Error('API配置不完整。请先设置API密钥和基础URL。');
    }

    if (!this.client) {
      this.client = new OpenAI({
        apiKey: apiConfig.apiKey,
        baseURL: apiConfig.baseUrl,
      });
    }

    return this.client;
  }

  /**
   * 获取客户端（如果配置有变化则重新创建）
   */
  private getClient(): OpenAI {
    const apiConfig = StorageService.getApiConfig();
    
    // 如果配置发生变化，重新创建客户端
    if (this.client) {
      const currentConfig = {
        apiKey: this.client.apiKey,
        baseURL: this.client.baseURL,
      };
      
      if (currentConfig.apiKey !== apiConfig.apiKey || 
          currentConfig.baseURL !== apiConfig.baseUrl) {
        this.client = null;
      }
    }

    return this.initializeClient();
  }

  /**
   * 发送聊天消息（流式输出）
   */
  async streamChat(options: StreamOptions): Promise<string> {
    const client = this.getClient();
    const apiConfig = StorageService.getApiConfig();
    
    const {
      messages,
      model = apiConfig.model || 'gpt-3.5-turbo',
      temperature = 0.7,
      maxTokens = 2000,
      responseFormat = 'text',
      onChunk,
      onComplete,
      onError
    } = options;

    let fullResponse = '';

    try {
      const requestBody: any = {
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: true,
      };

      if (responseFormat === 'json_object') {
        requestBody.response_format = { type: 'json_object' };
      }

      const stream = await client.chat.completions.create(requestBody) as any;

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          fullResponse += content;
          onChunk?.(content);
        }
      }

      onComplete?.(fullResponse);
      return fullResponse;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error : new Error('未知错误');
      onError?.(errorMessage);
      throw errorMessage;
    }
  }

  /**
   * 发送单次聊天消息（非流式）
   */
  async chat(options: Omit<StreamOptions, 'onChunk' | 'onComplete' | 'onError'>): Promise<string> {
    const client = this.getClient();
    const apiConfig = StorageService.getApiConfig();
    
    const {
      messages,
      model = apiConfig.model || 'gpt-3.5-turbo',
      temperature = 0.7,
      maxTokens = 2000,
      responseFormat = 'text'
    } = options;

    try {
      const requestBody: any = {
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: false,
      };

      if (responseFormat === 'json_object') {
        requestBody.response_format = { type: 'json_object' };
      }

      const response = await client.chat.completions.create(requestBody);

      return response.choices[0]?.message?.content || '';
      
    } catch (error) {
      throw error instanceof Error ? error : new Error('未知错误');
    }
  }

  /**
   * 验证API配置是否有效
   */
  async validateConfig(): Promise<{ valid: boolean; error?: string }> {
    try {
      const client = this.getClient();
      
      // 尝试发送一个简单的请求来验证配置
      await client.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 1,
        stream: false,
      });

      return { valid: true };
      
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : '配置验证失败'
      };
    }
  }

  /**
   * 获取可用的模型列表
   */
  async getModels(): Promise<string[]> {
    try {
      const client = this.getClient();
      const response = await client.models.list();
      
      return response.data
        .filter((model: any) => model.id.includes('gpt'))
        .map((model: any) => model.id)
        .sort();
        
    } catch (error) {
      console.warn('获取模型列表失败:', error);
      return ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo'];
    }
  }

  /**
   * 重置客户端（强制重新初始化）
   */
  resetClient(): void {
    this.client = null;
  }
}

// 导出单例实例
export const openAIService = new OpenAIService(); 