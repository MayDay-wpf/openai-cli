// MCP服务导出索引
export { FileSystemService } from './file-system';

// 服务注册表
import { BaseMCPService } from '../base-service';
import { FileSystemService } from './file-system';

export const MCPServices = {
  'file-system': FileSystemService
} as const;

// 获取所有可用的MCP服务
export function getAllMCPServices(): Record<string, typeof BaseMCPService> {
  return MCPServices;
}

// 创建服务实例
export function createMCPService(serviceName: keyof typeof MCPServices): BaseMCPService {
  const ServiceClass = MCPServices[serviceName];
  if (!ServiceClass) {
    throw new Error(`未知的MCP服务: ${serviceName}`);
  }
  return new ServiceClass();
} 