import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources';
import { StorageService } from './storage';

export type ChatMessage = ChatCompletionMessageParam;

export interface StreamChatOptions {
  messages: ChatMessage[];
  tools?: any[];
  onChunk: (chunk: string) => void;
  onComplete: (fullResponse: string) => void;
  onReasoningChunk: (chunk: string) => void;
  onToolChunk: (toolChunk: any) => void;
  onAssistantMessage: (message: { content: string; toolCalls: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[] }) => void;
  onError: (error: Error) => void;
}

export interface StreamChatResult {
  status: 'done' | 'tool_calls';
  assistantResponse: {
    content: string | null;
    tool_calls?: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[];
  }
}

class OpenAIService {
  private openai: OpenAI | null;
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY_MS = 1000;

  constructor() {
    this.openai = null; // Initialize to null
    this.updateConfig();

    // 监听配置变更事件
    StorageService.onConfigChange(() => {
      this.updateConfig();
    });
  }

  public updateConfig() {
    const apiConfig = StorageService.getApiConfig();
    if (apiConfig.apiKey && apiConfig.apiKey.trim() !== '') {
      this.openai = new OpenAI({
        apiKey: apiConfig.apiKey,
        baseURL: apiConfig.baseUrl,
      });
    } else {
      this.openai = null;
    }
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }



  public async streamChat(options: StreamChatOptions): Promise<StreamChatResult> {
    if (!this.openai) {
      const error = new Error("OpenAI API key is not configured. Please run 'openai-cli' and go to 'Configuration' to set it up.");
      options.onError(error);
      return {
        status: 'done',
        assistantResponse: { content: null }
      };
    }

    const apiConfig = StorageService.getApiConfig();

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        const result = await this.performStreamChat(options, apiConfig);
        
        // 检查AI回复是否为空（算作失败）
        const hasContent = result.assistantResponse.content && result.assistantResponse.content.trim() !== '';
        const hasToolCalls = result.assistantResponse.tool_calls && result.assistantResponse.tool_calls.length > 0;
        
        if (!hasContent && !hasToolCalls) {
          throw new Error('AI response is empty');
        }
        
        return result;
      } catch (error) {
        const isLastAttempt = attempt === this.MAX_RETRIES;
        
        if (isLastAttempt) {
          options.onError(error as Error);
          return {
            status: 'done',
            assistantResponse: { content: null }
          };
        }
        
        // 等待后重试
        await this.delay(this.RETRY_DELAY_MS * attempt);
        console.warn(`OpenAI API request failed (attempt ${attempt}/${this.MAX_RETRIES}):`, (error as Error).message);
      }
    }

    // 这里不应该到达，但为了类型安全
    const finalError = new Error('All retry attempts failed');
    options.onError(finalError);
    return {
      status: 'done',
      assistantResponse: { content: null }
    };
  }

  private async performStreamChat(options: StreamChatOptions, apiConfig: any): Promise<StreamChatResult> {
    // 打印请消息
    // console.log('--- OpenAI Request Body [DEBUG] ---');
    // console.log(JSON.stringify(options.messages, null, 2));
    // console.log('------------------------------------');
    // 打印系统提示词
    // console.log('--- System Prompt [DEBUG] ---');
    // console.log(options.messages[0].content);
    // console.log('------------------------------------');

    const stream = await this.openai!.chat.completions.create({
      model: apiConfig.model || 'gpt-4.1',
      messages: options.messages as any,
      stream: true,
      tools: options.tools,
      tool_choice: options.tools ? 'auto' : undefined,
    });

    let accumulatedContent = '';
    let toolCalls: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[] = [];
    let currentToolCallId: string | null = null;
    let currentToolCallFunction: { name: string; arguments: string } = { name: '', arguments: '' };
    let reasoningContent = '';

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta as any;

      if (delta?.content) {
        accumulatedContent += delta.content;
        options.onChunk(delta.content);
      }

      const reasoningChunk = delta?.reasoning_content || delta?.reasoning;
      if (reasoningChunk) {
        reasoningContent += reasoningChunk;
        options.onReasoningChunk(reasoningChunk);
      }

      if (delta?.tool_calls) {
        for (const toolCall of delta.tool_calls) {
          if (toolCall.id) {
            if (currentToolCallId) {
              // A new tool call has started, so we finalize the previous one
              toolCalls.push({
                id: currentToolCallId,
                type: 'function',
                function: {
                  name: currentToolCallFunction.name,
                  arguments: currentToolCallFunction.arguments,
                },
              });
            }
            currentToolCallId = toolCall.id;
            currentToolCallFunction = { name: '', arguments: '' };
          }
          if (toolCall.function?.name) {
            currentToolCallFunction.name += toolCall.function.name;
          }
          if (toolCall.function?.arguments) {
            currentToolCallFunction.arguments += toolCall.function.arguments;
          }
        }
      }

      const finishReason = chunk.choices[0]?.finish_reason;

      if (finishReason === 'tool_calls' || (finishReason === 'stop' && currentToolCallId)) {
        if (currentToolCallId) {
          toolCalls.push({
            id: currentToolCallId,
            type: 'function',
            function: {
              name: currentToolCallFunction.name,
              arguments: currentToolCallFunction.arguments,
            },
          });
        }

        if (options.onAssistantMessage) {
          options.onAssistantMessage({ content: accumulatedContent, toolCalls });
        }

        return {
          status: 'tool_calls',
          assistantResponse: { content: accumulatedContent || null, tool_calls: toolCalls }
        };
      }
    }

    if (options.onComplete) {
      options.onComplete(accumulatedContent);
    }

    return {
      status: 'done',
      assistantResponse: { content: accumulatedContent }
    };
  }

  public async chat(options: { messages: ChatMessage[], responseFormat?: 'text' | 'json_object', temperature?: number, maxTokens?: number }): Promise<string> {
    if (!this.openai) {
      throw new Error("OpenAI API key is not configured. Please run 'openai-cli' and go to 'Configuration' to set it up.");
    }

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        const result = await this.performChat(options);
        
        // 检查AI回复是否为空（算作失败）
        if (!result || result.trim() === '') {
          throw new Error('AI response is empty');
        }
        
        return result;
      } catch (error) {
        const isLastAttempt = attempt === this.MAX_RETRIES;
        
        if (isLastAttempt) {
          throw error;
        }
        
        // 等待后重试
        await this.delay(this.RETRY_DELAY_MS * attempt);
        console.warn(`OpenAI API request failed (attempt ${attempt}/${this.MAX_RETRIES}):`, (error as Error).message);
      }
    }

    // 这里不应该到达，但为了类型安全
    throw new Error('All retry attempts failed');
  }

  private async performChat(options: { messages: ChatMessage[], responseFormat?: 'text' | 'json_object', temperature?: number, maxTokens?: number }): Promise<string> {
    const apiConfig = StorageService.getApiConfig();
    const response = await this.openai!.chat.completions.create({
      model: apiConfig.model || 'gpt-4.1',
      messages: options.messages as any,
      response_format: options.responseFormat ? { type: options.responseFormat } : undefined,
      temperature: options.temperature,
      max_tokens: options.maxTokens,
    });
    return response.choices[0]?.message?.content || '';
  }
}

export const openAIService = new OpenAIService(); 