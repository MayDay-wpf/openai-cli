// MCP服务导出索引
export { FileReaderService } from './file-reader';

// 服务注册表
import { FileReaderService } from './file-reader';
import { FileOperationsService } from './file-operations';
import { BaseMCPService } from '../base-service';

export const MCPServices = {
  'file-reader': FileReaderService,
  'file-operations': FileOperationsService
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