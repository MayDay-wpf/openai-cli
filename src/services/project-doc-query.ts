import * as fs from 'fs';
import * as path from 'path';
import { languageService } from './language';
import {
  ProjectDocument,
  FileDocumentation,
  DocumentQueryOptions,
  DocumentQueryResult
} from '../types/project-doc';

/**
 * 项目文档查询服务
 * 用于查询和分析 sawyou.json 文档
 */
export class ProjectDocumentQueryService {
  private document: ProjectDocument | null = null;
  private documentPath: string;
  private lastLoadTime: number = 0;
  private cacheExpiration: number = 30000; // 30秒缓存

  constructor(projectRoot?: string) {
    const root = projectRoot || process.cwd();
    this.documentPath = path.join(root, 'sawyou.json');
  }

  /**
   * 加载项目文档
   */
  async loadDocument(): Promise<boolean> {
    try {
      // 检查文件是否存在
      if (!fs.existsSync(this.documentPath)) {
        const messages = languageService.getMessages();
        console.warn(`${messages.projectDoc.errors.documentNotFound}: ${this.documentPath}`);
        return false;
      }

      // 检查缓存是否过期
      const now = Date.now();
      if (this.document && (now - this.lastLoadTime) < this.cacheExpiration) {
        return true;
      }

      // 读取和解析文档
      const content = await fs.promises.readFile(this.documentPath, 'utf-8');
      this.document = JSON.parse(content);
      this.lastLoadTime = now;

      return true;
    } catch (error) {
      const messages = languageService.getMessages();
      console.error(`${messages.projectDoc.errors.loadFailed}:`, error);
      return false;
    }
  }

  /**
   * 获取项目元数据
   */
  async getMetadata() {
    if (!await this.loadDocument() || !this.document) {
      return null;
    }
    return this.document.metadata;
  }

  /**
   * 获取项目概览
   */
  async getOverview() {
    if (!await this.loadDocument() || !this.document) {
      return null;
    }
    return this.document.overview;
  }

  /**
   * 获取项目结构
   */
  async getStructure() {
    if (!await this.loadDocument() || !this.document) {
      return null;
    }
    return this.document.structure;
  }

  /**
   * 按文件路径查询文件文档
   */
  async queryFileByPath(filePath: string, options: DocumentQueryOptions = {}): Promise<DocumentQueryResult> {
    if (!await this.loadDocument() || !this.document) {
      return {};
    }

    // 标准化路径
    const normalizedPath = this.normalizePath(filePath);
    
    // 查找精确匹配
    const file = this.document.files[normalizedPath];
    if (!file) {
      // 尝试模糊匹配
      const fuzzyMatch = this.findFuzzyMatch(normalizedPath);
      if (!fuzzyMatch) {
        return {};
      }
      return this.buildQueryResult(fuzzyMatch, options);
    }

    return this.buildQueryResult(file, options);
  }

  /**
   * 搜索文件
   */
  async searchFiles(query: string, maxResults: number = 10): Promise<FileDocumentation[]> {
    if (!await this.loadDocument() || !this.document) {
      return [];
    }

    const normalizedQuery = query.toLowerCase();
    const allFiles = Object.values(this.document.files);
    
    // 模糊搜索
    const matches = allFiles.filter(file => {
      return file.path.toLowerCase().includes(normalizedQuery) ||
             file.name.toLowerCase().includes(normalizedQuery) ||
             file.purpose.toLowerCase().includes(normalizedQuery) ||
             file.tags.some(tag => tag.toLowerCase().includes(normalizedQuery));
    });

    // 按相关性排序
    matches.sort((a, b) => {
      const aScore = this.calculateRelevanceScore(a, normalizedQuery);
      const bScore = this.calculateRelevanceScore(b, normalizedQuery);
      return bScore - aScore;
    });

    return matches.slice(0, maxResults);
  }

  /**
   * 查找依赖关系
   */
  async findDependencies(filePath: string, maxDepth: number = 2): Promise<FileDocumentation[]> {
    const file = await this.queryFileByPath(filePath);
    if (!file.file || !this.document) {
      return [];
    }

    const visited = new Set<string>();
    const dependencies: FileDocumentation[] = [];
    
    this.collectDependencies(file.file.path, dependencies, visited, maxDepth, 0);
    
    return dependencies;
  }

