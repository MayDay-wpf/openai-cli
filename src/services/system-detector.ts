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

export interface SystemDetectionResult {
    hasRole: boolean;
    role?: string;
    hasMcpServices: boolean;
    mcpServers: McpServerInfo[];
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

            const result: SystemDetectionResult = {
                hasRole,
                role: config.role,
                hasMcpServices,
                mcpServers
            };

            return result;
        } catch (error) {
            throw error;
        }
    }

    async displaySystemInfo(detectionResult: SystemDetectionResult): Promise<void> {
        const messages = languageService.getMessages().systemDetector;

        // 显示角色信息
        if (detectionResult.hasRole && detectionResult.role) {
            this.displayRoleInfo(detectionResult.role);
        }

        // 显示MCP服务信息
        if (detectionResult.hasMcpServices && detectionResult.mcpServers.length > 0) {
            await this.displayMcpInfo(detectionResult.mcpServers);
        }

        // 如果都没有配置，显示准备就绪信息
        if (!detectionResult.hasRole && !detectionResult.hasMcpServices) {
            console.log();
            console.log('  ' + chalk.green('✓ ' + messages.ready));
            console.log();
        }
    }

    private displayRoleInfo(role: string): void {
        const messages = languageService.getMessages().systemDetector;

        // 截取角色描述，如果太长则显示前几行
        const lines = role.split('\n');
        const displayLines = lines.slice(0, 5);
        const hasMore = lines.length > 5;

        let content = displayLines.join('\n');
        if (hasMore) {
            content += '\n...';
        }

        const roleBox = boxen(
            chalk.white(content),
            {
                title: messages.roleTitle,
                titleAlignment: 'center',
                padding: 1,
                margin: { top: 1, bottom: 1, left: 2, right: 2 },
                borderStyle: 'round',
                borderColor: 'blue'
            }
        );

        console.log(roleBox);
    }

    private async displayMcpInfo(servers: McpServerInfo[]): Promise<void> {
        const messages = languageService.getMessages().systemDetector;

        let content = '';

        for (const server of servers) {
            const statusIcon = this.getStatusIcon(server.status);
            const statusColor = this.getStatusColor(server.status);

            content += `${statusIcon} ${chalk.white.bold(server.name)}\n`;

            // 显示服务类型，内置服务特殊处理
            if (server.isBuiltIn) {
                content += `   ${chalk.gray('Type:')} ${chalk.green('BUILTIN')} ${chalk.gray(`(${messages.builtinServices.protected})`)}`;
            } else {
                content += `   ${chalk.gray('Type:')} ${chalk.white(server.type.toUpperCase())}`;

                // 如果实际传输方式与配置不同，显示回退信息
                if (server.actualTransport && server.actualTransport !== server.type) {
                    content += chalk.gray(` → ${server.actualTransport.toUpperCase()}`);
                }
            }
            content += '\n';

            if (server.url) {
                content += `   ${chalk.gray('URL:')} ${chalk.white(server.url)}\n`;
            } else if (server.command) {
                content += `   ${chalk.gray('Command:')} ${chalk.white(server.command)}\n`;
                if (server.args && server.args.length > 0) {
                    content += `   ${chalk.gray('Args:')} ${chalk.white(server.args.join(' '))}\n`;
                }
            }

            content += `   ${chalk.gray(messages.serverStatus)} ${statusColor(this.getStatusText(server.status))}\n`;

            if (server.tools && server.tools.length > 0) {
                content += `   ${chalk.gray(messages.toolsFound)} ${chalk.cyan(server.tools.length)}: ${chalk.white(server.tools.slice(0, 3).join(', '))}`;
                if (server.tools.length > 3) {
                    content += chalk.gray(` +${server.tools.length - 3} more`);
                }
                content += '\n';
            } else if (server.status === 'connected') {
                content += `   ${chalk.gray(messages.noTools)}\n`;
            }

            if (server.error) {
                content += `   ${chalk.gray('Error:')} ${chalk.red(server.error)}\n`;
            }

            content += '\n';
        }

        const mcpBox = boxen(
            content.trim(),
            {
                title: messages.mcpTitle,
                titleAlignment: 'center',
                padding: 1,
                margin: { top: 1, bottom: 1, left: 2, right: 2 },
                borderStyle: 'round',
                borderColor: 'green'
            }
        );

        console.log(mcpBox);
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