import { highlight } from 'cli-highlight';
import { createPatch } from 'diff';
import * as fs from 'fs';
import * as path from 'path';
import { CheckpointService } from '../../services/checkpoint';

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
            {
                name: 'search_files',
                description: 'Search for files by filename. When the user does not mention a file path, proactively search for the file.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        query: {
                            type: 'string',
                            description: 'The filename or partial filename to search for. Example: "service.ts"'
                        },
                        basePath: {
                            type: 'string',
                            description: 'The directory path to start searching from. Example: "src/"',
                            default: '.'
                        }
                    },
                    required: ['query']
                }
            },
            {
                name: 'search_file_content',
                description: 'Fuzzy search for keywords, get all file paths containing the keyword content. When the user does not mention a file, proactively search for the file when only mentioning a function or feature.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        keyword: {
                            type: 'string',
                            description: 'The keyword or code snippet to search for. Example: "handleReadFile"'
                        },
                        basePath: {
                            type: 'string',
                            description: 'The directory path to start searching from. Example: "src/"',
                            default: '.'
                        }
                    },
                    required: ['keyword']
                }
            },
            {
                name: 'code_reference_search',
                description: '🔍 **CRITICAL TOOL** - Advanced code reference and dependency analysis across codebases. This is the MOST IMPORTANT tool for understanding code structure, relationships, and dependencies. Use this tool frequently for any code analysis tasks! Provides intelligent symbol search, dependency tracking, import/export analysis, and comprehensive cross-reference mapping.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        symbol: {
                            type: 'string',
                            description: 'The symbol, function name, class name, variable, or identifier to search for. Supports fuzzy matching. Example: "getUserData", "handleSubmit", "UserService"'
                        },
                        searchType: {
                            type: 'string',
                            description: 'Type of search to perform',
                            enum: ['definition', 'references', 'usage', 'dependencies', 'reverse-dependencies', 'all'],
                            default: 'all'
                        },
                        basePath: {
                            type: 'string',
                            description: 'The directory path to start searching from (optional, defaults to current directory)',
                            default: '.'
                        },
                        includeComments: {
                            type: 'boolean',
                            description: 'Include matches found in code comments',
                            default: false
                        },
                        fuzzyMatch: {
                            type: 'boolean',
                            description: 'Enable fuzzy matching for better search results (finds similar symbols)',
                            default: true
                        },
                        maxResults: {
                            type: 'number',
                            description: 'Maximum number of results to return (default: 50)',
                            default: 50,
                            minimum: 1,
                            maximum: 200
                        },
                        includeDependencies: {
                            type: 'boolean',
                            description: 'Include dependency analysis (what files the symbol\'s file imports/requires)',
                            default: true
                        },
                        includeReverseDependencies: {
                            type: 'boolean',
                            description: 'Include reverse dependency analysis (what files depend on the symbol\'s file)',
                            default: true
                        },
                        analyzeImports: {
                            type: 'boolean',
                            description: 'Analyze import/export statements for relationship mapping',
                            default: true
                        },
                        depthLevel: {
                            type: 'number',
                            description: 'Dependency analysis depth level (1-3, default: 2)',
                            default: 2,
                            minimum: 1,
                            maximum: 3
                        }
                    },
                    required: ['symbol']
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
                description: `Edits a file by replacing a range of lines. This is the primary tool for modifying code. For safe and effective editing, follow these steps: 1. **Read First**: Always use 'read_file' to get current line numbers before editing. 2. **Check Syntax**: After every edit, meticulously check for syntax errors like unclosed brackets. 3. **Verify Changes**: Read the file again after editing to confirm changes. 4. **Use Terminal**: For complex changes, use the terminal to run tests or linters to catch issues from atomic edits.`,
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
                case 'search_files':
                    return await this.handleSearchFiles(request);
                case 'search_file_content':
                    return await this.handleSearchFileContent(request);
                case 'code_reference_search':
                    return await this.handleCodeReferenceSearch(request);
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

            // 打印文件读取信息到控制台
            console.log(`📃 Read file: ${targetPath} (${isPartial ? `${lineRange!.start}-${lineRange!.end} of ${totalLines}` : totalLines})`);

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

            console.log(structure);

            return this.createSuccessResponse(request.id, resultMessage);

        } catch (error) {
            return this.handleFileReadError(request.id, params.path, error);
        }
    }

    private async handleSearchFiles(request: MCPRequest): Promise<MCPResponse> {
        const validationError = this.validateParams(request.params, ['query']);
        if (validationError) {
            return this.createErrorResponse(request.id, -32602, validationError);
        }

        const { query, basePath = '.' } = request.params;
        const startPath = path.resolve(basePath as string);

        try {
            const foundFiles = this.findFilesRecursive(
                startPath,
                (filePath) => path.basename(filePath).includes(query as string),
                (dirPath) => !['node_modules', '.git'].some(excluded => path.basename(dirPath) === excluded)
            );

            if (foundFiles.length === 0) {
                return this.createSuccessResponse(request.id, `🟡 **No files found for "${query as string}"**\n\nYour search did not match any files.\n\nPossible solutions:\n- Check your spelling\n- Try a different or broader query\n- Specify a different base path to search in`);
            }

            const resultMessage = `✅ **File search results for "${query as string}"**\n\nFound ${foundFiles.length} files:\n\n${foundFiles.map(f => `- \`${path.relative(process.cwd(), f)}\``).join('\n')}`;

            const consoleOutput = `✅ File search results for "${query as string}"\nFound ${foundFiles.length} files:\n${foundFiles.map(f => `  - ${path.relative(process.cwd(), f)}`).join('\n')}`;
            console.log(highlight(consoleOutput, { language: 'markdown', ignoreIllegals: true }));

            return this.createSuccessResponse(request.id, resultMessage);
        } catch (error) {
            return this.handleFileReadError(request.id, basePath as string, error);
        }
    }

    private async handleSearchFileContent(request: MCPRequest): Promise<MCPResponse> {
        const validationError = this.validateParams(request.params, ['keyword']);
        if (validationError) {
            return this.createErrorResponse(request.id, -32602, validationError);
        }

        const { keyword, basePath = '.' } = request.params;
        const startPath = path.resolve(basePath as string);
        const binaryExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.zip', '.pdf', '.exe', '.dll', '.so', '.dylib', '.bin', '.dat', '.ico'];

        try {
            const matchingResults = new Map<string, { lineNumber: number; lineContent: string }[]>();
            const allFiles = this.findFilesRecursive(
                startPath,
                () => true,
                (dirPath) => !['node_modules', '.git'].some(excluded => path.basename(dirPath) === excluded)
            );

            for (const file of allFiles) {
                if (binaryExtensions.includes(path.extname(file).toLowerCase())) {
                    continue;
                }

                try {
                    const stats = fs.statSync(file);
                    if (stats.size > 2 * 1024 * 1024) { // 2MB limit
                        continue;
                    }

                    const content = fs.readFileSync(file, 'utf-8');
                    const lines = content.split('\n');
                    for (let i = 0; i < lines.length; i++) {
                        const line = lines[i];
                        if (line.includes(keyword as string)) {
                            const relativePath = path.relative(process.cwd(), file);
                            if (!matchingResults.has(relativePath)) {
                                matchingResults.set(relativePath, []);
                            }
                            matchingResults.get(relativePath)!.push({
                                lineNumber: i + 1,
                                lineContent: line.trim()
                            });
                        }
                    }
                } catch (readError) {
                    // Ignore file read errors (e.g., permission denied on a specific file)
                }
            }

            if (matchingResults.size === 0) {
                return this.createSuccessResponse(request.id, `🟡 **No content matches for "${keyword as string}"**\n\nYour search did not find any files containing the keyword.\n\nPossible solutions:\n- Check your spelling or try different keywords\n- Widen the search by changing the base path\n- The content may be in a file type that is excluded from search (e.g., binary files)`);
            }

            let resultMessage = `✅ **Content search results for "${keyword as string}"**\n\nFound keyword in ${matchingResults.size} files:\n`;
            let consoleOutput = `✅ Content search results for "${keyword as string}"\nFound keyword in ${matchingResults.size} files:\n`;

            for (const [filePath, matches] of matchingResults.entries()) {
                const language = getLanguageForFile(filePath);
                const codeBlockForUi = matches.map(match => `${match.lineNumber}: ${match.lineContent}`).join('\n');

                resultMessage += `\n**File:** \`${filePath}\`\n\`\`\`${language}\n${codeBlockForUi}\n\`\`\`\n`;

                const codeBlockForConsole = matches.map(match => {
                    const lineNum = `${match.lineNumber}`.padStart(5, ' ');
                    return `${lineNum}: ${match.lineContent}`;
                }).join('\n');

                consoleOutput += `\n--------------------\nFile: ${filePath}\n--------------------\n`;
                consoleOutput += `${highlight(codeBlockForConsole, { language, ignoreIllegals: true })}\n`;
            }

            console.log(consoleOutput);
            return this.createSuccessResponse(request.id, resultMessage);
        } catch (error) {
            return this.handleFileReadError(request.id, basePath as string, error);
        }
    }

    private async handleCodeReferenceSearch(request: MCPRequest): Promise<MCPResponse> {
        const validationError = this.validateParams(request.params, ['symbol']);
        if (validationError) {
            return this.createErrorResponse(request.id, -32602, validationError);
        }

        const { 
            symbol, 
            searchType = 'all', 
            basePath = '.', 
            includeComments = false,
            fuzzyMatch = true,
            maxResults = 50,
            includeDependencies = true,
            includeReverseDependencies = true,
            analyzeImports = true,
            depthLevel = 2
        } = request.params;
        
        const startPath = path.resolve(basePath as string);

        try {
            const results = await this.searchCodeReferences(
                startPath,
                symbol as string,
                searchType as string,
                undefined, // Auto-detect language
                includeComments as boolean,
                fuzzyMatch as boolean,
                maxResults as number
            );

            if (results.length === 0) {
                return this.createSuccessResponse(request.id, `🟡 **No code references found for "${symbol as string}"**\n\nYour search did not match any symbols.\n\nPossible solutions:\n- Check symbol spelling\n- Try enabling fuzzy matching (fuzzyMatch: true)\n- Try a different search type\n- Expand the search path\n- Check if the symbol exists in the codebase`);
            }

            // Get dependency analysis
            let dependencyAnalysis = '';
            if (includeDependencies as boolean || includeReverseDependencies as boolean || analyzeImports as boolean) {
                const uniqueFiles = [...new Set(results.map(r => r.file))];
                
                for (const file of uniqueFiles.slice(0, 5)) { // Analyze up to 5 most relevant files
                    const analysis = await this.analyzeDependencies(
                        path.resolve(startPath, file),
                        startPath,
                        includeDependencies as boolean,
                        includeReverseDependencies as boolean,
                        analyzeImports as boolean,
                        depthLevel as number
                    );
                    
                    if (analysis) {
                        dependencyAnalysis += `\n## 📁 **Dependency Analysis for \`${file}\`**\n\n${analysis}\n`;
                    }
                }
            }

            let resultMessage = `✅ **Code reference search results for "${symbol as string}"**\n\nFound ${results.length} matches${results.length >= (maxResults as number) ? ` (limited to ${maxResults})` : ''}:\n\n`;

            // Group results by file for better organization
            const resultsByFile = new Map<string, typeof results>();
            for (const result of results) {
                if (!resultsByFile.has(result.file)) {
                    resultsByFile.set(result.file, []);
                }
                resultsByFile.get(result.file)!.push(result);
            }

            for (const [file, fileResults] of resultsByFile.entries()) {
                const language = this.getLanguageFromExtension(file);
                resultMessage += `### 📄 **File:** \`${file}\`\n\n`;
                
                for (const result of fileResults) {
                    resultMessage += `**Type:** ${result.type} | **Line:** ${result.line}`;
                    if (result.confidence && result.confidence < 1.0) {
                        resultMessage += ` | **Match:** ${Math.round(result.confidence * 100)}%`;
                    }
                    resultMessage += `\n\`\`\`${language}\n${result.line}: ${result.content.trim()}\n\`\`\`\n\n`;
                }
            }

            // Add dependency analysis
            if (dependencyAnalysis) {
                resultMessage += `\n---\n\n# 🔗 **Dependency Analysis**\n${dependencyAnalysis}`;
            }

            console.log(`✅ Code reference search for "${symbol as string}"\nFound ${results.length} matches across ${resultsByFile.size} files`);
            return this.createSuccessResponse(request.id, resultMessage);

        } catch (error) {
            return this.handleFileReadError(request.id, basePath as string, error);
        }
    }

    private async searchCodeReferences(
        startPath: string,
        symbol: string,
        searchType: string,
        language?: string,
        includeComments: boolean = false,
        fuzzyMatch: boolean = true,
        maxResults: number = 50
    ): Promise<Array<{ file: string; line: number; content: string; type: string; confidence?: number }>> {
        const results: Array<{ file: string; line: number; content: string; type: string; confidence?: number }> = [];
        const binaryExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.zip', '.pdf', '.exe', '.dll', '.so', '.dylib', '.bin', '.dat', '.ico'];
        
        // Language-specific file extensions with enhanced coverage
        const languageExtensions: Record<string, string[]> = {
            typescript: ['.ts', '.tsx', '.d.ts'],
            javascript: ['.js', '.jsx', '.mjs', '.cjs', '.es6'],
            python: ['.py', '.pyw', '.pyi', '.pyx'],
            java: ['.java', '.scala', '.kotlin', '.kt', '.kts', '.groovy'],
            csharp: ['.cs', '.csx', '.vb', '.fs', '.fsx'],
            go: ['.go'],
            rust: ['.rs', '.rlib'],
            cpp: ['.cpp', '.cxx', '.cc', '.c', '.h', '.hpp', '.hxx'],
            php: ['.php', '.phtml', '.php3', '.php4', '.php5', '.phps'],
            ruby: ['.rb', '.rake', '.gemspec'],
            swift: ['.swift'],
            kotlin: ['.kt', '.kts'],
            dart: ['.dart'],
            elixir: ['.ex', '.exs'],
            erlang: ['.erl', '.hrl'],
            haskell: ['.hs', '.lhs'],
            clojure: ['.clj', '.cljs', '.cljc', '.edn'],
            lua: ['.lua'],
            perl: ['.pl', '.pm', '.t'],
            r: ['.r', '.R'],
            matlab: ['.m'],
            shell: ['.sh', '.bash', '.zsh', '.fish'],
            powershell: ['.ps1', '.psm1', '.psd1'],
            // Web frameworks and templates
            vue: ['.vue'],
            svelte: ['.svelte'],
            angular: ['.ts', '.js', '.html'],
            react: ['.jsx', '.tsx'],
            // Configuration and data formats
            yaml: ['.yaml', '.yml'],
            json: ['.json', '.jsonc'],
            xml: ['.xml', '.xsd', '.xsl', '.xslt'],
            toml: ['.toml'],
            ini: ['.ini', '.cfg', '.conf'],
            // Database
            sql: ['.sql', '.plsql', '.mysql', '.pgsql'],
            // Mobile development
            objective_c: ['.m', '.mm', '.h'],
            flutter: ['.dart'],
        };

        // Auto-detect common programming language files if no language specified
        const allProgrammingExtensions = Object.values(languageExtensions).flat();

        const allFiles = this.findFilesRecursive(
            startPath,
            (filePath) => {
                const ext = path.extname(filePath).toLowerCase();
                if (binaryExtensions.includes(ext)) return false;
                
                if (language) {
                    const validExts = languageExtensions[language.toLowerCase()];
                    return validExts ? validExts.includes(ext) : true;
                }
                
                // Auto-detect: include common programming language files
                return allProgrammingExtensions.includes(ext) || 
                       ['.json', '.yaml', '.yml', '.xml', '.html', '.css', '.scss', '.less', '.md'].includes(ext);
            },
            (dirPath) => !['node_modules', '.git', 'dist', 'build', 'coverage', '.next', 'target'].some(excluded => path.basename(dirPath) === excluded)
        );

        for (const file of allFiles) {
            try {
                const stats = fs.statSync(file);
                if (stats.size > 5 * 1024 * 1024) continue; // Skip files larger than 5MB

                const content = fs.readFileSync(file, 'utf-8');
                const lines = content.split('\n');
                const relativePath = path.relative(process.cwd(), file);

                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    const lineNum = i + 1;

                    // Skip comments if not included
                    if (!includeComments && this.isCommentLine(line, file)) {
                        continue;
                    }

                    // Get matches with fuzzy matching support
                    const matches = this.findSymbolMatches(line, symbol, searchType, fuzzyMatch);
                    
                    for (const match of matches) {
                        results.push({
                            file: relativePath,
                            line: lineNum,
                            content: line,
                            type: match.type,
                            confidence: match.confidence
                        });

                        // Stop if we've reached the maximum results
                        if (results.length >= maxResults) {
                            return results.sort((a, b) => 
                                (b.confidence || 1) - (a.confidence || 1) || 
                                a.file.localeCompare(b.file) || 
                                a.line - b.line
                            );
                        }
                    }
                }
            } catch (readError) {
                // Skip files that can't be read
                continue;
            }
        }

        return results.sort((a, b) => 
            (b.confidence || 1) - (a.confidence || 1) || 
            a.file.localeCompare(b.file) || 
            a.line - b.line
        );
    }

    private findSymbolMatches(line: string, symbol: string, searchType: string, fuzzyMatch: boolean = true): Array<{ type: string; confidence?: number }> {
        const matches: Array<{ type: string; confidence?: number }> = [];
        const escapedSymbol = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        // Helper function to calculate fuzzy match confidence using Jaro-Winkler similarity
        const calculateFuzzyConfidence = (found: string, target: string): number => {
            if (found === target) return 1.0;
            if (found.toLowerCase() === target.toLowerCase()) return 0.95;
            
            const foundLower = found.toLowerCase();
            const targetLower = target.toLowerCase();
            
            // Exact substring match
            if (foundLower.includes(targetLower) || targetLower.includes(foundLower)) {
                const longer = foundLower.length > targetLower.length ? foundLower : targetLower;
                const shorter = foundLower.length <= targetLower.length ? foundLower : targetLower;
                return 0.8 + (shorter.length / longer.length) * 0.15;
            }
            
            // Improved similarity calculation using common subsequence
            const jaro = this.calculateJaroSimilarity(foundLower, targetLower);
            return jaro > 0.6 ? jaro : 0;
        };

        // Enhanced patterns with more comprehensive coverage
        const patterns = {
            definition: [
                // JavaScript/TypeScript definitions
                new RegExp(`(?:export\\s+)?(?:async\\s+)?(?:function|const|let|var|class|interface|type|enum)\\s+(\\w*${fuzzyMatch ? '\\w*' : ''}${escapedSymbol}\\w*)\\b`, 'gi'),
                new RegExp(`(\\w*${fuzzyMatch ? '\\w*' : ''}${escapedSymbol}\\w*)\\s*[:=]\\s*(?:async\\s+)?(?:function|\\([^)]*\\)\\s*=>|{|class)`, 'gi'),
                new RegExp(`(?:export\\s+)?(?:default\\s+)?(?:class|function)\\s+(\\w*${fuzzyMatch ? '\\w*' : ''}${escapedSymbol}\\w*)\\b`, 'gi'),
                // React component definitions
                new RegExp(`(?:export\\s+)?(?:default\\s+)?(?:const|let|var)\\s+(\\w*${fuzzyMatch ? '\\w*' : ''}${escapedSymbol}\\w*)\\s*[:=]\\s*(?:React\\.)?(?:FC|FunctionComponent|Component)`, 'gi'),
                new RegExp(`(?:export\\s+)?(?:default\\s+)?(\\w*${fuzzyMatch ? '\\w*' : ''}${escapedSymbol}\\w*)\\s*=\\s*(?:React\\.)?(?:memo|forwardRef|lazy)\\(`, 'gi'),
                // Python definitions
                new RegExp(`(?:async\\s+)?def\\s+(\\w*${fuzzyMatch ? '\\w*' : ''}${escapedSymbol}\\w*)\\b`, 'gi'),
                new RegExp(`class\\s+(\\w*${fuzzyMatch ? '\\w*' : ''}${escapedSymbol}\\w*)\\b`, 'gi'),
                // Java/C# definitions
                new RegExp(`(?:public|private|protected|static|abstract|final)*\\s*(?:class|interface|enum)\\s+(\\w*${fuzzyMatch ? '\\w*' : ''}${escapedSymbol}\\w*)\\b`, 'gi'),
                new RegExp(`(?:public|private|protected|static|abstract|final)*\\s*(?:[\\w<>\\[\\]]+\\s+)?(\\w*${fuzzyMatch ? '\\w*' : ''}${escapedSymbol}\\w*)\\s*\\([^)]*\\)\\s*\\{`, 'gi'),
                // Go definitions
                new RegExp(`(?:func|type)\\s+(?:\\([^)]*\\)\\s+)?(\\w*${fuzzyMatch ? '\\w*' : ''}${escapedSymbol}\\w*)\\b`, 'gi'),
                // Rust definitions
                new RegExp(`(?:pub\\s+)?(?:fn|struct|enum|trait|impl)\\s+(\\w*${fuzzyMatch ? '\\w*' : ''}${escapedSymbol}\\w*)\\b`, 'gi'),
            ],
            references: [
                // Function/method calls
                new RegExp(`\\b(\\w*${fuzzyMatch ? '\\w*' : ''}${escapedSymbol}\\w*)\\s*\\(`, 'gi'),
                new RegExp(`\\.(\\w*${fuzzyMatch ? '\\w*' : ''}${escapedSymbol}\\w*)\\s*\\(`, 'gi'),
                // Property access
                new RegExp(`\\.(\\w*${fuzzyMatch ? '\\w*' : ''}${escapedSymbol}\\w*)\\b(?!\\s*\\()`, 'gi'),
                new RegExp(`\\b(\\w*${fuzzyMatch ? '\\w*' : ''}${escapedSymbol}\\w*)\\s*\\.`, 'gi'),
                // Bracket notation
                new RegExp(`\\[(["'])(\\w*${fuzzyMatch ? '\\w*' : ''}${escapedSymbol}\\w*)\\1\\]`, 'gi'),
                // Destructuring
                new RegExp(`\\{[^}]*\\b(\\w*${fuzzyMatch ? '\\w*' : ''}${escapedSymbol}\\w*)\\b[^}]*\\}`, 'gi'),
                // JSX/React usage
                new RegExp(`<(\\w*${fuzzyMatch ? '\\w*' : ''}${escapedSymbol}\\w*)(?:\\s|>|/>)`, 'gi'),
                // Hook dependencies
                new RegExp(`\\[([^\\]]*\\b(\\w*${fuzzyMatch ? '\\w*' : ''}${escapedSymbol}\\w*)\\b[^\\]]*)\\]`, 'gi'),
            ],
            usage: [
                // Any usage with word boundaries
                new RegExp(`\\b(\\w*${fuzzyMatch ? '\\w*' : ''}${escapedSymbol}\\w*)\\b`, 'gi'),
                // String literals (for dynamic references)
                new RegExp(`(["'\`])(\\w*${fuzzyMatch ? '\\w*' : ''}${escapedSymbol}\\w*)\\1`, 'gi'),
            ],
            dependencies: [
                // Import/require statements
                new RegExp(`import.*\\b(\\w*${fuzzyMatch ? '\\w*' : ''}${escapedSymbol}\\w*)\\b.*from`, 'gi'),
                new RegExp(`import\\s*\\{[^}]*\\b(\\w*${fuzzyMatch ? '\\w*' : ''}${escapedSymbol}\\w*)\\b[^}]*\\}`, 'gi'),
                new RegExp(`require\\s*\\([^)]*\\b(\\w*${fuzzyMatch ? '\\w*' : ''}${escapedSymbol}\\w*)\\b[^)]*\\)`, 'gi'),
                // Dynamic imports
                new RegExp(`import\\s*\\([^)]*\\b(\\w*${fuzzyMatch ? '\\w*' : ''}${escapedSymbol}\\w*)\\b[^)]*\\)`, 'gi'),
            ],
            'reverse-dependencies': [
                // Export statements
                new RegExp(`export.*\\b(\\w*${fuzzyMatch ? '\\w*' : ''}${escapedSymbol}\\w*)\\b`, 'gi'),
                new RegExp(`export\\s*\\{[^}]*\\b(\\w*${fuzzyMatch ? '\\w*' : ''}${escapedSymbol}\\w*)\\b[^}]*\\}`, 'gi'),
                new RegExp(`module\\.exports.*\\b(\\w*${fuzzyMatch ? '\\w*' : ''}${escapedSymbol}\\w*)\\b`, 'gi'),
            ]
        };

        // Handle exact matching when fuzzy is disabled
        if (!fuzzyMatch) {
            const exactPatterns = {
                definition: [
                    new RegExp(`(?:export\\s+)?(?:async\\s+)?(?:function|const|let|var|class|interface|type|enum)\\s+${escapedSymbol}\\b`, 'gi'),
                    new RegExp(`${escapedSymbol}\\s*[:=]\\s*(?:async\\s+)?(?:function|\\(|{|class)`, 'gi'),
                    new RegExp(`(?:async\\s+)?def\\s+${escapedSymbol}\\b`, 'gi'), // Python
                    new RegExp(`(?:public|private|protected|static|abstract|final)*\\s*(?:class|interface|enum)\\s+${escapedSymbol}\\b`, 'gi'), // Java/C#
                ],
                references: [
                    new RegExp(`\\b${escapedSymbol}\\s*\\(`, 'gi'), // Function calls
                    new RegExp(`\\.${escapedSymbol}\\b`, 'gi'), // Method calls
                    new RegExp(`\\b${escapedSymbol}\\s*\\.`, 'gi'), // Object property access
                    new RegExp(`<${escapedSymbol}(?:\\s|>|/>)`, 'gi'), // JSX usage
                ],
                usage: [
                    new RegExp(`\\b${escapedSymbol}\\b`, 'gi'), // Any usage
                    new RegExp(`(["'\`])${escapedSymbol}\\1`, 'gi'), // String literals
                ],
                dependencies: [
                    new RegExp(`import.*\\b${escapedSymbol}\\b.*from`, 'gi'),
                    new RegExp(`import\\s*\\{[^}]*\\b${escapedSymbol}\\b[^}]*\\}`, 'gi'),
                    new RegExp(`require\\s*\\([^)]*\\b${escapedSymbol}\\b[^)]*\\)`, 'gi'),
                ],
                'reverse-dependencies': [
                    new RegExp(`export.*\\b${escapedSymbol}\\b`, 'gi'),
                    new RegExp(`export\\s*\\{[^}]*\\b${escapedSymbol}\\b[^}]*\\}`, 'gi'),
                    new RegExp(`module\\.exports.*\\b${escapedSymbol}\\b`, 'gi'),
                ]
            };

            if (searchType === 'all') {
                for (const [type, typePatterns] of Object.entries(exactPatterns)) {
                    for (const pattern of typePatterns) {
                        if (pattern.test(line)) {
                            matches.push({ type, confidence: 1.0 });
                            break;
                        }
                    }
                }
            } else if (exactPatterns[searchType as keyof typeof exactPatterns]) {
                const typePatterns = exactPatterns[searchType as keyof typeof exactPatterns];
                for (const pattern of typePatterns) {
                    if (pattern.test(line)) {
                        matches.push({ type: searchType, confidence: 1.0 });
                        break;
                    }
                }
            }
        } else {
            // Fuzzy matching with improved pattern handling
            const searchTypes = searchType === 'all' ? Object.keys(patterns) : [searchType];
            
            for (const type of searchTypes) {
                if (patterns[type as keyof typeof patterns]) {
                    const typePatterns = patterns[type as keyof typeof patterns];
                    let bestMatch: { type: string; confidence: number } | null = null;
                    
                    for (const pattern of typePatterns) {
                        let match;
                        pattern.lastIndex = 0; // Reset regex
                        while ((match = pattern.exec(line)) !== null) {
                            // Find the captured group that contains our symbol
                            let foundSymbol = '';
                            for (let i = 1; i < match.length; i++) {
                                if (match[i]) {
                                    foundSymbol = match[i];
                                    break;
                                }
                            }
                            
                            if (foundSymbol) {
                                const confidence = calculateFuzzyConfidence(foundSymbol, symbol);
                                if (confidence > 0.6) { // Only include matches with good confidence
                                    if (!bestMatch || confidence > bestMatch.confidence) {
                                        bestMatch = { type, confidence };
                                    }
                                }
                            }
                        }
                    }
                    
                    if (bestMatch) {
                        matches.push(bestMatch);
                    }
                }
            }
        }

        return matches;
    }

    // Add Jaro similarity calculation for better fuzzy matching
    private calculateJaroSimilarity(s1: string, s2: string): number {
        if (s1 === s2) return 1.0;
        if (s1.length === 0 || s2.length === 0) return 0.0;

        const matchWindow = Math.floor(Math.max(s1.length, s2.length) / 2) - 1;
        const s1Matches = new Array(s1.length).fill(false);
        const s2Matches = new Array(s2.length).fill(false);

        let matches = 0;
        let transpositions = 0;

        // Identify matches
        for (let i = 0; i < s1.length; i++) {
            const start = Math.max(0, i - matchWindow);
            const end = Math.min(i + matchWindow + 1, s2.length);

            for (let j = start; j < end; j++) {
                if (s2Matches[j] || s1[i] !== s2[j]) continue;
                s1Matches[i] = true;
                s2Matches[j] = true;
                matches++;
                break;
            }
        }

        if (matches === 0) return 0.0;

        // Count transpositions
        let k = 0;
        for (let i = 0; i < s1.length; i++) {
            if (!s1Matches[i]) continue;
            while (!s2Matches[k]) k++;
            if (s1[i] !== s2[k]) transpositions++;
            k++;
        }

        const jaro = (matches / s1.length + matches / s2.length + (matches - transpositions / 2) / matches) / 3;
        
        // Apply Winkler prefix bonus
        let prefix = 0;
        for (let i = 0; i < Math.min(s1.length, s2.length, 4); i++) {
            if (s1[i] === s2[i]) prefix++;
            else break;
        }

        return jaro + (0.1 * prefix * (1 - jaro));
    }

    private async analyzeDependencies(
        filePath: string,
        basePath: string,
        includeDependencies: boolean,
        includeReverseDependencies: boolean,
        analyzeImports: boolean,
        depthLevel: number
    ): Promise<string> {
        let analysis = '';

        try {
            if (!fs.existsSync(filePath)) {
                return '';
            }

            const content = fs.readFileSync(filePath, 'utf-8');
            const relativePath = path.relative(process.cwd(), filePath);

            // Analyze what this file imports/requires (dependencies)
            if (includeDependencies && analyzeImports) {
                const imports = this.extractImports(content, filePath);
                if (imports.length > 0) {
                    analysis += `### 📥 **Dependencies** (What \`${relativePath}\` imports):\n\n`;
                    for (const imp of imports.slice(0, 10)) {
                        analysis += `- **${imp.type}**: \`${imp.source}\`${imp.imports ? ` → ${imp.imports.join(', ')}` : ''}\n`;
                        if (imp.resolvedPath) {
                            analysis += `  → *Resolved to:* \`${path.relative(process.cwd(), imp.resolvedPath)}\`\n`;
                        }
                    }
                    analysis += '\n';

                    // Deep dependency analysis
                    if (depthLevel > 1) {
                        const deepDeps = await this.getDeepDependencies(filePath, basePath, depthLevel - 1, new Set([filePath]));
                        if (deepDeps.length > 0) {
                            analysis += `### 🔍 **Deep Dependencies** (Level ${depthLevel}):\n\n`;
                            for (const dep of deepDeps.slice(0, 8)) {
                                analysis += `- \`${path.relative(process.cwd(), dep)}\`\n`;
                            }
                            analysis += '\n';
                        }
                    }
                }
            }

            // Analyze what files import/require this file (reverse dependencies)
            if (includeReverseDependencies) {
                const reverseDeps = await this.findReverseDependencies(filePath, basePath);
                if (reverseDeps.length > 0) {
                    analysis += `### 📤 **Reverse Dependencies** (What imports \`${relativePath}\`):\n\n`;
                    for (const dep of reverseDeps.slice(0, 10)) {
                        analysis += `- \`${dep.file}\` (line ${dep.line})\n`;
                        analysis += `  \`\`\`${this.getLanguageFromExtension(dep.file)}\n  ${dep.line}: ${dep.content.trim()}\n  \`\`\`\n`;
                    }
                    analysis += '\n';
                }
            }

            // Analyze exports from this file
            if (analyzeImports) {
                const exports = this.extractExports(content, filePath);
                if (exports.length > 0) {
                    analysis += `### 📦 **Exports** (What \`${relativePath}\` provides):\n\n`;
                    for (const exp of exports.slice(0, 10)) {
                        analysis += `- **${exp.type}**: \`${exp.name}\`${exp.isDefault ? ' *(default)*' : ''}\n`;
                    }
                    analysis += '\n';
                }
            }

        } catch (error) {
            // Ignore errors for individual file analysis
        }

        return analysis;
    }

    private extractImports(content: string, filePath: string): Array<{
        type: string;
        source: string;
        imports?: string[];
        resolvedPath?: string;
    }> {
        const imports: Array<{
            type: string;
            source: string;
            imports?: string[];
            resolvedPath?: string;
        }> = [];
        
        const ext = path.extname(filePath).toLowerCase();
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Skip comments
            if (this.isCommentLine(line, filePath)) continue;

            if (['.ts', '.tsx', '.js', '.jsx', '.mjs'].includes(ext)) {
                // ES6 imports
                const esImportMatch = line.match(/import\s+(?:(\w+)|\{([^}]+)\}|(\*\s+as\s+\w+))\s+from\s+['"`]([^'"`]+)['"`]/);
                if (esImportMatch) {
                    const [, defaultImport, namedImports, namespaceImport, source] = esImportMatch;
                    const importList = namedImports ? namedImports.split(',').map(s => s.trim()) : 
                                     defaultImport ? [defaultImport] : 
                                     namespaceImport ? [namespaceImport] : [];
                    
                    imports.push({
                        type: 'ES6 Import',
                        source,
                        imports: importList,
                        resolvedPath: this.resolveImportPath(source, filePath)
                    });
                }

                // CommonJS require
                const requireMatch = line.match(/(?:const|let|var)\s+(?:\{([^}]+)\}|(\w+))\s*=\s*require\(['"`]([^'"`]+)['"`]\)/);
                if (requireMatch) {
                    const [, destructured, variable, source] = requireMatch;
                    const importList = destructured ? destructured.split(',').map(s => s.trim()) : 
                                     variable ? [variable] : [];
                    
                    imports.push({
                        type: 'CommonJS Require',
                        source,
                        imports: importList,
                        resolvedPath: this.resolveImportPath(source, filePath)
                    });
                }
            } else if (ext === '.py') {
                // Python imports
                const pythonImportMatch = line.match(/(?:from\s+(\S+)\s+)?import\s+(.+)/);
                if (pythonImportMatch) {
                    const [, fromModule, imports_] = pythonImportMatch;
                    const source = fromModule || imports_.split(',')[0].trim().split(' ')[0];
                    const importList = imports_.split(',').map(s => s.trim());
                    
                    imports.push({
                        type: 'Python Import',
                        source,
                        imports: importList
                    });
                }
            } else if (ext === '.java') {
                // Java imports
                const javaImportMatch = line.match(/import\s+(?:static\s+)?([^;]+);/);
                if (javaImportMatch) {
                    imports.push({
                        type: 'Java Import',
                        source: javaImportMatch[1]
                    });
                }
            }
        }

        return imports;
    }

    private extractExports(content: string, filePath: string): Array<{
        type: string;
        name: string;
        isDefault: boolean;
    }> {
        const exports: Array<{
            type: string;
            name: string;
            isDefault: boolean;
        }> = [];
        
        const ext = path.extname(filePath).toLowerCase();
        const lines = content.split('\n');

        for (const line of lines) {
            const trimmed = line.trim();
            if (this.isCommentLine(trimmed, filePath)) continue;

            if (['.ts', '.tsx', '.js', '.jsx', '.mjs'].includes(ext)) {
                // Export default
                const defaultExportMatch = trimmed.match(/export\s+default\s+(?:(?:class|function|const|let|var)\s+)?(\w+)/);
                if (defaultExportMatch) {
                    exports.push({
                        type: 'Default Export',
                        name: defaultExportMatch[1],
                        isDefault: true
                    });
                }

                // Named exports
                const namedExportMatch = trimmed.match(/export\s+(?:(?:class|function|const|let|var)\s+(\w+)|{\s*([^}]+)\s*})/);
                if (namedExportMatch) {
                    const [, singleExport, multipleExports] = namedExportMatch;
                    if (singleExport) {
                        exports.push({
                            type: 'Named Export',
                            name: singleExport,
                            isDefault: false
                        });
                    } else if (multipleExports) {
                        const exportNames = multipleExports.split(',').map(s => s.trim().split(' as ')[0]);
                        for (const name of exportNames) {
                            exports.push({
                                type: 'Named Export',
                                name,
                                isDefault: false
                            });
                        }
                    }
                }

                // CommonJS exports
                const cjsExportMatch = trimmed.match(/(?:module\.exports|exports)(?:\.(\w+))?\s*=\s*(\w+)/);
                if (cjsExportMatch) {
                    const [, property, value] = cjsExportMatch;
                    exports.push({
                        type: 'CommonJS Export',
                        name: property || value,
                        isDefault: !property
                    });
                }
            }
        }

        return exports;
    }

    private resolveImportPath(importPath: string, fromFile: string): string | undefined {
        try {
            if (importPath.startsWith('.')) {
                // Relative import
                const resolved = path.resolve(path.dirname(fromFile), importPath);
                return this.tryResolveWithExtensions(resolved);
            } else if (importPath.startsWith('/')) {
                // Absolute path
                return this.tryResolveWithExtensions(importPath);
            } else {
                // Node modules or package imports
                const fromDir = path.dirname(fromFile);
                
                // Try node_modules resolution
                const nodeModulesPath = this.findInNodeModules(importPath, fromDir);
                if (nodeModulesPath) {
                    return nodeModulesPath;
                }
                
                // Try TypeScript path mapping (if tsconfig.json exists)
                const tsconfigPath = this.findTsConfig(fromDir);
                if (tsconfigPath) {
                    const mappedPath = this.resolveTsConfigPath(importPath, tsconfigPath, fromFile);
                    if (mappedPath) {
                        return mappedPath;
                    }
                }
                
                // Try workspace alias resolution (common in monorepos)
                const aliasPath = this.resolveWorkspaceAlias(importPath, fromDir);
                if (aliasPath) {
                    return aliasPath;
                }
            }
        } catch (error) {
            // Ignore resolution errors
        }
        
        return undefined;
    }

    private tryResolveWithExtensions(basePath: string): string | undefined {
        // Try different extensions in order of preference
        const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.vue', '.svelte'];
        
        // First try the path as-is
        if (fs.existsSync(basePath)) {
            const stats = fs.statSync(basePath);
            if (stats.isFile()) {
                return basePath;
            } else if (stats.isDirectory()) {
                // Try index files
                for (const ext of extensions) {
                    const indexFile = path.join(basePath, 'index' + ext);
                    if (fs.existsSync(indexFile)) {
                        return indexFile;
                    }
                }
                
                // Try package.json main field
                const packageJsonPath = path.join(basePath, 'package.json');
                if (fs.existsSync(packageJsonPath)) {
                    try {
                        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
                        const mainField = packageJson.main || packageJson.module || packageJson.exports;
                        if (typeof mainField === 'string') {
                            const mainPath = path.resolve(basePath, mainField);
                            const resolved = this.tryResolveWithExtensions(mainPath);
                            if (resolved) return resolved;
                        }
                    } catch (e) {
                        // Ignore package.json parsing errors
                    }
                }
            }
        }
        
        // Try with extensions
        for (const ext of extensions) {
            const withExt = basePath + ext;
            if (fs.existsSync(withExt)) {
                return withExt;
            }
        }
        
        return undefined;
    }

    private findInNodeModules(moduleName: string, fromDir: string): string | undefined {
        let currentDir = fromDir;
        
        while (currentDir !== path.dirname(currentDir)) {
            const nodeModulesPath = path.join(currentDir, 'node_modules', moduleName);
            
            if (fs.existsSync(nodeModulesPath)) {
                const stats = fs.statSync(nodeModulesPath);
                if (stats.isFile()) {
                    return nodeModulesPath;
                } else if (stats.isDirectory()) {
                    // Try to resolve main entry point
                    const resolved = this.tryResolveWithExtensions(nodeModulesPath);
                    if (resolved) return resolved;
                }
            }
            
            currentDir = path.dirname(currentDir);
        }
        
        return undefined;
    }

    private findTsConfig(fromDir: string): string | undefined {
        let currentDir = fromDir;
        
        while (currentDir !== path.dirname(currentDir)) {
            const tsconfigPath = path.join(currentDir, 'tsconfig.json');
            if (fs.existsSync(tsconfigPath)) {
                return tsconfigPath;
            }
            
            currentDir = path.dirname(currentDir);
        }
        
        return undefined;
    }

    private resolveTsConfigPath(importPath: string, tsconfigPath: string, _fromFile: string): string | undefined {
        try {
            const tsconfigContent = fs.readFileSync(tsconfigPath, 'utf-8');
            const tsconfig = JSON.parse(tsconfigContent);
            
            if (tsconfig.compilerOptions && tsconfig.compilerOptions.paths) {
                const baseUrl = tsconfig.compilerOptions.baseUrl || '.';
                const basePath = path.resolve(path.dirname(tsconfigPath), baseUrl);
                
                for (const [pattern, mappings] of Object.entries(tsconfig.compilerOptions.paths)) {
                    const regex = new RegExp('^' + pattern.replace('*', '(.*)') + '$');
                    const match = importPath.match(regex);
                    
                    if (match) {
                        for (const mapping of mappings as string[]) {
                            const resolved = path.resolve(basePath, mapping.replace('*', match[1] || ''));
                            const finalPath = this.tryResolveWithExtensions(resolved);
                            if (finalPath) {
                                return finalPath;
                            }
                        }
                    }
                }
            }
        } catch (error) {
            // Ignore tsconfig parsing errors
        }
        
        return undefined;
    }

    private resolveWorkspaceAlias(importPath: string, fromDir: string): string | undefined {
        // Common alias patterns
        const commonAliases = [
            { alias: '@/', replacement: 'src/' },
            { alias: '~/', replacement: 'src/' },
            { alias: '@components/', replacement: 'src/components/' },
            { alias: '@utils/', replacement: 'src/utils/' },
            { alias: '@lib/', replacement: 'src/lib/' },
            { alias: '@services/', replacement: 'src/services/' },
        ];
        
        for (const { alias, replacement } of commonAliases) {
            if (importPath.startsWith(alias)) {
                const projectRoot = this.findProjectRoot(fromDir);
                if (projectRoot) {
                    const resolvedPath = path.resolve(projectRoot, importPath.replace(alias, replacement));
                    const finalPath = this.tryResolveWithExtensions(resolvedPath);
                    if (finalPath) {
                        return finalPath;
                    }
                }
            }
        }
        
        return undefined;
    }

    private findProjectRoot(fromDir: string): string | undefined {
        let currentDir = fromDir;
        
        while (currentDir !== path.dirname(currentDir)) {
            // Look for common project root indicators
            const indicators = ['package.json', 'tsconfig.json', '.git', 'yarn.lock', 'pnpm-lock.yaml'];
            
            for (const indicator of indicators) {
                if (fs.existsSync(path.join(currentDir, indicator))) {
                    return currentDir;
                }
            }
            
            currentDir = path.dirname(currentDir);
        }
        
        return undefined;
    }

    private async getDeepDependencies(
        filePath: string,
        basePath: string,
        depth: number,
        visited: Set<string>
    ): Promise<string[]> {
        if (depth <= 0 || visited.has(filePath)) {
            return [];
        }

        const dependencies: string[] = [];
        visited.add(filePath);

        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const imports = this.extractImports(content, filePath);

            for (const imp of imports) {
                if (imp.resolvedPath && fs.existsSync(imp.resolvedPath) && !visited.has(imp.resolvedPath)) {
                    dependencies.push(imp.resolvedPath);
                    
                    if (depth > 1) {
                        const subDeps = await this.getDeepDependencies(imp.resolvedPath, basePath, depth - 1, visited);
                        dependencies.push(...subDeps);
                    }
                }
            }
        } catch (error) {
            // Ignore errors
        }

        return [...new Set(dependencies)]; // Remove duplicates
    }

    private async findReverseDependencies(
        targetFile: string,
        basePath: string
    ): Promise<Array<{ file: string; line: number; content: string }>> {
        const reverseDeps: Array<{ file: string; line: number; content: string }> = [];
        const targetName = path.basename(targetFile, path.extname(targetFile));
        const targetRelativePath = path.relative(basePath, targetFile);
        const targetWithoutExt = targetRelativePath.replace(/\.[^/.]+$/, '');

        const allFiles = this.findFilesRecursive(
            basePath,
            (filePath) => {
                const ext = path.extname(filePath).toLowerCase();
                return ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.vue', '.svelte', '.py', '.java', '.go', '.rs'].includes(ext) && filePath !== targetFile;
            },
            (dirPath) => !['node_modules', '.git', 'dist', 'build', 'coverage', '.next', 'target', '__pycache__'].some(excluded => path.basename(dirPath) === excluded)
        );

        for (const file of allFiles) {
            try {
                const content = fs.readFileSync(file, 'utf-8');
                const lines = content.split('\n');
                const currentFileDir = path.dirname(file);

                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    
                    // Skip comments
                    if (this.isCommentLine(line, file)) continue;

                    // Enhanced import patterns that might reference our target file
                    const importPatterns = [
                        // Exact file name matches (common cases)
                        new RegExp(`['"\`]\\.\\/.*\\b${targetName}\\b['"\`]`),
                        new RegExp(`['"\`]\\.\\..*\\b${targetName}\\b['"\`]`),
                        
                        // Relative path matches
                        new RegExp(`['"\`]\\.\\/.*${targetWithoutExt.replace(/\\/g, '\\/')}['"\`]`),
                        new RegExp(`['"\`]\\.\\..*${targetWithoutExt.replace(/\\/g, '\\/')}['"\`]`),
                        
                        // Import statement patterns
                        new RegExp(`import.*from\\s*['"\`][^'"\`]*\\b${targetName}\\b[^'"\`]*['"\`]`, 'i'),
                        new RegExp(`import\\s*\\{[^}]*\\b${targetName}\\b[^}]*\\}.*from`, 'i'),
                        new RegExp(`import\\s+\\b${targetName}\\b\\s+from`, 'i'),
                        new RegExp(`import\\s*\\*\\s+as\\s+\\w+\\s+from\\s*['"\`][^'"\`]*\\b${targetName}\\b[^'"\`]*['"\`]`, 'i'),
                        
                        // Require patterns
                        new RegExp(`require\\s*\\(\\s*['"\`][^'"\`]*\\b${targetName}\\b[^'"\`]*['"\`]\\s*\\)`, 'i'),
                        
                        // Dynamic import patterns
                        new RegExp(`import\\s*\\(\\s*['"\`][^'"\`]*\\b${targetName}\\b[^'"\`]*['"\`]\\s*\\)`, 'i'),
                        
                        // JSX component usage (for React components)
                        new RegExp(`<${targetName}(?:\\s|>|\\s*\\/\\s*>)`, 'i'),
                        
                        // Re-export patterns
                        new RegExp(`export.*from\\s*['"\`][^'"\`]*\\b${targetName}\\b[^'"\`]*['"\`]`, 'i'),
                        new RegExp(`export\\s*\\{[^}]*\\b${targetName}\\b[^}]*\\}.*from`, 'i'),
                        
                        // TypeScript type imports
                        new RegExp(`import\\s+type\\s+\\{[^}]*\\b${targetName}\\b[^}]*\\}.*from`, 'i'),
                        new RegExp(`import\\s+type\\s+\\b${targetName}\\b\\s+from`, 'i'),
                        
                        // Vue component imports
                        new RegExp(`components:\\s*\\{[^}]*\\b${targetName}\\b[^}]*\\}`, 'i'),
                        
                        // Python import patterns
                        new RegExp(`from\\s+[\\w.]*\\b${targetName}\\b[\\w.]*\\s+import`, 'i'),
                        new RegExp(`import\\s+[\\w.]*\\b${targetName}\\b[\\w.]*`, 'i'),
                        
                        // Go import patterns
                        new RegExp(`import\\s+['"\`][^'"\`]*\\b${targetName}\\b[^'"\`]*['"\`]`, 'i'),
                        
                        // Rust use statements
                        new RegExp(`use\\s+[\\w:]*\\b${targetName}\\b[\\w:]*`, 'i'),
                    ];

                    // Check if this line contains an import that could resolve to our target file
                    for (const pattern of importPatterns) {
                        if (pattern.test(line)) {
                            // Additional validation: check if the import path could actually resolve to target file
                            const importMatch = line.match(/['"`]([^'"`]+)['"`]/);
                            if (importMatch) {
                                const importPath = importMatch[1];
                                
                                // Skip if it's clearly not a file import (e.g., npm packages)
                                if (!importPath.startsWith('.') && !importPath.startsWith('/') && !importPath.includes(targetName)) {
                                    continue;
                                }
                                
                                // Try to resolve the import path
                                if (importPath.startsWith('.')) {
                                    const resolvedPath = path.resolve(currentFileDir, importPath);
                                    const possibleTargets = [
                                        resolvedPath,
                                        resolvedPath + '.ts',
                                        resolvedPath + '.tsx',
                                        resolvedPath + '.js',
                                        resolvedPath + '.jsx',
                                        path.join(resolvedPath, 'index.ts'),
                                        path.join(resolvedPath, 'index.tsx'),
                                        path.join(resolvedPath, 'index.js'),
                                        path.join(resolvedPath, 'index.jsx'),
                                    ];
                                    
                                    // Check if any of these resolve to our target file
                                    const normalizedTarget = path.normalize(targetFile);
                                    const isMatchingImport = possibleTargets.some(possible => 
                                        path.normalize(possible) === normalizedTarget
                                    );
                                    
                                    if (isMatchingImport) {
                                        reverseDeps.push({
                                            file: path.relative(process.cwd(), file),
                                            line: i + 1,
                                            content: line
                                        });
                                        break;
                                    }
                                }
                            }
                            
                            // Also add matches that contain the target name in import statements
                            if (line.toLowerCase().includes('import') && line.includes(targetName)) {
                                reverseDeps.push({
                                    file: path.relative(process.cwd(), file),
                                    line: i + 1,
                                    content: line
                                });
                                break;
                            }
                        }
                    }
                }
            } catch (error) {
                // Skip files that can't be read
            }
        }

        // Remove duplicates and sort by file name then line number
        const uniqueDeps = reverseDeps.filter((dep, index, self) => 
            index === self.findIndex(d => d.file === dep.file && d.line === dep.line)
        );

        return uniqueDeps.sort((a, b) => {
            const fileCompare = a.file.localeCompare(b.file);
            return fileCompare !== 0 ? fileCompare : a.line - b.line;
        });
    }

    private isCommentLine(line: string, filePath: string): boolean {
        const trimmed = line.trim();
        const ext = path.extname(filePath).toLowerCase();
        
        // Different comment patterns for different languages
        if (['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs', '.java', '.cs', '.csx', '.cpp', '.cxx', '.cc', '.c', '.h', '.hpp', '.hxx', '.go', '.rs', '.swift', '.kt', '.kts', '.scala', '.groovy', '.dart', '.php'].includes(ext)) {
            return trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.includes('*/') || (trimmed.startsWith('*') && trimmed.length > 1);
        } else if (['.py', '.pyw', '.pyi', '.rb', '.rake', '.sh', '.bash', '.zsh', '.fish', '.pl', '.pm', '.r', '.R', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf'].includes(ext)) {
            return trimmed.startsWith('#');
        } else if (['.html', '.htm', '.xml', '.xsd', '.xsl', '.xslt', '.vue', '.svelte'].includes(ext)) {
            return trimmed.startsWith('<!--') || trimmed.includes('-->');
        } else if (['.sql', '.plsql', '.mysql', '.pgsql'].includes(ext)) {
            return trimmed.startsWith('--') || trimmed.startsWith('/*') || trimmed.includes('*/');
        } else if (['.lua'].includes(ext)) {
            return trimmed.startsWith('--') || trimmed.startsWith('--[[') || trimmed.includes(']]');
        } else if (['.hs', '.lhs'].includes(ext)) {
            return trimmed.startsWith('--') || trimmed.startsWith('{-') || trimmed.includes('-}');
        } else if (['.clj', '.cljs', '.cljc'].includes(ext)) {
            return trimmed.startsWith(';') || trimmed.startsWith('#_');
        } else if (['.ex', '.exs'].includes(ext)) {
            return trimmed.startsWith('#');
        } else if (['.erl', '.hrl'].includes(ext)) {
            return trimmed.startsWith('%');
        } else if (['.m', '.mm'].includes(ext)) {
            return trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.includes('*/');
        } else if (['.ps1', '.psm1', '.psd1'].includes(ext)) {
            return trimmed.startsWith('#') || trimmed.startsWith('<#') || trimmed.includes('#>');
        } else if (['.vb'].includes(ext)) {
            return trimmed.startsWith("'");
        } else if (['.fs', '.fsx'].includes(ext)) {
            return trimmed.startsWith('//') || trimmed.startsWith('(*') || trimmed.includes('*)');
        } else if (['.css', '.scss', '.sass', '.less'].includes(ext)) {
            return trimmed.startsWith('/*') || trimmed.includes('*/') || (ext === '.sass' && trimmed.startsWith('//'));
        } else if (['.tex'].includes(ext)) {
            return trimmed.startsWith('%');
        } else if (['.md', '.markdown'].includes(ext)) {
            return false; // Markdown comments are complex, skip for now
        }
        
        return false;
    }

    private getLanguageFromExtension(filePath: string): string {
        const ext = path.extname(filePath).toLowerCase();
        const languageMap: Record<string, string> = {
            // JavaScript/TypeScript
            '.ts': 'typescript',
            '.tsx': 'typescript',
            '.d.ts': 'typescript',
            '.js': 'javascript',
            '.jsx': 'javascript',
            '.mjs': 'javascript',
            '.cjs': 'javascript',
            '.es6': 'javascript',
            
            // Python
            '.py': 'python',
            '.pyw': 'python',
            '.pyi': 'python',
            '.pyx': 'python',
            
            // Java ecosystem
            '.java': 'java',
            '.scala': 'scala',
            '.kt': 'kotlin',
            '.kts': 'kotlin',
            '.groovy': 'groovy',
            
            // .NET
            '.cs': 'csharp',
            '.csx': 'csharp',
            '.vb': 'vbnet',
            '.fs': 'fsharp',
            '.fsx': 'fsharp',
            
            // Systems programming
            '.go': 'go',
            '.rs': 'rust',
            '.rlib': 'rust',
            '.cpp': 'cpp',
            '.cxx': 'cpp',
            '.cc': 'cpp',
            '.c': 'c',
            '.h': 'c',
            '.hpp': 'cpp',
            '.hxx': 'cpp',
            
            // Web development
            '.php': 'php',
            '.phtml': 'php',
            '.php3': 'php',
            '.php4': 'php',
            '.php5': 'php',
            '.phps': 'php',
            '.rb': 'ruby',
            '.rake': 'ruby',
            '.gemspec': 'ruby',
            '.swift': 'swift',
            '.dart': 'dart',
            
            // Functional languages
            '.ex': 'elixir',
            '.exs': 'elixir',
            '.erl': 'erlang',
            '.hrl': 'erlang',
            '.hs': 'haskell',
            '.lhs': 'haskell',
            '.clj': 'clojure',
            '.cljs': 'clojure',
            '.cljc': 'clojure',
            '.edn': 'clojure',
            
            // Scripting
            '.lua': 'lua',
            '.pl': 'perl',
            '.pm': 'perl',
            '.t': 'perl',
            '.r': 'r',
            '.R': 'r',
            '.m': 'matlab',
            '.sh': 'bash',
            '.bash': 'bash',
            '.zsh': 'bash',
            '.fish': 'fish',
            '.ps1': 'powershell',
            '.psm1': 'powershell',
            '.psd1': 'powershell',
            
            // Web frameworks
            '.vue': 'vue',
            '.svelte': 'svelte',
            
            // Configuration and data
            '.yaml': 'yaml',
            '.yml': 'yaml',
            '.json': 'json',
            '.jsonc': 'json',
            '.xml': 'xml',
            '.xsd': 'xml',
            '.xsl': 'xml',
            '.xslt': 'xml',
            '.toml': 'toml',
            '.ini': 'ini',
            '.cfg': 'ini',
            '.conf': 'ini',
            
            // Database
            '.sql': 'sql',
            '.plsql': 'sql',
            '.mysql': 'sql',
            '.pgsql': 'sql',
            
            // Mobile development
            '.mm': 'objectivec',
            
            // Markup
            '.html': 'html',
            '.htm': 'html',
            '.css': 'css',
            '.scss': 'scss',
            '.sass': 'sass',
            '.less': 'less',
            '.md': 'markdown',
            '.markdown': 'markdown',
            '.rst': 'rst',
            '.tex': 'latex',
        };
        
        return languageMap[ext] || 'text';
    }

    private findFilesRecursive(
        startPath: string,
        fileFilter: (filePath: string) => boolean,
        dirFilter: (dirPath: string) => boolean
    ): string[] {
        let results: string[] = [];
        try {
            if (!fs.existsSync(startPath)) {
                return [];
            }
            const items = fs.readdirSync(startPath, { withFileTypes: true });

            for (const item of items) {
                const fullPath = path.join(startPath, item.name);
                if (item.isDirectory()) {
                    if (dirFilter(fullPath)) {
                        results = results.concat(this.findFilesRecursive(fullPath, fileFilter, dirFilter));
                    }
                } else if (item.isFile()) {
                    if (fileFilter(fullPath)) {
                        results.push(fullPath);
                    }
                }
            }
        } catch (error) {
            // Ignore errors like permission denied for a directory
        }
        return results;
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
            // 在文件操作之前创建检查点
            await CheckpointService.getInstance().createCheckpoint(params.path);
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

            // 打印文件创建信息到控制台
            console.log(`📄 Create file: ${targetPath} (${content.length} chars)`);

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
            const protectedPath = path.resolve(process.cwd(), '.openai-cli');

            // Prevent deletion of the .openai-cli directory and its contents
            if (targetPath.startsWith(protectedPath)) {
                return this.createSuccessResponse(request.id, `❌ **Error: Protected Path**\n\nThe path "${params.path}" is within the protected '.openai-cli' directory and cannot be deleted.`);
            }

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

                console.log(`🗑️ : ${targetPath}`);
                return this.createSuccessResponse(request.id, resultMessage);

            } else {
                // Handle file deletion
                await CheckpointService.getInstance().createCheckpoint(targetPath);
                const fileSize = stats.size;
                fs.unlinkSync(targetPath);

                const resultMessage = `✅ **File deleted successfully**\n\n**File:** \`${targetPath}\`\n**Size:** ${this.formatFileSize(fileSize)}\n\n*File has been permanently deleted.*`;

                console.log(`🗑️ : ${targetPath}`);

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

            console.log(`📁 : ${targetPath}`);

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

            // 在文件操作之前创建检查点
            await CheckpointService.getInstance().createCheckpoint(params.path);

            // Check if file exists
            if (!fs.existsSync(targetPath)) {
                return this.createSuccessResponse(request.id, `❌ **Error: File does not exist**\n\nThe file "${params.path}" was not found.\n\nPossible solutions:\n- Check the file path spelling\n- Verify the file exists\n- Create the file first using create_file tool\n\n*Please verify the file path and try again.*`);
            }

            // Read the file first to validate line numbers and get content
            const originalContent = fs.readFileSync(targetPath, encoding as BufferEncoding);
            const lines = originalContent.split('\n');

            // Validate line numbers
            if (params.startLine < 1) {
                return this.createSuccessResponse(request.id, `❌ **Error: Invalid start line number**\n\nStart line ${params.startLine} cannot be less than 1.\n\n*Please use a valid line number.*`);
            }

            if (params.startLine > params.endLine) {
                return this.createSuccessResponse(request.id, `❌ **Error: Invalid line range**\n\nStart line (${params.startLine}) cannot be greater than end line (${params.endLine}).\n\n*Please ensure startLine ≤ endLine.*`);
            }

            // Perform the edit with robust out-of-bounds handling using splice
            const newContentLines = params.newContent === '' ? [] : params.newContent.split('\n');
            const startIndex = params.startLine - 1;

            // If startLine is past the end, we might need to add padding
            if (startIndex > lines.length) {
                const padding = Array(startIndex - lines.length).fill('');
                lines.push(...padding);
            }

            // Calculate how many lines to delete
            const effectiveEndIndex = Math.min(params.endLine, lines.length);
            const deleteCount = Math.max(0, effectiveEndIndex - startIndex);

            lines.splice(startIndex, deleteCount, ...newContentLines);

            const editedContent = lines.join('\n');
            const editedLines = lines; // For later use in response generation

            // Write the edited content back to the file
            fs.writeFileSync(targetPath, editedContent, encoding as BufferEncoding);

            const contextLines = 30;
            const newContentLineCount = newContentLines.length;

            // 打印文件编辑信息到控制台
            console.log(`✏️ Edit file: ${targetPath} (line ${params.startLine}-${params.startLine + newContentLineCount - 1})`);

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

**CRITICAL ACTION: Review the code block below to ensure the edit is correct and free of syntax errors.**
**Please carefully check for any mismatched or missing brackets, parentheses, or tags.**
\`\`\`${language}
${codeBlock}
\`\`\`

- If the edit is correct, reply: \`✔checked\`
- If the edit is incorrect or contains syntax errors, use the \`edit_file\` tool to make corrections.
- **Important tip: you can use the terminal tool 'execute_command' to run commands, such as 'node --check script.js' or the VSCode 'code' command to check for syntax errors.**`;

            // Create a diff for only the changed portion, but with correct line numbers
            const originalSlice = originalContent.split('\n').slice(params.startLine - 1, params.endLine).join('\n');
            const newSlice = params.newContent;

            // Create a patch with incorrect line numbers first
            const partialPatch = createPatch(params.path, originalSlice, newSlice, '', '', { context: 3 });

            // Manually correct the hunk header line numbers
            const oldContentLineCount = params.endLine - params.startLine + 1;
            const correctHeader = `@@ -${params.startLine},${oldContentLineCount} +${params.startLine},${newContentLineCount} @@`;

            const patchLines = partialPatch.split('\n');
            let diff = partialPatch;
            // The header is usually at index 2, but we search for it to be safe
            const hunkHeaderIndex = patchLines.findIndex(line => line.startsWith('@@'));
            if (hunkHeaderIndex !== -1) {
                patchLines[hunkHeaderIndex] = correctHeader;
                diff = patchLines.join('\n');
            }
            const needsConfirmation = StorageService.isFunctionConfirmationRequired('file-system_edit_file');
            if (!needsConfirmation) {
                console.log(highlight(diff, { language: 'diff', ignoreIllegals: true }));
            }
            return this.createSuccessResponse(request.id, resultMessage);

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