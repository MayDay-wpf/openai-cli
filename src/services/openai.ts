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
        stream: true, // 使用真正的流式输出
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
      let hasToolCalls = false;
      let pendingToolCalls: any[] = [];
      let assistantMessage = '';

      while (toolCallCount < maxToolCalls) {
        const completion = await client.chat.completions.create({
          ...requestBody,
          stream: true
        }) as any; // 临时使用any来避免类型错误

        hasToolCalls = false;
        pendingToolCalls = [];
        assistantMessage = '';

        // 处理流式响应
        for await (const chunk of completion) {
          const delta = chunk.choices[0]?.delta;

          if (!delta) continue;

          // 处理普通内容
          if (delta.content) {
            assistantMessage += delta.content;
            fullResponse += delta.content;
            onChunk?.(delta.content);
          }

          // 处理工具调用
          if (delta.tool_calls) {
            hasToolCalls = true;

            for (const toolCallDelta of delta.tool_calls) {
              const index = toolCallDelta.index || 0;

              // 确保工具调用数组有足够的元素
              while (pendingToolCalls.length <= index) {
                pendingToolCalls.push({
                  id: '',
                  type: 'function',
                  function: { name: '', arguments: '' }
                });
              }

              if (toolCallDelta.id) {
                pendingToolCalls[index].id = toolCallDelta.id;
              }

              if (toolCallDelta.function) {
                if (toolCallDelta.function.name) {
                  pendingToolCalls[index].function.name += toolCallDelta.function.name;
                }
                if (toolCallDelta.function.arguments) {
                  pendingToolCalls[index].function.arguments += toolCallDelta.function.arguments;
                }
              }
            }
          }
        }

        // 如果有工具调用，处理它们
        if (hasToolCalls && pendingToolCalls.length > 0 && onToolCall) {
          toolCallCount++;

          // 添加助手消息到对话历史
          currentMessages.push({
            role: 'assistant',
            content: assistantMessage,
            tool_calls: pendingToolCalls
          } as any);

          // 执行每个工具调用
          for (const toolCall of pendingToolCalls) {
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

          // 重置fullResponse，因为工具调用后会有新的回复
          fullResponse = '';

          // 继续循环，让AI基于工具结果生成回复
          continue;
        }

        // 没有工具调用，这是最终回复
        break;
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