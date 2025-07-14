import chalk from 'chalk';
import { highlight } from 'cli-highlight';
import { createPatch } from 'diff';
import * as fs from 'fs';
import * as path from 'path';
import { TodosService } from '../../mcp/services';
import { languageService } from '../../services/language';
import { ChatMessage, openAIService } from '../../services/openai';
import { StorageService } from '../../services/storage';
import { SystemDetector } from '../../services/system-detector';
import { Messages } from '../../types/language';
import { AnimationUtils, LoadingController } from '../../utils';
import type { Message } from '../../utils/token-calculator';
import { StreamRenderer } from './stream-renderer';

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
            displayContent: content,
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
            const userColor = chalk.hex('#4F46E5');
            const userPrefix = chalk.bgHex('#4F46E5').white.bold(` ${messages.main.messages.userLabel} `) + userColor(` ${timeStr} `);
            process.stdout.write(userPrefix + '\n' + chalk.cyan('❯ ') + chalk.white(message.displayContent || message.content) + '\n\n');
        } else if (message.type === 'ai' || message.type === 'tool') {
            // 美化AI或工具消息标签
            const isTool = message.type === 'tool';
            const label = isTool ? messages.main.messages.toolLabel : messages.main.messages.aiLabel;
            const aiColor = chalk.hex('#059669');
            const bgColor = isTool ? chalk.bgYellow.black : chalk.bgHex('#059669').white;

            const prefix = bgColor.bold(` ${label} `) + aiColor(` ${timeStr} `);
            process.stdout.write(prefix + '\n');

            // 重置渲染器并处理完整内容
            this.streamRenderer.reset();
            const contentToRender = message.displayContent || message.content;
            const formattedContent = this.streamRenderer.processChunk(contentToRender);
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
        const aiColor = chalk.hex('#059669');
        const aiPrefix = chalk.bgHex('#059669').white.bold(` ${messages.main.messages.aiLabel} `) + aiColor(` ${timeStr} `);

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
            displayContent: content,
            timestamp: new Date()
        };

        this.callbacks.addMessage(aiMessage);
        this.displayAIResponse(content);
    }

    /**
     * 构建系统消息
     */
    private buildSystemMessage(langMessages: Messages, selectedTextFiles: string[]): string {
        const apiConfig = StorageService.getApiConfig();

        // 构建系统消息
        const cwd = process.cwd();
        const currentTime = new Date().toLocaleTimeString(langMessages.main.messages.format.timeLocale, {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
        });

        const promptParts = [
            langMessages.main.messages.system.basePrompt
                .replace('{role}', apiConfig.role || '')
                .replace('{cwd}', cwd)
                .replace('{time}', currentTime)
        ];

        if (apiConfig.role) {
            promptParts.push(apiConfig.role);
        }

        // Add Todos prompt
        const todos = TodosService.getTodos();
        const pendingTodos = todos.filter(t => t.status !== 'completed' && t.status !== 'cancelled');

        if (pendingTodos.length > 0) {
            const todoListString = pendingTodos.map(t => {
                const statusIcon = t.status === 'in_progress' ? '▶️' : '⚪️';
                return `${statusIcon} ${t.content} (id: ${t.id})`;
            }).join('\n');

            const todoPrompt = `You are in the middle of a multi-step task. You MUST follow the plan in the todo list.
1. Identify the next 'pending' task.
2. Execute the task using the appropriate tool(s).
3. IMMEDIATELY after successful execution, call the 'update_todos' tool to mark the task as 'completed'.
This entire sequence (execute and update) should happen in a single response. Do not ask for permission, just proceed.

Current Todos:
${todoListString}`;
            promptParts.push(todoPrompt);
        } else {
            const programmingTaskPrompt = `**important : If the user's request involves a programming task, you MUST first use the 'create_todos' tool to generate a comprehensive, step-by-step plan.**`;
            promptParts.push(programmingTaskPrompt);
        }

        // Add a general rule for tool verification
        const toolVerificationPrompt = `**General Tool Interaction Rule:**
Some tools, especially for file editing, will return a "CRITICAL ACTION" or "ACTION REQUIRED" message asking you to verify the result.
When you see such a message, you MUST:
1.  Pause your current task plan (including any todos).
2.  Carefully review the output provided by the tool.
3.  Respond with "√checked" if the action was successful and correct.
4.  If it's incorrect, call the tool again with the necessary corrections.
**Verification is your highest priority.** Do not proceed until you have confirmed the tool's action.`;
        promptParts.push(toolVerificationPrompt);

        if (selectedTextFiles.length > 0) {
            const fileList = selectedTextFiles.map(file => `- ${file}`).join('\n');
            promptParts.push(
                langMessages.main.messages.system.fileReferencePrompt
                    .replace('{fileList}', fileList)
            );
        }
        return promptParts.join('\n\n');
    }

    /**
     * 处理AI请求的主要逻辑
     */
    async processAIRequest(isContinuation: boolean = false): Promise<void> {
        if (!isContinuation) {
            // Clear todos at the beginning of a new user-initiated task.
            TodosService.clearTodos();
        }

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
                    text: '' // messages.main.status.thinking
                });
                this.callbacks.onLoadingStart(loadingController);
                isLoading = true;
            }
        };

        let isFirstChunk = true;
        const resetForNewResponse = () => {
            isFirstChunk = true;
            // Also reset the stream renderer to ensure a clean slate for the new response
            this.streamRenderer.reset();
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
                onReasoningChunk: (chunk: string) => {
                    // No longer displaying reasoning to keep the output clean.
                },
                onToolChunk: (toolChunk) => {
                    // 保持加载动画
                },
                onAssistantMessage: ({ content, toolCalls }) => {
                    stopLoading(); // 在显示内容前停止动画

                    const finalContent = this.streamRenderer.finalize();
                    if (finalContent) {
                        process.stdout.write(finalContent);
                    }
                    // process.stdout.write('\n\n'); // 移除，避免在工具调用中间中断消息流

                    const aiMessage: Message = {
                        type: 'ai',
                        content: content, // 原始content可能为空
                        tool_calls: toolCalls,
                        displayContent: content,
                        timestamp: new Date()
                    };
                    this.callbacks.addMessage(aiMessage);
                    assistantMessageDisplayed = true;
                },
                onToolCall: async (toolCall: any) => {
                    // onAssistantMessage 已经停止了动画，这里执行工具调用
                    const result = await this.handleToolCall(toolCall);
                    // 在工具调用完成后，立即为下一轮AI响应重置状态
                    resetForNewResponse();
                    startLoading(); // 为下一轮AI思考重新启动加载动画
                    return result;
                },
                onChunk: (chunk: string) => {
                    stopLoading();
                    if (isFirstChunk) {
                        // 显示AI回复标签
                        const timeStr = new Date().toLocaleTimeString(messages.main.messages.format.timeLocale, {
                            hour: '2-digit',
                            minute: '2-digit'
                        });
                        const aiColor = chalk.hex('#059669');
                        const aiPrefix = chalk.bgHex('#059669').white.bold(` ${messages.main.messages.aiLabel} `) + aiColor(` ${timeStr} `);
                        process.stdout.write(aiPrefix + '\n');
                        isFirstChunk = false;
                    }

                    const formattedChunk = this.streamRenderer.processChunk(chunk);
                    if (formattedChunk) {
                        process.stdout.write(formattedChunk);
                    }
                    aiResponseContent += chunk;
                    startLoading();
                },
                onComplete: (fullResponse: string) => {
                    stopLoading(); // 确保流程结束时动画已停止

                    const finalContent = this.streamRenderer.finalize();
                    if (finalContent) {
                        process.stdout.write(finalContent);
                    }

                    // If there was any streamed output or a final response, add newlines for spacing.
                    if (finalContent || fullResponse) {
                        process.stdout.write('\n\n');
                    }

                    // BUGFIX: The original code failed to save the final AI message if a tool call had occurred.
                    // This is now corrected by removing the `!assistantMessageDisplayed` check and saving
                    // the final response whenever it's not empty.
                    if (fullResponse) {
                        const aiMessage: Message = {
                            type: 'ai',
                            content: fullResponse,
                            displayContent: fullResponse,
                            timestamp: new Date()
                        };
                        this.callbacks.addMessage(aiMessage);
                    }

                    // Check if we need to continue the task
                    // The AI's response turn is complete. Finalize the state.
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
    private async handleToolCall(toolCall: any): Promise<any> {
        try {
            const messages = languageService.getMessages();
            const functionName = toolCall.function.name;
            const parameters = JSON.parse(toolCall.function.arguments || '{}');

            console.log(chalk.yellow.bold(` 🛠️ ${messages.main.messages.toolCall.calling.replace('{name}', functionName)}`));

            // 截断并打印参数，防止过长的参数刷屏
            // const paramsString = JSON.stringify(parameters, null, 2);
            // if (paramsString !== '{}') { // 只在有参数时打印
            //     const truncatedParams = paramsString.length > 100 ? `${paramsString.substring(0, 100)}...` : paramsString;
            //     console.log(chalk.gray(`parameters: ${truncatedParams}`));
            // }

            // 检查是否需要用户确认
            const needsConfirmation = StorageService.isFunctionConfirmationRequired(functionName);

            if (needsConfirmation) {
                let diff: string | undefined;
                // For file operations, generate a diff before asking for confirmation
                if (functionName === 'file-system_create_file' || functionName === 'file-system_edit_file') {
                    const targetPath = path.resolve(parameters.path);
                    let originalContent = '';
                    if (fs.existsSync(targetPath)) {
                        originalContent = fs.readFileSync(targetPath, 'utf8');
                    }
                    const newContent = parameters.content || parameters.newContent || '';
                    diff = createPatch(targetPath, originalContent, newContent);
                }

                const shouldExecute = await this.askUserConfirmation(functionName, parameters, diff);

                if (!shouldExecute) {
                    // 用户拒绝执行
                    const rejectionMessage = `User rejected the tool call: ${functionName}`;
                    console.log(chalk.yellow(messages.main.messages.toolCall.rejected));

                    // 返回拒绝信息给AI
                    return {
                        tool_call_id: toolCall.id,
                        error: rejectionMessage,
                    };
                }
                console.log(chalk.green(messages.main.messages.toolCall.approved));
            }

            const systemDetector = this.callbacks.getSystemDetector();
            const result = await systemDetector.executeMcpTool(functionName, parameters);

            // The system message is now built once at the start of processAIRequest
            // and is part of the `chatMessages` array passed to the streamChat call.
            // No need to update it here as the whole message history will be rebuilt on the next turn.

            // console.log(result);

            // 将工具调用结果添加到历史记录
            let resultContent = '';
            if (result && typeof result === 'object') {
                if (result.diff) {
                    const displayDiff = highlight(result.diff, { language: 'diff' });
                    resultContent = `✅ **Tool Result: ${functionName}**\n\n${result.message || ''}\n\n${displayDiff}`;
                } else if (result.content) {
                    resultContent = `✅ **Tool Result: ${functionName}**\n\n`;
                    if (result.structure) {
                        resultContent += result.structure;
                    } else {
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
                    resultContent = `✅ **Tool Result: ${functionName}**\n\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``;
                }
            } else {
                resultContent = `✅ **Tool Result: ${functionName}**\n\n${String(result)}`;
            }

            const toolResultMessage: Message = {
                type: 'tool',
                tool_call_id: toolCall.id,
                name: functionName, // <-- Add function name here
                content: result, // 存储原始结果
                displayContent: resultContent, // 存储格式化后的显示内容
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
                type: 'tool',
                tool_call_id: toolCall.id,
                name: toolCall.function?.name || 'Unknown', // <-- Add function name here
                content: {
                    error: errorMsg,
                    tool_call_id: toolCall.id,
                },
                displayContent: `❌ **Tool Error: ${toolCall.function?.name || 'Unknown'}**\n\n**Error:** ${errorMsg}\n\n**Parameters:**\n\`\`\`json\n${JSON.stringify(JSON.parse(toolCall.function?.arguments || '{}'), null, 2)}\n\`\`\``,
                timestamp: new Date()
            };
            this.callbacks.addMessage(errorMessage);

            throw error;
        }
    }



    /**
     * 询问用户是否确认执行函数
     */
    private async askUserConfirmation(functionName: string, parameters: any, diff?: string): Promise<boolean> {
        const messages = languageService.getMessages();

        console.log();
        console.log(chalk.yellow(messages.main.messages.toolCall.handle));
        console.log(chalk.white(`Tool: ${chalk.bold(functionName)}`));
        console.log(chalk.white(`Parameters: ${chalk.gray(JSON.stringify(parameters, null, 2))}`));

        if (diff) {
            console.log(chalk.yellow.bold('--- Proposed Changes ---'));
            console.log(highlight(diff, { language: 'diff' }));
            console.log(chalk.yellow.bold('----------------------'));
        }

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
        const chatMessages: ChatMessage[] = [];
        const langMessages = languageService.getMessages();
        const selectedTextFiles = this.callbacks.getSelectedTextFiles();

        // 构建系统消息
        const systemMessage = this.buildSystemMessage(langMessages, selectedTextFiles);

        if (systemMessage) {
            chatMessages.push({ role: 'system', content: systemMessage });
        }

        // 转换消息历史，并确保 'tool' 消息的合法性
        let expectedToolMessages = 0;
        for (const msg of (recentMessages as any[])) {
            if (msg.type === 'user') {
                const userMessage: ChatMessage = { role: 'user', content: msg.content };
                chatMessages.push(userMessage);
                expectedToolMessages = 0;
            } else if (msg.type === 'ai') {
                const assistantMessage: ChatMessage = {
                    role: 'assistant',
                    content: msg.content || null, // Ensure content is not undefined
                    tool_calls: msg.tool_calls,
                };
                chatMessages.push(assistantMessage);
                if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
                    expectedToolMessages = assistantMessage.tool_calls.length;
                } else {
                    expectedToolMessages = 0;
                }
            } else if (msg.type === 'tool') {
                // 关键检查：只在期望有工具消息时才添加，防止孤立的工具消息导致API错误
                if (expectedToolMessages > 0) {
                    const toolMessage: ChatMessage = {
                        role: 'tool',
                        tool_call_id: msg.tool_call_id,
                        name: (msg as any).name,
                        content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
                    };
                    chatMessages.push(toolMessage);
                    expectedToolMessages--;
                }
            }
        }

        const selectedImageFiles = this.callbacks.getSelectedImageFiles();

        // 处理文件内容
        let fileContents = '';
        if (selectedTextFiles.length > 0) {
            fileContents = selectedTextFiles
                .map((filePath: string) => {
                    try {
                        const absolutePath = path.resolve(process.cwd(), filePath);
                        //const content = fs.readFileSync(absolutePath, 'utf-8');
                        return `--- ${filePath} ---`;
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
                .filter((content: string) => content)
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
}