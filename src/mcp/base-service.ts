import { MCPRequest, MCPResponse, MCPTool } from './types';

// MCP服务基础抽象类
export abstract class BaseMCPService {
  protected serviceName: string;
  protected version: string;

  constructor(serviceName: string, version: string = '1.0.0') {
    this.serviceName = serviceName;
    this.version = version;
  }

  // 获取服务信息
  getServiceInfo() {
    return {
      name: this.serviceName,
      version: this.version,
      tools: this.getTools()
    };
  }

  // 抽象方法：获取服务支持的工具列表
  abstract getTools(): MCPTool[];

  // 抽象方法：处理请求
  abstract handleRequest(request: MCPRequest): Promise<MCPResponse>;

  // 创建成功响应
  protected createSuccessResponse(id: string, result: any): MCPResponse {
    return {
      id,
      result
    };
  }

  // 创建错误响应
  protected createErrorResponse(id: string, code: number, message: string, data?: any): MCPResponse {
    return {
      id,
      error: {
        code,
        message,
        data
      }
    };
  }

  // 验证请求参数
  protected validateParams(params: any, required: string[]): string | null {
    if (!params) {
      return '缺少必需参数';
    }

    for (const field of required) {
      if (!(field in params) || params[field] === undefined || params[field] === null) {
        return `缺少必需参数: ${field}`;
      }
    }

    return null;
  }
} 