  /**
   * 查找使用关系（谁在使用这个文件）
   */
  async findUsages(filePath: string, maxDepth: number = 2): Promise<FileDocumentation[]> {
    const file = await this.queryFileByPath(filePath);
    if (!file.file || !this.document) {
      return [];
    }

    const visited = new Set<string>();
    const usages: FileDocumentation[] = [];
    
    this.collectUsages(file.file.path, usages, visited, maxDepth, 0);
    
    return usages;
  }

  /**
   * 获取文件统计信息
   */
  async getFileStats(): Promise<any> {
    if (!await this.loadDocument() || !this.document) {
      return null;
    }

    const allFiles = Object.values(this.document.files);
    
    return {
      totalFiles: allFiles.length,
      fileTypes: this.groupBy(allFiles, f => f.type),
      importance: this.groupBy(allFiles, f => f.importance),
      avgSize: allFiles.reduce((sum, f) => sum + f.size, 0) / allFiles.length,
      totalSize: allFiles.reduce((sum, f) => sum + f.size, 0),
      topTags: this.getTopTags(allFiles),
      mostConnected: this.getMostConnectedFiles(allFiles)
    };
  }

  /**
   * 导出为不同格式
   */
  async exportToFormat(format: 'markdown' | 'html' | 'txt'): Promise<string> {
    if (!await this.loadDocument() || !this.document) {
      return '';
    }

    switch (format) {
      case 'markdown':
        return this.exportToMarkdown();
      case 'html':
        return this.exportToHTML();
      case 'txt':
        return this.exportToText();
      default:
        throw new Error(`不支持的格式: ${format}`);
    }
  }

  // ========== 私有方法 ==========

