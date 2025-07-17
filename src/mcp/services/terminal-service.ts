import { exec, spawn } from 'child_process';
import { confirm, select } from '@inquirer/prompts';
import * as path from 'path';
import { BaseMCPService } from '../base-service';
import { languageService } from '../../services/language';
import { StorageService } from '../../services/storage';
import { MCPRequest, MCPResponse, MCPTool } from '../types';
import { constants } from 'buffer';

interface ExecuteCommandParams {
    command: string;
    cwd?: string;
    interactive?: boolean; // 是否为交互式命令
    background?: boolean; // 是否在后台运行
    timeout?: number; // 命令超时时间（秒），超过此时间会询问用户是否转为后台运行
}

const messages = languageService.getMessages();
const config = StorageService.getApiConfig();

// 存储后台运行的进程
const backgroundProcesses = new Map<string, any>();

export class TerminalService extends BaseMCPService {
    constructor() {
        super('terminal', '1.0.0');
    }

    getTools(): MCPTool[] {
        return [
            {
                name: 'execute_command',
                description: 'Execute a shell command and get the output. Supports automatic detection of long-running commands and background execution.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        command: {
                            type: 'string',
                            description: 'The command to execute. Example: "ls -la"'
                        },
                        cwd: {
                            type: 'string',
                            description: 'The working directory to execute the command in. Defaults to the project root. Example: "src/services"',
                            default: '.'
                        },
                        interactive: {
                            type: 'boolean',
                            description: 'Whether this command requires user interaction. For interactive commands like npm create, npm init, etc. Defaults to false.',
                            default: false
                        },
                        background: {
                            type: 'boolean',
                            description: 'Whether to run this command in the background. Useful for long-running commands like dev servers. Defaults to false.',
                            default: false
                        },
                        timeout: {
                            type: 'number',
                            description: 'Timeout in seconds. If command runs longer than this, user will be asked to move it to background. Defaults to 60 seconds.',
                            default: 60
                        }
                    },
                    required: ['command']
                }
            },
            {
                name: 'list_background_processes',
                description: 'List all running background processes',
                inputSchema: {
                    type: 'object',
                    properties: {},
                    required: []
                }
            },
            {
                name: 'kill_background_process',
                description: 'Kill a background process by its ID',
                inputSchema: {
                    type: 'object',
                    properties: {
                        processId: {
                            type: 'string',
                            description: 'The ID of the process to kill'
                        }
                    },
                    required: ['processId']
                }
            }
        ];
    }

    async handleRequest(request: MCPRequest): Promise<MCPResponse> {
        try {
            switch (request.method) {
                case 'execute_command':
                    return await this.handleExecuteCommand(request);
                case 'list_background_processes':
                    return await this.handleListBackgroundProcesses(request);
                case 'kill_background_process':
                    return await this.handleKillBackgroundProcess(request);
                default:
                    return this.createErrorResponse(
                        request.id,
                        -32601,
                        `Unsupported method: ${request.method}`
                    );
            }
        } catch (error) {
            return this.createErrorResponse(
                request.id,
                -32603,
                'Internal server error',
                error instanceof Error ? error.message : String(error)
            );
        }
    }

    private async handleListBackgroundProcesses(request: MCPRequest): Promise<MCPResponse> {
        const processes = Array.from(backgroundProcesses.entries()).map(([id, proc]) => ({
            id,
            command: proc.command,
            cwd: proc.cwd,
            startTime: proc.startTime,
            pid: proc.child.pid
        }));

        const terminalMessages = messages.terminal;
        const processInfo = processes.map(p => 
            `**${terminalMessages.execution.processId}:** ${p.id}\n**${terminalMessages.processManagement.command}:** \`${p.command}\`\n**${terminalMessages.processManagement.directory}:** ${p.cwd}\n**${terminalMessages.execution.pid}:** ${p.pid}\n**${terminalMessages.execution.startTime}:** ${p.startTime}`
        ).join('\n\n');

        const message = processes.length > 0 
            ? `🔄 **${terminalMessages.processManagement.listTitle}:**\n\n${processInfo}`
            : `📭 **${terminalMessages.processManagement.noProcesses}**`;

        return this.createSuccessResponse(request.id, message);
    }

    private async handleKillBackgroundProcess(request: MCPRequest): Promise<MCPResponse> {
        const { processId } = request.params;
        const terminalMessages = messages.terminal;
        
        if (!backgroundProcesses.has(processId)) {
            return this.createErrorResponse(request.id, -32602, terminalMessages.processManagement.processNotExists.replace('{processId}', processId));
        }

        const proc = backgroundProcesses.get(processId);
        try {
            proc.child.kill('SIGTERM');
            backgroundProcesses.delete(processId);
            
            return this.createSuccessResponse(
                request.id, 
                `✅ **${terminalMessages.processManagement.processTerminated}**\n\n**${terminalMessages.execution.processId}:** ${processId}\n**${terminalMessages.processManagement.command}:** \`${proc.command}\`\n**${terminalMessages.execution.pid}:** ${proc.child.pid}`
            );
        } catch (error) {
            return this.createErrorResponse(
                request.id, 
                -32603, 
                `${terminalMessages.processManagement.terminationFailed}: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    private async handleExecuteCommand(request: MCPRequest): Promise<MCPResponse> {
        const validationError = this.validateParams(request.params, ['command']);
        if (validationError) {
            return this.createErrorResponse(request.id, -32602, validationError);
        }

        const params: ExecuteCommandParams = request.params;
        const cwd = path.resolve(params.cwd || '.');
        
        // 检查函数是否需要手动确认
        const functionName = 'terminal_execute_command';
        const needsConfirmation = StorageService.isFunctionConfirmationRequired(functionName);
        const execCommand = true;
        if (!needsConfirmation) {
            // 检查敏感词,如果携带*通配符就模糊匹配
            const sensitiveWords = config.terminalSensitiveWords || [];
            const command = params.command.toLowerCase();
        
            // 找到匹配的敏感词
            const matchedSensitiveWord = sensitiveWords.find(word => {
                const lowerWord = word.toLowerCase();
        
                // 如果敏感词包含*通配符，进行模糊匹配
                if (lowerWord.includes('*')) {
                    // 直接在这里处理通配符匹配
                    const regexPattern = lowerWord
                        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // 转义特殊字符
                        .replace(/\\\*/g, '.*'); // 将 \* 替换为 .*
        
                    const regex = new RegExp(regexPattern);
                    return regex.test(command);
                } else {
                    // 普通匹配
                    return command.includes(lowerWord);
                }
            });
        
            if (matchedSensitiveWord) {
                // 提示用户是否继续执行，显示匹配到的敏感词
                const confirmation = await confirm({
                    message: `${messages.config.messages.terminalSensitiveWordsEditorPrompt}(${matchedSensitiveWord}): ${params.command}`,
                    default: false
                });
                if (!confirmation) {
                    return this.createSuccessResponse(request.id, messages.terminal.responses.commandRefused);
                }
            }
        }
        
        if (execCommand) {
            // 如果明确指定后台运行
            if (params.background) {
                return this.executeBackgroundCommand(params, cwd, request.id);
            }
            
            // 检查是否为明确的交互式命令（只检查几个最常见的）
            const isInteractive = params.interactive || this.isKnownInteractiveCommand(params.command);
            
            if (isInteractive) {
                return this.executeInteractiveCommand(params, cwd, request.id);
            } else {
                // 使用智能检测方式执行命令
                return this.executeCommandWithSmartDetection(params, cwd, request.id);
            }
        }
        return this.createErrorResponse(request.id, -32602, 'Command contains sensitive words');
    }

    /**
     * 检查是否为已知的交互式命令（只检查最常见的几个）
     */
    private isKnownInteractiveCommand(command: string): boolean {
        const interactiveKeywords = [
            'npm init',
            'yarn init',
            'git commit -',
            'git rebase -i'
        ];

        const lowerCommand = command.toLowerCase();
        return interactiveKeywords.some(keyword => lowerCommand.includes(keyword));
    }

    /**
     * 智能检测执行命令（基于超时检测）
     */
    private executeCommandWithSmartDetection(params: ExecuteCommandParams, cwd: string, requestId: any): Promise<MCPResponse> {
        return new Promise((resolve) => {
            const timeout = (params.timeout || 60) * 1000; // 转换为毫秒
            const terminalMessages = messages.terminal;
            
            console.log(`🔄 ${terminalMessages.execution.executing}: ${params.command}`);
            console.log(`📁 ${terminalMessages.execution.workingDirectory}: ${cwd}`);
            console.log(`⏱️  ${terminalMessages.execution.timeoutDetection}: ${timeout/1000}${terminalMessages.smartDetection.timeoutPrompt}`);
            console.log(terminalMessages.execution.separator);

            // 创建子进程
            const child = spawn(params.command, {
                cwd,
                shell: true
            });

            let stdout = '';
            let stderr = '';
            let isCompleted = false;
            let timeoutHandle: NodeJS.Timeout;

            // 实时输出 stdout
            if (child.stdout) {
                child.stdout.on('data', (data) => {
                    const text = data.toString();
                    stdout += text;
                    process.stdout.write(text);
                });
            }

            // 实时输出 stderr
            if (child.stderr) {
                child.stderr.on('data', (data) => {
                    const text = data.toString();
                    stderr += text;
                    process.stderr.write(text);
                });
            }

            // 设置超时检测
            timeoutHandle = setTimeout(async () => {
                if (!isCompleted) {
                    console.log('\n' + terminalMessages.execution.separator);
                    console.log(`⏰ ${terminalMessages.smartDetection.longRunningDetected.replace('{timeout}', (timeout/1000).toString())}`);
                    
                    try {
                        const choice = await select({
                            message: terminalMessages.smartDetection.choicePrompt,
                            choices: [
                                {
                                    name: terminalMessages.smartDetection.options.background.name,
                                    value: 'background',
                                    description: terminalMessages.smartDetection.options.background.description
                                },
                                {
                                    name: terminalMessages.smartDetection.options.wait.name,
                                    value: 'wait',
                                    description: terminalMessages.smartDetection.options.wait.description
                                },
                                {
                                    name: terminalMessages.smartDetection.options.kill.name,
                                    value: 'kill',
                                    description: terminalMessages.smartDetection.options.kill.description
                                }
                            ]
                        });

                        switch (choice) {
                            case 'background':
                                // 转为后台运行
                                const processId = `bg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                                const processInfo = {
                                    child,
                                    command: params.command,
                                    cwd,
                                    startTime: new Date().toLocaleString(),
                                    processId
                                };
                                backgroundProcesses.set(processId, processInfo);
                                
                                console.log(`🚀 ${terminalMessages.smartDetection.backgroundMoved} (${terminalMessages.execution.processId}: ${processId})`);
                                const resultMessage = `🚀 **${terminalMessages.smartDetection.backgroundMoved}**\n\n**${terminalMessages.processManagement.command}:** \`${params.command}\`\n**${terminalMessages.execution.processId}:** ${processId}\n**${terminalMessages.execution.pid}:** ${child.pid}\n\n💡 ${terminalMessages.backgroundProcess.listCommand}\n💡 ${terminalMessages.backgroundProcess.killCommand}`;
                                resolve(this.createSuccessResponse(requestId, resultMessage));
                                isCompleted = true;
                                break;
                                
                            case 'wait':
                                console.log(`⏳ ${terminalMessages.smartDetection.continueWaiting}`);
                                // 不做任何操作，继续等待
                                break;
                                
                            case 'kill':
                                child.kill('SIGTERM');
                                console.log(`🛑 ${terminalMessages.smartDetection.userTerminated}`);
                                resolve(this.createSuccessResponse(requestId, `🛑 **${terminalMessages.smartDetection.userTerminated}**`));
                                isCompleted = true;
                                break;
                        }
                    } catch (error) {
                        // 如果用户选择出错，默认转为后台运行
                        const processId = `bg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                        const processInfo = {
                            child,
                            command: params.command,
                            cwd,
                            startTime: new Date().toLocaleString(),
                            processId
                        };
                        backgroundProcesses.set(processId, processInfo);
                        
                        console.log(`🚀 ${terminalMessages.smartDetection.autoBackground} (${terminalMessages.execution.processId}: ${processId})`);
                        const resultMessage = `🚀 **${terminalMessages.smartDetection.autoBackground}**\n\n**${terminalMessages.processManagement.command}:** \`${params.command}\`\n**${terminalMessages.execution.processId}:** ${processId}`;
                        resolve(this.createSuccessResponse(requestId, resultMessage));
                        isCompleted = true;
                    }
                }
            }, timeout);

            child.on('error', (error) => {
                if (!isCompleted) {
                    clearTimeout(timeoutHandle);
                    isCompleted = true;
                    console.log(terminalMessages.execution.separator);
                    console.error(`❌ ${terminalMessages.execution.failed}: ${error.message}`);
                    
                    const resultMessage = `❌ **${terminalMessages.responses.commandFailed}**\n\n**${terminalMessages.processManagement.command}:** \`${params.command}\`\n**${terminalMessages.execution.error}:** ${error.message}`;
                    resolve(this.createSuccessResponse(requestId, resultMessage));
                }
            });

            child.on('exit', (code, signal) => {
                if (!isCompleted) {
                    clearTimeout(timeoutHandle);
                    isCompleted = true;
                    console.log(terminalMessages.execution.separator);
                    
                    if (code === 0) {
                        console.log(`✅ ${terminalMessages.execution.success} (${terminalMessages.execution.exitCode}: ${code})`);
                        const resultMessage = `✅ **${terminalMessages.responses.commandSuccess}**\n\n**${terminalMessages.processManagement.command}:** \`${params.command}\`\n**${terminalMessages.execution.exitCode}:** ${code}\n\n**${terminalMessages.responses.outputSummary}:**\n\`\`\`\n${stdout.slice(-1000)}\n\`\`\`${stderr ? `\n**${terminalMessages.responses.errorOutput}:**\n\`\`\`\n${stderr.slice(-500)}\n\`\`\`` : ''}`;
                        resolve(this.createSuccessResponse(requestId, resultMessage));
                    } else {
                        const signalInfo = signal ? ` (${terminalMessages.execution.signal}: ${signal})` : '';
                        console.log(`❌ ${terminalMessages.execution.failed} (${terminalMessages.execution.exitCode}: ${code}${signalInfo})`);
                        const resultMessage = `❌ **${terminalMessages.responses.commandFailed}**\n\n**${terminalMessages.processManagement.command}:** \`${params.command}\`\n**${terminalMessages.execution.exitCode}:** ${code}${signal ? `\n**${terminalMessages.execution.signal}:** ${signal}` : ''}\n\n**Output:**\n\`\`\`\n${stdout}\n\`\`\`\n**${terminalMessages.responses.errorOutput}:**\n\`\`\`\n${stderr}\n\`\`\``;
                        resolve(this.createSuccessResponse(requestId, resultMessage));
                    }
                }
            });
        });
    }

    /**
     * 执行交互式命令
     */
    private executeInteractiveCommand(params: ExecuteCommandParams, cwd: string, requestId: any): Promise<MCPResponse> {
        return new Promise((resolve) => {
            const terminalMessages = messages.terminal;
            
            console.log(`🔄 ${terminalMessages.interactiveProcess.executing}: ${params.command}`);
            console.log(`📁 ${terminalMessages.execution.workingDirectory}: ${cwd}`);
            console.log(`💡 ${terminalMessages.execution.interactiveMode}`);
            console.log(terminalMessages.execution.separator);

            // 创建子进程
            const child = spawn(params.command, {
                cwd,
                stdio: 'inherit', // 继承父进程的 stdio，允许用户直接交互
                shell: true
            });

            let exitCode: number | null = null;
            let hasError = false;

            child.on('error', (error) => {
                hasError = true;
                console.error(`\n❌ ${terminalMessages.execution.failed}: ${error.message}`);
                
                const resultMessage = `❌ **${terminalMessages.responses.interactiveFailed}**\n\n**${terminalMessages.processManagement.command}:** \`${params.command}\`\n**${terminalMessages.execution.error}:** ${error.message}`;
                resolve(this.createSuccessResponse(requestId, resultMessage));
            });

            child.on('exit', (code, signal) => {
                if (hasError) return; // 已经处理过错误

                exitCode = code;
                console.log(terminalMessages.execution.separator);
                
                if (code === 0) {
                    console.log(`✅ ${terminalMessages.execution.success} (${terminalMessages.execution.exitCode}: ${code})`);
                    const resultMessage = `✅ **${terminalMessages.responses.interactiveSuccess}**\n\n**${terminalMessages.processManagement.command}:** \`${params.command}\`\n**${terminalMessages.execution.exitCode}:** ${code}`;
                    resolve(this.createSuccessResponse(requestId, resultMessage));
                } else {
                    const signalInfo = signal ? ` (${terminalMessages.execution.signal}: ${signal})` : '';
                    console.log(`❌ ${terminalMessages.execution.failed} (${terminalMessages.execution.exitCode}: ${code}${signalInfo})`);
                    const resultMessage = `❌ **${terminalMessages.interactiveProcess.executionFailed}**\n\n**${terminalMessages.processManagement.command}:** \`${params.command}\`\n**${terminalMessages.execution.exitCode}:** ${code}${signal ? `\n**${terminalMessages.execution.signal}:** ${signal}` : ''}`;
                    resolve(this.createSuccessResponse(requestId, resultMessage));
                }
            });
        });
    }

    /**
     * 执行后台命令
     */
    private executeBackgroundCommand(params: ExecuteCommandParams, cwd: string, requestId: any): Promise<MCPResponse> {
        return new Promise((resolve) => {
            const processId = `bg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const terminalMessages = messages.terminal;
            
            console.log(`🚀 ${terminalMessages.backgroundProcess.launching}: ${params.command}`);
            console.log(`📁 ${terminalMessages.execution.workingDirectory}: ${cwd}`);
            console.log(`🆔 ${terminalMessages.execution.processId}: ${processId}`);
            console.log(`💡 ${terminalMessages.execution.backgroundMode}`);
            console.log(terminalMessages.execution.separator);

            // 创建子进程
            const child = spawn(params.command, {
                cwd,
                shell: true,
                detached: true, // 分离进程
                stdio: ['ignore', 'pipe', 'pipe'] // 捕获输出但不继承stdin
            });

            // 存储进程信息
            const processInfo = {
                child,
                command: params.command,
                cwd,
                startTime: new Date().toLocaleString(),
                processId
            };
            
            backgroundProcesses.set(processId, processInfo);

            let hasStarted = false;
            let startupOutput = '';

            // 监听初始输出以确认启动
            if (child.stdout) {
                child.stdout.on('data', (data) => {
                    const text = data.toString();
                    if (!hasStarted) {
                        startupOutput += text;
                        // 输出前几行启动信息
                        if (startupOutput.length < 1000) {
                            process.stdout.write(text);
                        }
                    }
                });
            }

            if (child.stderr) {
                child.stderr.on('data', (data) => {
                    const text = data.toString();
                    if (!hasStarted) {
                        startupOutput += text;
                        // 输出前几行启动信息
                        if (startupOutput.length < 1000) {
                            process.stderr.write(text);
                        }
                    }
                });
            }

            child.on('error', (error) => {
                backgroundProcesses.delete(processId);
                console.log(terminalMessages.execution.separator);
                console.error(`❌ ${terminalMessages.backgroundProcess.startupFailed}: ${error.message}`);
                
                const resultMessage = `❌ **${terminalMessages.responses.backgroundFailed}**\n\n**${terminalMessages.processManagement.command}:** \`${params.command}\`\n**${terminalMessages.execution.processId}:** ${processId}\n**${terminalMessages.execution.error}:** ${error.message}`;
                resolve(this.createSuccessResponse(requestId, resultMessage));
            });

            child.on('exit', (code, signal) => {
                backgroundProcesses.delete(processId);
                console.log(terminalMessages.execution.separator);
                
                if (code === 0) {
                    console.log(`✅ ${terminalMessages.backgroundProcess.normalExit} (${terminalMessages.execution.processId}: ${processId}, ${terminalMessages.execution.exitCode}: ${code})`);
                } else {
                    const signalInfo = signal ? ` (${terminalMessages.execution.signal}: ${signal})` : '';
                    console.log(`❌ ${terminalMessages.backgroundProcess.abnormalExit} (${terminalMessages.execution.processId}: ${processId}, ${terminalMessages.execution.exitCode}: ${code}${signalInfo})`);
                }
            });

            // 等待一小段时间确认进程启动
            setTimeout(() => {
                hasStarted = true;
                console.log(terminalMessages.execution.separator);
                
                if (child.pid && !child.killed) {
                    console.log(`✅ ${terminalMessages.backgroundProcess.launched} (${terminalMessages.execution.processId}: ${processId}, ${terminalMessages.execution.pid}: ${child.pid})`);
                    const resultMessage = `✅ **${terminalMessages.responses.backgroundSuccess}**\n\n**${terminalMessages.processManagement.command}:** \`${params.command}\`\n**${terminalMessages.execution.processId}:** ${processId}\n**${terminalMessages.execution.pid}:** ${child.pid}\n**${terminalMessages.execution.workingDirectory}:** ${cwd}\n\n💡 **${terminalMessages.backgroundProcess.managementTips}:**\n- ${terminalMessages.backgroundProcess.listCommand}\n- ${terminalMessages.backgroundProcess.killCommand}\n\n**${terminalMessages.backgroundProcess.startupOutput}:**\n\`\`\`\n${startupOutput.slice(0, 500)}${startupOutput.length > 500 ? '...' : ''}\n\`\`\``;
                    resolve(this.createSuccessResponse(requestId, resultMessage));
                } else {
                    const resultMessage = `❌ **${terminalMessages.responses.backgroundFailed}**\n\n**${terminalMessages.processManagement.command}:** \`${params.command}\`\n**${terminalMessages.execution.processId}:** ${processId}\n\n${terminalMessages.backgroundProcess.maybeExited}`;
                    resolve(this.createSuccessResponse(requestId, resultMessage));
                }
            }, 2000); // 等待2秒确认启动
        });
    }
}