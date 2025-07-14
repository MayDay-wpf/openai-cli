// MCP模块主导出文件
export * from './api';
export * from './base-service';
export * from './manager';
export * from './services';
export * from './types';

// 导入主要服务和工具
export { BuiltInMCPAPI } from './api';
export { BaseMCPService } from './base-service';
export { GlobalMCPManager } from './manager';
export { FileSystemService } from './services/file-system';
export { TodosService } from './services/todos-service';

// MCP服务管理器
import { BaseMCPService } from './base-service';
import { getServices } from './services';
import { MCPRequest, MCPResponse } from './types';

export class MCPServiceManager {
  private services: Map<string, BaseMCPService> = new Map();

  constructor() {
    this.initializeServices();
  }

  // 初始化所有服务
  private initializeServices() {
    const availableServices = getServices();

    for (const service of availableServices) {
      try {
        const serviceName = service.getServiceInfo().name;
        this.services.set(serviceName, service);
        console.log(`MCP服务已初始化: ${serviceName}`);
      } catch (error) {
        console.error(`初始化MCP服务失败:`, error);
      }
    }
  }

  // 获取所有服务信息
  getServicesInfo() {
    const servicesInfo: any[] = [];

    for (const [serviceName, service] of this.services) {
      servicesInfo.push({
        serviceName,
        ...service.getServiceInfo()
      });
    }

    return servicesInfo;
  }

  // 处理MCP请求
  async handleRequest(serviceName: string, request: MCPRequest): Promise<MCPResponse> {
    const service = this.services.get(serviceName);

    if (!service) {
      return {
        id: request.id,
        error: {
          code: -32601,
          message: `未找到MCP服务: ${serviceName}`
        }
      };
    }

    try {
      return await service.handleRequest(request);
    } catch (error) {
      return {
        id: request.id,
        error: {
          code: -32603,
          message: '服务处理请求时发生错误',
          data: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }

  // 获取指定服务的工具列表
  getServiceTools(serviceName: string) {
    const service = this.services.get(serviceName);
    if (!service) {
      throw new Error(`未找到MCP服务: ${serviceName}`);
    }
    return service.getTools();
  }

  // 获取所有服务的工具列表
  getAllTools() {
    const allTools: any[] = [];

    for (const [serviceName, service] of this.services) {
      const tools = service.getTools().map(tool => ({
        ...tool,
        serviceName
      }));
      allTools.push(...tools);
    }

    return allTools;
  }
} 