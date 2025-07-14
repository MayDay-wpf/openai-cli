import { get_encoding } from 'tiktoken';
import { ChatMessage } from '../services/openai';
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
     */
    static selectHistoryMessages(
        messages: Message[],
        systemMessage: string,
        targetUsageRatio: number = 0.8
    ): TokenCalculationResult {
        const apiConfig = StorageService.getApiConfig();
        const maxContextTokens = apiConfig.contextTokens || 128000;
        const maxAllowedTokens = Math.floor(maxContextTokens * targetUsageRatio);

        // 计算系统消息的tokens
        const systemTokens = this.calculateTokens(systemMessage) + 4; // 加上角色开销

        // 首先计算所有消息的总token
        let totalOriginalTokens = systemTokens;
        messages.forEach(msg => {
            totalOriginalTokens += this.calculateTokens(msg.content) + 4; // 加上角色开销
        });

        // 如果总token未超过限制，则返回所有消息，不进行压缩
        if (totalOriginalTokens <= maxAllowedTokens) {
            return {
                totalTokens: totalOriginalTokens,
                maxAllowedTokens,
                allowedMessages: messages,
                droppedCount: 0
            };
        }

        console.log(`--- History token limit exceeded (${totalOriginalTokens} > ${maxAllowedTokens}), compressing... ---`);


        // 如果系统消息就超过限制，返回空结果
        if (systemTokens >= maxAllowedTokens) {
            return {
                totalTokens: systemTokens,
                maxAllowedTokens,
                allowedMessages: [],
                droppedCount: messages.length
            };
        }

        // 可用于历史记录的token数量
        const availableTokens = maxAllowedTokens - systemTokens;
        const allowedMessages: Message[] = [];
        let currentTokens = 0;
        let droppedCount = 0;

        // 从最新的消息开始向前选择
        for (let i = messages.length - 1; i >= 0; i--) {
            const message = messages[i];
            const messageTokens = this.calculateTokens(message.content) + 4; // 加上角色开销

            // 检查添加这条消息是否会超过限制
            if (currentTokens + messageTokens <= availableTokens) {
                allowedMessages.unshift(message); // 添加到开头以保持时间顺序
                currentTokens += messageTokens;
            } else {
                droppedCount = i + 1; // 丢弃的消息数量
                break;
            }
        }

        return {
            totalTokens: systemTokens + currentTokens,
            maxAllowedTokens,
            allowedMessages,
            droppedCount
        };
    }

    /**
     * 获取当前配置的上下文使用统计信息
     */
    static getContextUsageStats(
        messages: Message[],
        systemMessage: string,
        targetUsageRatio: number = 0.8
    ): {
        maxContext: number;
        maxAllowed: number;
        used: number;
        percentage: number;
        remaining: number;
        isNearLimit: boolean;
    } {
        const result = this.selectHistoryMessages(messages, systemMessage, targetUsageRatio);
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