  /**
   * 标准化文件路径
   */
  private normalizePath(filePath: string): string {
    return filePath.replace(/\\/g, '/').replace(/^\.\//, '');
  }

  /**
   * 模糊匹配文件
   */
  private findFuzzyMatch(filePath: string): FileDocumentation | null {
    if (!this.document) return null;

    const allFiles = Object.values(this.document.files);
    
    // 尝试按文件名匹配
    const fileName = path.basename(filePath);
    const nameMatch = allFiles.find(f => f.name === fileName);
    if (nameMatch) return nameMatch;

    // 尝试部分路径匹配
    const pathMatch = allFiles.find(f => 
      f.path.includes(filePath) || filePath.includes(f.path)
    );
    if (pathMatch) return pathMatch;

    return null;
  }

  /**
   * 构建查询结果
   */
  private buildQueryResult(file: FileDocumentation, options: DocumentQueryOptions): DocumentQueryResult {
    const result: DocumentQueryResult = { file };

    if (!this.document) return result;

    // 添加相关文件
    if (options.includeImports && file.imports) {
      result.dependencies = file.dependencies
        .map(dep => this.document!.files[dep])
        .filter(Boolean);
    }

    if (options.includeExports) {
      result.usages = file.usedBy
        .map(usage => this.document!.files[usage])
        .filter(Boolean);
    }

    return result;
  }

  /**
   * 计算相关性得分
   */
  private calculateRelevanceScore(file: FileDocumentation, query: string): number {
    let score = 0;
    
    // 路径匹配
    if (file.path.toLowerCase().includes(query)) score += 10;
    if (file.name.toLowerCase().includes(query)) score += 15;
    
    // 内容匹配
    if (file.purpose.toLowerCase().includes(query)) score += 5;
    
    // 标签匹配
    file.tags.forEach(tag => {
      if (tag.toLowerCase().includes(query)) score += 3;
    });
    
    // 重要性加权
    if (file.importance === 'high') score *= 1.5;
    if (file.importance === 'low') score *= 0.8;
    
    return score;
  }

  /**
   * 递归收集依赖
   */
  private collectDependencies(
    filePath: string, 
    result: FileDocumentation[], 
    visited: Set<string>, 
    maxDepth: number, 
    currentDepth: number
  ): void {
    if (currentDepth >= maxDepth || visited.has(filePath) || !this.document) {
      return;
    }

    visited.add(filePath);
    const file = this.document.files[filePath];
    if (!file) return;

    for (const dep of file.dependencies) {
      const depFile = this.document.files[dep];
      if (depFile && !result.some(f => f.path === dep)) {
        result.push(depFile);
        this.collectDependencies(dep, result, visited, maxDepth, currentDepth + 1);
      }
    }
  }

  /**
   * 递归收集使用关系
   */
  private collectUsages(
    filePath: string, 
    result: FileDocumentation[], 
    visited: Set<string>, 
    maxDepth: number, 
    currentDepth: number
  ): void {
    if (currentDepth >= maxDepth || visited.has(filePath) || !this.document) {
      return;
    }

    visited.add(filePath);
    const file = this.document.files[filePath];
    if (!file) return;

    for (const usage of file.usedBy) {
      const usageFile = this.document.files[usage];
      if (usageFile && !result.some(f => f.path === usage)) {
        result.push(usageFile);
        this.collectUsages(usage, result, visited, maxDepth, currentDepth + 1);
      }
    }
  }

  /**
   * 按字段分组
   */
  private groupBy<T, K extends string | number>(array: T[], keyFn: (item: T) => K): Record<K, number> {
    const groups = {} as Record<K, number>;
    for (const item of array) {
      const key = keyFn(item);
      groups[key] = (groups[key] || 0) + 1;
    }
    return groups;
  }

  /**
   * 获取热门标签
   */
  private getTopTags(files: FileDocumentation[], limit: number = 10): Array<{tag: string, count: number}> {
    const tagCounts: Record<string, number> = {};
    
    files.forEach(file => {
      file.tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });
    
    return Object.entries(tagCounts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * 获取连接度最高的文件
   */
  private getMostConnectedFiles(files: FileDocumentation[], limit: number = 10): Array<{file: string, connections: number}> {
    return files
      .map(file => ({
        file: file.path,
        connections: file.dependencies.length + file.usedBy.length
      }))
      .sort((a, b) => b.connections - a.connections)
      .slice(0, limit);
  }

  /**
   * 导出为 Markdown 格式
   */
  private exportToMarkdown(): string {
    if (!this.document) return '';
    
    let md = `# ${this.document.metadata.name} 项目文档\n\n`;
    md += `> 生成时间: ${this.document.metadata.generatedAt}\n`;
    md += `> 版本: ${this.document.metadata.version}\n\n`;
    
    if (this.document.metadata.description) {
      md += `## 项目描述\n\n${this.document.metadata.description}\n\n`;
    }
    
    md += `## 技术栈\n\n`;
    this.document.overview.techStack.forEach(tech => {
      md += `- ${tech}\n`;
    });
    
    md += `\n## 文件列表\n\n`;
    Object.values(this.document.files).forEach(file => {
      md += `### ${file.path}\n\n`;
      md += `**类型**: ${file.type}  \n`;
      md += `**大小**: ${file.size} bytes  \n`;
      md += `**功能**: ${file.purpose}\n\n`;
    });
    
    return md;
  }

  /**
   * 导出为 HTML 格式
   */
  private exportToHTML(): string {
    if (!this.document) return '';
    
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${this.document.metadata.name} - 项目文档</title>
      <meta charset="utf-8">
    </head>
    <body>
      <h1>${this.document.metadata.name} 项目文档</h1>
      <p>生成时间: ${this.document.metadata.generatedAt}</p>
      <!-- 更多 HTML 内容 -->
    </body>
    </html>
    `;
  }

  /**
   * 导出为纯文本格式
   */
  private exportToText(): string {
    if (!this.document) return '';
    
    let text = `${this.document.metadata.name} 项目文档\n`;
    text += `生成时间: ${this.document.metadata.generatedAt}\n\n`;
    
    Object.values(this.document.files).forEach(file => {
      text += `文件: ${file.path}\n`;
      text += `功能: ${file.purpose}\n\n`;
    });
    
    return text;
  }
}

// 导出单例实例
export const projectDocQueryService = new ProjectDocumentQueryService(); 