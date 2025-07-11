import * as fs from 'fs';
import * as path from 'path';
import { BaseMCPService } from '../base-service';
import { MCPRequest, MCPResponse, MCPTool, ReadFileParams, ReadFileResult, DirectoryResult, DirectoryItem } from '../types';
import { TokenCalculator } from '../../utils/token-calculator';
import { StorageService } from '../../services/storage';

// Enhanced file reader MCP service with directory browsing and token-aware reading
export class FileReaderService extends BaseMCPService {
  constructor() {
    super('file-reader', '1.0.0');
  }

  getTools(): MCPTool[] {
    return [
      {
        name: 'read_file',
        description: 'Read local file content with optional line range. If target is a directory, returns directory structure in markdown format.',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'File or directory path to read (supports both relative and absolute paths)'
            },
            encoding: {
              type: 'string',
              description: 'File encoding format',
              default: 'utf8',
              enum: ['utf8', 'ascii', 'base64', 'hex', 'binary']
            },
            startLine: {
              type: 'number',
              description: 'Starting line number. Required for file reading, ignored for directory browsing.',
              minimum: 1
            },
            endLine: {
              type: 'number',
              description: 'Ending line number. Required for file reading, ignored for directory browsing.',
              minimum: 1
            }
          },
          required: ['path', 'startLine', 'endLine']
        }
      }
    ];
  }

  async handleRequest(request: MCPRequest): Promise<MCPResponse> {
    try {
      switch (request.method) {
        case 'read_file':
          return await this.handleReadFile(request);
        default:
          return this.createErrorResponse(
            request.id,
            -32601,
            `Unsupported method: ${request.method}`
          );
      }
    } catch (error) {
      return this.createErrorResponse(
        request.id,
        -32603,
        'Internal server error',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  private async handleReadFile(request: MCPRequest): Promise<MCPResponse> {
    const validationError = this.validateParams(request.params, ['path']);
    if (validationError) {
      return this.createErrorResponse(request.id, -32602, validationError);
    }

    const params: ReadFileParams = request.params;
    const encoding = params.encoding || 'utf8';

    try {
      // Resolve file path
      const targetPath = path.resolve(params.path);
      
      // Check if path exists
      if (!fs.existsSync(targetPath)) {
        return this.createSuccessResponse(request.id, {
          content: `❌ **Error: Path does not exist**\n\nThe path "${params.path}" was not found. Please check:\n- File/directory name spelling\n- File/directory location\n- Use correct relative or absolute path\n\n*Retry with the correct path.*`,
          size: 0,
          lastModified: new Date().toISOString(),
          encoding,
          totalLines: 0,
          isPartial: false,
          message: 'Path not found - please retry with correct path'
        });
      }

      // Get path stats
      const stats = fs.statSync(targetPath);

      // Handle directory (ignore line parameters for directories)
      if (stats.isDirectory()) {
        return await this.handleDirectoryRead(request.id, targetPath);
      }

      // Handle file
      if (!stats.isFile()) {
        return this.createSuccessResponse(request.id, {
          content: `❌ **Error: Invalid path type**\n\nThe path "${params.path}" is neither a file nor a directory. Please check:\n- Path points to a valid file or directory\n- No special characters or invalid path format\n\n*Retry with a valid file or directory path.*`,
          size: 0,
          lastModified: new Date().toISOString(),
          encoding,
          totalLines: 0,
          isPartial: false,
          message: 'Invalid path type - please retry with valid file or directory path'
        });
      }

      return await this.handleFileRead(request.id, targetPath, params, stats, encoding);

    } catch (error) {
      // Convert all errors to content responses for AI to understand and retry
      let errorContent = '';
      let errorMessage = '';

      if (error instanceof Error) {
        if (error.message.includes('EACCES')) {
          errorContent = `❌ **Error: Permission denied**\n\nAccess to "${params.path}" was denied. Please check:\n- File/directory permissions\n- Try a different file or directory you have access to\n- Use sudo if necessary (for system files)\n\n*Retry with a file you have read permissions for.*`;
          errorMessage = 'Permission denied - please retry with accessible file';
        } else if (error.message.includes('ENOENT')) {
          errorContent = `❌ **Error: File not found**\n\nThe file "${params.path}" does not exist. Please check:\n- File name spelling\n- File location and path\n- File may have been moved or deleted\n\n*Retry with the correct file path.*`;
          errorMessage = 'File not found - please retry with correct path';
        } else {
          errorContent = `❌ **Error: Failed to read file**\n\nFailed to read "${params.path}": ${error.message}\n\nPossible solutions:\n- Check if the file is corrupted\n- Try a different encoding format\n- Verify file permissions\n- Try reading a different file\n\n*Retry with adjusted parameters or a different file.*`;
          errorMessage = `Read failed: ${error.message} - please retry with different parameters`;
        }
      } else {
        errorContent = `❌ **Error: Unknown error**\n\nAn unknown error occurred while reading "${params.path}": ${String(error)}\n\n*Please retry with a different file or check the path.*`;
        errorMessage = 'Unknown error - please retry with different file';
      }

      return this.createSuccessResponse(request.id, {
        content: errorContent,
        size: 0,
        lastModified: new Date().toISOString(),
        encoding,
        totalLines: 0,
        isPartial: false,
        message: errorMessage
      });
    }
  }

  private async handleDirectoryRead(requestId: string, dirPath: string): Promise<MCPResponse> {
    try {
      const result = this.buildDirectoryTree(dirPath);
      return this.createSuccessResponse(requestId, result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return this.createSuccessResponse(requestId, {
        path: dirPath,
        items: [],
        totalFiles: 0,
        totalDirectories: 0,
        structure: `❌ **Error: Failed to read directory**\n\nFailed to read directory "${dirPath}": ${errorMessage}\n\nPossible solutions:\n- Check directory permissions\n- Verify the directory path is correct\n- Try a different directory you have access to\n- Use a parent directory path\n\nSuggestions:\n- Try reading individual files instead of the directory\n- Use a different directory path\n- Check if the directory exists and is accessible\n\n*Retry with a different directory path or read specific files directly.*`
      });
    }
  }

  private buildDirectoryTree(dirPath: string, maxDepth: number = 10, currentDepth: number = 0): DirectoryResult {
    const items: DirectoryItem[] = [];
    let totalFiles = 0;
    let totalDirectories = 0;

    // Prevent infinite recursion
    if (currentDepth >= maxDepth) {
      return {
        path: dirPath,
        items: [],
        totalFiles: 0,
        totalDirectories: 0,
        structure: `*Max depth (${maxDepth}) reached, stopping recursion*`
      };
    }

    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });

      // Process directory entries
      for (const entry of entries) {
        // Skip hidden files and common build/cache directories
        if (this.shouldSkipEntry(entry.name)) {
          continue;
        }

        const fullPath = path.join(dirPath, entry.name);

        try {
          if (entry.isDirectory()) {
            totalDirectories++;
            items.push({
              name: entry.name,
              type: 'directory',
              path: fullPath
            });

            // Recursively get subdirectory info
            const subResult = this.buildDirectoryTree(fullPath, maxDepth, currentDepth + 1);
            totalFiles += subResult.totalFiles;
            totalDirectories += subResult.totalDirectories;

          } else if (entry.isFile()) {
            totalFiles++;
            const stats = fs.statSync(fullPath);
            items.push({
              name: entry.name,
              type: 'file',
              path: fullPath,
              size: stats.size,
              lastModified: stats.mtime.toISOString()
            });
          }
        } catch (entryError) {
          // Skip entries that can't be accessed (permission issues, etc.)
          continue;
        }
      }

      // Sort items: directories first, then files, both alphabetically
      items.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });

    } catch (error) {
      // If we can't read the directory, return basic info
      return {
        path: dirPath,
        items: [],
        totalFiles: 0,
        totalDirectories: 0,
        structure: `*Unable to read directory: ${error instanceof Error ? error.message : 'Unknown error'}*`
      };
    }

    // Generate markdown directory structure
    const structure = this.generateRecursiveDirectoryMarkdown(dirPath, maxDepth);

    return {
      path: dirPath,
      items,
      totalFiles,
      totalDirectories,
      structure
    };
  }

  private shouldSkipEntry(name: string): boolean {
    // Skip hidden files and common build/cache directories
    const skipPatterns = [
      /^\./,                    // Hidden files (starting with .)
      /^node_modules$/,         // Node.js dependencies
      /^dist$/,                 // Build output
      /^build$/,                // Build output
      /^\.git$/,                // Git directory
      /^\.vscode$/,             // VS Code settings
      /^\.idea$/,               // IntelliJ settings
      /^coverage$/,             // Test coverage
      /^\.nyc_output$/,         // Coverage output
      /^logs$/,                 // Log files
      /^tmp$/,                  // Temporary files
      /^temp$/,                 // Temporary files
    ];

    return skipPatterns.some(pattern => pattern.test(name));
  }

  private isCodeFile(fileName: string): boolean {
    const codeExtensions = [
      // JavaScript/TypeScript
      '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
      // Python
      '.py', '.pyx', '.pyi',
      // Java/Kotlin/Scala
      '.java', '.kt', '.scala',
      // C/C++/C#
      '.c', '.cpp', '.cxx', '.cc', '.h', '.hpp', '.hxx', '.cs',
      // Go
      '.go',
      // Rust
      '.rs',
      // PHP
      '.php', '.phtml',
      // Ruby
      '.rb', '.rbw',
      // Swift
      '.swift',
      // Dart
      '.dart',
      // HTML/CSS/XML
      '.html', '.htm', '.css', '.scss', '.sass', '.less', '.xml', '.xhtml',
      // Configuration files
      '.json', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf',
      // Shell scripts
      '.sh', '.bash', '.zsh', '.fish', '.ps1', '.bat', '.cmd',
      // SQL
      '.sql',
      // Markdown and documentation
      '.md', '.markdown', '.txt', '.rst', '.asciidoc',
      // Other common code files
      '.vue', '.svelte', '.elm', '.clj', '.cljs', '.ex', '.exs', '.erl', '.hrl',
      '.pl', '.pm', '.r', '.R', '.m', '.mm', '.f', '.f90', '.f95', '.f03', '.f08'
    ];

    const ext = path.extname(fileName).toLowerCase();
    return codeExtensions.includes(ext);
  }

  private getFileInfo(filePath: string, stats: fs.Stats): string {
    const fileName = path.basename(filePath);

    if (this.isCodeFile(fileName)) {
      // For code files, show line count
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lineCount = content.split('\n').length;
        return `${lineCount} lines`;
      } catch (error) {
        // If can't read file, fall back to size
        return this.formatFileSize(stats.size);
      }
    } else {
      // For non-code files (images, videos, binaries, etc.), show file size
      return this.formatFileSize(stats.size);
    }
  }

  private generateRecursiveDirectoryMarkdown(dirPath: string, maxDepth: number = 10): string {
    const lines: string[] = [];
    lines.push(`# Directory Structure: ${path.basename(dirPath)}`);
    lines.push('');
    lines.push(`**Path:** \`${dirPath}\`\n`);

    // Generate tree structure
    const treeLines = this.generateDirectoryTree(dirPath, '', true, maxDepth, 0);

    if (treeLines.length === 0) {
      lines.push('*Empty directory*');
      return lines.join('\n');
    }

    lines.push('## Tree Structure');
    lines.push('');
    lines.push('```');
    lines.push(`${path.basename(dirPath)}/`);
    lines.push(...treeLines);
    lines.push('```');
    lines.push('');

    // Add summary
    const summary = this.getDirectorySummary(dirPath, maxDepth, 0);
    lines.push(`**Summary:** ${summary.totalDirectories} directories, ${summary.totalFiles} files`);
    lines.push('');
    lines.push('> **Tip:** Use the `read_file` tool with specific file paths to read their contents, or with directory paths to explore specific subdirectories.');
    lines.push('\n');
    lines.push('> **Suggestion:** It is recommended to read 300 lines at a time when reading a file (e.g., `Once: startLine: 1, endLine: 300`, `Twice: startLine: 301, endLine: 600`, `Three times: startLine: 601, endLine: 900`). If the file contains too much content, it can be read in multiple times.');

    return lines.join('\n');
  }

  private generateDirectoryTree(
    dirPath: string,
    prefix: string,
    isLast: boolean,
    maxDepth: number,
    currentDepth: number
  ): string[] {
    const lines: string[] = [];

    // Prevent infinite recursion
    if (currentDepth >= maxDepth) {
      lines.push(`${prefix}${isLast ? '└── ' : '├── '}... (max depth reached)`);
      return lines;
    }

    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true })
        .filter(entry => !this.shouldSkipEntry(entry.name))
        .sort((a, b) => {
          // Directories first, then files
          if (a.isDirectory() && !b.isDirectory()) return -1;
          if (!a.isDirectory() && b.isDirectory()) return 1;
          return a.name.localeCompare(b.name);
        });

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const isLastEntry = i === entries.length - 1;
        const entryPrefix = prefix + (isLast ? '    ' : '│   ');
        const connector = isLastEntry ? '└── ' : '├── ';

        try {
          if (entry.isDirectory()) {
            lines.push(`${prefix}${connector}${entry.name}/`);

            // Recursively process subdirectory
            const subDirPath = path.join(dirPath, entry.name);
            const subLines = this.generateDirectoryTree(
              subDirPath,
              entryPrefix,
              isLastEntry,
              maxDepth,
              currentDepth + 1
            );
            lines.push(...subLines);

          } else if (entry.isFile()) {
            const filePath = path.join(dirPath, entry.name);
            const stats = fs.statSync(filePath);
            const fileInfo = this.getFileInfo(filePath, stats);
            lines.push(`${prefix}${connector}${entry.name} (${fileInfo})`);
          }
        } catch (entryError) {
          // Skip entries that can't be accessed
          lines.push(`${prefix}${connector}${entry.name} (access denied)`);
        }
      }

    } catch (error) {
      lines.push(`${prefix}${isLast ? '└── ' : '├── '}(unable to read directory)`);
    }

    return lines;
  }

  private getDirectorySummary(dirPath: string, maxDepth: number, currentDepth: number): { totalFiles: number; totalDirectories: number } {
    let totalFiles = 0;
    let totalDirectories = 0;

    if (currentDepth >= maxDepth) {
      return { totalFiles: 0, totalDirectories: 0 };
    }

    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true })
        .filter(entry => !this.shouldSkipEntry(entry.name));

      for (const entry of entries) {
        try {
          if (entry.isDirectory()) {
            totalDirectories++;
            const subResult = this.getDirectorySummary(
              path.join(dirPath, entry.name),
              maxDepth,
              currentDepth + 1
            );
            totalFiles += subResult.totalFiles;
            totalDirectories += subResult.totalDirectories;
          } else if (entry.isFile()) {
            totalFiles++;
          }
        } catch (entryError) {
          // Skip entries that can't be accessed
        }
      }
    } catch (error) {
      // Can't read directory
    }

    return { totalFiles, totalDirectories };
  }

  private formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  }

  private async handleFileRead(
    requestId: string,
    filePath: string,
    params: ReadFileParams,
    stats: fs.Stats,
    encoding: string
  ): Promise<MCPResponse> {
    // Check file size limit (50MB for safety)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (stats.size > maxSize) {
      const sizeInMB = (stats.size / (1024 * 1024)).toFixed(1);
      return this.createSuccessResponse(requestId, {
        content: `❌ **Error: File too large**\n\nThe file "${params.path}" is ${sizeInMB}MB, which exceeds the 50MB safety limit.\n\nSuggestions:\n- Try reading specific line ranges instead of the entire file\n- Use startLine and endLine parameters to read smaller sections\n- Split large files into smaller chunks\n- Choose a smaller file to read\n\n*Retry with specific line ranges (e.g., startLine: 1, endLine: 100) to read manageable portions.*`,
        size: stats.size,
        lastModified: stats.mtime.toISOString(),
        encoding,
        totalLines: 0,
        isPartial: false,
        message: `File too large (${sizeInMB}MB) - please retry with specific line ranges`
      });
    }

    // Read the full file content first
    const fullContent = fs.readFileSync(filePath, encoding as BufferEncoding);
    const allLines = fullContent.split('\n');
    const totalLines = allLines.length;

    // Determine line range
    // For file reading, startLine and endLine are required parameters
    // If somehow they're missing, use defaults (though this shouldn't happen due to required field validation)
    const startLine = Math.max(1, params.startLine || 1);
    const endLine = Math.min(totalLines, params.endLine || totalLines);

    if (startLine > totalLines) {
      return this.createSuccessResponse(requestId, {
        content: `❌ **Error: Invalid line range**\n\nStart line ${startLine} exceeds the total number of lines (${totalLines}) in "${params.path}".\n\nFile info:\n- Total lines: ${totalLines}\n- Requested start line: ${startLine}\n\nSuggestions:\n- Use startLine between 1 and ${totalLines}\n- Try startLine: 1, endLine: ${totalLines} to read the entire file\n- Use smaller line ranges for better performance\n\n*Retry with startLine ≤ ${totalLines}.*`,
        size: stats.size,
        lastModified: stats.mtime.toISOString(),
        encoding,
        totalLines,
        isPartial: false,
        message: `Start line ${startLine} exceeds total lines ${totalLines} - please retry with valid range`
      });
    }

    if (startLine > endLine) {
      return this.createSuccessResponse(requestId, {
        content: `❌ **Error: Invalid line range**\n\nStart line (${startLine}) cannot be greater than end line (${endLine}).\n\nFile info:\n- Total lines: ${totalLines}\n- Requested range: ${startLine} to ${endLine}\n\nSuggestions:\n- Ensure startLine ≤ endLine\n- Try endLine: ${Math.min(startLine + 100, totalLines)} for a reasonable range\n- Use startLine: 1, endLine: 50 for the first 50 lines\n\n*Retry with startLine ≤ endLine.*`,
        size: stats.size,
        lastModified: stats.mtime.toISOString(),
        encoding,
        totalLines,
        isPartial: false,
        message: `Start line ${startLine} > end line ${endLine} - please retry with valid range`
      });
    }

    // Extract requested lines (convert to 0-based indexing)
    const selectedLines = allLines.slice(startLine - 1, endLine);
    let content = selectedLines.join('\n');

    // Add line numbers to content
    const numberedLines = selectedLines.map((line, index) => {
      const lineNumber = startLine + index;
      return `${lineNumber.toString().padStart(4, ' ')}: ${line}`;
    });
    const numberedContent = numberedLines.join('\n');

    // Calculate tokens for the content
    const contentTokens = TokenCalculator.calculateTokens(numberedContent);

    // Get max allowed tokens (80% of context limit)
    const apiConfig = StorageService.getApiConfig();
    const maxContextTokens = apiConfig.contextTokens || 128000;
    const maxAllowedTokens = Math.floor(maxContextTokens * 0.8);

    let finalContent = numberedContent;
    let isPartial = false;
    let actualEndLine = endLine;
    let message = '';

    // If content exceeds token limit, trim it line by line
    if (contentTokens > maxAllowedTokens) {
      const availableLines: string[] = [];
      let currentTokens = 0;

      for (let i = 0; i < numberedLines.length; i++) {
        const lineWithNumber = numberedLines[i];
        const lineTokens = TokenCalculator.calculateTokens(lineWithNumber + '\n');

        if (currentTokens + lineTokens <= maxAllowedTokens) {
          availableLines.push(lineWithNumber);
          currentTokens += lineTokens;
        } else {
          break;
        }
      }

      if (availableLines.length === 0) {
        return this.createSuccessResponse(requestId, {
          content: `❌ **Error: Content too large for token limit**\n\nEven the first line of "${params.path}" (line ${startLine}) exceeds the token limit (${maxAllowedTokens} tokens).\n\nFile info:\n- Requested range: lines ${startLine}-${endLine}\n- Total lines: ${totalLines}\n- First line is too long for processing\n\nSuggestions:\n- Try reading a different file with shorter lines\n- Look for files with simpler content structure\n- Check if the file contains very long lines of data\n\n*Retry with a different file or check the file content structure.*`,
          size: stats.size,
          lastModified: stats.mtime.toISOString(),
          encoding,
          totalLines,
          isPartial: true,
          message: 'First line exceeds token limit - please retry with different file'
        });
      }

      finalContent = availableLines.join('\n');
      actualEndLine = startLine + availableLines.length - 1;
      isPartial = true;

      const remainingLines = endLine - actualEndLine;
      message = `⚠️ Content truncated due to token limit (${maxAllowedTokens} tokens). ` +
        `Showing lines ${startLine}-${actualEndLine} of ${startLine}-${endLine}. ` +
        `${remainingLines} lines remaining. Use startLine=${actualEndLine + 1} to continue reading.`;
    }

    // Add intelligent reading suggestions to the content
    let enhancedContent = finalContent;
    
    // Add helpful navigation information at the end
    const navigationInfo = this.generateNavigationSuggestions(
      params.path, 
      startLine, 
      actualEndLine, 
      totalLines, 
      isPartial
    );
    
    enhancedContent += '\n\n' + navigationInfo;

    const result: ReadFileResult = {
      content: enhancedContent,
      size: stats.size,
      lastModified: stats.mtime.toISOString(),
      encoding,
      totalLines,
      lineRange: {
        start: startLine,
        end: actualEndLine
      },
      hasMore: actualEndLine < totalLines,
      tokenCount: TokenCalculator.calculateTokens(enhancedContent),
      isPartial,
      message: message || undefined
    };

    return this.createSuccessResponse(requestId, result);
  }

  /**
   * Generate intelligent navigation suggestions for continued reading
   */
  private generateNavigationSuggestions(
    filePath: string, 
    startLine: number, 
    endLine: number, 
    totalLines: number, 
    isPartial: boolean
  ): string {
    const suggestions: string[] = [];
    
    suggestions.push('---');
    suggestions.push('');
    suggestions.push('📖 **Reading Guide & Navigation**');
    suggestions.push('');
    
    // File overview
    suggestions.push(`**File:** \`${filePath}\``);
    suggestions.push(`**Current Section:** Lines ${startLine}-${endLine} of ${totalLines}`);
    suggestions.push(`**Progress:** ${Math.round((endLine / totalLines) * 100)}% of file read`);
    suggestions.push('');

    // Reading suggestions based on current position and remaining content
    if (endLine < totalLines) {
      const remainingLines = totalLines - endLine;
      suggestions.push('🔄 **Continue Reading Options:**');
      suggestions.push('');
      
      if (remainingLines <= 300) {
        // Few lines remaining - read all
        suggestions.push(`• **Read remaining content:** \`startLine: ${endLine + 1}, endLine: ${totalLines}\``);
      } else {
        // Many lines remaining - suggest chunks
        const nextChunkEnd = Math.min(endLine + 300, totalLines);
        suggestions.push(`• **Next 300 lines:** \`startLine: ${endLine + 1}, endLine: ${nextChunkEnd}\``);
        
        if (totalLines - nextChunkEnd > 0) {
          const finalChunkStart = Math.max(totalLines - 200, nextChunkEnd + 1);
          suggestions.push(`• **Jump to end (last 200 lines):** \`startLine: ${finalChunkStart}, endLine: ${totalLines}\``);
        }
        
        // Middle section suggestion
        if (totalLines > 600) {
          const middleStart = Math.floor(totalLines * 0.4);
          const middleEnd = Math.min(middleStart + 300, totalLines);
          suggestions.push(`• **Middle section:** \`startLine: ${middleStart}, endLine: ${middleEnd}\``);
        }
      }
      suggestions.push('');
    }

    // Targeted reading suggestions
    suggestions.push('🎯 **Smart Reading Strategies:**');
    suggestions.push('');
    
    if (startLine === 1) {
      // Reading from beginning
      suggestions.push('• You are reading from the **beginning** of the file');
      suggestions.push('• Look for imports, declarations, and main structure');
      if (endLine < totalLines) {
        suggestions.push('• Continue reading to find function implementations and logic');
      }
    } else if (endLine >= totalLines) {
      // Reading at the end
      suggestions.push('• You are at the **end** of the file');
      suggestions.push('• This section likely contains final implementations or exports');
      if (startLine > 1) {
        suggestions.push('• Consider reading earlier sections for context if needed');
      }
    } else {
      // Reading middle section
      suggestions.push('• You are reading a **middle section** of the file');
      suggestions.push('• This may contain specific implementations or class methods');
      suggestions.push('• Read beginning for context or continue forward for more details');
    }
    suggestions.push('');

    // Conditional suggestions based on content
    suggestions.push('💡 **If current content doesn\'t answer your question:**');
    suggestions.push('');
    suggestions.push('1. **Search for specific functions/classes** - Continue reading different sections');
    suggestions.push('2. **Check imports and dependencies** - Read the beginning (lines 1-50)');
    suggestions.push('3. **Look for main logic** - Read middle sections or search for key terms');
    suggestions.push('4. **Find exports and conclusions** - Read the end of the file');
    suggestions.push('5. **Read related files** - Use directory browsing to find connected files');
    suggestions.push('');

    if (isPartial) {
      suggestions.push('⚠️ **Note:** Content was truncated due to token limits. Continue reading in smaller chunks for complete information.');
      suggestions.push('');
    }

    // Quick access templates
    suggestions.push('📋 **Quick Copy Templates:**');
    suggestions.push('');
    suggestions.push('```');
    if (endLine < totalLines) {
      const nextEnd = Math.min(endLine + 300, totalLines);
      suggestions.push(`Continue: startLine: ${endLine + 1}, endLine: ${nextEnd}`);
    }
    if (startLine > 1) {
      const prevStart = Math.max(1, startLine - 300);
      suggestions.push(`Previous: startLine: ${prevStart}, endLine: ${startLine - 1}`);
    }
    suggestions.push(`Full file: startLine: 1, endLine: ${totalLines}`);
    suggestions.push('```');

    return suggestions.join('\n');
  }
} 