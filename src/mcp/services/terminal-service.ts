import { exec, spawn } from 'child_process';
import { confirm } from '@inquirer/prompts';
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
}

const messages = languageService.getMessages();
const config = StorageService.getApiConfig();

export class TerminalService extends BaseMCPService {
    constructor() {
        super('terminal', '1.0.0');
    }

    getTools(): MCPTool[] {
        return [
            {
                name: 'execute_command',
                description: 'Execute a shell command and get the output. Supports cross-platform execution.',
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
                        }
                    },
                    required: ['command']
                }
            }
        ];
    }

    async handleRequest(request: MCPRequest): Promise<MCPResponse> {
        try {
            switch (request.method) {
                case 'execute_command':
                    return await this.handleExecuteCommand(request);
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
                    return this.createSuccessResponse(request.id, 'The user refused to execute the command, and the command was canceled, but this does not affect subsequent execution. You can remind the user to execute the command manually.');
                }
            }
        }
        if (execCommand) {
            // 检查是否为交互式命令或者包含需要交互的关键词
            const isInteractive = params.interactive || this.isInteractiveCommand(params.command);
            
            if (isInteractive) {
                return this.executeInteractiveCommand(params, cwd, request.id);
            } else {
                // 所有非交互式命令都使用实时输出
                return this.executeCommand(params, cwd, request.id);
            }
        }
        return this.createErrorResponse(request.id, -32602, 'Command contains sensitive words');
    }

    /**
     * 检查命令是否需要交互
     */
    private isInteractiveCommand(command: string): boolean {
        const interactiveKeywords = [
            'npm create',
            'npm init',
            'yarn create',
            'npx create',
            'git commit',
            'git rebase -i',
            'docker run -it',
            'sudo',
            'passwd',
            'ssh',
            'mysql',
            'psql',
            'mongo'
        ];

        const lowerCommand = command.toLowerCase();
        return interactiveKeywords.some(keyword => lowerCommand.includes(keyword));
    }



    /**
     * 执行交互式命令
     */
    private executeInteractiveCommand(params: ExecuteCommandParams, cwd: string, requestId: any): Promise<MCPResponse> {
        return new Promise((resolve) => {
            console.log(`🔄 执行交互式命令: ${params.command}`);
            console.log(`📁 工作目录: ${cwd}`);
            console.log('💡 此命令支持实时输出和用户交互');
            console.log('━'.repeat(60));

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
                console.error(`\n❌ 命令执行出错: ${error.message}`);
                
                const resultMessage = `❌ **Interactive command failed to start**\n\n**Command:** \`${params.command}\`\n**CWD:** \`${cwd}\`\n**Error:** ${error.message}`;
                resolve(this.createSuccessResponse(requestId, resultMessage));
            });

            child.on('exit', (code, signal) => {
                if (hasError) return; // 已经处理过错误

                exitCode = code;
                console.log('━'.repeat(60));
                
                if (code === 0) {
                    console.log(`✅ 命令执行成功 (退出码: ${code})`);
                    const resultMessage = `✅ **Interactive command executed successfully**\n\n**Command:** \`${params.command}\`\n**CWD:** \`${cwd}\`\n**Exit Code:** ${code}\n\n交互式命令已完成，请检查上方终端输出获取详细信息。`;
                    resolve(this.createSuccessResponse(requestId, resultMessage));
                } else {
                    const signalInfo = signal ? ` (信号: ${signal})` : '';
                    console.log(`❌ 命令执行失败 (退出码: ${code}${signalInfo})`);
                    const resultMessage = `❌ **Interactive command failed with exit code ${code}**\n\n**Command:** \`${params.command}\`\n**CWD:** \`${cwd}\`\n**Exit Code:** ${code}${signal ? `\n**Signal:** ${signal}` : ''}\n\n交互式命令执行失败，请检查上方终端输出获取详细错误信息。`;
                    resolve(this.createSuccessResponse(requestId, resultMessage));
                }
            });

            // 处理进程意外终止
            child.on('close', (code, signal) => {
                if (exitCode === null && !hasError) {
                    const signalInfo = signal ? ` (信号: ${signal})` : '';
                    console.log('━'.repeat(60));
                    console.log(`⚠️  命令进程意外关闭 (退出码: ${code}${signalInfo})`);
                    const resultMessage = `⚠️ **Interactive command process closed unexpectedly**\n\n**Command:** \`${params.command}\`\n**CWD:** \`${cwd}\`\n**Exit Code:** ${code}${signal ? `\n**Signal:** ${signal}` : ''}`;
                    resolve(this.createSuccessResponse(requestId, resultMessage));
                }
            });
        });
    }

    /**
     * 执行命令（支持实时输出）
     */
    private executeCommand(params: ExecuteCommandParams, cwd: string, requestId: any): Promise<MCPResponse> {
        return new Promise((resolve) => {
            console.log(`🔄 执行命令: ${params.command}`);
            console.log(`📁 工作目录: ${cwd}`);
            console.log('💡 此命令将显示实时输出');
            console.log('━'.repeat(60));

            // 创建子进程，捕获输出但实时显示
            const child = spawn(params.command, {
                cwd,
                shell: true
            });

            let stdout = '';
            let stderr = '';
            let exitCode: number | null = null;
            let hasError = false;

            // 实时输出 stdout
            if (child.stdout) {
                child.stdout.on('data', (data) => {
                    const text = data.toString();
                    stdout += text;
                    process.stdout.write(text); // 实时显示
                });
            }

            // 实时输出 stderr
            if (child.stderr) {
                child.stderr.on('data', (data) => {
                    const text = data.toString();
                    stderr += text;
                    process.stderr.write(text); // 实时显示
                });
            }

            child.on('error', (error) => {
                hasError = true;
                console.log('━'.repeat(60));
                console.error(`❌ 命令执行出错: ${error.message}`);
                
                const resultMessage = `❌ **Command failed to start**\n\n**Command:** \`${params.command}\`\n**CWD:** \`${cwd}\`\n**Error:** ${error.message}`;
                resolve(this.createSuccessResponse(requestId, resultMessage));
            });

            child.on('exit', (code, signal) => {
                if (hasError) return; // 已经处理过错误

                exitCode = code;
                console.log('━'.repeat(60));
                
                if (code === 0) {
                    console.log(`✅ 命令执行成功 (退出码: ${code})`);
                    const resultMessage = `✅ **Command executed successfully**\n\n**Command:** \`${params.command}\`\n**CWD:** \`${cwd}\`\n**Exit Code:** ${code}\n\n命令已完成，请检查上方终端输出获取详细信息。\n\n**Summary Output:**\n\`\`\`\n${stdout.slice(-1000)}\n\`\`\`${stderr ? `\n**Stderr:**\n\`\`\`\n${stderr.slice(-500)}\n\`\`\`` : ''}`;
                    resolve(this.createSuccessResponse(requestId, resultMessage));
                } else {
                    const signalInfo = signal ? ` (信号: ${signal})` : '';
                    console.log(`❌ 命令执行失败 (退出码: ${code}${signalInfo})`);
                    const resultMessage = `❌ **Command failed with exit code ${code}**\n\n**Command:** \`${params.command}\`\n**CWD:** \`${cwd}\`\n**Exit Code:** ${code}${signal ? `\n**Signal:** ${signal}` : ''}\n\n命令执行失败，请检查上方终端输出获取详细错误信息。\n\n**Output:**\n\`\`\`\n${stdout}\n\`\`\`\n**Stderr:**\n\`\`\`\n${stderr}\n\`\`\``;
                    resolve(this.createSuccessResponse(requestId, resultMessage));
                }
            });

            // 处理进程意外终止
            child.on('close', (code, signal) => {
                if (exitCode === null && !hasError) {
                    const signalInfo = signal ? ` (信号: ${signal})` : '';
                    console.log('━'.repeat(60));
                    console.log(`⚠️  命令进程意外关闭 (退出码: ${code}${signalInfo})`);
                    const resultMessage = `⚠️ **Command process closed unexpectedly**\n\n**Command:** \`${params.command}\`\n**CWD:** \`${cwd}\`\n**Exit Code:** ${code}${signal ? `\n**Signal:** ${signal}` : ''}\n\n**Output:**\n\`\`\`\n${stdout}\n\`\`\`${stderr ? `\n**Stderr:**\n\`\`\`\n${stderr}\n\`\`\`` : ''}`;
                    resolve(this.createSuccessResponse(requestId, resultMessage));
                }
            });
        });
    }


}