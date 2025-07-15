import { exec } from 'child_process';
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
            return new Promise((resolve) => {
                const spinner = ['\\', '|', '/', '-'];
                let i = 0;
                const interval = setInterval(() => {
                    process.stdout.write(`\r[${spinner[i++]}] ${messages.config.messages.commandExecuting}...`);
                    i %= spinner.length;
                }, 100);

                exec(params.command, { cwd }, (error, stdout, stderr) => {
                    clearInterval(interval);
                    process.stdout.write('\r' + ' '.repeat(messages.config.messages.commandExecuting.length + 5) + '\r');

                    if (error) {
                        // When a command fails (e.g., a build script with errors), it's not a service error.
                        // We should return a success response containing the command's output (stdout/stderr)
                        // to let the model see the result and debug it.
                        const resultMessage = `❌ **Command failed with exit code ${error.code}**\n\n**Command:** \`${params.command}\`\n**CWD:** \`${cwd}\`\n\n**Stdout:**\n\`\`\`\n${stdout}\n\`\`\`\n**Stderr:**\n\`\`\`\n${stderr}\n\`\`\``;
                        resolve(this.createSuccessResponse(request.id, resultMessage));
                        return;
                    }

                    const resultMessage = `✅ **Command executed successfully**\n\n**Command:** \`${params.command}\`\n**CWD:** \`${cwd}\`\n\n**Stdout:**\n\`\`\`\n${stdout}\n\`\`\`\n${stderr ? `**Stderr:**\n\`\`\`\n${stderr}\n\`\`\`\n` : ''}`;
                    console.log(`CWD: ${cwd}\nCommand: ${params.command}\nStdout: ${stdout}`);
                    resolve(this.createSuccessResponse(request.id, resultMessage));
                });
            });
        }
        return this.createErrorResponse(request.id, -32602, 'Command contains sensitive words');
    }
}