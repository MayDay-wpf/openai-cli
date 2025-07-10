import OpenAI from 'openai';
import { StorageService } from './storage';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: any[];
  tool_call_id?: string;
}

export interface StreamOptions {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'text' | 'json_object';
  tools?: any[];
  onChunk?: (chunk: string) => void;
  onToolCall?: (toolCall: any) => Promise<any>;
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
      tools,
      onChunk,
      onToolCall,
      onComplete,
      onError
    } = options;

    let fullResponse = '';
    let currentMessages = [...messages]; // 复制消息数组，用于工具调用循环

    try {
      const requestBody: any = {
        model,
        messages: currentMessages,
        temperature,
        max_tokens: maxTokens,
        stream: false, // 暂时使用非流式以便正确处理工具调用
      };

      if (responseFormat === 'json_object') {
        requestBody.response_format = { type: 'json_object' };
      }

      if (tools && tools.length > 0) {
        requestBody.tools = tools;
        requestBody.tool_choice = 'auto';
      }

      let maxToolCalls = 5; // 最大工具调用次数，防止无限循环
      let toolCallCount = 0;

      while (toolCallCount < maxToolCalls) {
        const response = await client.chat.completions.create(requestBody);
        const choice = response.choices[0];

        if (!choice?.message) {
          break;
        }

        const message = choice.message;

        // 如果有工具调用
        if (message.tool_calls && message.tool_calls.length > 0 && onToolCall) {
          toolCallCount++;

          // 添加助手消息到对话历史
          currentMessages.push({
            role: 'assistant',
            content: message.content || '',
            tool_calls: message.tool_calls
          } as any);

          // 执行每个工具调用
          for (const toolCall of message.tool_calls) {
            if (toolCall.function && toolCall.function.name) {
              try {
                const toolResult = await onToolCall(toolCall);

                // 添加工具调用结果到对话历史
                currentMessages.push({
                  role: 'tool',
                  content: JSON.stringify(toolResult),
                  tool_call_id: toolCall.id
                } as any);

              } catch (error) {
                console.warn('Tool call failed:', error);

                // 添加工具调用错误到对话历史
                currentMessages.push({
                  role: 'tool',
                  content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                  tool_call_id: toolCall.id
                } as any);
              }
            }
          }

          // 更新请求消息，继续对话
          requestBody.messages = currentMessages;

          // 继续循环，让AI基于工具结果生成回复
          continue;
        }

        // 没有工具调用，这是最终回复
        const content = message.content || '';
        fullResponse = content;

        // 如果有内容，通过onChunk逐字符输出以模拟流式效果
        if (content && onChunk) {
          const words = content.split(' ');
          for (let i = 0; i < words.length; i++) {
            const word = words[i] + (i < words.length - 1 ? ' ' : '');
            onChunk(word);
            // 添加小延迟以模拟打字效果
            await new Promise(resolve => setTimeout(resolve, 20));
          }
        }

        break; // 结束循环
      }

      if (toolCallCount >= maxToolCalls) {
        console.warn('Max tool call limit reached');
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