import chalk from 'chalk';
import * as fs from 'fs';
import { marked } from 'marked';
import * as path from 'path';
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
    getSelectedImageFiles: () => string[];
    getSelectedTextFiles: () => string[];
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

        // 粗体和斜体
        line = line.replace(/\*\*\*([^\*]+)\*\*\*/g, chalk.bold.italic('$1'));
        line = line.replace(/\*\*([^\*]+)\*\*/g, chalk.bold('$1'));
        line = line.replace(/\*([^\*]+)\*/g, chalk.italic('$1'));

        return line;
    }

    /**
     * 获取MIME类型
     */
    private getMimeType(extension: string): string | null {
        const mimeTypes: { [key: string]: string } = {
            '.png': 'image/png',
            '.jpeg': 'image/jpeg',
            '.jpg': 'image/jpeg',
            '.webp': 'image/webp',
            '.gif': 'image/gif',
        };
        return mimeTypes[extension] || null;
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

        let isLoading = false;

        const stopLoading = () => {
            if (isLoading) {
                this.callbacks.onLoadingStop();
                isLoading = false;
            }
        };

        const startLoading = () => {
            if (!isLoading) {
                const loadingController = AnimationUtils.showLoadingAnimation({
                    text: messages.main.status.thinking
                });
                this.callbacks.onLoadingStart(loadingController);
                isLoading = true;
            }
        };

        let isFirstChunk = true;
        const resetForNewResponse = () => {
            isFirstChunk = true;
        };

        startLoading(); // 首次启动加载动画

        try {
            // 构建聊天消息历史
            const chatMessages = this.buildChatMessages();
            // 获取MCP工具
            const tools = await this.getMcpTools();

            let aiResponseContent = '';
            let assistantMessageDisplayed = false;

            // 重置流式渲染器
            this.streamRenderer.reset();

            // 流式调用OpenAI
            await openAIService.streamChat({
                messages: chatMessages,
                tools: tools.length > 0 ? tools : undefined,
                onToolChunk: (toolChunk) => {
                    // 保持加载动画
                },
                onAssistantMessage: ({ content, toolCalls }) => {
                    stopLoading(); // 在显示内容前停止动画

                    const finalContent = this.streamRenderer.finalize();
                    if (finalContent) {
                        process.stdout.write(finalContent);
                    }
                    process.stdout.write('\n\n');

                    const aiMessage: Message = {
                        type: 'ai',
                        content: content,
                        timestamp: new Date()
                    };
                    this.callbacks.addMessage(aiMessage);
                    assistantMessageDisplayed = true;
                },
                onToolCall: async (toolCall: any) => {
                    // onAssistantMessage 已经停止了动画，这里执行工具调用
                    // handleToolCall 会在执行后重新启动动画并重置状态
                    return await this.handleToolCall(toolCall, startLoading, resetForNewResponse);
                },
                onChunk: (chunk: string) => {
                    if (isFirstChunk) {
                        stopLoading(); // 在渲染第一个数据块前停止动画

                        // 显示AI回复标签
                        const timeStr = new Date().toLocaleTimeString(messages.main.messages.format.timeLocale, {
                            hour: '2-digit',
                            minute: '2-digit'
                        });
                        const aiPrefix = chalk.bgGreen.white.bold(` ${messages.main.messages.aiLabel} `) + chalk.green(` ${timeStr} `);
                        process.stdout.write(aiPrefix + '\n');
                        isFirstChunk = false;
                    }

                    const formattedChunk = this.streamRenderer.processChunk(chunk);
                    if (formattedChunk) {
                        process.stdout.write(formattedChunk);
                    }
                    aiResponseContent += chunk;
                },
                onComplete: (fullResponse: string) => {
                    stopLoading(); // 确保流程结束时动画已停止

                    if (assistantMessageDisplayed) {
                        this.callbacks.onStateChange({ isProcessing: false, canSendMessage: true });
                        return;
                    }

                    const finalContent = this.streamRenderer.finalize();
                    if (finalContent) {
                        process.stdout.write(finalContent);
                    }
                    process.stdout.write('\n\n');

                    const aiMessage: Message = {
                        type: 'ai',
                        content: fullResponse,
                        timestamp: new Date()
                    };
                    this.callbacks.addMessage(aiMessage);
                    this.callbacks.onStateChange({ isProcessing: false, canSendMessage: true });
                },
                onError: (error: Error) => {
                    stopLoading(); // 出错时停止动画
                    const errorMsg = `${messages.main.status.connectionError}: ${error.message}`;
                    process.stdout.write(chalk.red(errorMsg) + '\n\n');
                    this.callbacks.onStateChange({ isProcessing: false, canSendMessage: true });
                }
            });

        } catch (error) {
            stopLoading(); // 捕获同步错误
            const errorMsg = error instanceof Error ? error.message : messages.main.status.unknownError;
            process.stdout.write(chalk.red(`${messages.main.status.connectionError}: ${errorMsg}`) + '\n\n');
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
    private async handleToolCall(toolCall: any, startLoading: () => void, resetForNewResponse: () => void): Promise<any> {
        try {
            const messages = languageService.getMessages();
            const functionName = toolCall.function.name;
            const parameters = JSON.parse(toolCall.function.arguments || '{}');

            console.log(chalk.cyan(messages.main.messages.toolCall.calling.replace('{name}', functionName)));

            // 截断并打印参数，防止过长的参数刷屏
            const paramsString = JSON.stringify(parameters, null, 2);
            if (paramsString !== '{}') { // 只在有参数时打印
                const truncatedParams = paramsString.length > 100 ? `${paramsString.substring(0, 100)}...` : paramsString;
                console.log(chalk.gray(`parameters: ${truncatedParams}`));
            }

            // 检查是否需要用户确认
            const needsConfirmation = StorageService.isFunctionConfirmationRequired(functionName);

            if (needsConfirmation) {
                // 显示函数信息并询问用户是否执行
                console.log();
                console.log(chalk.yellow(messages.main.messages.toolCall.handle));
                console.log(chalk.white(`tool: ${chalk.bold(functionName)}`));
                console.log(chalk.white(`parameters: ${chalk.gray(JSON.stringify(parameters, null, 2))}`));
                console.log();

                const shouldExecute = await this.askUserConfirmation(functionName, parameters);

                if (!shouldExecute) {
                    // 用户拒绝执行
                    const rejectionMessage = `❌ **Tool Rejected: ${functionName}**\n\n${messages.main.messages.toolCall.rejected}\n\n**Parameters:**\n\`\`\`json\n${JSON.stringify(parameters, null, 2)}\n\`\`\``;

                    const toolRejectedMessage: Message = {
                        type: 'ai',
                        content: rejectionMessage,
                        timestamp: new Date()
                    };
                    this.callbacks.addMessage(toolRejectedMessage);

                    console.log(chalk.yellow(messages.main.messages.toolCall.rejected));

                    // 返回拒绝信息给AI
                    return {
                        error: messages.main.messages.toolCall.rejected,
                        rejected: true,
                        functionName: functionName,
                        reason: messages.main.messages.toolCall.rejected
                    };
                }

                console.log(chalk.green(messages.main.messages.toolCall.approved));
            }

            // 将工具调用记录添加到历史记录
            // const toolCallMessage: Message = {
            //     type: 'ai',
            //     content: `🛠️ **Tool Call: ${functionName}**\n\n**Parameters:**\n\`\`\`json\n${JSON.stringify(parameters, null, 2)}\n\`\`\``,
            //     timestamp: new Date()
            // };
            // this.callbacks.addMessage(toolCallMessage);

            const systemDetector = this.callbacks.getSystemDetector();
            const result = await systemDetector.executeMcpTool(functionName, parameters);

            console.log(chalk.green(messages.main.messages.toolCall.success));

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

            // 为AI的下一轮思考重新启动加载动画
            startLoading();
            // 重置状态，以便正确处理下一条流式响应
            resetForNewResponse();

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
     * 询问用户是否确认执行函数
     */
    private async askUserConfirmation(functionName: string, parameters: any): Promise<boolean> {
        const messages = languageService.getMessages();
        return new Promise((resolve) => {
            console.log(chalk.yellow(messages.main.messages.toolCall.confirm));
            console.log(chalk.gray(messages.main.messages.toolCall.confirmOptions));
            process.stdout.write(chalk.yellow(messages.main.messages.toolCall.pleaseSelect));

            // 确保stdin处于正确状态
            if (process.stdin.isTTY) {
                process.stdin.setRawMode(true);
            }
            process.stdin.resume();
            process.stdin.setEncoding('utf8');

            const cleanup = () => {
                process.stdin.removeListener('data', keyHandler);
                if (process.stdin.isTTY) {
                    process.stdin.setRawMode(false);
                }
                process.stdin.pause();
            };

            const keyHandler = (key: string) => {
                switch (key.toLowerCase()) {
                    case 'y':
                        process.stdout.write(chalk.green('yes\n'));
                        cleanup();
                        resolve(true);
                        break;
                    case 'n':
                        process.stdout.write(chalk.red('no\n'));
                        cleanup();
                        resolve(false);
                        break;
                    case '\r': // 回车
                    case '\n':
                        process.stdout.write(chalk.green('yes\n'));
                        cleanup();
                        resolve(true);
                        break;
                    case '\u0003': // Ctrl+C
                        process.stdout.write(chalk.red('no\n'));
                        cleanup();
                        resolve(false);
                        break;
                    // 忽略其他按键
                }
            };

            process.stdin.on('data', keyHandler);
        });
    }

    private getMimeType(extension: string): string | null {
        const mimeTypes: { [key: string]: string } = {
            '.png': 'image/png',
            '.jpeg': 'image/jpeg',
            '.jpg': 'image/jpeg',
            '.webp': 'image/webp',
            '.gif': 'image/gif',
        };
        return mimeTypes[extension.toLowerCase()] || null;
    }

    /**
     * 清理用户消息中的@文件引用，将@文件路径转换为纯文件路径说明
     */
    private cleanFileReferencesInMessage(content: string): string {
        // 移除所有@文件引用
        return content.replace(/@([^\s@]+)(?=\s|$)/g, '').trim();
    }

    /**
     * 构建包含历史记录和文件信息的聊天消息
     */
    private buildChatMessages(): ChatMessage[] {
        const recentMessages = this.callbacks.getRecentMessages(20);
        const systemDetector = this.callbacks.getSystemDetector();
        const apiConfig = StorageService.getApiConfig();
        const chatMessages: ChatMessage[] = [];
        const langMessages = languageService.getMessages();

        // 构建系统消息
        const cwd = process.cwd();
        const currentTime = new Date().toLocaleTimeString(langMessages.main.messages.format.timeLocale, {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
        });

        const promptParts = [
            langMessages.main.messages.system.basePrompt
                .replace('{cwd}', cwd)
                .replace('{time}', currentTime)
        ];

        if (apiConfig.role) {
            promptParts.push(apiConfig.role);
        }

        const selectedTextFiles = this.callbacks.getSelectedTextFiles();
        if (selectedTextFiles.length > 0) {
            const fileList = selectedTextFiles.map(file => `- ${file}`).join('\n');
            promptParts.push(
                langMessages.main.messages.system.fileReferencePrompt
                    .replace('{fileList}', fileList)
            );
        }
        const systemMessage = promptParts.join('\n\n');

        if (systemMessage) {
            chatMessages.push({ role: 'system', content: systemMessage });
        }

        // 转换消息历史
        for (const msg of (recentMessages as any[])) {
            if (msg.type === 'user' || msg.type === 'ai' || msg.type === 'tool') {
                const role = msg.type === 'ai' ? 'assistant' : msg.type;
                chatMessages.push({
                    role,
                    content: msg.content,
                    tool_call_id: msg.tool_call_id,
                });
            }
        }

        const selectedImageFiles = this.callbacks.getSelectedImageFiles();

        // 处理文件内容
        let fileContents = '';
        if (selectedTextFiles.length > 0) {
            fileContents = selectedTextFiles
                .map((filePath) => {
                    try {
                        const absolutePath = path.resolve(process.cwd(), filePath);
                        const content = fs.readFileSync(absolutePath, 'utf-8');
                        return `--- ${filePath} ---\n${content}`;
                    } catch (error) {
                        this.displayMessage({
                            type: 'system',
                            content: chalk.red(
                                langMessages.main.fileSearch.fileReadError.replace(
                                    '{filePath}',
                                    filePath
                                )
                            ),
                            timestamp: new Date(),
                        });
                        return '';
                    }
                })
                .filter(content => content)
                .join('\n\n');
        }

        // 更新最后一条用户消息
        const lastUserMessage = chatMessages.filter(msg => msg.role === 'user').pop();

        if (lastUserMessage) {
            let userMessageText = '';
            if (typeof lastUserMessage.content === 'string') {
                userMessageText = this.cleanFileReferencesInMessage(lastUserMessage.content);
            }

            if (fileContents) {
                userMessageText = `${fileContents}\n\n${userMessageText}`;
            }

            if (selectedImageFiles.length > 0) {
                const content: ({ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } })[] = [
                    { type: 'text', text: userMessageText }
                ];

                for (const imagePath of selectedImageFiles) {
                    try {
                        const absolutePath = path.resolve(process.cwd(), imagePath);
                        const imageBuffer = fs.readFileSync(absolutePath);
                        const base64Image = imageBuffer.toString('base64');
                        const ext = path.extname(imagePath).toLowerCase();
                        const mimeType = this.getMimeType(ext);

                        if (mimeType) {
                            content.push({
                                type: 'image_url',
                                image_url: {
                                    url: `data:${mimeType};base64,${base64Image}`,
                                },
                            });
                        }
                    } catch (error) {
                        // ... 错误处理
                    }
                }
                lastUserMessage.content = content;
            } else {
                lastUserMessage.content = userMessageText;
            }
        }

        return chatMessages;
    }

    /**
     * 显示历史记录
     */
    showHistory(messages: Message[]): void {
        const historyMessages = languageService.getMessages();

        if (messages.length === 0) {
            process.stdout.write(chalk.yellow(historyMessages.main.messages.noHistory + '\n'));
            return;
        }

        process.stdout.write(chalk.bold('\n=== ' + historyMessages.main.messages.historyTitle + ' ===\n\n'));

        // 显示Token使用统计
        const selectedTextFiles = this.callbacks.getSelectedTextFiles();
        let systemMessage = historyMessages.main.messages.system.basePrompt;
        if (selectedTextFiles.length > 0) {
            const fileList = selectedTextFiles.map((file: string) => `- ${file}`).join('\n');
            systemMessage += historyMessages.main.messages.system.fileReferencePrompt.replace('{fileList}', fileList);
        }

        const stats = TokenCalculator.getContextUsageStats(messages, systemMessage, 0.8);
        const statsMessage = historyMessages.main.messages.tokenUsage.tokenStats
            .replace('{used}', stats.used.toString())
            .replace('{max}', stats.maxAllowed.toString())
            .replace('{percentage}', Math.round((stats.used / stats.maxAllowed) * 100).toString());

        process.stdout.write(chalk.gray(statsMessage) + '\n');

        if (stats.isNearLimit) {
            process.stdout.write(chalk.yellow(historyMessages.main.messages.tokenUsage.nearLimit) + '\n');
        }

        process.stdout.write('\n');

        messages.forEach((message, index) => {
            const timeStr = message.timestamp.toLocaleTimeString(historyMessages.main.messages.format.timeLocale, {
                hour: '2-digit',
                minute: '2-digit',
            });

            if (message.type === 'user') {
                const prefix = chalk.bgBlue.white.bold(` [${index + 1}] ${historyMessages.main.messages.userLabel} `) + chalk.blue(` ${timeStr} `);
                process.stdout.write(prefix + '\n' + chalk.cyan('❯ ') + chalk.white(message.content) + '\n\n');
            } else if (message.type === 'ai') {
                const prefix = chalk.bgGreen.white.bold(` [${index + 1}] ${historyMessages.main.messages.aiLabel} `) + chalk.green(` ${timeStr} `);
                process.stdout.write(prefix + '\n');

                const streamRenderer = new StreamRenderer();
                const renderedOutput = streamRenderer.processChunk(message.content);
                const finalOutput = streamRenderer.finalize();
                process.stdout.write(renderedOutput + finalOutput + '\n\n');
            }
        });

        const totalMsg = historyMessages.main.messages.totalMessages.replace('{count}', messages.length.toString());
        process.stdout.write(chalk.gray(`\n${totalMsg}\n\n`));
    }
} 