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

  constructor() {
    this.openai = null; // Initialize to null
    this.updateConfig();
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

    // 打印请消息
    // console.log('--- OpenAI Request Body [DEBUG] ---');
    // console.log(JSON.stringify(options.messages, null, 2));
    // console.log('------------------------------------');
    // 打印系统提示词
    // console.log('--- System Prompt [DEBUG] ---');
    // console.log(options.messages[0].content);
    // console.log('------------------------------------');
    try {
      const stream = await this.openai.chat.completions.create({
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

    } catch (error) {
      options.onError(error as Error);
      // In case of error, we consider it "done" to stop the loop.
      return {
        status: 'done',
        assistantResponse: { content: null }
      };
    }
  }

  public async chat(options: { messages: ChatMessage[], responseFormat?: 'text' | 'json_object', temperature?: number, maxTokens?: number }): Promise<string> {
    if (!this.openai) {
      throw new Error("OpenAI API key is not configured. Please run 'openai-cli' and go to 'Configuration' to set it up.");
    }
    const apiConfig = StorageService.getApiConfig();
    try {
      const response = await this.openai.chat.completions.create({
        model: apiConfig.model || 'gpt-4.1',
        messages: options.messages as any,
        response_format: options.responseFormat ? { type: options.responseFormat } : undefined,
        temperature: options.temperature,
        max_tokens: options.maxTokens,
      });
      return response.choices[0]?.message?.content || '';
    } catch (error) {
      throw error instanceof Error ? error : new Error('Unknown error in chat');
    }
  }
}

export const openAIService = new OpenAIService(); 