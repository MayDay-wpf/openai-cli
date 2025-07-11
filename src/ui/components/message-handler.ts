import chalk from 'chalk';
import { marked } from 'marked';
import { languageService } from '../../services/language';
import { ChatMessage, openAIService } from '../../services/openai';
import { StorageService } from '../../services/storage';
import { SystemDetector } from '../../services/system-detector';
import { Messages } from '../../types/language';
import { AnimationUtils, LoadingController, TokenCalculator } from '../../utils';
import type { Message } from '../../utils/token-calculator';
// cli-highlight的正确导入方式
const { highlight } = require('cli-highlight');

export interface ChatState {
    canSendMessage: boolean;
    isProcessing: boolean;
}

export interface MessageHandlerCallbacks {
    onStateChange: (state: Partial<ChatState>) => void;
    onLoadingStart: (controller: LoadingController) => void;
    onLoadingStop: () => void;
    getSelectedFiles: () => string[];
    addMessage: (message: Message) => void;
    getRecentMessages: (count?: number) => Message[];
    getSystemDetector: () => SystemDetector;
}

/**
 * 流式渲染器，用于处理流式输入并进行美观输出
 */
class StreamRenderer {
    private buffer: string = '';
    private isInCodeBlock: boolean = false;
    private codeBlockLanguage: string = '';
    private codeBlockContent: string = '';
    private currentLine: string = '';
    private codeLineNumber: number = 1;

    // 支持的语言列表（常见的编程语言）
    private supportedLanguages = new Set([
        'javascript', 'js', 'typescript', 'ts', 'python', 'py', 'java', 
        'cpp', 'c++', 'c', 'csharp', 'cs', 'php', 'ruby', 'go', 
        'rust', 'swift', 'kotlin', 'scala', 'sql', 'html', 'css', 
        'scss', 'sass', 'less', 'xml', 'json', 'yaml', 'yml', 
        'bash', 'sh', 'shell', 'powershell', 'dockerfile', 'makefile',
        'perl', 'lua', 'r', 'matlab', 'objective-c', 'dart', 'elixir',
        'erlang', 'haskell', 'clojure', 'groovy', 'actionscript'
    ]);

    constructor() {
        // 配置marked选项
        marked.setOptions({
            breaks: true,
            gfm: true,
        });
    }

    /**
     * 检查语言是否被支持，如果不支持则返回默认配置
     */
    private checkLanguageSupport(language: string): { isSupported: boolean; fallbackLanguage?: string } {
        if (!language || language.trim() === '') {
            return { isSupported: false };
        }

        const normalizedLang = language.toLowerCase().trim();
        
        // 处理一些特殊的语言别名
        const languageAliases: { [key: string]: string } = {
            'vue': 'html',  // Vue文件可以用HTML高亮作为回退
            'jsx': 'javascript',
            'tsx': 'typescript',
            'vue.js': 'html',
            'vuejs': 'html',
            'svelte': 'html',
            'angular': 'typescript',
            'react': 'javascript'
        };

        // 检查是否有别名映射
        if (languageAliases[normalizedLang]) {
            return { isSupported: true, fallbackLanguage: languageAliases[normalizedLang] };
        }

        // 检查是否直接支持
        if (this.supportedLanguages.has(normalizedLang)) {
            return { isSupported: true };
        }

        return { isSupported: false };
    }

    /**
     * 处理流式输入的文本块
     */
    processChunk(chunk: string): string {
        let output = '';
        this.buffer += chunk;

        // 按换行符分割处理
        const lines = this.buffer.split('\n');

        // 保留最后一行（可能不完整）
        this.buffer = lines.pop() || '';

        // 处理完整的行
        for (const line of lines) {
            output += this.processLine(line + '\n');
        }

        return output;
    }

