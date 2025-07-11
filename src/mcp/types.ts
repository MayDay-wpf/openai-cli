// MCP服务基础类型定义
export interface MCPRequest {
  id: string;
  method: string;
  params?: any;
}

export interface MCPResponse {
  id: string;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

// 文件读取服务相关类型
export interface ReadFileParams {
  path: string;
  encoding?: string;
  startLine?: number;
  endLine?: number;
}

export interface ReadFileResult {
  content: string;
  size: number;
  lastModified: string;
  encoding: string;
  totalLines?: number;
  lineRange?: {
    start: number;
    end: number;
  };
  hasMore?: boolean;
  tokenCount?: number;
  isPartial?: boolean;
  message?: string;
}

export interface DirectoryItem {
  name: string;
  type: 'file' | 'directory';
  path: string;
  size?: number;
  lastModified?: string;
}

export interface DirectoryResult {
  path: string;
  items: DirectoryItem[];
  totalFiles: number;
  totalDirectories: number;
  structure: string; // Markdown formatted directory tree
}

// 文件操作服务相关类型
export interface CreateFileParams {
  path: string;
  content?: string;
  encoding?: string;
}

export interface DeleteFileParams {
  path: string;
  recursive?: boolean; // For directories
}

export interface CreateDirectoryParams {
  path: string;
  recursive?: boolean; // Create parent directories if they don't exist
}

export interface FileOperationResult {
  success: boolean;
  operation: 'create_file' | 'delete_file' | 'create_directory' | 'delete_directory';
  path: string;
  message: string;
  details?: {
    size?: number;
    created?: string;
    parent_created?: boolean;
    files_deleted?: number;
    directories_deleted?: number;
  };
} 