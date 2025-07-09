/**
 * 项目文档数据结构定义
 * 用于生成和解析 sawyou.json 文件
 */

/**
 * 项目文档的根结构
 */
export interface ProjectDocument {
  metadata: ProjectMetadata;
  overview: ProjectOverview;
  structure: ProjectStructure;
  files: Record<string, FileDocumentation>;
}

/**
 * 项目元数据
 */
export interface ProjectMetadata {
  name: string;
  version: string;
  description?: string;
  generatedAt: string; // ISO 8601 日期时间
  generatedBy: string; // 工具名称和版本
  projectPath: string;
  schemaVersion: string; // 文档格式版本
}

/**
 * 项目概览
 */
export interface ProjectOverview {
  type: ProjectType;
  techStack: string[];
  mainFeatures: string[];
  dependencies: ProjectDependency[];
  entryPoints: EntryPoint[];
}

/**
 * 项目类型
 */
export type ProjectType = 
  | 'web-application'
  | 'mobile-application' 
  | 'cli-tool'
  | 'library'
  | 'api-service'
  | 'desktop-application'
  | 'other';

/**
 * 项目依赖
 */
export interface ProjectDependency {
  name: string;
  version?: string;
  type: 'runtime' | 'development' | 'peer';
  description?: string;
}

/**
 * 入口点
 */
export interface EntryPoint {
  path: string;
  type: 'main' | 'script' | 'export';
  description: string;
}

/**
 * 项目结构
 */
export interface ProjectStructure {
  tree: DirectoryNode;
  directories: Record<string, DirectoryInfo>;
  architecture: ArchitectureInfo;
}

/**
 * 目录节点（用于构建文件树）
 */
export interface DirectoryNode {
  name: string;
  type: 'directory' | 'file';
  path: string;
  children?: DirectoryNode[];
  size?: number; // 文件大小（字节）
  important?: boolean; // 是否为重要文件/目录
}

/**
 * 目录信息
 */
export interface DirectoryInfo {
  path: string;
  purpose: string;
  contains: string[];
  importance: 'high' | 'medium' | 'low';
}

/**
 * 架构信息
 */
export interface ArchitectureInfo {
  pattern: ArchitecturePattern;
  layers: ArchitectureLayer[];
  dataFlow: DataFlowInfo[];
}

/**
 * 架构模式
 */
export type ArchitecturePattern = 
  | 'mvc'
  | 'mvp' 
  | 'mvvm'
  | 'layered'
  | 'microservices'
  | 'component-based'
  | 'modular'
  | 'other';

/**
 * 架构层级
 */
export interface ArchitectureLayer {
  name: string;
  description: string;
  directories: string[];
  responsibilities: string[];
}

/**
 * 数据流信息
 */
export interface DataFlowInfo {
  from: string;
  to: string;
  description: string;
  type: 'data' | 'control' | 'dependency';
}

/**
 * 文件文档
 */
export interface FileDocumentation {
  path: string;
  name: string;
  type: FileType;
  size: number;
  purpose: string;
  exports?: ExportInfo[];
  imports?: ImportInfo[];
  functions?: FunctionInfo[];
  classes?: ClassInfo[];
  interfaces?: InterfaceInfo[];
  constants?: ConstantInfo[];
  dependencies: string[];
  usedBy: string[];
  importance: 'high' | 'medium' | 'low';
  tags: string[];
  lastModified?: string;
}

/**
 * 文件类型
 */
export type FileType = 
  // 前端语言
  | 'typescript'
  | 'javascript'
  | 'frontend-framework'
  | 'markup'
  | 'style'
  
  // 后端语言
  | 'python'
  | 'java'
  | 'dotnet'
  | 'php'
  | 'ruby'
  | 'golang'
  | 'rust'
  | 'cpp'
  | 'swift'
  | 'kotlin'
  | 'scala'
  | 'clojure'
  | 'haskell'
  | 'ocaml'
  | 'fsharp'
  | 'r'
  | 'objectivec'
  | 'perl'
  | 'lua'
  | 'dart'
  
  // 数据和配置
  | 'json'
  | 'yaml'
  | 'xml'
  | 'config'
  
  // 数据库
  | 'database'
  
  // 文档
  | 'markdown'
  | 'text'
  | 'documentation'
  
  // 脚本
  | 'shell'
  | 'powershell'
  | 'batch'
  
  // 构建工具
  | 'docker'
  | 'build'
  
  // 测试和其他
  | 'test'
  | 'template'
  | 'asset'
  | 'other';

/**
 * 导出信息
 */
export interface ExportInfo {
  name: string;
  type: 'function' | 'class' | 'interface' | 'constant' | 'type' | 'default';
  description?: string;
  signature?: string;
}

/**
 * 导入信息
 */
export interface ImportInfo {
  from: string;
  imports: string[];
  type: 'named' | 'default' | 'namespace' | 'side-effect';
}

/**
 * 函数信息
 */
export interface FunctionInfo {
  name: string;
  description?: string;
  parameters?: ParameterInfo[];
  returnType?: string;
  isAsync: boolean;
  isExported: boolean;
  visibility?: 'public' | 'private' | 'protected';
}

/**
 * 参数信息
 */
export interface ParameterInfo {
  name: string;
  type?: string;
  required: boolean;
  description?: string;
}

/**
 * 类信息
 */
export interface ClassInfo {
  name: string;
  description?: string;
  extends?: string;
  implements?: string[];
  methods?: FunctionInfo[];
  properties?: PropertyInfo[];
  isExported: boolean;
  isAbstract?: boolean;
}

/**
 * 属性信息
 */
export interface PropertyInfo {
  name: string;
  type?: string;
  description?: string;
  visibility?: 'public' | 'private' | 'protected';
  isStatic?: boolean;
  isReadonly?: boolean;
}

/**
 * 接口信息
 */
export interface InterfaceInfo {
  name: string;
  description?: string;
  extends?: string[];
  properties?: PropertyInfo[];
  methods?: FunctionInfo[];
  isExported: boolean;
}

/**
 * 常量信息
 */
export interface ConstantInfo {
  name: string;
  type?: string;
  value?: string;
  description?: string;
  isExported: boolean;
}

/**
 * 文档查询选项
 */
export interface DocumentQueryOptions {
  includeImports?: boolean;
  includeExports?: boolean;
  includeFunctions?: boolean;
  includeClasses?: boolean;
  depth?: number;
}

/**
 * 文档查询结果
 */
export interface DocumentQueryResult {
  file?: FileDocumentation;
  relatedFiles?: FileDocumentation[];
  dependencies?: FileDocumentation[];
  usages?: FileDocumentation[];
} 