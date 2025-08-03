import chalk from 'chalk';
import { highlight } from 'cli-highlight';
import { createPatch } from 'diff';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { TodosService } from '../../mcp/services';
import { CheckpointService, languageService } from '../../services';
import { ChatMessage, openAIService } from '../../services/openai';
import { StorageService } from '../../services/storage';
import { SystemDetector } from '../../services/system-detector';
import { Messages } from '../../types/language';
import { AnimationUtils, LoadingController } from '../../utils';
import type { Message } from '../../utils/token-calculator';
import { TokenCalculator } from '../../utils/token-calculator';
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
    private reasoningStreamRenderer: StreamRenderer;

    constructor(messages: Messages, callbacks: MessageHandlerCallbacks) {
        this.currentMessages = messages;
        this.callbacks = callbacks;
        this.streamRenderer = new StreamRenderer();
        this.reasoningStreamRenderer = new StreamRenderer();

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
    private buildSystemMessage(langMessages: Messages, selectedTextFiles: string[], allMessages: Message[]): string {
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

        // The logic for adding todos has been moved to buildTodoPromptPart.
        // This function now only builds the static part of the prompt.

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
     * 构建系统消息中与TODO相关的部分
     */
    private buildTodoPromptPart(allMessages: Message[]): string {
        const todos = TodosService.getTodos();
        const pendingTodos = todos.filter(t => t.status !== 'completed' && t.status !== 'cancelled');

        if (pendingTodos.length > 0) {
            const todoListString = pendingTodos.map(t => {
                const statusIcon = t.status === 'in_progress' ? '▶️' : '⚪️';
                return `${statusIcon} ${t.content} (id: ${t.id})`;
            }).join('\n');

            const lastUserMessage = allMessages.filter(m => m.type === 'user').pop();
            const userTask = lastUserMessage ? this.cleanFileReferencesInMessage(lastUserMessage.content as string) : "the user's request";

            return `**CRITICAL: Your primary objective is to complete the user's request: "${userTask}"**

You have a plan to achieve this. You MUST follow the steps below.
1.  Identify the next 'pending' task.
2.  Execute it using the necessary tool(s).
3.  IMMEDIATELY after successful execution, use the 'update_todos' tool to mark the task 'completed'.
This sequence is a single, atomic operation. Proceed without asking for confirmation.

Current Plan *Todo must be completed. Remember to call the tool 'update_todos' after completion.*:
${todoListString}

If it has been completed, remember to call the 'update_todos' tool to update the completed item.`;
        } else {
            return `**important : If the user's request involves a programming task, you MUST first use the 'create_todos' tool to generate a comprehensive, step-by-step plan.**`;
        }
    }

    /**
     * 处理AI请求的主要逻辑
     */
    async processAIRequest(isContinuation: boolean = false): Promise<void> {
        // A new user-initiated task is identified if the most recent message is from the user.
        // This is a more reliable way to determine when to clear the TODO list for a new task.
        const allCurrentMessages = this.callbacks.getRecentMessages();
        const lastMessage = allCurrentMessages.length > 0 ? allCurrentMessages[allCurrentMessages.length - 1] : null;
        if (lastMessage && lastMessage.type === 'user' && !isContinuation) {
            TodosService.clearTodos();

            // 为这项新任务设置一个检查点任务
            const taskId = uuidv4();
            const taskDescription = typeof lastMessage.content === 'string'
                ? (lastMessage.content as string).substring(0, 100)
                : 'Task from non-string message';
            CheckpointService.getInstance().setCurrentTask(taskId, taskDescription);
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

        try {
            const tools = await this.getMcpTools();
            let continueConversation = true;

            while (continueConversation) {
                const chatMessages = await this.buildChatMessages();

                let isFirstChunk = true;
                let isFirstReasoningChunk = true;
                const resetForNewResponse = () => {
                    isFirstChunk = true;
                    isFirstReasoningChunk = true;
                    this.streamRenderer.reset();
                    this.reasoningStreamRenderer.reset();
                };

                resetForNewResponse();
                startLoading();

                let aiResponseContent = '';

                const result = await openAIService.streamChat({
                    messages: chatMessages,
                    tools: tools.length > 0 ? tools : undefined,
                    onReasoningChunk: (chunk: string) => {
                        stopLoading();
                        if (isFirstReasoningChunk) {
                            const timeStr = new Date().toLocaleTimeString(messages.main.messages.format.timeLocale, {
                                hour: '2-digit',
                                minute: '2-digit'
                            });
                            const thinkingColor = chalk.hex('#6B7280');
                            const thinkingPrefix = chalk.bgHex('#6B7280').white.bold(` Thinking `) + thinkingColor(` ${timeStr} `);
                            process.stdout.write(thinkingPrefix + '\n');
                            isFirstReasoningChunk = false;
                        }
                        const formattedChunk = this.reasoningStreamRenderer.processChunk(chunk);
                        if (formattedChunk) {
                            process.stdout.write(chalk.gray(formattedChunk));
                        }
                        startLoading();
                    },
                    onToolChunk: (toolChunk) => { },
                    onAssistantMessage: ({ content, toolCalls }) => {
                        stopLoading();

                        const finalContent = this.streamRenderer.finalize();
                        if (finalContent) {
                            process.stdout.write(finalContent);
                        }
                        const finalReasoningContent = this.reasoningStreamRenderer.finalize();
                        if (finalReasoningContent) {
                            process.stdout.write(chalk.gray(finalReasoningContent));
                        }
                        this.reasoningStreamRenderer.reset();

                        const aiMessage: Message = {
                            type: 'ai',
                            content: content,
                            tool_calls: toolCalls,
                            displayContent: content,
                            timestamp: new Date()
                        };
                        this.callbacks.addMessage(aiMessage);
                    },
                    onChunk: (chunk: string) => {
                        stopLoading();
                        if (isFirstChunk) {
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
                        stopLoading();

                        const finalContent = this.streamRenderer.finalize();
                        if (finalContent) {
                            process.stdout.write(finalContent);
                        }
                        const finalReasoningContent = this.reasoningStreamRenderer.finalize();
                        if (finalReasoningContent) {
                            process.stdout.write(chalk.gray(finalReasoningContent));
                        }
                        this.reasoningStreamRenderer.reset();

                        if (finalContent || fullResponse) {
                            process.stdout.write('\n\n');
                        } else if (!isFirstReasoningChunk) {
                            process.stdout.write('\n\n');
                        }

                        if (fullResponse) {
                            const aiMessage: Message = {
                                type: 'ai',
                                content: fullResponse,
                                displayContent: fullResponse,
                                timestamp: new Date()
                            };
                            this.callbacks.addMessage(aiMessage);
                        }
                    },
                    onError: (error: Error) => {
                        stopLoading();
                        const finalReasoningContent = this.reasoningStreamRenderer.finalize();
                        if (finalReasoningContent) {
                            process.stdout.write(chalk.gray(finalReasoningContent) + '\n\n');
                        }
                        const errorMsg = `${messages.main.status.connectionError}: ${error.message}`;
                        process.stdout.write(chalk.red(errorMsg) + '\n\n');
                        //console.log(chalk.gray(JSON.stringify(chatMessages, null, 2)));
                        continueConversation = false; // Stop loop on error
                    }
                });

                if (result.status === 'tool_calls') {
                    stopLoading();
                    const toolCalls = result.assistantResponse.tool_calls || [];
                    for (const toolCall of toolCalls) {
                        await this.handleToolCall(toolCall);
                    }
                    // Continue loop to let AI respond to tool results
                } else {
                    continueConversation = false; // 'done' or error
                }
            }
        } catch (error) {
            stopLoading();
            const errorMsg = error instanceof Error ? error.message : messages.main.status.unknownError;
            process.stdout.write(chalk.red(`${messages.main.status.connectionError}: ${errorMsg}`) + '\n\n');
        } finally {
            // 清除当前任务ID，为下一次请求做准备
            CheckpointService.getInstance().clearCurrentTask();
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
            return tools;
        } catch (error) {
            console.warn('Failed to get MCP tools:', error);
            return [];
        }
    }

    /**
     * 处理工具调用
     */
    private async handleToolCall(toolCall: any): Promise<void> {
        try {
            const messages = languageService.getMessages();
            const functionName = toolCall.function.name;
            const parameters = JSON.parse(toolCall.function.arguments || '{}');

            console.log(chalk.yellow.bold(`${messages.main.messages.toolCall.calling.replace('{name}', functionName)}`));

            const needsConfirmation = StorageService.isFunctionConfirmationRequired(functionName);

            if (needsConfirmation) {
                let diff: string | undefined;
                if (functionName === 'file-system_create_file') {
                    const targetPath = path.resolve(parameters.path);
                    const newContent = parameters.content || '';
                    diff = createPatch(targetPath, '', newContent, '', '', { context: 3 });
                } else if (functionName === 'file-system_edit_file') {
                    const targetPath = path.resolve(parameters.path);
                    let originalContent = '';
                    if (fs.existsSync(targetPath)) {
                        originalContent = fs.readFileSync(targetPath, 'utf8');
                    }

                    const { startLine, endLine, newContent } = parameters;
                    const originalSlice = originalContent.split('\n').slice(startLine - 1, endLine).join('\n');
                    const partialPatch = createPatch(targetPath, originalSlice, newContent, '', '', { context: 3 });

                    const newContentLineCount = newContent === '' ? 0 : newContent.split('\n').length;
                    const oldContentLineCount = endLine - startLine + 1;
                    const correctHeader = `@@ -${startLine},${oldContentLineCount} +${startLine},${newContentLineCount} @@`;

                    const patchLines = partialPatch.split('\n');
                    const hunkHeaderIndex = patchLines.findIndex(line => line.startsWith('@@'));
                    if (hunkHeaderIndex !== -1) {
                        patchLines[hunkHeaderIndex] = correctHeader;
                        diff = patchLines.join('\n');
                    } else {
                        diff = partialPatch;
                    }
                }

                const shouldExecute = await this.askUserConfirmation(functionName, parameters, diff);

                if (!shouldExecute) {
                    const rejectionMessage = `User rejected the tool call: ${functionName}`;
                    console.log(chalk.yellow(messages.main.messages.toolCall.rejected));

                    const toolResultMessage: Message = {
                        type: 'tool',
                        tool_call_id: toolCall.id,
                        name: functionName,
                        content: { error: rejectionMessage },
                        displayContent: `⚠️ **Tool Result: ${functionName}**\n\n${rejectionMessage}`,
                        timestamp: new Date()
                    };
                    this.callbacks.addMessage(toolResultMessage);
                    return;
                }
                console.log(chalk.green(messages.main.messages.toolCall.approved));
            }

            const systemDetector = this.callbacks.getSystemDetector();
            const result = await systemDetector.executeMcpTool(functionName, parameters);

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
                name: functionName,
                content: result ?? 'SUCCESS',
                displayContent: resultContent,
                timestamp: new Date()
            };
            this.callbacks.addMessage(toolResultMessage);
        } catch (error) {
            const messages = languageService.getMessages();
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            console.log(chalk.red(messages.main.messages.toolCall.failed.replace('{error}', errorMsg)));

            const errorMessage: Message = {
                type: 'tool',
                tool_call_id: toolCall.id,
                name: toolCall.function?.name || 'Unknown',
                content: {
                    error: errorMsg,
                    tool_call_id: toolCall.id,
                },
                displayContent: `❌ **Tool Error: ${toolCall.function?.name || 'Unknown'}**\n\n**Error:** ${errorMsg}\n\n**Parameters:**\n\`\`\`json\n${JSON.stringify(JSON.parse(toolCall.function?.arguments || '{}'), null, 2)}\n\`\`\``,
                timestamp: new Date()
            };
            this.callbacks.addMessage(errorMessage);
        }
    }



    /**
     * 询问用户是否确认执行函数
     */
    private async askUserConfirmation(functionName: string, parameters: any, diff?: string): Promise<boolean> {
        const messages = languageService.getMessages();

        console.log();
        console.log(chalk.yellow(messages.main.messages.toolCall.handle));
        // console.log(chalk.white(`Tool: ${chalk.bold(functionName)}`));
        // console.log(chalk.white(`Parameters: ${chalk.gray(JSON.stringify(parameters, null, 2))}`));

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
    private async buildChatMessages(): Promise<ChatMessage[]> {
        const langMessages = languageService.getMessages();
        const selectedTextFiles = this.callbacks.getSelectedTextFiles();

        // 1. Get the complete message history ONCE.
        const allMessages = this.callbacks.getRecentMessages();

        // 2. Build the static part of the system message.
        const baseSystemMessage = this.buildSystemMessage(langMessages, selectedTextFiles, allMessages);

        // 3. Append the dynamic TODO part to the system message
        const todoPromptPart = this.buildTodoPromptPart(allMessages);

        // 4. Use TokenCalculator to intelligently select and compress the history.
        // This is now an async call.
        const tokenResult = await TokenCalculator.selectHistoryMessages(
            allMessages,
            `${baseSystemMessage}\n\n${todoPromptPart}`,
            0.7 // Use 70% of context to leave room for tool calls
        );

        const summaryPromptPart = tokenResult.summary ? `\n\n[Prior conversation summary: ${tokenResult.summary}]` : '';
        const systemMessageContent = `${baseSystemMessage}\n\n${todoPromptPart}${summaryPromptPart}`;


        // `tokenResult.allowedMessages` is now an array that both fits the token limit and is guaranteed to start with a user message.
        const recentMessages = tokenResult.allowedMessages;

        // 5. Build the final chatMessages array.
        const chatMessages: ChatMessage[] = [];
        if (systemMessageContent) {
            chatMessages.push({ role: 'system', content: systemMessageContent });
        }

        // 6. Convert the selected message history for the API, ensuring tool messages are valid.
        let expectedToolMessages = 0;
        for (const msg of (recentMessages as any[])) {
            if (msg.type === 'user') {
                const userMessage: ChatMessage = { role: 'user', content: msg.content };
                chatMessages.push(userMessage);
                expectedToolMessages = 0;
            } else if (msg.type === 'ai') {
                const assistantMessage: ChatMessage = {
                    role: 'assistant',
                    content: msg.content || null,
                    tool_calls: msg.tool_calls,
                };
                chatMessages.push(assistantMessage);
                if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
                    expectedToolMessages = assistantMessage.tool_calls.length;
                } else {
                    expectedToolMessages = 0;
                }
            } else if (msg.type === 'tool') {
                if (expectedToolMessages > 0) {
                    const toolMessage: ChatMessage = {
                        role: 'tool',
                        tool_call_id: msg.tool_call_id,
                        content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content ?? null),
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