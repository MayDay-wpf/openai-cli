import * as fs from 'fs';
import * as path from 'path';
import { MarkdownDocOptions, ProjectFile, ProjectInfo } from '../types/project-doc';
import { FileSearchManager } from '../ui/components/files';
import { TokenCalculator } from '../utils/token-calculator';
import { languageService } from './language';
import { ChatMessage, openAIService } from './openai';
import { StorageService } from './storage';

/**
 * 项目初始化服务
 * 生成 Markdown 格式的项目描述文档
 */
export class ProjectInitService {
  private fileSearchManager: FileSearchManager;
  private projectRoot: string;
  private storageService: StorageService;
  private gitignorePatterns: string[] = [];

  constructor(projectRoot?: string) {
    this.projectRoot = projectRoot || process.cwd();
    this.fileSearchManager = new FileSearchManager(this.projectRoot);
    this.storageService = new StorageService();
  }

  /**
   * 生成 Markdown 格式的项目文档
   */
  async generateMarkdownDoc(options: MarkdownDocOptions = {}): Promise<string> {
    const { onStepStart, onFileProgress, checkInterrupt, outputPath } = options;
    const finalOutputPath = outputPath || path.join(this.projectRoot, 'sawyou.md');

    try {
      // 每次生成文档时重新解析 .gitignore 文件
      this.parseGitignore();

      // 步骤1: 扫描项目文件
      onStepStart?.('scanning');
      if (checkInterrupt?.()) throw new Error('Interrupted');

      const projectFiles = await this.scanProjectFiles(checkInterrupt);

      // 步骤2: 分析项目结构
      onStepStart?.('analyzing');
      if (checkInterrupt?.()) throw new Error('Interrupted');

      const projectInfo = await this.analyzeProject(projectFiles, checkInterrupt);

      // 步骤3: 生成文件树和简述
      onStepStart?.('generating');
      if (checkInterrupt?.()) throw new Error('Interrupted');

      const fileTree = this.generateFileTree(projectFiles);
      const fileSummaries = await this.generateFileSummaries(projectFiles, {
        checkInterrupt,
        onProgress: onFileProgress
      });

      // 步骤4: 生成 Markdown 文档
      onStepStart?.('saving');
      if (checkInterrupt?.()) throw new Error('Interrupted');

      const markdownContent = this.buildMarkdownContent({
        projectInfo,
        fileTree,
        fileSummaries
      });

      await fs.promises.writeFile(finalOutputPath, markdownContent, 'utf-8');
      return finalOutputPath;

    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error('生成项目描述失败');
      throw errorObj;
    }
  }

  /**
   * 扫描项目文件
   */
  private async scanProjectFiles(checkInterrupt?: () => boolean): Promise<ProjectFile[]> {
    const files: ProjectFile[] = [];
    await this.walkDirectory(this.projectRoot, files, 0, -1); // 不限制深度

    // 过滤出代码文件，排序便于处理
    const codeFiles = files.filter(file => {
      if (file.type === 'directory') return false;
      return this.isCodeFile(file.relativePath);
    }).sort((a, b) => a.relativePath.localeCompare(b.relativePath));

    // 读取所有代码文件的内容
    for (let i = 0; i < codeFiles.length; i++) {
      if (checkInterrupt?.()) throw new Error('Interrupted');

      const file = codeFiles[i];
      try {
        const rawContent = await fs.promises.readFile(file.path, 'utf-8');
        // 使用智能截断，确保内容在合理范围内
        file.content = this.intelligentTruncate(rawContent, file.relativePath);
      } catch (error) {
        // 忽略无法读取的文件
        continue;
      }
    }

    return codeFiles;
  }

