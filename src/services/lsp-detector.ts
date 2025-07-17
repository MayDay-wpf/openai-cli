import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { StorageService } from './storage';

export interface LspDetectionResult {
  hasLsp: boolean;
  lspName?: string;
  command?: string;
  args?: string[];
  isAvailable?: boolean;
  suggestion?: string;
  diagnostics?: LspDiagnostic[];
}

export interface LspDiagnostic {
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  severity: number; // 1=Error, 2=Warning, 3=Information, 4=Hint
  message: string;
  source?: string;
}

export class LspDetector {
  private static readonly FILE_TYPE_TO_LSP: Record<string, string> = {
    '.ts': 'typescript',
    '.tsx': 'typescriptreact',
    '.js': 'javascript',
    '.jsx': 'javascriptreact',
    '.py': 'python',
    '.go': 'go',
    '.rs': 'rust',
    '.java': 'java',
    '.cpp': 'cpp',
    '.c': 'c',
    '.cs': 'csharp',
    '.php': 'php',
    '.rb': 'ruby',
    '.swift': 'swift',
    '.kt': 'kotlin',
    '.scala': 'scala'
  };

  /**
   * Check file syntax errors
   */
  static async detectLspForFile(filePath: string): Promise<LspDetectionResult> {
    const ext = path.extname(filePath).toLowerCase();
    const lspType = this.FILE_TYPE_TO_LSP[ext];

    if (!lspType) {
      return {
        hasLsp: false,
        suggestion: `Syntax checking for ${ext} files is not supported yet`
      };
    }

    // Get user configured LSP service
    const lspConfig = StorageService.getLspConfig();
    const lspServerConfig = lspConfig.lsp[lspType];
    
    // Check if LSP service for this type exists in configuration
    if (!lspServerConfig || lspServerConfig.disabled) {
      return {
        hasLsp: false,
        lspName: lspType,
        suggestion: `${lspType} LSP service is not configured or disabled, cannot perform syntax checking`
      };
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return {
        hasLsp: false,
        lspName: lspType,
        suggestion: `File does not exist, cannot perform syntax checking`
      };
    }

    // Perform syntax checking
    const diagnostics = await this.checkFileSyntax(lspServerConfig.command, lspServerConfig.args || [], filePath);
    
    const errorCount = diagnostics.filter(d => d.severity === 1).length;
    const warningCount = diagnostics.filter(d => d.severity === 2).length;
    
    let suggestion = '';
    if (errorCount > 0 || warningCount > 0) {
      suggestion = `🔍 Found ${errorCount} errors, ${warningCount} warnings`;
      
      // Print errors to console
      console.log(`\n❌ Syntax check results - ${filePath}:`);
      diagnostics.forEach(diag => {
        const severityIcon = diag.severity === 1 ? '❌' : diag.severity === 2 ? '⚠️' : 'ℹ️';
        const line = diag.range.start.line + 1;
        const char = diag.range.start.character + 1;
        console.log(`  ${severityIcon} Line ${line}:${char} - ${diag.message}`);
      });
    } else {
      suggestion = `✅ Syntax check passed, no errors found`;
      console.log(`✅ Syntax check passed - ${filePath}`);
    }
    
    return {
      hasLsp: true,
      lspName: lspType,
      command: lspServerConfig.command,
      args: lspServerConfig.args,
      isAvailable: true,
      diagnostics: diagnostics,
      suggestion: suggestion
    };
  }

