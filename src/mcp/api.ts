import { GlobalMCPManager } from './manager';
import { MCPRequest, ReadFileParams, ReadFileResult } from './types';

/**
 * 内置MCP服务API
 * 提供简化的接口来使用系统MCP服务
 */
export class BuiltInMCPAPI {
  private static getMCPManager() {
    return GlobalMCPManager.getInstance();
  }

  /**
   * 读取文件内容
   * @param filePath 文件路径
   * @param encoding 编码格式，默认为utf8
   * @returns 文件内容和元信息
   */
  static async readFile(filePath: string, encoding: string = 'utf8'): Promise<ReadFileResult> {
    const request: MCPRequest = {
      id: `read-file-${Date.now()}`,
      method: 'read_file',
      params: {
        path: filePath,
        encoding
      } as ReadFileParams
    };

    const response = await this.getMCPManager().handleRequest('file-system', request);

    if (response.error) {
      throw new Error(`读取文件失败: ${response.error.message}`);
    }

    return response.result as ReadFileResult;
  }

  /**
   * 检查文件是否存在并可读取
   * @param filePath 文件路径
   * @returns 是否可读取
   */
  static async canReadFile(filePath: string): Promise<boolean> {
    try {
      await this.readFile(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 获取所有可用的MCP工具
   * @returns 工具列表
   */
  static getAllTools() {
    return this.getMCPManager().getAllTools();
  }

  /**
   * 获取指定服务的工具
   * @param serviceName 服务名称
   * @returns 工具列表
   */
  static getServiceTools(serviceName: string) {
    return this.getMCPManager().getServiceTools(serviceName);
  }

  /**
   * 检查MCP服务是否已就绪
   * @returns 是否就绪
   */
  static isReady(): boolean {
    return this.getMCPManager().isReady();
  }

  /**
   * 直接执行MCP请求（高级API）
   * @param serviceName 服务名称
   * @param request MCP请求
   * @returns MCP响应
   */
  static async executeRequest(serviceName: string, request: MCPRequest) {
    return await this.getMCPManager().handleRequest(serviceName, request);
  }
} 