    /**
 * 处理单行文本
 */
    private processLine(line: string): string {
        const cleanLine = line.replace('\n', '');

        // 检测代码块开始/结束
        if (cleanLine.startsWith('```')) {
            if (!this.isInCodeBlock) {
                // 代码块开始
                this.isInCodeBlock = true;
                this.codeBlockLanguage = cleanLine.substring(3).trim();
                this.codeBlockContent = '';
                this.codeLineNumber = 1;

                // 显示代码块头部
                const messages = languageService.getMessages();
                const language = this.codeBlockLanguage || messages.main.messages.codeBlock.unknownLanguage;
                const terminalWidth = process.stdout.columns || 120;
                const languageLabel = ` ${language.toUpperCase()} `;
                const remainingWidth = terminalWidth - languageLabel.length;

                return chalk.bgBlue.white.bold(languageLabel) + chalk.blue('─'.repeat(Math.max(0, remainingWidth))) + '\n';
            } else {
                // 代码块结束
                this.isInCodeBlock = false;
                this.codeBlockContent = '';
                this.codeBlockLanguage = '';

                // 显示代码块底部
                const terminalWidth = process.stdout.columns || 120;
                return chalk.blue('─'.repeat(terminalWidth)) + '\n';
            }
        }

        if (this.isInCodeBlock) {
            // 在代码块内，添加行号和背景色
            const lineNum = this.codeLineNumber.toString().padStart(3, ' ');
            const highlightedCode = this.highlightCodeLine(cleanLine, this.codeBlockLanguage);
            this.codeLineNumber++;

            // 获取终端宽度，默认120列
            const terminalWidth = process.stdout.columns || 120;
            const lineNumberWidth = 5; // 行号部分宽度 " 123 "
            const availableWidth = terminalWidth - lineNumberWidth;

            // 计算实际字符长度（去除ANSI颜色代码）
            const stripAnsi = (str: string) => str.replace(/\x1b\[[0-9;]*m/g, '');
            const actualCodeLength = stripAnsi(highlightedCode).length;

            // 确保填充到正确宽度
            const paddingNeeded = Math.max(0, availableWidth - actualCodeLength);
            const paddedCode = highlightedCode + ' '.repeat(paddingNeeded);

            // 使用更好看的配色方案 - 根据当前行号而不是下一行
            const isEvenLine = (this.codeLineNumber - 1) % 2 === 0;
            const bgColor = isEvenLine ? chalk.bgHex('#2a2a2a') : chalk.bgHex('#1e1e1e');

            return chalk.bgHex('#404040').white.bold(` ${lineNum} `) +
                bgColor(paddedCode) + '\n';
        }

        // 普通文本行的美化处理
        return this.formatRegularLine(cleanLine) + '\n';
    }

    /**
     * 代码高亮（完整代码块）
     */
    private highlightCode(code: string, language: string): string {
        const languageCheck = this.checkLanguageSupport(language);
        
        try {
            if (languageCheck.isSupported) {
                const targetLanguage = languageCheck.fallbackLanguage || language;
                return highlight(code, { language: targetLanguage });
            } else {
                // 不支持的语言使用黄色高亮
                return chalk.yellow(code);
            }
        } catch (error) {
            // 如果高亮失败，也使用黄色高亮
            return chalk.yellow(code);
        }
    }

    /**
     * 单行代码高亮
     */
    private highlightCodeLine(codeLine: string, language: string): string {
        const languageCheck = this.checkLanguageSupport(language);
        
        try {
            if (languageCheck.isSupported) {
                const targetLanguage = languageCheck.fallbackLanguage || language;
                return highlight(codeLine, { language: targetLanguage });
            } else {
                // 不支持的语言使用黄色高亮
                return chalk.yellow(codeLine);
            }
        } catch (error) {
            // 如果高亮失败，也使用黄色高亮
            return chalk.yellow(codeLine);
        }
    }

    /**
     * 格式化普通文本行
     */
    private formatRegularLine(line: string): string {
        const messages = languageService.getMessages();

        // 处理标题
        if (line.startsWith('# ')) {
            return chalk.bold.cyan(line);
        } else if (line.startsWith('## ')) {
            return chalk.bold.blue(line);
        } else if (line.startsWith('### ')) {
            return chalk.bold.magenta(line);
        } else if (line.startsWith('#### ')) {
            return chalk.bold.yellow(line);
        }

        // 处理列表项
        if (line.match(/^[\s]*[-*+]\s/)) {
            return chalk.green(line);
        }

        // 处理数字列表
        if (line.match(/^[\s]*\d+\.\s/)) {
            return chalk.cyan(line);
        }

        // 处理行内代码
        line = line.replace(/`([^`]+)`/g, (match, code) => {
            return chalk.yellow.bgBlack(` ${code} `);
        });

        // 处理加粗文本
        line = line.replace(/\*\*([^*]+)\*\*/g, (match, text) => {
            return chalk.bold(text);
        });

        // 处理斜体文本
        line = line.replace(/\*([^*]+)\*/g, (match, text) => {
            return chalk.italic(text);
        });

        // 处理链接
        line = line.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
            return chalk.blue.underline(text) + chalk.dim(` (${url})`);
        });

        return line;
    }

    /**
 * 完成处理，处理缓冲区中剩余的内容
 */
    finalize(): string {
        if (this.buffer.length > 0) {
            const result = this.processLine(this.buffer + '\n');
            this.buffer = '';
            return result;
        }

        // 如果还在代码块中，重置状态（因为现在是按行处理的）
        if (this.isInCodeBlock) {
            this.isInCodeBlock = false;
            this.codeBlockContent = '';
            this.codeBlockLanguage = '';
        }

        return '';
    }

    /**
     * 重置渲染器状态
     */
    reset(): void {
        this.buffer = '';
        this.isInCodeBlock = false;
        this.codeBlockLanguage = '';
        this.codeBlockContent = '';
        this.currentLine = '';
        this.codeLineNumber = 1;
    }
}

export class MessageHandler {
    private currentMessages: Messages;
    private callbacks: MessageHandlerCallbacks;
    private streamRenderer: StreamRenderer;

    constructor(messages: Messages, callbacks: MessageHandlerCallbacks) {
        this.currentMessages = messages;
        this.callbacks = callbacks;
        this.streamRenderer = new StreamRenderer();

        // 监听语言变更事件
        languageService.onLanguageChange((language) => {
            this.currentMessages = languageService.getMessages();
        });
    }



    updateLanguage(messages: Messages): void {
        this.currentMessages = messages;
    }

    /**
     * 添加用户消息并显示
     */
    addUserMessage(content: string): void {
        const userMessage: Message = {
            type: 'user',
            content,
            timestamp: new Date()
        };

        this.callbacks.addMessage(userMessage);
        this.displayMessage(userMessage);
    }

    /**
     * 显示消息
     */
    displayMessage(message: Message): void {
        const messages = languageService.getMessages();
        const timeStr = message.timestamp.toLocaleTimeString(messages.main.messages.format.timeLocale, {
            hour: '2-digit',
            minute: '2-digit'
        });

        if (message.type === 'user') {
            // 美化用户消息标签
            const userPrefix = chalk.bgBlue.white.bold(` ${messages.main.messages.userLabel} `) + chalk.blue(` ${timeStr} `);
            process.stdout.write(userPrefix + '\n' + chalk.cyan('❯ ') + chalk.white(message.content) + '\n\n');
        } else if (message.type === 'ai') {
            // 美化AI消息标签
            const aiPrefix = chalk.bgGreen.white.bold(` ${messages.main.messages.aiLabel} `) + chalk.green(` ${timeStr} `);
            process.stdout.write(aiPrefix + '\n');

            // 重置渲染器并处理完整内容
            this.streamRenderer.reset();
            const formattedContent = this.streamRenderer.processChunk(message.content);
            const finalContent = this.streamRenderer.finalize();

            process.stdout.write(formattedContent + finalContent + '\n');
        }
    }

    /**
     * 显示 AI 回复，使用美观的流式渲染
     */
    displayAIResponse(content: string): void {
        const messages = languageService.getMessages();
        const timeStr = new Date().toLocaleTimeString(messages.main.messages.format.timeLocale, {
            hour: '2-digit',
            minute: '2-digit'
        });

        // 美化AI回复标签
        const aiPrefix = chalk.bgGreen.white.bold(` ${messages.main.messages.aiLabel} `) + chalk.green(` ${timeStr} `);

        // 使用流式渲染器处理内容
        this.streamRenderer.reset();
        const formattedContent = this.streamRenderer.processChunk(content);
        const finalContent = this.streamRenderer.finalize();

        process.stdout.write(aiPrefix + '\n' + formattedContent + finalContent + '\n\n');
    }

    /**
     * 注入AI回复（用于外部调用）
     */
    injectAIReply(content: string): void {
        const aiMessage: Message = {
            type: 'ai',
            content,
            timestamp: new Date()
        };

        this.callbacks.addMessage(aiMessage);
        this.displayAIResponse(content);
    }

    /**
     * 处理AI请求的主要逻辑
     */
    async processAIRequest(): Promise<void> {
        const messages = languageService.getMessages();

        // 检查API配置
        const validation = StorageService.validateApiConfig();
        if (!validation.isValid) {
            const errorMsg = messages.main.status.configMissing;
            process.stdout.write(chalk.red(errorMsg) + '\n');
            process.stdout.write(chalk.yellow(messages.main.init.missingItems + ': ' + validation.missing.join(', ')) + '\n');
            process.stdout.write(chalk.cyan(messages.main.init.useConfig + '\n\n'));
            return;
        }

        // 设置处理状态
        this.callbacks.onStateChange({ isProcessing: true, canSendMessage: false });

        // 显示loading动画
        const loadingController = AnimationUtils.showLoadingAnimation({
            text: messages.main.status.thinking
        });
        this.callbacks.onLoadingStart(loadingController);

        try {
            // 构建聊天消息历史，包含选中的文件信息
            const chatMessages = this.buildChatMessages();

            // 获取MCP工具
            const tools = await this.getMcpTools();

            let aiResponseContent = '';
            let isFirstChunk = true;

            // 重置流式渲染器
            this.streamRenderer.reset();

            // 流式调用OpenAI
            await openAIService.streamChat({
                messages: chatMessages,
                tools: tools.length > 0 ? tools : undefined,
                onToolCall: async (toolCall: any) => {
                    // 在工具调用时停止loading动画
                    this.callbacks.onLoadingStop();
                    return await this.handleToolCall(toolCall);
                },
                onChunk: (chunk: string) => {
                    // 如果是第一个chunk，停止loading动画并显示AI标签
                    if (isFirstChunk) {
                        this.callbacks.onLoadingStop();

                        // 显示美化的AI回复开始标签
                        const timeStr = new Date().toLocaleTimeString(messages.main.messages.format.timeLocale, {
                            hour: '2-digit',
                            minute: '2-digit'
                        });
                        const aiPrefix = chalk.bgGreen.white.bold(` ${messages.main.messages.aiLabel} `) + chalk.green(` ${timeStr} `);
                        process.stdout.write(aiPrefix + '\n');
                        isFirstChunk = false;
                    }

                    // 使用流式渲染器处理chunk
                    const formattedChunk = this.streamRenderer.processChunk(chunk);
                    if (formattedChunk) {
                        process.stdout.write(formattedChunk);
                    }

                    aiResponseContent += chunk;
                },
                onComplete: (fullResponse: string) => {
                    // 停止loading动画（如果还在运行）
                    this.callbacks.onLoadingStop();

                    // 处理渲染器中剩余的内容
                    const finalContent = this.streamRenderer.finalize();
                    if (finalContent) {
                        process.stdout.write(finalContent);
                    }

                    // 换行结束AI回复
                    process.stdout.write('\n\n');

                    // 将完整回复添加到历史记录
                    const aiMessage: Message = {
                        type: 'ai',
                        content: fullResponse,
                        timestamp: new Date()
                    };
                    this.callbacks.addMessage(aiMessage);

                    // 恢复状态
                    this.callbacks.onStateChange({ isProcessing: false, canSendMessage: true });
                },
                onError: (error: Error) => {
                    // 停止loading动画
                    this.callbacks.onLoadingStop();

                    // 显示错误信息
                    const errorMsg = `${messages.main.status.connectionError}: ${error.message}`;
                    process.stdout.write(chalk.red(errorMsg) + '\n\n');

                    // 恢复状态
                    this.callbacks.onStateChange({ isProcessing: false, canSendMessage: true });
                }
            });

        } catch (error) {
            // 停止loading动画
            this.callbacks.onLoadingStop();

            // 显示错误信息
            const errorMsg = error instanceof Error ? error.message : messages.main.status.unknownError;
            process.stdout.write(chalk.red(`${messages.main.status.connectionError}: ${errorMsg}`) + '\n\n');

            // 恢复状态
            this.callbacks.onStateChange({ isProcessing: false, canSendMessage: true });
        }
    }

    /**
     * 获取MCP工具定义
     */
    private async getMcpTools(): Promise<any[]> {
        try {
            const systemDetector = this.callbacks.getSystemDetector();
            const tools = await systemDetector.getAllToolDefinitions();
            
            // 调试信息：显示加载的工具
            // if (tools.length > 0) {
            //     const messages = languageService.getMessages();
            //     console.log(chalk.gray(`🐛 🛠️ 已加载 ${tools.length} 个MCP工具: ${tools.map(t => t.function.name).join(', ')}`));
            //     // 显示第一个工具的详细信息
            //     if (tools[0]) {
            //         console.log(chalk.gray(`🐛 第一个工具详情: ${JSON.stringify(tools[0], null, 2)}`));
            //     }
            // }
            
            return tools;
        } catch (error) {
            console.warn('Failed to get MCP tools:', error);
            return [];
        }
    }

    /**
     * 处理工具调用
     */
    private async handleToolCall(toolCall: any): Promise<any> {
        try {
            const messages = languageService.getMessages();
            const functionName = toolCall.function.name;
            const parameters = JSON.parse(toolCall.function.arguments || '{}');

            console.log(chalk.cyan(messages.main.messages.toolCall.calling.replace('{name}', functionName)));
            console.log(chalk.gray(`🐛参数: ${JSON.stringify(parameters, null, 2)}`));

            // 将工具调用记录添加到历史记录
            const toolCallMessage: Message = {
                type: 'ai',
                content: `🛠️ **Tool Call: ${functionName}**\n\n**Parameters:**\n\`\`\`json\n${JSON.stringify(parameters, null, 2)}\n\`\`\``,
                timestamp: new Date()
            };
            this.callbacks.addMessage(toolCallMessage);