  /**
   * Check file syntax using LSP
   */
  private static async checkFileSyntax(command: string, args: string[], filePath: string): Promise<LspDiagnostic[]> {
    return new Promise((resolve) => {
      try {
        const absolutePath = path.resolve(filePath);
        const fileUri = `file://${absolutePath}`;
        const fileContent = fs.readFileSync(absolutePath, 'utf8');
        
        console.log(`🔍 Starting syntax check: ${command} ${args.join(' ')}`);
        
        const lspProcess = spawn(command, args, {
          stdio: ['pipe', 'pipe', 'pipe']
        });

        let resolved = false;
        let responseData = '';
        const diagnostics: LspDiagnostic[] = [];
        
        // LSP initialization message
        const initializeRequest = {
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            processId: process.pid,
            clientInfo: { name: 'openai-cli', version: '1.0.0' },
            rootUri: `file://${path.dirname(absolutePath)}`,
            capabilities: {
              textDocument: {
                publishDiagnostics: { relatedInformation: false, versionSupport: false, tagSupport: false }
              }
            }
          }
        };

        const initialized = { jsonrpc: '2.0', method: 'initialized', params: {} };
        
        const didOpen = {
          jsonrpc: '2.0',
          method: 'textDocument/didOpen',
          params: {
            textDocument: {
              uri: fileUri,
              languageId: this.getLanguageId(filePath),
              version: 1,
              text: fileContent
            }
          }
        };

        lspProcess.stdout?.on('data', (data) => {
          responseData += data.toString();
          
          // Parse LSP messages
          try {
            let remainingData = responseData;
            while (remainingData.length > 0) {
              const contentLengthMatch = remainingData.match(/Content-Length: (\d+)\r?\n\r?\n/);
              if (!contentLengthMatch) break;
              
              const contentLength = parseInt(contentLengthMatch[1]);
              const headerEnd = remainingData.indexOf('\r\n\r\n') + 4;
              
              if (remainingData.length < headerEnd + contentLength) break;
              
              const content = remainingData.substring(headerEnd, headerEnd + contentLength);
              const response = JSON.parse(content);
              
              // Handle diagnostic messages
              if (response.method === 'textDocument/publishDiagnostics') {
                const diagParams = response.params;
                if (diagParams.uri === fileUri && diagParams.diagnostics) {
                  diagnostics.push(...diagParams.diagnostics);
                }
              }
              
              remainingData = remainingData.substring(headerEnd + contentLength);
            }
          } catch (parseError) {
            // Ignore parsing errors
          }
        });

        lspProcess.stderr?.on('data', (data) => {
          // Ignore stderr output
        });

        lspProcess.on('error', (error) => {
          if (!resolved) {
            resolved = true;
            console.log(`❌ LSP process failed to start: ${error.message}`);
            resolve([]);
          }
        });

        lspProcess.on('close', () => {
          if (!resolved) {
            resolved = true;
            resolve(diagnostics);
          }
        });

        // Send message sequence
        setTimeout(() => {
          this.sendLspMessage(lspProcess, initializeRequest);
        }, 100);
        
        setTimeout(() => {
          this.sendLspMessage(lspProcess, initialized);
        }, 200);
        
        setTimeout(() => {
          this.sendLspMessage(lspProcess, didOpen);
        }, 300);
        
        // Wait for diagnostic results
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            lspProcess.kill();
            resolve(diagnostics);
          }
        }, 3000);

      } catch (error) {
        console.log(`💥 Error during syntax checking: ${error}`);
        resolve([]);
      }
    });
  }

  /**
   * Send LSP message
   */
  private static sendLspMessage(process: any, message: any): void {
    const content = JSON.stringify(message);
    const header = `Content-Length: ${Buffer.byteLength(content, 'utf8')}\r\n\r\n`;
    process.stdin?.write(header + content);
  }

  /**
   * Get language ID
   */
  private static getLanguageId(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mapping: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescriptreact',
      '.js': 'javascript',
      '.jsx': 'javascriptreact',
      '.py': 'python',
      '.go': 'go',
      '.rs': 'rust',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
      '.cs': 'csharp',
      '.php': 'php',
      '.rb': 'ruby'
    };
    return mapping[ext] || 'plaintext';
  }

  /**
   * Generate LSP suggestion message
   */
  static generateLspSuggestion(detection: LspDetectionResult): string {
    if (detection.suggestion) {
      return `\n\n**📡 Syntax Check:** ${detection.suggestion}`;
    }
    return '';
  }

  /**
   * Get list of supported file types
   */
  static getSupportedFileTypes(): string[] {
    return Object.keys(this.FILE_TYPE_TO_LSP);
  }

  /**
   * Get LSP type for file type
   */
  static getLspTypeForFile(filePath: string): string | undefined {
    const ext = path.extname(filePath).toLowerCase();
    return this.FILE_TYPE_TO_LSP[ext];
  }
} 