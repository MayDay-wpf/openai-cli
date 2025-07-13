import OpenAI from 'openai';
import { TokenCalculator } from '../utils/token-calculator';
import { StorageService } from './storage';

export type ChatMessageContent =
  | string
  | (
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string; detail?: 'low' | 'high' | 'auto' } }
  )[];

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: ChatMessageContent;
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
  onToolChunk?: (toolCallChunk: any) => void;
  onAssistantMessage?: (message: { content: string, toolCalls: any[] }) => void;
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
      throw new Error('API configuration is incomplete. Please set the API key and base URL first.');
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
   * 将ChatMessage转换为Message格式（用于TokenCalculator）
   */
  private convertChatMessagesToMessages(chatMessages: ChatMessage[]): any[] {
    return chatMessages
      .filter(msg => msg.role !== 'system') // 排除系统消息
      .map(msg => {
        let content = '';
        if (typeof msg.content === 'string') {
          content = msg.content;
        } else if (Array.isArray(msg.content)) {
          // 对于Vision请求，只提取文本部分进行token计算
          content = msg.content
            .filter((item): item is { type: 'text'; text: string } => item.type === 'text')
            .map(item => item.text)
            .join(' ');
        }

        return {
          type: msg.role === 'assistant' ? 'ai' : msg.role,
          content: content,
          // 保留工具调用信息
          //tool_calls: msg.tool_calls,
          tool_call_id: msg.tool_call_id,
          timestamp: new Date()
        };
      });
  }

  /**
   * 使用TokenCalculator压缩消息历史
   */
  private compressMessagesWithTokenCalculator(messages: ChatMessage[]): ChatMessage[] {
    // 提取系统消息
    const systemMessages = messages.filter(msg => msg.role === 'system');
    const systemMessageContent = systemMessages.length > 0 ? systemMessages[0].content : '';
    const systemMessage = typeof systemMessageContent === 'string' ? systemMessageContent : '';

    // 转换为Message格式
    const historyMessages = this.convertChatMessagesToMessages(messages);

    // 使用TokenCalculator进行智能选择，使用70%的上下文限制为工具调用留出空间
    const tokenResult = TokenCalculator.selectHistoryMessages(
      historyMessages,
      systemMessage,
      0.7
    );

    // 构建结果消息数组
    const resultMessages: ChatMessage[] = [];

    // 添加系统消息
    systemMessages.forEach(msg => resultMessages.push(msg));

    // 添加选中的历史消息，转换回ChatMessage格式
    tokenResult.allowedMessages.forEach(msg => {
      resultMessages.push({
        role: msg.type === 'ai' ? 'assistant' : msg.type as 'user' | 'tool',
        content: msg.content,
        // 恢复工具调用信息
        tool_calls: msg.tool_calls,
        tool_call_id: msg.tool_call_id,
      });
    });
    return resultMessages;
  }

  /**
   * 发送聊天消息（流式输出）
   */
  async streamChat(options: StreamOptions): Promise<string> {
    const client = this.getClient();
    const apiConfig = StorageService.getApiConfig();

    const {
      messages,
      model = apiConfig.model || 'gpt-4.1',
      responseFormat = 'text',
      tools,
      onChunk,
      onAssistantMessage,
      onToolCall,
      onComplete,
      onError,
      onToolChunk
    } = options;

    let fullResponse = '';
    let currentMessages = [...messages]; // 复制消息数组，用于工具调用循环

    try {
      const requestBody: any = {
        model,
        messages: currentMessages,
        stream: true, // 使用真正的流式输出
      };

      if (responseFormat === 'json_object') {
        requestBody.response_format = { type: 'json_object' };
      }

      if (tools && tools.length > 0) {
        requestBody.tools = tools;
        requestBody.tool_choice = 'auto';
      }

      let maxToolCalls = apiConfig.maxToolCalls || 25; // 最大工具调用次数，防止无限循环
      let toolCallCount = 0;
      let hasToolCalls = false;
      let pendingToolCalls: any[] = [];
      let assistantMessage = '';

      while (toolCallCount < maxToolCalls) {

        // 调试日志，打印每次请求的请求体
        // console.log('--- OpenAI Request Body [DEBUG] ---');
        // console.log(JSON.stringify(requestBody, null, 2));
        // console.log('------------------------------------');

        const completion = await client.chat.completions.create({
          ...requestBody,
          stream: true
        }) as any;

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
            onToolChunk?.(delta.tool_calls);

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
          const assistantResponseMessage = {
            role: 'assistant',
            content: assistantMessage,
            tool_calls: pendingToolCalls
          };
          currentMessages.push(assistantResponseMessage as any);

          // 触发新的回调，通知UI层完整的助手消息
          onAssistantMessage?.({
            content: assistantMessage,
            toolCalls: pendingToolCalls
          });

          // 执行每个工具调用
          for (const toolCall of pendingToolCalls) {
            if (toolCall.function && toolCall.function.name) {
              try {
                const toolResult = await onToolCall(toolCall);

                // 添加工具调用结果到对话历史
                currentMessages.push({
                  role: 'tool',
                  tool_call_id: toolCall.id,
                  content: JSON.stringify(toolResult)
                } as any);

              } catch (error) {
                console.warn('Tool call failed:', error);

                // 添加工具调用错误到对话历史
                currentMessages.push({
                  role: 'tool',
                  tool_call_id: toolCall.id,
                  content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
                } as any);
              }
            }
          }

          // 使用TokenCalculator检查并压缩消息历史，防止token溢出
          currentMessages = this.compressMessagesWithTokenCalculator(currentMessages);

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
      const errorMessage = error instanceof Error ? error : new Error('Unknown error');
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
      model = apiConfig.model || 'gpt-4.1',
      responseFormat = 'text'
    } = options;

    try {
      const requestBody: any = {
        model,
        messages,
        stream: false,
      };

      if (responseFormat === 'json_object') {
        requestBody.response_format = { type: 'json_object' };
      }

      const response = await client.chat.completions.create(requestBody);

      return response.choices[0]?.message?.content || '';

    } catch (error) {
      throw error instanceof Error ? error : new Error('Unknown error');
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
      console.warn('Failed to get model list:', error);
      return ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'o4-mini', 'o3-mini'];
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