  /**
   * 分析项目基本信息
   */
  private async analyzeProject(files: ProjectFile[], checkInterrupt?: () => boolean): Promise<ProjectInfo> {
    if (checkInterrupt?.()) throw new Error('Interrupted');

    const messages = languageService.getMessages();
    const fileList = files.slice(0, 20).map(f => f.relativePath).join('\n');

    // 读取 package.json 信息
    const packageInfo = this.getPackageInfo();

    const chatMessages: ChatMessage[] = [
      {
        role: 'system',
        content: `你是一个专业的项目分析师。请分析项目结构并返回JSON格式的项目信息。

要求：
1. 分析项目的主要功能和用途
2. 识别使用的技术栈
3. 判断项目类型（web应用、CLI工具、库等）
4. 用中文描述

返回格式：
{
  "name": "项目名称",
  "description": "项目描述（2-3句话）",
  "techStack": ["技术1", "技术2"],
  "type": "项目类型"
}`
      },
      {
        role: 'user',
        content: `分析以下项目：

项目路径：${this.projectRoot}
Package.json信息：${JSON.stringify(packageInfo, null, 2)}

主要文件：
${fileList}`
      }
    ];

    try {
      const result = await openAIService.chat({
        messages: chatMessages,
        temperature: 0.2,
        maxTokens: 1000,
        responseFormat: 'json_object'
      });

      const parsed = JSON.parse(result);
      return {
        name: parsed.name || packageInfo.name || path.basename(this.projectRoot),
        description: parsed.description || '项目描述待完善',
        techStack: Array.isArray(parsed.techStack) ? parsed.techStack : this.detectTechStack(files),
        type: parsed.type || '其他项目'
      };
    } catch (error) {
      // AI 分析失败时，返回默认分析结果
      return {
        name: packageInfo.name || path.basename(this.projectRoot),
        description: packageInfo.description || '项目描述待完善',
        techStack: this.detectTechStack(files),
        type: '其他项目'
      };
    }
  }

  /**
   * 获取 package.json 信息
   */
  private getPackageInfo(): any {
    try {
      const packageJsonPath = path.join(this.projectRoot, 'package.json');
      const packageContent = fs.readFileSync(packageJsonPath, 'utf-8');
      return JSON.parse(packageContent);
    } catch (error) {
      return {};
    }
  }

  /**
   * 检测技术栈
   */
  private detectTechStack(files: ProjectFile[]): string[] {
    const techStack: string[] = [];

    // 前端技术
    if (files.some(f => f.relativePath.endsWith('.ts') || f.relativePath.endsWith('.tsx'))) {
      techStack.push('TypeScript');
    }
    if (files.some(f => f.relativePath.endsWith('.js') || f.relativePath.endsWith('.jsx'))) {
      techStack.push('JavaScript');
    }
    if (files.some(f => f.relativePath === 'package.json')) {
      techStack.push('Node.js');
    }
    if (files.some(f => f.relativePath.includes('react') || f.relativePath.endsWith('.tsx') || f.relativePath.endsWith('.jsx'))) {
      techStack.push('React');
    }
    if (files.some(f => f.relativePath.endsWith('.vue'))) {
      techStack.push('Vue.js');
    }

    // 后端语言
    if (files.some(f => f.relativePath.endsWith('.py'))) {
      techStack.push('Python');
    }
    if (files.some(f => f.relativePath.endsWith('.java'))) {
      techStack.push('Java');
    }
    if (files.some(f => f.relativePath.endsWith('.go'))) {
      techStack.push('Go');
    }
    if (files.some(f => f.relativePath.endsWith('.rs'))) {
      techStack.push('Rust');
    }

    // 其他技术
    if (files.some(f => f.relativePath === 'Dockerfile' || f.relativePath.toLowerCase().includes('dockerfile'))) {
      techStack.push('Docker');
    }

    return [...new Set(techStack)]; // 去重
  }

  /**
   * 生成文件树（Markdown格式）
   */
  private generateFileTree(files: ProjectFile[]): string {
    const tree: { [key: string]: any } = {};

    // 构建树结构
    for (const file of files) {
      const parts = file.relativePath.split(path.sep);
      let current = tree;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (i === parts.length - 1) {
          // 叶子节点（文件）
          current[part] = null;
        } else {
          // 目录节点
          if (!current[part]) {
            current[part] = {};
          }
          current = current[part];
        }
      }
    }

