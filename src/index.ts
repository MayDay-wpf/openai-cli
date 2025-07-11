#!/usr/bin/env node

// 抑制 punycode 弃用警告
process.removeAllListeners('warning');
process.on('warning', (warning) => {
  // 忽略 punycode 模块的弃用警告
  if (warning.name === 'DeprecationWarning' && warning.message.includes('punycode')) {
    return;
  }
  // 显示其他警告
  console.warn(warning.message);
});

import { Command } from 'commander';
import { WelcomeScreen } from './ui/screens/welcome';
import { GlobalMCPManager } from './mcp/manager';

// 导出MCP模块供外部使用
export * from './mcp';

const packageJson = require('../package.json');

const program = new Command();

program
  .name('openai-cli')
  .description('OpenAI CLI Coding Agent - 您的智能编程助手')
  .version(packageJson.version);

program
  .action(async () => {
    try {
      // 更新MCP配置（修复旧配置）
      const { StorageService } = await import('./services/storage');
      StorageService.updateMcpConfig();
      
      // 初始化系统MCP服务
      const mcpManager = GlobalMCPManager.getInstance();
      await mcpManager.initialize();
      
      // 启动主界面
      const welcome = new WelcomeScreen();
      await welcome.show();
    } catch (error) {
      console.error('启动失败:', error);
      process.exit(1);
    }
  });

program.parse(); 