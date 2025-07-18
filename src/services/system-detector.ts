import boxen from 'boxen';
import chalk from 'chalk';
import { MCPClient } from 'mcp-client';
import { GlobalMCPManager } from '../mcp/manager';
import { AnimationUtils } from '../utils';
import { languageService } from './language';
import { StorageService } from './storage';

export interface McpServerInfo {
    name: string;
    type: 'http' | 'stdio' | 'sse' | 'builtin' | 'other' | 'unknown';
    status: 'connected' | 'failed' | 'not_found' | 'pending';
    url?: string;
    command?: string;
    args?: string[];
    tools?: string[];
    error?: string;
    actualTransport?: 'http' | 'sse' | 'stdio' | 'builtin'; // 实际使用的传输方式
    isBuiltIn?: boolean; // 标记是否为内置服务
}

export interface LspServerInfo {
    name: string;
    status: 'enabled' | 'disabled' | 'not_found' | 'error';
    command?: string;
    args?: string[];
    error?: string;
    isBuiltIn?: boolean; // 标记是否为内置服务
}

export interface SystemDetectionResult {
    hasRole: boolean;
    role?: string;
    hasMcpServices: boolean;
    mcpServers: McpServerInfo[];
    hasLspServices: boolean;
    lspServers: LspServerInfo[];
}

export class SystemDetector {
    private mcpClients: Map<string, MCPClient> = new Map();
    private globalMCPManager: GlobalMCPManager;

    constructor() {
        this.globalMCPManager = GlobalMCPManager.getInstance();
    }

    async detectSystem(): Promise<SystemDetectionResult> {
        const messages = languageService.getMessages().systemDetector;

        try {
            // 检测系统角色
            let controller = AnimationUtils.showLoadingAnimation({
                text: messages.progress.detectingRole,
                interval: 100
            });
            const config = StorageService.getApiConfig();
            const hasRole = !!config.role;
            await this.delay(500);
            controller.stop();

            // 检测MCP服务
            controller = AnimationUtils.showLoadingAnimation({
                text: messages.progress.detectingMcp,
                interval: 100
            });
            const mcpConfig = StorageService.getMcpConfig();
            const hasMcpServices = Object.keys(mcpConfig.mcpServers).length > 0;
            await this.delay(500);
            controller.stop();

            let mcpServers: McpServerInfo[] = [];

            if (hasMcpServices) {
                // 连接MCP服务
                controller = AnimationUtils.showLoadingAnimation({
                    text: messages.progress.connectingMcp,
                    interval: 100
                });
                mcpServers = await this.detectMcpServers(mcpConfig.mcpServers);
                controller.stop();

                // 获取工具
                controller = AnimationUtils.showLoadingAnimation({
                    text: messages.progress.fetchingTools,
                    interval: 100
                });
                await this.fetchToolsForServers(mcpServers);
                controller.stop();
            }

            // 检测LSP服务
            controller = AnimationUtils.showLoadingAnimation({
                text: messages.progress.detectingLsp,
                interval: 100
            });
            const lspConfig = StorageService.getLspConfig();
            const hasLspServices = Object.keys(lspConfig.lsp).length > 0;
            await this.delay(500);
            controller.stop();

            let lspServers: LspServerInfo[] = [];

            if (hasLspServices) {
                // 检测LSP服务状态
                controller = AnimationUtils.showLoadingAnimation({
                    text: messages.progress.checkingLsp,
                    interval: 100
                });
                lspServers = await this.detectLspServers(lspConfig.lsp);
                controller.stop();
            }

            const result: SystemDetectionResult = {
                hasRole,
                role: config.role,
                hasMcpServices,
                mcpServers,
                hasLspServices,
                lspServers
            };

            return result;
        } catch (error) {
            throw error;
        }
    }

