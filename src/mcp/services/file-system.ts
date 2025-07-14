import { highlight } from 'cli-highlight';
import { createPatch } from 'diff';
import * as fs from 'fs';
import * as path from 'path';
import { StorageService } from '../../services/storage';
import { getLanguageForFile } from '../../utils/file-types';
import { BaseMCPService } from '../base-service';
import {
    CreateDirectoryParams,
    CreateFileParams,
    DeleteFileParams,
    EditFileParams,
    MCPRequest,
    MCPResponse,
    MCPTool,
    ReadFileParams
} from '../types';

// Unified file system MCP service combining reading, operations, and editing
export class FileSystemService extends BaseMCPService {
    constructor() {
        super('file-system', '1.0.0');
    }

    getTools(): MCPTool[] {
        return [
            // File reading tools
            {
                name: 'read_file',
                description: 'Read a specific range of lines from a file to understand its content. For optimal performance and context, it is recommended to read about 300 lines at a time. The response will include line numbers.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        path: {
                            type: 'string',
                            description: 'File path to read (supports both relative and absolute paths). Example: "src/utils/helpers.ts"'
                        },
                        encoding: {
                            type: 'string',
                            description: 'File encoding format. Example: "utf8"',
                            default: 'utf8',
                            enum: ['utf8', 'ascii', 'base64', 'hex', 'binary']
                        },
                        startLine: {
                            type: 'number',
                            description: 'Starting line number (1-based) for reading. Example: 1',
                            minimum: 1
                        },
                        endLine: {
                            type: 'number',
                            description: 'Ending line number (1-based) for reading. Example: 300',
                            minimum: 1
                        }
                    },
                    required: ['path', 'startLine', 'endLine']
                }
            },
            {
                name: 'list_directory',
                description: 'List the contents of a directory to understand the project structure. Provides a tree view and detailed file information.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        path: {
                            type: 'string',
                            description: 'Directory path to list (supports both relative and absolute paths). Example: "src/services/"',
                            default: '.'
                        }
                    },
                    required: ['path']
                }
            },
            // File operation tools
            {
                name: 'create_file',
                description: 'Create a new file with optional content. This is useful for adding new features or modules to the project. Parent directories will be created if they do not exist. If the file content is large, you can create part of the content first, and then call the `edit_file` tool to edit the file.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        path: {
                            type: 'string',
                            description: 'File path to create. Example: "src/new_feature/main.ts"'
                        },
                        content: {
                            type: 'string',
                            description: 'Initial content for the file. Can be empty. Example: "export function newFunc() { console.log(\'hello\'); }"',
                            default: ''
                        },
                        encoding: {
                            type: 'string',
                            description: 'File encoding format. Example: "utf8"',
                            default: 'utf8',
                            enum: ['utf8', 'ascii', 'base64', 'hex', 'binary']
                        }
                    },
                    required: ['path']
                }
            },
            {
                name: 'delete_file',
                description: 'Delete a file or an entire directory. Use with caution, as this operation is permanent. The `recursive` option must be used for non-empty directories.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        path: {
                            type: 'string',
                            description: 'File or directory path to delete. Example: "src/old_feature/main.ts"'
                        },
                        recursive: {
                            type: 'boolean',
                            description: 'If true, allows deletion of non-empty directories. Example: false',
                            default: false
                        }
                    },
                    required: ['path']
                }
            },
            {
                name: 'create_directory',
                description: 'Create a new directory. This is useful for structuring new modules or features. Can create parent directories recursively by default.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        path: {
                            type: 'string',
                            description: 'Directory path to create. Example: "src/new_module/components/"'
                        },
                        recursive: {
                            type: 'boolean',
                            description: 'Create parent directories if they do not exist. Example: true',
                            default: true
                        }
                    },
                    required: ['path']
                }
            },
            // File editing tool
            {
                name: 'edit_file',
                description: 'Edit a file by replacing a specific range of lines with new content. This is the primary tool for modifying existing code. To avoid errors, it is recommended to break down large edits into several smaller, sequential calls. First, read the file to get the line numbers, then call this tool.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        path: {
                            type: 'string',
                            description: 'File path to edit. Example: "src/utils/helpers.ts"'
                        },
                        startLine: {
                            type: 'number',
                            description: 'The first line of the code to be replaced (1-based). Example: 10',
                            minimum: 1
                        },
                        endLine: {
                            type: 'number',
                            description: 'The last line of the code to be replaced (inclusive). Example: 15',
                            minimum: 1
                        },
                        newContent: {
                            type: 'string',
                            description: 'The new content to insert. Use an empty string to delete lines. Example: "const newVar = \'updated value\';"'
                        },
                        encoding: {
                            type: 'string',
                            description: 'File encoding format. Example: "utf8"',
                            default: 'utf8',
                            enum: ['utf8', 'ascii', 'base64', 'hex', 'binary']
                        }
                    },
                    required: ['path', 'startLine', 'endLine', 'newContent']
                }
            }
        ];
    }

    async handleRequest(request: MCPRequest): Promise<MCPResponse> {
        try {
            switch (request.method) {
                case 'read_file':
                    return await this.handleReadFile(request);
                case 'list_directory':
                    return await this.handleListDirectory(request);
                case 'create_file':
                    return await this.handleCreateFile(request);
                case 'delete_file':
                    return await this.handleDeleteFile(request);
                case 'create_directory':
                    return await this.handleCreateDirectory(request);
                case 'edit_file':
                    return await this.handleEditFile(request);
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

    // File reading methods
    private async handleReadFile(request: MCPRequest): Promise<MCPResponse> {
        const validationError = this.validateParams(request.params, ['path', 'startLine', 'endLine']);
        if (validationError) {
            return this.createErrorResponse(request.id, -32602, validationError);
        }

        const params: ReadFileParams = request.params;
        const encoding = params.encoding || 'utf8';

        try {
            const targetPath = path.resolve(params.path);

            if (!fs.existsSync(targetPath)) {
                return this.createSuccessResponse(request.id, `❌ **Error: File does not exist**\n\nThe file "${params.path}" was not found.\n\nPossible solutions:\n- Check the file path spelling\n- Verify the file exists\n- Use the correct relative or absolute path\n\n*Please verify the file path and try again.*`);
            }

            const stats = fs.statSync(targetPath);

            if (stats.isDirectory()) {
                return this.createSuccessResponse(request.id, `❌ **Error: Path is a directory**\n\nThe path "${params.path}" is a directory, not a file.\n\nPossible solutions:\n- Use list_directory to view directory contents\n- Specify a file path instead\n- Choose a file within this directory\n\n*Use list_directory tool for directory contents.*`);
            }

            const content = fs.readFileSync(targetPath, encoding as BufferEncoding);
            const lines = content.split('\n');
            const totalLines = lines.length;

            let finalContent = '';
            let isPartial = false;
            let lineRange: { start: number; end: number } | undefined;

            const startLine = params.startLine!;
            const endLine = params.endLine!;

            if (startLine > endLine) {
                return this.createSuccessResponse(request.id, `❌ **Error: Invalid range**\n\nStart line (${startLine}) cannot be greater than end line (${endLine}).\n\n*Please ensure startLine ≤ endLine.*`);
            }

            if (startLine > totalLines) {
                return this.createSuccessResponse(request.id, `✅ **File read successfully**\n\nStart line (${startLine}) is beyond the end of the file (total lines: ${totalLines}). Returning empty content.`);
            }

            const effectiveEndLine = Math.min(endLine, totalLines);

            const selectedLines = lines.slice(startLine - 1, effectiveEndLine);
            const contentWithLineNumbers = selectedLines
                .map((line, index) => {
                    const lineNum = startLine + index;
                    return `${lineNum.toString().padStart(5, ' ')}: ${line}`;
                })
                .join('\n');

            finalContent = contentWithLineNumbers;
            isPartial = true;
            lineRange = { start: startLine, end: effectiveEndLine };

            // Calculate token count (rough estimation)
            const tokenCount = this.estimateTokenCount(finalContent);

            const message = `✅ **File read successfully**\n\n**File:** \`${targetPath}\`\n**Size:** ${this.formatFileSize(stats.size)}\n**Lines:** ${isPartial ? `${lineRange!.start}-${lineRange!.end} of ${totalLines}` : totalLines}\n**Tokens:** ~${tokenCount}\n**Modified:** ${stats.mtime.toLocaleString()}\n\n${isPartial ? '*Partial content - use startLine/endLine to read different sections.*' : '*Complete file content loaded.*'}`;

            const response = `${message}\n\n---\n\n${finalContent}`;

            return this.createSuccessResponse(request.id, response);

        } catch (error) {
            return this.handleFileReadError(request.id, params.path, error);
        }
    }

    private async handleListDirectory(request: MCPRequest): Promise<MCPResponse> {
        const validationError = this.validateParams(request.params, ['path']);
        if (validationError) {
            return this.createErrorResponse(request.id, -32602, validationError);
        }

        const params = request.params;
        const targetPath = path.resolve(params.path);

        try {
            if (!fs.existsSync(targetPath)) {
                return this.createSuccessResponse(request.id, `❌ **Error: Directory does not exist**\n\nThe directory "${params.path}" was not found.\n\nPossible solutions:\n- Check the directory path spelling\n- Verify the directory exists\n- Use the correct relative or absolute path\n\n*Please verify the directory path and try again.*`);
            }

            const stats = fs.statSync(targetPath);
            if (!stats.isDirectory()) {
                return this.createSuccessResponse(request.id, `❌ **Error: Path is not a directory**\n\nThe path "${params.path}" is a file, not a directory.\n\nPossible solutions:\n- Use read_file to read file contents\n- Use the parent directory path\n- Choose a valid directory path\n\n*Use read_file tool for file contents.*`);
            }

            const items = fs.readdirSync(targetPath, { withFileTypes: true });
            const directoryItems = items.map(item => {
                const itemPath = path.join(targetPath, item.name);
                const itemStats = fs.statSync(itemPath);

                return {
                    name: item.name,
                    type: item.isDirectory() ? 'directory' as const : 'file' as const,
                    path: itemPath,
                    size: item.isFile() ? itemStats.size : undefined,
                    lastModified: itemStats.mtime.toISOString()
                };
            });

            const totalFiles = directoryItems.filter(item => item.type === 'file').length;
            const totalDirectories = directoryItems.filter(item => item.type === 'directory').length;

            // Generate tree structure
            const structure = this.generateDirectoryTree(targetPath, directoryItems);

            const resultMessage = `✅ **Directory listed successfully**\n\n**Path:** \`${targetPath}\`\n**Contains:** ${totalFiles} files, ${totalDirectories} directories\n\n${structure}`;

            return this.createSuccessResponse(request.id, resultMessage);

        } catch (error) {
            return this.handleFileReadError(request.id, params.path, error);
        }
    }

    // File operation methods (from file-operations.ts)
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
                return this.createSuccessResponse(request.id, `❌ **Error: File already exists**\n\nThe file "${params.path}" already exists.\n\nOptions:\n- Choose a different filename\n- Delete the existing file first using delete_file\n- Use a different directory\n\n*Retry with a different path or delete the existing file first.*`);
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

            const diff = createPatch(targetPath, '', content);
            const resultMessage = `✅ **File created successfully**\n\n**File:** \`${targetPath}\`\n**Size:** ${this.formatFileSize(stats.size)}\n**Content:** ${content.length > 0 ? `${content.length} characters` : 'Empty file'}\n${parentCreated ? '**Parent directories:** Created automatically\n' : ''}\n*File is ready for use.*`;

            // Note: 如果不是手动确认,则打印diff到控制台
            const needsConfirmation = StorageService.isFunctionConfirmationRequired('file-system_create_file');
            if (!needsConfirmation) {
                console.log(highlight(diff, { language: 'diff', ignoreIllegals: true }));
            }
            const finalMessage = `${resultMessage}\n\n**Changes:**\n\`\`\`diff\n${diff}\n\`\`\``;
            return this.createSuccessResponse(request.id, finalMessage);
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
                return this.createSuccessResponse(request.id, `❌ **Error: Path does not exist**\n\nThe path "${params.path}" was not found.\n\nPossible issues:\n- File/directory name spelling\n- File/directory may have been already deleted\n- Incorrect path\n\n*Verify the path and try again.*`);
            }

            const stats = fs.statSync(targetPath);
            let filesDeleted = 0;
            let directoriesDeleted = 0;

            if (stats.isDirectory()) {
                // Handle directory deletion
                const items = fs.readdirSync(targetPath);

                if (items.length > 0 && !recursive) {
                    return this.createSuccessResponse(request.id, `❌ **Error: Directory not empty**\n\nThe directory "${params.path}" contains ${items.length} items.\n\nOptions:\n- Use \`recursive: true\` to delete directory and all contents\n- Remove directory contents manually first\n- Choose an empty directory\n\n*Use recursive option to delete non-empty directories.*`);
                }

                // Count items for reporting
                if (recursive) {
                    const counts = this.countDirectoryItems(targetPath);
                    filesDeleted = counts.files;
                    directoriesDeleted = counts.directories;
                }

                // Delete directory
                fs.rmSync(targetPath, { recursive, force: true });

                const resultMessage = `✅ **Directory deleted successfully**\n\n**Directory:** \`${targetPath}\`\n${recursive ? `**Items deleted:** ${filesDeleted} files, ${directoriesDeleted} directories\n` : '**Status:** Empty directory removed\n'}\n*Directory and contents have been permanently deleted.*`;

                return this.createSuccessResponse(request.id, resultMessage);

            } else {
                // Handle file deletion
                const fileSize = stats.size;
                fs.unlinkSync(targetPath);

                const resultMessage = `✅ **File deleted successfully**\n\n**File:** \`${targetPath}\`\n**Size:** ${this.formatFileSize(fileSize)}\n\n*File has been permanently deleted.*`;

                return this.createSuccessResponse(request.id, resultMessage);
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
                    return this.createSuccessResponse(request.id, `❌ **Error: Directory already exists**\n\nThe directory "${params.path}" already exists.\n\nOptions:\n- Use the existing directory\n- Choose a different directory name\n- Delete the existing directory first (if empty)\n\n*Directory is already available for use.*`);
                } else {
                    return this.createSuccessResponse(request.id, `❌ **Error: Path exists as file**\n\nThe path "${params.path}" already exists as a file, not a directory.\n\nOptions:\n- Choose a different directory name\n- Delete the existing file first\n- Use a different path\n\n*Retry with a different path.*`);
                }
            }

            // Check parent directory
            const parentDir = path.dirname(targetPath);
            let parentCreated = false;

            if (!recursive && !fs.existsSync(parentDir)) {
                return this.createSuccessResponse(request.id, `❌ **Error: Parent directory does not exist**\n\nThe parent directory for "${params.path}" does not exist and recursive is disabled.\n\nOptions:\n- Use \`recursive: true\` to create parent directories\n- Create parent directories manually first\n- Choose a path with existing parent directories\n\n*Retry with recursive: true or create parent directories first.*`);
            }

            // Create directory
            if (recursive && !fs.existsSync(parentDir)) {
                parentCreated = true;
            }

            fs.mkdirSync(targetPath, { recursive });
            const stats = fs.statSync(targetPath);

            const resultMessage = `✅ **Directory created successfully**\n\n**Directory:** \`${targetPath}\`\n**Created:** ${stats.birthtime.toISOString()}\n${parentCreated ? '**Parent directories:** Created automatically\n' : ''}\n*Directory is ready for use.*`;

            return this.createSuccessResponse(request.id, resultMessage);

        } catch (error) {
            return this.handleFileOperationError(request.id, 'create_directory', params.path, error);
        }
    }

    // File editing method (from file-editor.ts)
    private async handleEditFile(request: MCPRequest): Promise<MCPResponse> {
        const validationError = this.validateParams(request.params, ['path', 'startLine', 'endLine', 'newContent']);
        if (validationError) {
            return this.createErrorResponse(request.id, -32602, validationError);
        }

        const params: EditFileParams = request.params;
        const encoding = params.encoding || 'utf8';

        try {
            const targetPath = path.resolve(params.path);

            // Check if file exists
            if (!fs.existsSync(targetPath)) {
                return this.createSuccessResponse(request.id, `❌ **Error: File does not exist**\n\nThe file "${params.path}" was not found.\n\nPossible solutions:\n- Check the file path spelling\n- Verify the file exists\n- Create the file first using create_file tool\n\n*Please verify the file path and try again.*`);
            }

            // Read the file first to validate line numbers and get content
            const originalContent = fs.readFileSync(targetPath, encoding as BufferEncoding);
            const lines = originalContent.split('\n');
            const totalLines = lines.length;

            // Validate line numbers
            if (params.startLine < 1) {
                return this.createSuccessResponse(request.id, `❌ **Error: Invalid start line number**\n\nStart line ${params.startLine} cannot be less than 1.\n\n*Please use a valid line number.*`);
            }

            if (params.startLine > params.endLine) {
                return this.createSuccessResponse(request.id, `❌ **Error: Invalid line range**\n\nStart line (${params.startLine}) cannot be greater than end line (${params.endLine}).\n\n*Please ensure startLine ≤ endLine.*`);
            }

            // Perform the edit with robust out-of-bounds handling
            const effectiveEndLine = Math.min(params.endLine, totalLines);
            const newContentLines = params.newContent === '' ? [] : params.newContent.split('\n');
            const beforeLines = lines.slice(0, params.startLine - 1);

            // If startLine is out of bounds, afterLines should be empty. Otherwise, slice from effectiveEndLine.
            const afterLines = params.startLine > totalLines ? [] : lines.slice(effectiveEndLine);

            let paddingLines: string[] = [];
            if (params.startLine > totalLines + 1) {
                // Add padding if the edit starts more than one line after the end of the file
                paddingLines = Array(params.startLine - totalLines - 1).fill('');
            }

            const editedLines = [...beforeLines, ...paddingLines, ...newContentLines, ...afterLines];

            const editedContent = editedLines.join('\n');

            // Write the edited content back to the file
            fs.writeFileSync(targetPath, editedContent, encoding as BufferEncoding);

            const contextLines = 30;
            const newContentLineCount = newContentLines.length;

            // Calculate the display range
            const displayStartLine = Math.max(1, params.startLine - contextLines);
            const displayEndLine = Math.min(editedLines.length, params.startLine + newContentLineCount - 1 + contextLines);

            // Extract the relevant code block with line numbers
            const codeBlock = editedLines
                .slice(displayStartLine - 1, displayEndLine)
                .map((line, index) => `${(displayStartLine + index).toString().padStart(5, ' ')}: ${line}`)
                .join('\n');

            const language = getLanguageForFile(targetPath);
            const resultMessage = `✅ **File Edited: \`${targetPath}\`**

AI has modified the file. Below is the code block surrounding the edit (lines ${params.startLine}-${params.startLine + newContentLineCount - 1}).

**CRITICAL ACTION: Review the code block below to ensure the edit is correct.**
\`\`\`${language}
${codeBlock}
\`\`\`

- If the edit is correct, reply: \`✔checked\`
- If the edit is incorrect, use \`edit_file\` to fix it.`;

            const diff = createPatch(targetPath, originalContent, editedContent);
            const needsConfirmation = StorageService.isFunctionConfirmationRequired('file-system_edit_file');
            if (!needsConfirmation) {
                console.log(highlight(diff, { language: 'diff', ignoreIllegals: true }));
            }
            const finalMessage = `${resultMessage}\n\n**Changes:**\n\`\`\`diff\n${diff}\n\`\`\``;
            return this.createSuccessResponse(request.id, finalMessage);

        } catch (error) {
            return this.handleFileEditError(request.id, params.path, error);
        }
    }

    // Helper methods
    private estimateTokenCount(content: string): number {
        // Rough estimation: 1 token ≈ 4 characters for English text
        return Math.ceil(content.length / 4);
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

    private generateDirectoryTree(dirPath: string, items: any[]): string {
        const dirName = path.basename(dirPath);
        let tree = `📁 **${dirName}/**\n`;

        // Sort items: directories first, then files
        const sortedItems = items.sort((a, b) => {
            if (a.type === b.type) {
                return a.name.localeCompare(b.name);
            }
            return a.type === 'directory' ? -1 : 1;
        });

        sortedItems.forEach((item, index) => {
            const isLast = index === sortedItems.length - 1;
            const prefix = isLast ? '└── ' : '├── ';
            const icon = item.type === 'directory' ? '📁' : '📄';
            const sizeInfo = item.type === 'file' && item.size !== undefined ?
                ` (${this.formatFileSize(item.size)})` : '';

            tree += `${prefix}${icon} ${item.name}${sizeInfo}\n`;
        });

        return tree;
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

    // Error handling methods
    private handleFileReadError(
        requestId: string,
        filePath: string,
        error: unknown
    ): MCPResponse {
        let errorContent = '';

        if (error instanceof Error) {
            if (error.message.includes('EACCES')) {
                errorContent = `❌ **Error: Permission denied**\n\nAccess to "${filePath}" was denied.\n\nPossible solutions:\n- Check file/directory permissions\n- Try a different location you have read access to\n- Run with appropriate permissions\n- Choose a different path\n\n*Retry with a path you have read permissions for.*`;
            } else if (error.message.includes('ENOENT')) {
                errorContent = `❌ **Error: File not found**\n\nThe file "${filePath}" does not exist.\n\nPossible solutions:\n- Check the file path spelling\n- Verify the file exists\n- Use the correct relative or absolute path\n- Create the file first if needed\n\n*Retry with correct file path.*`;
            } else {
                errorContent = `❌ **Error: Read operation failed**\n\nFailed to read "${filePath}": ${error.message}\n\nPossible solutions:\n- Check file system permissions\n- Verify the file is not corrupted\n- Try a different encoding format\n- Ensure the file is not locked\n\n*Retry with different parameters or check system status.*`;
            }
        } else {
            errorContent = `❌ **Error: Unknown error**\n\nAn unknown error occurred while reading "${filePath}": ${String(error)}\n\n*Please retry with different parameters or check the system.*`;
        }

        return this.createSuccessResponse(requestId, errorContent);
    }

    private handleFileOperationError(
        requestId: string,
        operation: string,
        filePath: string,
        error: unknown
    ): MCPResponse {
        let errorContent = '';

        if (error instanceof Error) {
            if (error.message.includes('EACCES')) {
                errorContent = `❌ **Error: Permission denied**\n\nAccess to "${filePath}" was denied.\n\nPossible solutions:\n- Check file/directory permissions\n- Try a different location you have write access to\n- Run with appropriate permissions\n- Choose a different path\n\n*Retry with a path you have write permissions for.*`;
            } else if (error.message.includes('ENOENT')) {
                errorContent = `❌ **Error: Path not found**\n\nThe path "${filePath}" or its parent directory does not exist.\n\nPossible solutions:\n- Check the path spelling\n- Create parent directories first\n- Use recursive option for directory creation\n- Use an existing path\n\n*Retry with correct path or create parent directories first.*`;
            } else if (error.message.includes('ENOTDIR')) {
                errorContent = `❌ **Error: Not a directory**\n\nA component in the path "${filePath}" is not a directory.\n\nPossible solutions:\n- Check the path structure\n- Ensure all parent components are directories\n- Use a different path\n- Remove conflicting files\n\n*Retry with a valid directory path.*`;
            } else if (error.message.includes('EEXIST')) {
                errorContent = `❌ **Error: Already exists**\n\nThe path "${filePath}" already exists.\n\nPossible solutions:\n- Choose a different name\n- Delete the existing file/directory first\n- Use a different location\n- Check if you meant to modify instead of create\n\n*Retry with a different path or remove existing item first.*`;
            } else {
                errorContent = `❌ **Error: Operation failed**\n\nFailed to ${operation.replace('_', ' ')} "${filePath}": ${error.message}\n\nPossible solutions:\n- Check file system permissions\n- Verify available disk space\n- Try a different path\n- Check for file locks or conflicts\n\n*Retry with different parameters or check system status.*`;
            }
        } else {
            errorContent = `❌ **Error: Unknown error**\n\nAn unknown error occurred while trying to ${operation.replace('_', ' ')} "${filePath}": ${String(error)}\n\n*Please retry with different parameters or check the system.*`;
        }

        return this.createSuccessResponse(requestId, errorContent);
    }

    private handleFileEditError(
        requestId: string,
        filePath: string,
        error: unknown
    ): MCPResponse {
        let errorContent = '';

        if (error instanceof Error) {
            if (error.message.includes('EACCES')) {
                errorContent = `❌ **Error: Permission denied**\n\nAccess to "${filePath}" was denied.\n\nPossible solutions:\n- Check file permissions\n- Ensure you have write access to the file\n- Try a different file you have permissions for\n- Run with appropriate permissions\n\n*Retry with a file you have write permissions for.*`;
            } else if (error.message.includes('ENOENT')) {
                errorContent = `❌ **Error: File not found**\n\nThe file "${filePath}" does not exist.\n\nPossible solutions:\n- Check the file path spelling\n- Verify the file exists\n- Create the file first using create_file tool\n- Use an existing file path\n\n*Retry with correct file path or create the file first.*`;
            } else if (error.message.includes('EISDIR')) {
                errorContent = `❌ **Error: Is a directory**\n\nThe path "${filePath}" is a directory, not a file.\n\nPossible solutions:\n- Specify a file path instead of directory\n- Choose a file within the directory\n- Use file operations for directory management\n\n*Retry with a valid file path.*`;
            } else {
                errorContent = `❌ **Error: Edit operation failed**\n\nFailed to edit "${filePath}": ${error.message}\n\nPossible solutions:\n- Check file system permissions\n- Verify available disk space\n- Ensure file is not locked by another process\n- Try again with valid parameters\n\n*Retry with different parameters or check system status.*`;
            }
        } else {
            errorContent = `❌ **Error: Unknown error**\n\nAn unknown error occurred while editing "${filePath}": ${String(error)}\n\n*Please retry with different parameters or check the system.*`;
        }

        return this.createSuccessResponse(requestId, errorContent);
    }
} 