    // 转换为 Markdown 格式
    return this.treeToMarkdown(tree, '');
  }

  /**
   * 将树结构转换为 Markdown 格式
   */
  private treeToMarkdown(tree: any, prefix: string): string {
    const lines: string[] = [];
    const entries = Object.entries(tree).sort(([a], [b]) => {
      // 目录排在前面，文件排在后面
      const aIsDir = tree[a] !== null;
      const bIsDir = tree[b] !== null;
      if (aIsDir && !bIsDir) return -1;
      if (!aIsDir && bIsDir) return 1;
      return a.localeCompare(b);
    });

    entries.forEach(([name, subtree], index) => {
      const isLast = index === entries.length - 1;
      const connector = isLast ? '└── ' : '├── ';
      const nextPrefix = prefix + (isLast ? '    ' : '│   ');

      if (subtree === null) {
        // 文件
        lines.push(`${prefix}${connector}${name}`);
      } else {
        // 目录
        lines.push(`${prefix}${connector}${name}/`);
        lines.push(this.treeToMarkdown(subtree, nextPrefix));
      }
    });

    return lines.filter(line => line.trim()).join('\n');
  }

  /**
   * 生成文件功能简述
   */
  private async generateFileSummaries(
    files: ProjectFile[],
    options: {
      checkInterrupt?: () => boolean;
      onProgress?: (current: number, total: number, fileName?: string) => void;
    } = {}
  ): Promise<string[]> {
    const { checkInterrupt, onProgress } = options;
    // 处理所有有内容的文件
    const filesToAnalyze = files.filter(f => f.content && f.content.trim().length > 0);
    const totalFiles = filesToAnalyze.length;

    // 并发处理文件，使用配置的并发数
    const concurrency = this.getConcurrencyLimit();
    const summaries: string[] = [];

    for (let i = 0; i < filesToAnalyze.length; i += concurrency) {
      if (checkInterrupt?.()) throw new Error('Interrupted');

      const batch = filesToAnalyze.slice(i, i + concurrency);
      const batchPromises = batch.map(async (file, batchIndex) => {
        const globalIndex = i + batchIndex;
        onProgress?.(globalIndex + 1, totalFiles, file.relativePath);

        // 计算文件行数
        const lineCount = this.calculateLineCount(file.content!);

        // 生成文件功能简述
        const summary = await this.generateFileSummary(file);

        return `**${file.relativePath}** (Line Count:${lineCount}): ${summary}`;
      });

      const batchResults = await Promise.all(batchPromises);
      summaries.push(...batchResults);
    }

    return summaries;
  }

  /**
   * 生成单个文件的功能简述
   */
  private async generateFileSummary(file: ProjectFile): Promise<string> {
    const messages = languageService.getMessages();
    const content = file.content!;
    const truncatedContent = this.intelligentTruncate(content, file.relativePath);

    const chatMessages: ChatMessage[] = [
      {
        role: 'system',
        content: messages.main.init.aiPrompts.systemPrompt
      },
      {
        role: 'user',
        content: messages.main.init.aiPrompts.userPrompt
          .replace('{filePath}', file.relativePath)
          .replace('{fileContent}', truncatedContent)
      }
    ];

    try {
      const result = await openAIService.chat({
        messages: chatMessages,
        temperature: 0.1,
        maxTokens: 100
      });

      return result.trim() || messages.main.init.aiPrompts.fallback;
    } catch (error) {
      return messages.main.init.aiPrompts.fallback;
    }
  }

  /**
   * 构建 Markdown 文档内容
   */
  private buildMarkdownContent(data: {
    projectInfo: ProjectInfo;
    fileTree: string;
    fileSummaries: string[];
  }): string {
    const { projectInfo, fileTree, fileSummaries } = data;
    const messages = languageService.getMessages();
    const template = messages.main.init.markdownTemplate;

    return `# ${projectInfo.name}

## ${template.projectDescription}

${projectInfo.description}

**${template.projectType}**: ${projectInfo.type}

**${template.techStack}**: ${projectInfo.techStack.join(', ')}

## ${template.projectStructure}

\`\`\`
${fileTree}
\`\`\`

## ${template.fileFunctions}

${fileSummaries.join('\n\n')}

---

*${template.generatedBy} ${new Date().toLocaleString('zh-CN')}*
`;
  }

  /**
   * 递归遍历目录
   */
  private async walkDirectory(
    dirPath: string,
    results: ProjectFile[],
    currentDepth: number,
    maxDepth: number
  ): Promise<void> {
    // 移除深度限制，只要maxDepth为-1就不限制
    if (maxDepth !== -1 && currentDepth > maxDepth) return;

    try {
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        const relativePath = path.relative(this.projectRoot, fullPath);
        const isDirectory = entry.isDirectory();

        // 使用FileSearchManager的ignore逻辑
        if (this.shouldIgnoreFile(relativePath, isDirectory)) {
          continue;
        }

        const projectFile: ProjectFile = {
          path: fullPath,
          name: entry.name,
          relativePath: relativePath,
          type: isDirectory ? 'directory' : 'file'
        };

        results.push(projectFile);

        // 如果是目录，继续递归（不限制深度）
        if (isDirectory) {
          await this.walkDirectory(fullPath, results, currentDepth + 1, maxDepth);
        }
      }
    } catch (error) {
      // 忽略无法访问的目录
    }
  }

  /**
   * 检查文件是否应该忽略
   */
  private shouldIgnoreFile(relativePath: string, isDirectory: boolean): boolean {
    // 排除生成的文档文件
    if (relativePath === 'sawyou.md') {
      return true;
    }

    // 首先检查 .gitignore 规则
    if (this.isIgnoredByGitignore(relativePath, isDirectory)) {
      return true;
    }

    // 基本的ignore规则
    const ignoredPatterns = [
      'node_modules', '.git', '.DS_Store', 'dist', 'build', 'coverage',
      '*.log', '*.tmp', '*.temp', '.env', '.env.*',
      '.next', '.nuxt', '.vscode', '.idea',
      'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'
    ];

    for (const pattern of ignoredPatterns) {
      if (this.matchesPattern(relativePath, pattern)) {
        return true;
      }
    }

    return false;
  }

  /**
   * 简单的模式匹配
   */
  private matchesPattern(filePath: string, pattern: string): boolean {
    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return regex.test(filePath);
    }
    return filePath.includes(pattern);
  }

  /**
   * 判断是否为代码文件
   */
  private isCodeFile(filePath: string): boolean {
    const codeExtensions = [
      // 前端语言
      '.ts', '.js', '.tsx', '.jsx', '.vue', '.html', '.css', '.scss',
      '.less', '.sass',

      // 后端语言
      '.py', '.java', '.go', '.rs', '.php', '.rb', '.swift', '.kt',
      '.c', '.cpp', '.h', '.hpp', '.cs',

      // 数据库和配置
      '.sql', '.json', '.yaml', '.yml', '.toml', '.xml', '.ini', '.cfg',

      // 文档和脚本
      '.md', '.txt', '.sh', '.bash', '.ps1', '.bat',

      // 构建和工具
      '.dockerfile', 'Dockerfile', 'Makefile', 'makefile'
    ];

    const ext = path.extname(filePath).toLowerCase();
    const fileName = path.basename(filePath).toLowerCase();

    // 检查扩展名
    if (codeExtensions.includes(ext)) {
      return true;
    }

    // 检查特殊文件名
    const specialFiles = [
      'dockerfile', 'makefile', 'package.json', 'tsconfig.json',
      'webpack.config.js', 'vite.config.js', 'rollup.config.js'
    ];

    return specialFiles.includes(fileName);
  }

  /**
   * 获取系统设置的并发量
   */
  private getConcurrencyLimit(): number {
    try {
      const config = StorageService.getConfig();
      // 从配置中获取并发量，默认为5，不设置上限
      return config.concurrency || 5;
    } catch (error) {
      return 5; // 默认并发量
    }
  }

  /**
   * 计算文件行数
   */
  private calculateLineCount(content: string): number {
    if (!content || content.trim().length === 0) {
      return 0;
    }

    // 使用换行符计算行数，处理不同操作系统的换行符
    const lines = content.split(/\r?\n/);
    return lines.length;
  }

  /**
   * 智能截断文件内容
   * 根据配置的模型最大上下文来判断是否需要截断
   */
  private intelligentTruncate(content: string, filePath: string): string {
    // 获取配置的最大上下文token数
    const apiConfig = StorageService.getApiConfig();
    const maxContextTokens = apiConfig.contextTokens || 128000;
    const maxAllowedTokens = Math.floor(maxContextTokens * 0.8); // 80%限制

    // 计算当前内容的token数量
    const currentTokens = TokenCalculator.calculateTokens(content);

    // 如果不超过80%，直接返回原内容
    if (currentTokens <= maxAllowedTokens) {
      return content;
    }

    // 超过了就按比例截断
    const ratio = maxAllowedTokens / currentTokens;
    const targetLength = Math.floor(content.length * ratio * 0.9); // 保守一点

    return content.substring(0, targetLength) + '\n\n... 内容被截断 ...';
  }

  /**
   * 解析 .gitignore 文件
   */
  private parseGitignore(): void {
    const gitignorePath = path.join(this.projectRoot, '.gitignore');
    if (fs.existsSync(gitignorePath)) {
      const content = fs.readFileSync(gitignorePath, 'utf-8');
      const lines = content.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#'));
      this.gitignorePatterns = lines;
    }
  }

  /**
   * 检查文件是否被 .gitignore 忽略
   */
  private isIgnoredByGitignore(relativePath: string, isDirectory: boolean): boolean {
    // 规范化路径，使用正斜杠
    const normalizedPath = relativePath.replace(/\\/g, '/');
    
    for (const pattern of this.gitignorePatterns) {
      if (this.matchesGitignorePattern(normalizedPath, pattern, isDirectory)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * 匹配 gitignore 模式
   */
  private matchesGitignorePattern(filePath: string, pattern: string, isDirectory: boolean): boolean {
    // 移除前导和尾随空格
    pattern = pattern.trim();
    if (!pattern) return false;

    // 处理否定模式（以 ! 开头的模式不会被忽略）
    if (pattern.startsWith('!')) {
      return false; // 简化处理，否定模式暂不支持
    }

    // 处理目录模式（以 / 结尾）
    if (pattern.endsWith('/')) {
      pattern = pattern.slice(0, -1);
      if (!isDirectory) return false; // 只匹配目录
    }

    // 处理根路径模式（以 / 开头）
    if (pattern.startsWith('/')) {
      pattern = pattern.slice(1);
      return this.matchesGlobPattern(filePath, pattern);
    }

    // 检查是否匹配文件名或路径的任何部分
    const pathParts = filePath.split('/');
    
    // 直接匹配整个路径
    if (this.matchesGlobPattern(filePath, pattern)) {
      return true;
    }

    // 匹配路径中的任何部分
    for (let i = 0; i < pathParts.length; i++) {
      const subPath = pathParts.slice(i).join('/');
      if (this.matchesGlobPattern(subPath, pattern)) {
        return true;
      }
    }

    // 匹配文件名
    const fileName = pathParts[pathParts.length - 1];
    if (this.matchesGlobPattern(fileName, pattern)) {
      return true;
    }

    return false;
  }

  /**
   * 匹配 glob 模式
   */
  private matchesGlobPattern(text: string, pattern: string): boolean {
    // 转换 glob 模式为正则表达式
    let regexPattern = pattern
      .replace(/\./g, '\\.')          // 转义点号
      .replace(/\*\*/g, '.*')         // ** 匹配任何字符包括 / (必须在 * 之前处理)
      .replace(/\*/g, '[^/]*')        // * 匹配除 / 之外的任何字符
      .replace(/\?/g, '[^/]');        // ? 匹配除 / 之外的单个字符

    // 确保完全匹配
    regexPattern = '^' + regexPattern + '$';
    
    try {
      const regex = new RegExp(regexPattern);
      return regex.test(text);
    } catch (error) {
      // 如果正则表达式无效，回退到简单的字符串匹配
      return text === pattern;
    }
  }
} 