    async displaySystemInfo(detectionResult: SystemDetectionResult): Promise<void> {
        const messages = languageService.getMessages().systemDetector;

        // 如果没有任何服务或角色配置，显示准备就绪信息
        if (!detectionResult.hasRole && !detectionResult.hasMcpServices && !detectionResult.hasLspServices) {
            console.log();
            console.log('  ' + chalk.green('✓ ' + messages.ready));
            console.log();
            return;
        }

        // 构建系统状态显示内容
        let content = '';
        let hasContent = false;

        // 显示角色信息（如果有）
        if (detectionResult.hasRole && detectionResult.role) {
            const lines = detectionResult.role.split('\n');
            const displayLines = lines.slice(0, 3); // 限制为3行
            const hasMore = lines.length > 3;

            content += chalk.cyan('● ') + chalk.white.bold('System Role') + '\n';
            displayLines.forEach(line => {
                content += '  ' + chalk.white(line.trim()) + '\n';
            });
            if (hasMore) {
                content += '  ' + chalk.gray('...') + '\n';
            }
            hasContent = true;
        }

        // 显示MCP服务信息（如果有）
        if (detectionResult.hasMcpServices && detectionResult.mcpServers.length > 0) {
            if (hasContent) content += '\n';
            content += chalk.green('● ') + chalk.white.bold('MCP Services') + '\n';
            
            detectionResult.mcpServers.forEach(server => {
                const statusIcon = this.getStatusIcon(server.status);
                const statusColor = this.getStatusColor(server.status);
                
                content += `  ${statusIcon} ${chalk.white(server.name)}`;
                
                // 显示类型和状态
                if (server.isBuiltIn) {
                    content += ` ${chalk.gray('(Built-in)')}`;
                } else {
                    content += ` ${chalk.gray(`(${server.type.toUpperCase()})`)}`;
                }
                
                content += ` - ${statusColor(this.getStatusText(server.status))}`;
                
                // 显示工具数量
                if (server.tools && server.tools.length > 0) {
                    content += ` ${chalk.cyan(`[${server.tools.length} tools]`)}`;
                }
                
                content += '\n';
            });
            hasContent = true;
        }

        // 显示LSP服务信息（如果有）
        if (detectionResult.hasLspServices && detectionResult.lspServers.length > 0) {
            if (hasContent) content += '\n';
            content += chalk.blue('● ') + chalk.white.bold('Language Servers') + '\n';
            
            detectionResult.lspServers.forEach(server => {
                const statusIcon = this.getLspStatusIcon(server.status);
                const statusColor = this.getLspStatusColor(server.status);
                
                content += `  ${statusIcon} ${chalk.white(server.name)}`;
                
                // 显示类型
                if (server.isBuiltIn) {
                    content += ` ${chalk.gray('(Built-in)')}`;
                } else {
                    content += ` ${chalk.gray('(External)')}`;
                }
                
                content += ` - ${statusColor(this.getLspStatusText(server.status))}`;
                content += '\n';
            });
            hasContent = true;
        }

        // 显示整合的系统状态框
        if (hasContent) {
            const systemBox = boxen(
                content.trim(),
                {
                    title: chalk.white.bold('System Status'),
                    titleAlignment: 'center',
                    padding: { top: 1, bottom: 1, left: 2, right: 2 },
                    margin: { top: 1, bottom: 1, left: 2, right: 2 },
                    borderStyle: 'round',
                    borderColor: 'cyan'
                }
            );

            console.log(systemBox);
        }
    }



    private async detectMcpServers(mcpServers: Record<string, any>): Promise<McpServerInfo[]> {
        const servers: McpServerInfo[] = [];

        for (const [name, config] of Object.entries(mcpServers)) {
            const serverInfo: McpServerInfo = {
                name,
                type: this.detectServerType(config),
                status: 'pending'
            };

            // 检查是否为内置服务
            if (config.transport === 'builtin') {
                serverInfo.isBuiltIn = true;
                serverInfo.actualTransport = 'builtin';

                // 直接连接内置服务
                try {
                    await this.connectToBuiltInServer(serverInfo);
                    servers.push(serverInfo);
                } catch (error) {
                    serverInfo.status = 'failed';
                    serverInfo.error = error instanceof Error ? error.message : 'Built-in service error';
                    servers.push(serverInfo);
                }
            } else {
                // 外部服务
                if (config.url) {
                    serverInfo.url = config.url;
                } else if (config.command) {
                    serverInfo.command = config.command;
                    serverInfo.args = config.args || [];
                }

                // 尝试连接外部MCP服务器
                try {
                    await this.connectToMcpServer(serverInfo);
                    servers.push(serverInfo);
                } catch (error) {
                    serverInfo.status = 'failed';
                    serverInfo.error = error instanceof Error ? error.message : 'Unknown error';
                    servers.push(serverInfo);
                }
            }
        }

        return servers;
    }

