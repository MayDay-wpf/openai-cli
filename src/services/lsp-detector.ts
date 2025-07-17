import { spawn } from 'child_process';
import * as path from 'path';
import { StorageService } from './storage';

export interface LspDetectionResult {
  hasLsp: boolean;
  lspName?: string;
  command?: string;
  isAvailable?: boolean;
  suggestion?: string;
}

export class LspDetector {
  private static readonly FILE_TYPE_TO_LSP: Record<string, string[]> = {
    '.ts': ['typescript'],
    '.tsx': ['typescript'],
    '.js': ['javascript'],
    '.jsx': ['javascript'],
    '.py': ['python'],
    '.go': ['go'],
    '.rs': ['rust'],
    '.java': ['java'],
    '.cpp': ['cpp'],
    '.c': ['c'],
    '.cs': ['csharp'],
    '.php': ['php'],
    '.rb': ['ruby'],
    '.swift': ['swift'],
    '.kt': ['kotlin'],
    '.scala': ['scala']
  };

  private static readonly DEFAULT_LSP_COMMANDS: Record<string, string[]> = {
    'typescript': ['typescript-language-server', '--stdio'],
    'javascript': ['typescript-language-server', '--stdio'],
    'python': ['pylsp'],
    'go': ['gopls'],
    'rust': ['rust-analyzer'],
    'java': ['jdtls'],
    'cpp': ['clangd'],
    'c': ['clangd'],
    'csharp': ['omnisharp-lsp'],
    'php': ['intelephense', '--stdio'],
    'ruby': ['solargraph', 'stdio'],
    'swift': ['sourcekit-lsp'],
    'kotlin': ['kotlin-language-server'],
    'scala': ['metals']
  };

  /**
   * 检测文件类型对应的 LSP 服务
   */
  static async detectLspForFile(filePath: string): Promise<LspDetectionResult> {
    const ext = path.extname(filePath).toLowerCase();
    const lspTypes = this.FILE_TYPE_TO_LSP[ext];

    if (!lspTypes || lspTypes.length === 0) {
      return {
        hasLsp: false,
        suggestion: `Not supported at the moment ${ext} LSP service of the file`
      };
    }

    // 获取用户配置的 LSP 服务
    const lspConfig = StorageService.getLspConfig();
    
    // 检查用户配置的 LSP 服务
    for (const lspType of lspTypes) {
      const userConfig = lspConfig.lsp[lspType];
      if (userConfig && !userConfig.disabled) {
        const isAvailable = await this.checkLspAvailability(userConfig.command);
        return {
          hasLsp: true,
          lspName: lspType,
          command: userConfig.command,
          isAvailable,
          suggestion: isAvailable 
            ? `✅ ${lspType} LSP Service has been configured and is available (${userConfig.command})`
            : `⚠️ ${lspType} LSP Service has been configured but is unavailable, please check. ${userConfig.command} Is it installed correctly`
        };
      }
    }

    // 如果用户没有配置，检查默认的 LSP 服务
    const primaryLspType = lspTypes[0];
    const defaultCommand = this.DEFAULT_LSP_COMMANDS[primaryLspType];
    
    if (defaultCommand) {
      const isAvailable = await this.checkLspAvailability(defaultCommand[0]);
      if (isAvailable) {
        return {
          hasLsp: true,
          lspName: primaryLspType,
          command: defaultCommand[0],
          isAvailable: true,
          suggestion: `✅ System detected as installed ${primaryLspType} LSP Service (${defaultCommand[0]})`
        };
      }
    }

    // 如果都不可用，返回安装建议
    return {
      hasLsp: false,
      lspName: primaryLspType,
      command: defaultCommand?.[0],
      isAvailable: false,
      suggestion: `💡 Recommended installation ${primaryLspType} LSP Service to obtain better code intelligent suggestions: ${defaultCommand?.join(' ')}`
    };
  }

  /**
   * 简单检查 LSP 命令是否可用
   */
  private static async checkLspAvailability(command: string): Promise<boolean> {
    return new Promise((resolve) => {
      const process = spawn(command, ['--version'], {
        stdio: 'pipe',
        timeout: 2000
      });

      let resolved = false;
      
      process.on('close', (code) => {
        if (!resolved) {
          resolved = true;
          resolve(code === 0);
        }
      });

      process.on('error', () => {
        if (!resolved) {
          resolved = true;
          resolve(false);
        }
      });

      // 超时处理
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          process.kill();
          resolve(false);
        }
      }, 2000);
    });
  }

  /**
   * 生成 LSP 提示信息
   */
  static generateLspSuggestion(detection: LspDetectionResult): string {
    if (detection.suggestion) {
      return `\n\n**📡 LSP Service status:** ${detection.suggestion}`;
    }
    return '';
  }
} 