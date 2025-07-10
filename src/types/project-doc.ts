/**
 * 项目描述文档相关的简化类型定义
 * 用于生成 sawyou.md 文件
 */

/**
 * 项目基本信息
 */
export interface ProjectInfo {
  name: string;
  description: string;
  type: string;
  techStack: string[];
}

/**
 * 项目文件信息
 */
export interface ProjectFile {
  path: string;
  name: string;
  relativePath: string;
  type: 'file' | 'directory';
  content?: string;
}

/**
 * Markdown 文档生成选项
 */
export interface MarkdownDocOptions {
  onStepStart?: (stepKey: string) => void;
  onFileProgress?: (current: number, total: number, fileName?: string) => void;
  checkInterrupt?: () => boolean;
  outputPath?: string;
} 