    private async detectLspServers(lspServers: Record<string, any>): Promise<LspServerInfo[]> {
        const servers: LspServerInfo[] = [];

        for (const [name, config] of Object.entries(lspServers)) {
            const serverInfo: LspServerInfo = {
                name,
                command: config.command,
                args: config.args || [],
                status: 'enabled'
            };

            // 检查是否为内置服务
            const builtInServices = StorageService.getBuiltInLspServices();
            if (builtInServices[name]) {
                serverInfo.isBuiltIn = true;
            }

            // 检查是否被禁用
            if (config.disabled === true) {
                serverInfo.status = 'disabled';
                servers.push(serverInfo);
                continue;
            }

            // 检查命令是否存在（简单检测）
            try {
                await this.checkLspServerAvailability(serverInfo);
                servers.push(serverInfo);
            } catch (error) {
                serverInfo.status = 'error';
                serverInfo.error = error instanceof Error ? error.message : 'Unknown error';
                servers.push(serverInfo);
            }
        }

        return servers;
    }

    private async checkLspServerAvailability(serverInfo: LspServerInfo): Promise<void> {
        return new Promise((resolve, reject) => {
            const { spawn } = require('child_process');
            
            if (!serverInfo.command) {
                reject(new Error('No command specified'));
                return;
            }

            // 尝试启动LSP服务器来检查可用性
            const child = spawn(serverInfo.command, ['--help'], {
                stdio: 'pipe',
                timeout: 3000 // 3秒超时
            });

            let resolved = false;

            const cleanup = () => {
                if (!resolved) {
                    resolved = true;
                    try {
                        child.kill();
                    } catch (error) {
                        // 忽略清理错误
                    }
                }
            };

            child.on('spawn', () => {
                if (!resolved) {
                    resolved = true;
                    cleanup();
                    resolve();
                }
            });

            child.on('error', (error: Error) => {
                if (!resolved) {
                    resolved = true;
                    cleanup();
                    if (error.message.includes('ENOENT')) {
                        reject(new Error(`Command not found: ${serverInfo.command}`));
                    } else {
                        reject(error);
                    }
                }
            });

            child.on('exit', (code: number | null) => {
                if (!resolved) {
                    resolved = true;
                    cleanup();
                    // 任何退出码都认为是可用的，因为我们只是测试命令是否存在
                    resolve();
                }
            });

            // 超时处理
            setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    cleanup();
                    reject(new Error(`Timeout checking ${serverInfo.command}`));
                }
            }, 3000);
        });
    }

    private async connectToBuiltInServer(serverInfo: McpServerInfo): Promise<void> {
        try {
            // 检查全局MCP管理器是否已初始化
            if (!this.globalMCPManager.isReady()) {
                throw new Error('Built-in MCP manager not initialized');
            }

            // 验证内置服务存在
            const servicesInfo = this.globalMCPManager.getServicesInfo();
            const serviceExists = servicesInfo.some(service => service.serviceName === serverInfo.name);

            if (!serviceExists) {
                throw new Error(`Built-in service '${serverInfo.name}' not found`);
            }

            serverInfo.status = 'connected';
        } catch (error) {
            serverInfo.status = 'failed';
            serverInfo.error = error instanceof Error ? error.message : 'Connection to built-in service failed';
        }
    }

    private async fetchToolsForServers(servers: McpServerInfo[]): Promise<void> {
        const connectedServers = servers.filter(s => s.status === 'connected');

        for (const server of connectedServers) {
            try {
                if (server.isBuiltIn) {
                    // 内置服务，使用全局MCP管理器获取工具
                    const tools = this.globalMCPManager.getServiceTools(server.name);
                    server.tools = tools.map(tool => tool.name);
                } else {
                    // 外部服务，使用MCP客户端获取工具
                    const client = this.mcpClients.get(server.name);
                    if (client) {
                        const tools = await client.getAllTools();
                        server.tools = tools.map(tool => tool.name);
                    }
                }
            } catch (error) {
                // 获取工具失败不影响连接状态，但记录错误
                server.tools = [];
            }
        }
    }

    private detectServerType(config: any): 'http' | 'stdio' | 'sse' | 'builtin' | 'other' | 'unknown' {
        if (config.transport === 'builtin') {
            return 'builtin';
        } else if (config.url) {
            // 根据URL判断是HTTP还是SSE
            if (config.type === 'sse' || config.url.includes('/sse')) {
                return 'sse';
            }
            return 'http';
        } else if (config.command) {
            return 'stdio';
        } else if (config.transport) {
            return 'other';
        }
        return 'unknown';
    }

    private async connectToMcpServer(serverInfo: McpServerInfo): Promise<void> {
        const messages = languageService.getMessages().systemDetector;

        try {
            const client = new MCPClient({
                name: "OpenAI-CLI-Detector",
                version: "1.0.0",
            });

            if (serverInfo.type === 'http' && serverInfo.url) {
                try {
                    // 首先尝试HTTP连接
                    await client.connect({
                        type: "httpStream",
                        url: serverInfo.url,
                    });
                    serverInfo.actualTransport = 'http';
                } catch (httpError) {
                    // HTTP失败，尝试SSE回退
                    try {
                        const sseUrl = this.convertToSseUrl(serverInfo.url);
                        await client.connect({
                            type: "sse",
                            url: sseUrl,
                        });
                        serverInfo.actualTransport = 'sse';
                    } catch (sseError) {
                        throw httpError; // 抛出原始错误
                    }
                }
            } else if (serverInfo.type === 'sse' && serverInfo.url) {
                // 直接使用SSE连接
                await client.connect({
                    type: "sse",
                    url: serverInfo.url,
                });
                serverInfo.actualTransport = 'sse';
            } else if (serverInfo.type === 'stdio' && serverInfo.command) {
                // STDIO连接
                await client.connect({
                    type: "stdio",
                    command: serverInfo.command,
                    args: serverInfo.args || [],
                });
                serverInfo.actualTransport = 'stdio';
            } else {
                throw new Error('Unsupported server type');
            }

            // 连接成功
            serverInfo.status = 'connected';

            // 存储客户端以备后用
            this.mcpClients.set(serverInfo.name, client);

        } catch (error) {
            serverInfo.status = 'failed';
            serverInfo.error = error instanceof Error ? error.message : 'Connection failed';
        }
    }

    private convertToSseUrl(httpUrl: string): string {
        // 简单的URL转换逻辑，将HTTP URL转换为SSE URL
        // 这个逻辑可能需要根据具体的服务器实现进行调整
        if (httpUrl.endsWith('/mcp')) {
            return httpUrl.replace('/mcp', '/sse');
        } else if (httpUrl.endsWith('/')) {
            return httpUrl + 'sse';
        } else {
            return httpUrl + '/sse';
        }
    }

    private async delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private getStatusIcon(status: McpServerInfo['status']): string {
        switch (status) {
            case 'connected':
                return chalk.green('●');
            case 'failed':
                return chalk.red('●');
            case 'not_found':
                return chalk.yellow('●');
            case 'pending':
                return chalk.gray('●');
            default:
                return chalk.gray('●');
        }
    }

    private getStatusColor(status: McpServerInfo['status']): (text: string) => string {
        switch (status) {
            case 'connected':
                return chalk.green;
            case 'failed':
                return chalk.red;
            case 'not_found':
                return chalk.yellow;
            case 'pending':
                return chalk.gray;
            default:
                return chalk.gray;
        }
    }

    private getStatusText(status: McpServerInfo['status']): string {
        const messages = languageService.getMessages().systemDetector;

        switch (status) {
            case 'connected':
                return messages.mcpConnected;
            case 'failed':
                return messages.mcpFailed;
            case 'not_found':
                return messages.mcpNotFound;
            case 'pending':
                return messages.mcpConnecting;
            default:
                return 'Unknown';
        }
    }

    async waitForUserToContinue(): Promise<void> {
        const messages = languageService.getMessages().systemDetector;

        return new Promise((resolve) => {
            console.log('  ' + chalk.gray(messages.pressEnterToContinue));

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
                const keyCode = key.charCodeAt(0);

                switch (keyCode) {
                    case 13: // Enter
                    case 10: // Line feed
                        cleanup();
                        resolve();
                        break;
                    case 3: // Ctrl+C
                        cleanup();
                        process.exit();
                        break;
                    // 忽略其他按键
                }
            };

            process.stdin.on('data', keyHandler);
        });
    }

    // 公开方法：获取已连接的MCP客户端
    getMcpClient(serverName: string): MCPClient | undefined {
        return this.mcpClients.get(serverName);
    }

    // 公开方法：获取所有连接的MCP客户端
    getAllMcpClients(): Map<string, MCPClient> {
        return new Map(this.mcpClients);
    }

    // 公开方法：获取所有MCP工具的OpenAI格式定义
    async getAllToolDefinitions(): Promise<any[]> {
        const toolDefinitions: any[] = [];

        // 1. 获取内置服务的工具
        try {
            if (this.globalMCPManager.isReady()) {
                const servicesInfo = this.globalMCPManager.getServicesInfo();

                for (const serviceInfo of servicesInfo) {
                    try {
                        const tools = this.globalMCPManager.getServiceTools(serviceInfo.serviceName);

                        // 将内置服务的工具转换为OpenAI格式
                        for (const tool of tools) {
                            const openAITool = this.convertMcpToolToOpenAI(tool, serviceInfo.serviceName);
                            if (openAITool) {
                                toolDefinitions.push(openAITool);
                            }
                        }
                    } catch (error) {
                        console.warn(`Failed to get tools from built-in service ${serviceInfo.serviceName}:`, error);
                    }
                }
            } else {
                // Attempt to initialize if not ready
                try {
                    await this.globalMCPManager.initialize();
                    // Retry getting services after initialization
                    const servicesInfo = this.globalMCPManager.getServicesInfo();
                    for (const serviceInfo of servicesInfo) {
                        try {
                            const tools = this.globalMCPManager.getServiceTools(serviceInfo.serviceName);

                            // 将内置服务的工具转换为OpenAI格式
                            for (const tool of tools) {
                                const openAITool = this.convertMcpToolToOpenAI(tool, serviceInfo.serviceName);
                                if (openAITool) {
                                    toolDefinitions.push(openAITool);
                                }
                            }
                        } catch (error) {
                            console.warn(`Failed to get tools from built-in service ${serviceInfo.serviceName}:`, error);
                        }
                    }
                } catch (initError) {
                    console.warn(`Failed to initialize GlobalMCPManager:`, initError);
                }
            }
        } catch (error) {
            console.warn('Failed to get built-in MCP tools:', error);
        }

        // 2. 获取外部服务的工具
        for (const [serverName, client] of this.mcpClients.entries()) {
            try {
                // 获取服务器的工具列表
                const tools = await client.getAllTools();

                // 将MCP工具格式转换为OpenAI工具格式
                for (const tool of tools) {
                    const openAITool = this.convertMcpToolToOpenAI(tool, serverName);
                    if (openAITool) {
                        toolDefinitions.push(openAITool);
                    }
                }
            } catch (error) {
                console.warn(`Failed to get tool definitions from server ${serverName}:`, error);
            }
        }

        return toolDefinitions;
    }

    // 私有方法：将MCP工具格式转换为OpenAI工具格式
    private convertMcpToolToOpenAI(mcpTool: any, serverName: string): any | null {
        try {
            // 基本的工具定义结构
            const openAITool = {
                type: 'function',
                function: {
                    name: `${serverName}_${mcpTool.name}`,
                    description: mcpTool.description || `Tool from ${serverName}: ${mcpTool.name}`,
                    parameters: {
                        type: 'object',
                        properties: {},
                        required: []
                    }
                }
            };

            // 如果MCP工具有参数定义，转换为OpenAI格式
            if (mcpTool.inputSchema) {
                openAITool.function.parameters = mcpTool.inputSchema;
            } else if (mcpTool.parameters) {
                // 处理不同的参数格式
                openAITool.function.parameters.properties = mcpTool.parameters;
                if (mcpTool.required && Array.isArray(mcpTool.required)) {
                    openAITool.function.parameters.required = mcpTool.required;
                }
            }

            return openAITool;
        } catch (error) {
            console.warn(`Failed to convert MCP tool ${mcpTool.name} to OpenAI format:`, error);
            return null;
        }
    }

    // 公开方法：执行MCP工具调用
    async executeMcpTool(toolName: string, parameters: any): Promise<any> {
        // 解析服务器名和工具名
        const parts = toolName.split('_');
        if (parts.length < 2) {
            throw new Error(`Invalid tool name format: ${toolName}`);
        }

        const serverName = parts[0];
        const actualToolName = parts.slice(1).join('_');

        // 检查是否为内置服务
        const servicesInfo = this.globalMCPManager.getServicesInfo();
        const isBuiltInService = servicesInfo.some(service => service.serviceName === serverName);

        if (isBuiltInService) {
            // 内置服务，使用全局MCP管理器
            try {
                const request = {
                    id: `tool-call-${Date.now()}`,
                    method: actualToolName,
                    params: parameters
                };

                const response = await this.globalMCPManager.handleRequest(serverName, request);

                if (response.error) {
                    throw new Error(response.error.message);
                }

                return response.result;
            } catch (error) {
                throw new Error(`Failed to execute built-in MCP tool ${toolName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        } else {
            // 外部服务，使用MCP客户端
            const client = this.mcpClients.get(serverName);
            if (!client) {
                throw new Error(`MCP client not found for server: ${serverName}`);
            }

            try {
                // 调用MCP工具
                const result = await client.callTool({
                    name: actualToolName,
                    arguments: parameters
                });
                return result;
            } catch (error) {
                throw new Error(`Failed to execute external MCP tool ${toolName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
    }

    private getLspStatusIcon(status: LspServerInfo['status']): string {
        switch (status) {
            case 'enabled':
                return chalk.green('●');
            case 'disabled':
                return chalk.gray('●');
            case 'not_found':
                return chalk.yellow('●');
            case 'error':
                return chalk.red('●');
            default:
                return chalk.gray('●');
        }
    }

    private getLspStatusColor(status: LspServerInfo['status']): (text: string) => string {
        switch (status) {
            case 'enabled':
                return chalk.green;
            case 'disabled':
                return chalk.gray;
            case 'not_found':
                return chalk.yellow;
            case 'error':
                return chalk.red;
            default:
                return chalk.gray;
        }
    }

    private getLspStatusText(status: LspServerInfo['status']): string {
        const messages = languageService.getMessages().systemDetector;

        switch (status) {
            case 'enabled':
                return messages.lspEnabled;
            case 'disabled':
                return messages.lspDisabled;
            case 'not_found':
                return messages.lspNotFound;
            case 'error':
                return messages.lspError;
            default:
                return 'Unknown';
        }
    }

    // 清理资源
    async cleanup(): Promise<void> {
        // 清理MCP客户端
        for (const client of this.mcpClients.values()) {
            try {
                // 注意：mcp-client可能没有显式的disconnect方法
                // 如果有，可以在这里调用
            } catch (error) {
                // 忽略清理错误
            }
        }
        this.mcpClients.clear();
    }
} 