            const systemDetector = this.callbacks.getSystemDetector();
            const result = await systemDetector.executeMcpTool(functionName, parameters);

            console.log(chalk.green(messages.main.messages.toolCall.success));
            //console.log(chalk.gray(`🐛结果: ${JSON.stringify(result, null, 2)}`));

            // 将工具调用结果添加到历史记录
            let resultContent = '';
            if (result && typeof result === 'object') {
                // 如果结果是文件内容或目录结构，格式化显示
                if (result.content) {
                    resultContent = `✅ **Tool Result: ${functionName}**\n\n`;
                    if (result.structure) {
                        // 目录结构结果
                        resultContent += result.structure;
                    } else {
                        // 文件内容结果
                        resultContent += `**File:** ${parameters.path || 'Unknown'}\n`;
                        if (result.totalLines) {
                            resultContent += `**Lines:** ${result.lineRange?.start || 1}-${result.lineRange?.end || result.totalLines} of ${result.totalLines}\n`;
                        }
                        if (result.tokenCount) {
                            resultContent += `**Tokens:** ${result.tokenCount}\n`;
                        }
                        if (result.isPartial) {
                            resultContent += `**Status:** Partial content (truncated due to token limit)\n`;
                        }
                        if (result.message) {
                            resultContent += `**Message:** ${result.message}\n`;
                        }
                        resultContent += `\n**Content:**\n\`\`\`\n${result.content}\n\`\`\``;
                    }
                } else {
                    // 其他类型的结果
                    resultContent = `✅ **Tool Result: ${functionName}**\n\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``;
                }
            } else {
                resultContent = `✅ **Tool Result: ${functionName}**\n\n${String(result)}`;
            }

            const toolResultMessage: Message = {
                type: 'ai',
                content: resultContent,
                timestamp: new Date()
            };
            this.callbacks.addMessage(toolResultMessage);

            return result;
        } catch (error) {
            const messages = languageService.getMessages();
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            console.log(chalk.red(messages.main.messages.toolCall.failed.replace('{error}', errorMsg)));

            // 将工具调用错误也添加到历史记录
            const errorMessage: Message = {
                type: 'ai',
                content: `❌ **Tool Error: ${toolCall.function?.name || 'Unknown'}**\n\n**Error:** ${errorMsg}\n\n**Parameters:**\n\`\`\`json\n${JSON.stringify(JSON.parse(toolCall.function?.arguments || '{}'), null, 2)}\n\`\`\``,
                timestamp: new Date()
            };
            this.callbacks.addMessage(errorMessage);

            throw error;
        }
    }

    /**
     * 构建包含历史记录和文件信息的聊天消息
     */
    private buildChatMessages(): ChatMessage[] {
        const messages: ChatMessage[] = [];
        const currentMessages = languageService.getMessages();

        // 构建系统消息
        const selectedFiles = this.callbacks.getSelectedFiles();
        let systemMessage = currentMessages.main.messages.system.basePrompt;

        // 添加系统角色提示词
        const apiConfig = StorageService.getApiConfig();
        if (apiConfig.role) {
            systemMessage += '\n\n' + apiConfig.role;
        }

        if (selectedFiles.length > 0) {
            const fileList = selectedFiles.map(file => `- ${file}`).join('\n');
            systemMessage += currentMessages.main.messages.system.fileReferencePrompt.replace('{fileList}', fileList);
        }

        // 获取所有历史消息
        const allHistoryMessages = this.callbacks.getRecentMessages();

        // 使用TokenCalculator智能选择历史记录，保持在上下文限制的80%以内
        const tokenResult = TokenCalculator.selectHistoryMessages(
            allHistoryMessages,
            systemMessage,
            0.8 // 使用80%的上下文限制
        );

        // 添加系统消息
        messages.push({
            role: 'system',
            content: systemMessage
        });

        // 如果有消息被丢弃，显示提示信息
        if (tokenResult.droppedCount > 0) {
            const droppedMessage = currentMessages.main.messages.tokenUsage.droppedMessages.replace('{count}', tokenResult.droppedCount.toString());
            const statsMessage = currentMessages.main.messages.tokenUsage.tokenStats
                .replace('{used}', tokenResult.totalTokens.toString())
                .replace('{max}', tokenResult.maxAllowedTokens.toString())
                .replace('{percentage}', Math.round((tokenResult.totalTokens / tokenResult.maxAllowedTokens) * 100).toString());

            console.log(chalk.yellow(droppedMessage));
            console.log(chalk.gray(statsMessage));
        }

        // 添加选中的历史消息
        for (const message of tokenResult.allowedMessages) {
            messages.push({
                role: message.type === 'user' ? 'user' : 'assistant',
                content: message.content
            });
        }

        return messages;
    }

    /**
     * 显示历史记录
     */
    showHistory(messages: Message[]): void {
        const currentMessages = languageService.getMessages();

        if (messages.length === 0) {
            process.stdout.write(chalk.yellow(currentMessages.main.messages.noHistory + '\n'));
            return;
        }

        process.stdout.write(chalk.bold('\n=== ' + currentMessages.main.messages.historyTitle + ' ===\n\n'));

        // 显示Token使用统计
        const selectedFiles = this.callbacks.getSelectedFiles();
        let systemMessage = currentMessages.main.messages.system.basePrompt;
        if (selectedFiles.length > 0) {
            const fileList = selectedFiles.map(file => `- ${file}`).join('\n');
            systemMessage += currentMessages.main.messages.system.fileReferencePrompt.replace('{fileList}', fileList);
        }

        const stats = TokenCalculator.getContextUsageStats(messages, systemMessage, 0.8);
        const statsMessage = currentMessages.main.messages.tokenUsage.tokenStats
            .replace('{used}', stats.used.toString())
            .replace('{max}', stats.maxAllowed.toString())
            .replace('{percentage}', stats.percentage.toString());

        process.stdout.write(chalk.gray(statsMessage) + '\n');

        if (stats.isNearLimit) {
            process.stdout.write(chalk.yellow(currentMessages.main.messages.tokenUsage.nearLimit) + '\n');
        }

        process.stdout.write('\n');

        messages.forEach((message, index) => {
            const timeStr = message.timestamp.toLocaleTimeString(currentMessages.main.messages.format.timeLocale, {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });

            if (message.type === 'user') {
                const prefix = chalk.bgBlue.white.bold(` [${index + 1}] ${currentMessages.main.messages.userLabel} `) + chalk.blue(` ${timeStr} `);
                process.stdout.write(prefix + '\n' + chalk.cyan('❯ ') + chalk.white(message.content) + '\n\n');
            } else {
                // AI消息使用美观渲染
                const prefix = chalk.bgGreen.white.bold(` [${index + 1}] ${currentMessages.main.messages.aiLabel} `) + chalk.green(` ${timeStr} `);
                process.stdout.write(prefix + '\n');

                // 创建临时渲染器处理AI消息
                const tempRenderer = new StreamRenderer();
                const formattedContent = tempRenderer.processChunk(message.content);
                const finalContent = tempRenderer.finalize();

                process.stdout.write(formattedContent + finalContent + '\n');
            }
        });

        const totalMsg = currentMessages.main.messages.totalMessages.replace('{count}', messages.length.toString());
        process.stdout.write(chalk.gray(`\n${totalMsg}\n\n`));
    }
} 