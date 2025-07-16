import { MCPServiceManager } from './index';
import { MCPRequest, MCPResponse } from './types';

/**
 * 全局MCP服务管理器
 * 在主进程中运行，提供内置MCP服务
 */
export class GlobalMCPManager {
  private static instance: GlobalMCPManager;
  private serviceManager: MCPServiceManager;
  private isInitialized: boolean = false;

  private constructor() {
    this.serviceManager = new MCPServiceManager();
  }

  static getInstance(): GlobalMCPManager {
    if (!GlobalMCPManager.instance) {
      GlobalMCPManager.instance = new GlobalMCPManager();
    }
    return GlobalMCPManager.instance;
  }

  /**
   * 初始化MCP服务
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // 获取所有服务信息并验证它们能正常工作
      const servicesInfo = this.serviceManager.getServicesInfo();
      // 静默初始化，不输出详细信息到控制台

      this.isInitialized = true;
    } catch (error) {
      console.error('初始化MCP服务失败:', error);
      throw error;
    }
  }

  /**
   * 处理MCP请求
   */
  async handleRequest(serviceName: string, request: MCPRequest): Promise<MCPResponse> {
    if (!this.isInitialized) {
      throw new Error('MCP服务未初始化');
    }
    return await this.serviceManager.handleRequest(serviceName, request);
  }

  /**
   * 获取所有服务信息
   */
  getServicesInfo() {
    return this.serviceManager.getServicesInfo();
  }

  /**
   * 获取指定服务的工具列表
   */
  getServiceTools(serviceName: string) {
    return this.serviceManager.getServiceTools(serviceName);
  }

  /**
   * 获取所有工具列表
   */
  getAllTools() {
    return this.serviceManager.getAllTools();
  }

  /**
   * 检查服务是否已初始化
   */
  isReady(): boolean {
    return this.isInitialized;
  }
} 