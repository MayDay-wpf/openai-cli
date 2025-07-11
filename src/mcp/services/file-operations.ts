import * as fs from 'fs';
import * as path from 'path';
import { BaseMCPService } from '../base-service';
import { 
  MCPRequest, 
  MCPResponse, 
  MCPTool, 
  CreateFileParams, 
  DeleteFileParams, 
  CreateDirectoryParams,
  FileOperationResult 
} from '../types';

// File operations MCP service for creating and deleting files/directories
export class FileOperationsService extends BaseMCPService {
  constructor() {
    super('file-operations', '1.0.0');
  }

  getTools(): MCPTool[] {
    return [
      {
        name: 'create_file',
        description: 'Create a new file with optional content. Will create parent directories if they don\'t exist.',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'File path to create (supports both relative and absolute paths)'
            },
            content: {
              type: 'string',
              description: 'File content to write. If not provided, creates an empty file.',
              default: ''
            },
            encoding: {
              type: 'string',
              description: 'File encoding format',
              default: 'utf8',
              enum: ['utf8', 'ascii', 'base64', 'hex', 'binary']
            }
          },
          required: ['path']
        }
      },
      {
        name: 'delete_file',
        description: 'Delete a file or directory. Use recursive option for non-empty directories.',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'File or directory path to delete (supports both relative and absolute paths)'
            },
            recursive: {
              type: 'boolean',
              description: 'Allow deletion of directories and their contents. Required for non-empty directories.',
              default: false
            }
          },
          required: ['path']
        }
      },
      {
        name: 'create_directory',
        description: 'Create a new directory. Can create parent directories if they don\'t exist.',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Directory path to create (supports both relative and absolute paths)'
            },
            recursive: {
              type: 'boolean',
              description: 'Create parent directories if they don\'t exist',
              default: true
            }
          },
          required: ['path']
        }
      }
    ];
  }

  async handleRequest(request: MCPRequest): Promise<MCPResponse> {
    try {
      switch (request.method) {
        case 'create_file':
          return await this.handleCreateFile(request);
        case 'delete_file':
          return await this.handleDeleteFile(request);
        case 'create_directory':
          return await this.handleCreateDirectory(request);
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

  private async handleCreateFile(request: MCPRequest): Promise<MCPResponse> {
    const validationError = this.validateParams(request.params, ['path']);
    if (validationError) {
      return this.createErrorResponse(request.id, -32602, validationError);
    }

    const params: CreateFileParams = request.params;
    const content = params.content || '';
    const encoding = params.encoding || 'utf8';

    try {
      const targetPath = path.resolve(params.path);
      const parentDir = path.dirname(targetPath);

      // Check if file already exists
      if (fs.existsSync(targetPath)) {
        return this.createSuccessResponse(request.id, {
          success: false,
          operation: 'create_file',
          path: targetPath,
          message: `❌ **Error: File already exists**\n\nThe file "${params.path}" already exists.\n\nOptions:\n- Choose a different filename\n- Delete the existing file first using delete_file\n- Use a different directory\n\n*Retry with a different path or delete the existing file first.*`,
          details: {}
        });
      }

      // Create parent directories if they don't exist
      let parentCreated = false;
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
        parentCreated = true;
      }

      // Create the file
      fs.writeFileSync(targetPath, content, encoding as BufferEncoding);
      const stats = fs.statSync(targetPath);

      const result: FileOperationResult = {
        success: true,
        operation: 'create_file',
        path: targetPath,
        message: `✅ **File created successfully**\n\n**File:** \`${targetPath}\`\n**Size:** ${this.formatFileSize(stats.size)}\n**Content:** ${content.length > 0 ? `${content.length} characters` : 'Empty file'}\n${parentCreated ? '**Parent directories:** Created automatically\n' : ''}\n*File is ready for use.*`,
        details: {
          size: stats.size,
          created: stats.birthtime.toISOString(),
          parent_created: parentCreated
        }
      };

      return this.createSuccessResponse(request.id, result);

    } catch (error) {
      return this.handleFileOperationError(request.id, 'create_file', params.path, error);
    }
  }

  private async handleDeleteFile(request: MCPRequest): Promise<MCPResponse> {
    const validationError = this.validateParams(request.params, ['path']);
    if (validationError) {
      return this.createErrorResponse(request.id, -32602, validationError);
    }

    const params: DeleteFileParams = request.params;
    const recursive = params.recursive || false;

    try {
      const targetPath = path.resolve(params.path);

      // Check if path exists
      if (!fs.existsSync(targetPath)) {
        return this.createSuccessResponse(request.id, {
          success: false,
          operation: 'delete_file',
          path: targetPath,
          message: `❌ **Error: Path does not exist**\n\nThe path "${params.path}" was not found.\n\nPossible issues:\n- File/directory name spelling\n- File/directory may have been already deleted\n- Incorrect path\n\n*Verify the path and try again.*`,
          details: {}
        });
      }

      const stats = fs.statSync(targetPath);
      let filesDeleted = 0;
      let directoriesDeleted = 0;

      if (stats.isDirectory()) {
        // Handle directory deletion
        const items = fs.readdirSync(targetPath);
        
        if (items.length > 0 && !recursive) {
          return this.createSuccessResponse(request.id, {
            success: false,
            operation: 'delete_directory',
            path: targetPath,
            message: `❌ **Error: Directory not empty**\n\nThe directory "${params.path}" contains ${items.length} items and cannot be deleted without the recursive option.\n\nOptions:\n- Use \`recursive: true\` to delete directory and all contents\n- Manually delete all contents first\n- Delete individual files/subdirectories\n\n*Retry with recursive: true to delete all contents.*`,
            details: {}
          });
        }

        // Count items for reporting
        if (recursive) {
          const counts = this.countDirectoryItems(targetPath);
          filesDeleted = counts.files;
          directoriesDeleted = counts.directories;
        }

        // Delete directory
        fs.rmSync(targetPath, { recursive, force: true });

        const result: FileOperationResult = {
          success: true,
          operation: 'delete_directory',
          path: targetPath,
          message: `✅ **Directory deleted successfully**\n\n**Directory:** \`${targetPath}\`\n${recursive ? `**Items deleted:** ${filesDeleted} files, ${directoriesDeleted} directories\n` : '**Status:** Empty directory removed\n'}\n*Directory and contents have been permanently deleted.*`,
          details: {
            files_deleted: filesDeleted,
            directories_deleted: directoriesDeleted
          }
        };

        return this.createSuccessResponse(request.id, result);

      } else {
        // Handle file deletion
        const fileSize = stats.size;
        fs.unlinkSync(targetPath);

        const result: FileOperationResult = {
          success: true,
          operation: 'delete_file',
          path: targetPath,
          message: `✅ **File deleted successfully**\n\n**File:** \`${targetPath}\`\n**Size:** ${this.formatFileSize(fileSize)}\n\n*File has been permanently deleted.*`,
          details: {}
        };

        return this.createSuccessResponse(request.id, result);
      }

    } catch (error) {
      return this.handleFileOperationError(request.id, 'delete_file', params.path, error);
    }
  }

  private async handleCreateDirectory(request: MCPRequest): Promise<MCPResponse> {
    const validationError = this.validateParams(request.params, ['path']);
    if (validationError) {
      return this.createErrorResponse(request.id, -32602, validationError);
    }

    const params: CreateDirectoryParams = request.params;
    const recursive = params.recursive !== undefined ? params.recursive : true;

    try {
      const targetPath = path.resolve(params.path);

      // Check if directory already exists
      if (fs.existsSync(targetPath)) {
        const stats = fs.statSync(targetPath);
        if (stats.isDirectory()) {
          return this.createSuccessResponse(request.id, {
            success: false,
            operation: 'create_directory',
            path: targetPath,
            message: `❌ **Error: Directory already exists**\n\nThe directory "${params.path}" already exists.\n\nOptions:\n- Use the existing directory\n- Choose a different directory name\n- Delete the existing directory first (if empty)\n\n*Directory is already available for use.*`,
            details: {}
          });
        } else {
          return this.createSuccessResponse(request.id, {
            success: false,
            operation: 'create_directory',
            path: targetPath,
            message: `❌ **Error: Path exists as file**\n\nThe path "${params.path}" already exists as a file, not a directory.\n\nOptions:\n- Choose a different directory name\n- Delete the existing file first\n- Use a different path\n\n*Retry with a different path.*`,
            details: {}
          });
        }
      }

      // Check parent directory
      const parentDir = path.dirname(targetPath);
      let parentCreated = false;

      if (!recursive && !fs.existsSync(parentDir)) {
        return this.createSuccessResponse(request.id, {
          success: false,
          operation: 'create_directory',
          path: targetPath,
          message: `❌ **Error: Parent directory does not exist**\n\nThe parent directory for "${params.path}" does not exist and recursive is disabled.\n\nOptions:\n- Use \`recursive: true\` to create parent directories\n- Create parent directories manually first\n- Choose a path with existing parent directories\n\n*Retry with recursive: true or create parent directories first.*`,
          details: {}
        });
      }

      // Create directory
      if (recursive && !fs.existsSync(parentDir)) {
        parentCreated = true;
      }

      fs.mkdirSync(targetPath, { recursive });
      const stats = fs.statSync(targetPath);

      const result: FileOperationResult = {
        success: true,
        operation: 'create_directory',
        path: targetPath,
        message: `✅ **Directory created successfully**\n\n**Directory:** \`${targetPath}\`\n**Created:** ${stats.birthtime.toISOString()}\n${parentCreated ? '**Parent directories:** Created automatically\n' : ''}\n*Directory is ready for use.*`,
        details: {
          created: stats.birthtime.toISOString(),
          parent_created: parentCreated
        }
      };

      return this.createSuccessResponse(request.id, result);

    } catch (error) {
      return this.handleFileOperationError(request.id, 'create_directory', params.path, error);
    }
  }

  private handleFileOperationError(
    requestId: string, 
    operation: string, 
    filePath: string, 
    error: unknown
  ): MCPResponse {
    let errorContent = '';
    let errorMessage = '';

    if (error instanceof Error) {
      if (error.message.includes('EACCES')) {
        errorContent = `❌ **Error: Permission denied**\n\nAccess to "${filePath}" was denied.\n\nPossible solutions:\n- Check file/directory permissions\n- Try a different location you have write access to\n- Run with appropriate permissions\n- Choose a different path\n\n*Retry with a path you have write permissions for.*`;
        errorMessage = 'Permission denied - please retry with accessible path';
      } else if (error.message.includes('ENOENT')) {
        errorContent = `❌ **Error: Path not found**\n\nThe path "${filePath}" or its parent directory does not exist.\n\nPossible solutions:\n- Check the path spelling\n- Create parent directories first\n- Use recursive option for directory creation\n- Use an existing path\n\n*Retry with correct path or create parent directories first.*`;
        errorMessage = 'Path not found - please retry with correct path';
      } else if (error.message.includes('ENOTDIR')) {
        errorContent = `❌ **Error: Not a directory**\n\nA component in the path "${filePath}" is not a directory.\n\nPossible solutions:\n- Check the path structure\n- Ensure all parent components are directories\n- Use a different path\n- Remove conflicting files\n\n*Retry with a valid directory path.*`;
        errorMessage = 'Invalid directory path - please retry with correct structure';
      } else if (error.message.includes('EEXIST')) {
        errorContent = `❌ **Error: Already exists**\n\nThe path "${filePath}" already exists.\n\nPossible solutions:\n- Choose a different name\n- Delete the existing file/directory first\n- Use a different location\n- Check if you meant to modify instead of create\n\n*Retry with a different path or remove existing item first.*`;
        errorMessage = 'Path already exists - please retry with different name';
      } else {
        errorContent = `❌ **Error: Operation failed**\n\nFailed to ${operation.replace('_', ' ')} "${filePath}": ${error.message}\n\nPossible solutions:\n- Check file system permissions\n- Verify available disk space\n- Try a different path\n- Check for file locks or conflicts\n\n*Retry with different parameters or check system status.*`;
        errorMessage = `${operation} failed: ${error.message} - please retry with different parameters`;
      }
    } else {
      errorContent = `❌ **Error: Unknown error**\n\nAn unknown error occurred while trying to ${operation.replace('_', ' ')} "${filePath}": ${String(error)}\n\n*Please retry with different parameters or check the system.*`;
      errorMessage = 'Unknown error - please retry with different parameters';
    }

    const result: FileOperationResult = {
      success: false,
      operation: operation as any,
      path: filePath,
      message: errorContent,
      details: {}
    };

    return this.createSuccessResponse(requestId, result);
  }

  private countDirectoryItems(dirPath: string): { files: number; directories: number } {
    let files = 0;
    let directories = 0;

    try {
      const items = fs.readdirSync(dirPath, { withFileTypes: true });
      
      for (const item of items) {
        if (item.isFile()) {
          files++;
        } else if (item.isDirectory()) {
          directories++;
          const subCounts = this.countDirectoryItems(path.join(dirPath, item.name));
          files += subCounts.files;
          directories += subCounts.directories;
        }
      }
    } catch (error) {
      // If we can't read a directory, just return current counts
    }

    return { files, directories };
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
} 