import { get_encoding } from 'tiktoken';
import { ChatMessage, openAIService } from '../services/openai';
import { StorageService } from '../services/storage';

export interface Message {
    type: 'user' | 'ai' | 'system' | 'tool';
    content: any;
    displayContent?: string; // 用于显示的美化内容
    timestamp: Date;
    tool_calls?: any[];
    tool_call_id?: string;
    name?: string; // For tool calls
}

export interface TokenCalculationResult {
    totalTokens: number;
    maxAllowedTokens: number;
    allowedMessages: Message[];
    droppedCount: number;
    summary?: string; // 新增字段，用于存放压缩摘要
}

export class TokenCalculator {
    private static encoding: any = null;

    /**
     * 初始化编码器，优先使用模型特定的编码器，回退到通用编码器
     */
    private static getEncoding(): any {
        if (this.encoding) {
            return this.encoding;
        }
        this.encoding = get_encoding('o200k_base');
        return this.encoding;
    }

    /**
     * 计算文本的Token数量
     */
    static calculateTokens(text: string): number {
        try {
            const encoding = this.getEncoding();
            const tokens = encoding.encode(text);
            return tokens.length;
        } catch (error) {
            // 回退到字符估算：大约1个token = 3.5个字符（对于中英文混合）
            return Math.ceil(text.length / 3.5);
        }
    }

    /**
     * 计算ChatMessage的Token数量（包括角色信息的开销）
     */
    static calculateChatMessageTokens(message: ChatMessage): number {
        // 每个消息都有一些固定开销：角色标识、格式化等
        const roleOverhead = 4; // 角色信息的大概开销
        let contentForTokenCalculation = '';
        if (typeof message.content === 'string') {
            contentForTokenCalculation = message.content;
        } else if (Array.isArray(message.content)) {
            contentForTokenCalculation = message.content
                .filter(part => part.type === 'text')
                // @ts-ignore
                .map(part => part.text)
                .join(' ');
        }
        const contentTokens = this.calculateTokens(contentForTokenCalculation);
        return contentTokens + roleOverhead;
    }

    /**
     * 计算多个ChatMessage的总Token数量
     */
    static calculateChatMessagesTokens(messages: ChatMessage[]): number {
        let totalTokens = 0;

        // 计算每个消息的tokens
        for (const message of messages) {
            totalTokens += this.calculateChatMessageTokens(message);
        }

        // 添加对话的固定开销
        const conversationOverhead = 8; // 对话开始和结束的开销

        return totalTokens + conversationOverhead;
    }

    /**
     * 智能选择历史记录，确保不超过上下文Token限制
     * 现在是一个异步函数，以支持智能压缩
     */
    static async selectHistoryMessages(
        messages: Message[],
        systemMessage: string,
        targetUsageRatio: number = 0.8
    ): Promise<TokenCalculationResult> {
        const apiConfig = StorageService.getApiConfig();
        const maxContextTokens = apiConfig.contextTokens || 128000;
        const maxAllowedTokens = Math.floor(maxContextTokens * targetUsageRatio);

        const systemTokens = this.calculateTokens(systemMessage) + 4;

        let totalOriginalTokens = systemTokens;
        messages.forEach(msg => {
            const contentString = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content ?? null);
            totalOriginalTokens += this.calculateTokens(contentString) + 4;
        });

        if (totalOriginalTokens <= maxAllowedTokens) {
            return {
                totalTokens: totalOriginalTokens,
                maxAllowedTokens,
                allowedMessages: messages,
                droppedCount: 0,
            };
        }

        console.log(`--- History token limit exceeded (${totalOriginalTokens} > ${maxAllowedTokens}), compressing... ---`);
        
        // --- 智能压缩逻辑 ---
        const tokensToCut = totalOriginalTokens - maxAllowedTokens;
        let tokensCounted = 0;
        let cutIndex = -1;

        // 1. 找到需要压缩的消息的切分点
        for (let i = 0; i < messages.length; i++) {
            const msg = messages[i];
            const contentString = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content ?? null);
            tokensCounted += this.calculateTokens(contentString) + 4;
            if (tokensCounted >= tokensToCut) {
                cutIndex = i;
                break;
            }
        }
        
        // 2. 为了保证上下文的完整性，我们找到下一个'user'消息作为最终的切分点
        let finalCutIndex = -1;
        if (cutIndex !== -1) {
            for (let i = cutIndex; i < messages.length; i++) {
                if (messages[i].type === 'user') {
                    finalCutIndex = i;
                    break;
                }
            }
        }

        // 如果找不到安全的切分点，或者切分后没剩下任何消息，则放弃压缩并返回空
        if (finalCutIndex === -1 || finalCutIndex === messages.length -1) {
             return { totalTokens: systemTokens, maxAllowedTokens, allowedMessages: [], droppedCount: messages.length };
        }

        const messagesToCompress = messages.slice(0, finalCutIndex);
        const allowedMessages = messages.slice(finalCutIndex);

        // 3. 将待压缩消息转换为API格式
        const compressionChatMessages: ChatMessage[] = messagesToCompress.map(msg => ({
            role: msg.type === 'ai' ? 'assistant' : msg.type,
            content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content ?? null)
        } as ChatMessage));
        
        // 4. 调用API进行压缩
        let summary = '';
        try {
            const summaryPrompt: ChatMessage = {
                role: 'user',
                content: 'Please summarize the preceding conversation into a concise paragraph. Keep all key facts, decisions, and code snippets mentioned. The summary will be used as context for a following conversation.'
            };
            
            const summaryResponse = await openAIService.chat({
                messages: [...compressionChatMessages, summaryPrompt],
                temperature: 0.2,
                maxTokens: 1000,
            });
            summary = summaryResponse;
        } catch (error) {
            console.warn('Failed to compress conversation history:', error);
            // 压缩失败，回退到丢弃策略
            return { totalTokens: systemTokens, maxAllowedTokens, allowedMessages: [], droppedCount: messages.length, summary: '[Conversation history was too long and compression failed.]' };
        }
        
        // 5. 重新计算最终的token
        let finalTokens = systemTokens + this.calculateTokens(summary) + 4;
        allowedMessages.forEach(msg => {
            const contentString = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content ?? null);
            finalTokens += this.calculateTokens(contentString) + 4;
        });

        return {
            totalTokens: finalTokens,
            maxAllowedTokens,
            allowedMessages: allowedMessages,
            droppedCount: messagesToCompress.length,
            summary: summary
        };
    }

    /**
     * 获取当前配置的上下文使用统计信息
     */
    static async getContextUsageStats(
        messages: Message[],
        systemMessage: string,
        targetUsageRatio: number = 0.8
    ): Promise<{
        maxContext: number;
        maxAllowed: number;
        used: number;
        percentage: number;
        remaining: number;
        isNearLimit: boolean;
    }> {
        const result = await this.selectHistoryMessages(messages, systemMessage, targetUsageRatio);
        const apiConfig = StorageService.getApiConfig();
        const maxContext = apiConfig.contextTokens || 128000;

        return {
            maxContext,
            maxAllowed: result.maxAllowedTokens,
            used: result.totalTokens,
            percentage: Math.round((result.totalTokens / result.maxAllowedTokens) * 100),
            remaining: result.maxAllowedTokens - result.totalTokens,
            isNearLimit: result.totalTokens / result.maxAllowedTokens > 0.9
        };
    }

    /**
     * 释放编码器资源
     */
    static cleanup(): void {
        if (this.encoding) {
            try {
                this.encoding.free();
            } catch (error) {
                // 忽略清理错误
            }
            this.encoding = null;
        }
    }
} 