import * as fs from 'fs';
import * as path from 'path';
import { get_encoding } from 'tiktoken';
import {
  DirectoryNode,
  EntryPoint,
  FileDocumentation,
  FileType,
  ProjectDocument,
  ProjectMetadata,
  ProjectOverview,
  ProjectStructure,
  ProjectType
} from '../types/project-doc';
import { FileSearchManager } from '../ui/components/files';
import { languageService } from './language';
import { ChatMessage, openAIService } from './openai';
import { StorageService } from './storage';

export interface ProjectFile {
  path: string;
  name: string;
  relativePath: string;
  type: 'file' | 'directory';
  content?: string;
  size?: number;
}

export interface InitProgress {
  current: number;
  total: number;
  phase: string;
  file?: string;
}

export interface InitOptions {
  onProgress?: (progress: InitProgress) => void;
  onPhaseChange?: (phase: string) => void;
  onError?: (error: Error) => void;
  checkInterrupt?: () => boolean;
  skipFiles?: string[]; // 需要跳过的文件列表（用于恢复功能）
  currentPhase?: number; // 当前阶段索引（用于恢复功能）
  outputPath?: string; // 输出文件路径，默认为 sawyou.json
}

/**
 * 项目初始化服务
 * 生成适用于AI的项目结构化JSON文档
 */
export class ProjectInitService {
  private fileSearchManager: FileSearchManager;
  private projectRoot: string;

  constructor(projectRoot?: string) {
    this.projectRoot = projectRoot || process.cwd();
    this.fileSearchManager = new FileSearchManager(this.projectRoot);
  }

  /**
   * 执行项目初始化，生成sawyou.json文件
   */
  async init(options: InitOptions = {}): Promise<string> {
    const { onProgress, onPhaseChange, onError, checkInterrupt, skipFiles = [], currentPhase = 0, outputPath } = options;
    const finalOutputPath = outputPath || path.join(this.projectRoot, 'sawyou.json');

    try {
      let projectFiles: ProjectFile[] = [];
      let projectDocument: ProjectDocument | undefined;

      // 阶段1: 扫描项目文件
      if (currentPhase <= 0) {
        if (checkInterrupt?.()) throw new Error('Interrupted');
        onPhaseChange?.('扫描项目文件...');

        onProgress?.({ current: 0, total: 1, phase: '扫描项目文件' });
        projectFiles = await this.scanProjectFiles(checkInterrupt);
        onProgress?.({ current: 1, total: 1, phase: '扫描项目文件' });
      } else {
        projectFiles = await this.scanProjectFiles(checkInterrupt);
      }

      // 阶段2: 分析项目概览和结构
      if (currentPhase <= 1) {
        if (checkInterrupt?.()) throw new Error('Interrupted');
        onPhaseChange?.('分析项目结构...');

        const analysisResult = await this.analyzeProjectOverviewAndStructure(projectFiles, {
          onProgress: (current, total) => {
            if (checkInterrupt?.()) throw new Error('Interrupted');
            onProgress?.({ current, total, phase: '分析项目结构' });
          },
          checkInterrupt
        });

        projectDocument = {
          metadata: this.generateMetadata(),
          overview: analysisResult.overview,
          structure: analysisResult.structure,
          files: {}
        };
      } else if (currentPhase > 1) {
        // 当从阶段2之后恢复时，需要初始化projectDocument
        const analysisResult = this.generateDefaultOverviewAndStructure(projectFiles);
        projectDocument = {
          metadata: this.generateMetadata(),
          overview: analysisResult.overview,
          structure: analysisResult.structure,
          files: {}
        };
      }

      // 阶段3: 生成文件文档
      if (currentPhase <= 2) {
        if (checkInterrupt?.()) throw new Error('Interrupted');
        onPhaseChange?.('生成文件文档...');

        // 确保projectDocument已初始化
        if (!projectDocument) {
          const analysisResult = this.generateDefaultOverviewAndStructure(projectFiles);
          projectDocument = {
            metadata: this.generateMetadata(),
            overview: analysisResult.overview,
            structure: analysisResult.structure,
            files: {}
          };
        }

        const fileDocumentations = await this.generateFileDocumentations(projectFiles, {
          onProgress: (current, total, file) => {
            if (checkInterrupt?.()) throw new Error('Interrupted');
            onProgress?.({ current, total, phase: '生成文件文档', file: file?.relativePath });
          },
          checkInterrupt,
          skipFiles
        });

        // 将文件文档添加到项目文档中
        projectDocument.files = fileDocumentations;
      }

      // 阶段4: 生成最终 JSON 文档
      if (currentPhase <= 3) {
        if (checkInterrupt?.()) throw new Error('Interrupted');
        onPhaseChange?.('生成最终文档...');

        onProgress?.({ current: 0, total: 1, phase: '生成最终文档' });

        // 确保projectDocument已初始化
        if (!projectDocument) {
          const analysisResult = this.generateDefaultOverviewAndStructure(projectFiles);
          projectDocument = {
            metadata: this.generateMetadata(),
            overview: analysisResult.overview,
            structure: analysisResult.structure,
            files: {}
          };
        }

        // 分析文件依赖关系
        this.analyzeFileDependencies(projectDocument);

        // 生成格式化的 JSON
        const jsonContent = JSON.stringify(projectDocument, null, 2);
        await fs.promises.writeFile(finalOutputPath, jsonContent, 'utf-8');

        onProgress?.({ current: 1, total: 1, phase: '完成' });
        return finalOutputPath;
      }

      return finalOutputPath;

    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error('初始化失败');
      onError?.(errorObj);
      throw errorObj;
    }
  }

  /**
   * 扫描项目文件
   */
  private async scanProjectFiles(checkInterrupt?: () => boolean): Promise<ProjectFile[]> {
    const files: ProjectFile[] = [];
    await this.walkDirectory(this.projectRoot, files, 0, 5); // 最多5层深度

    // 过滤出代码文件，排序便于处理
    const codeFiles = files.filter(file => {
      if (file.type === 'directory') return false;
      return this.isCodeFile(file.relativePath);
    }).sort((a, b) => a.relativePath.localeCompare(b.relativePath));

    // 读取文件内容和大小信息
    for (let i = 0; i < codeFiles.length; i++) {
      if (checkInterrupt?.()) throw new Error('Interrupted');

      const file = codeFiles[i];
      try {
        const stats = await fs.promises.stat(file.path);
        file.size = stats.size;

        // 只读取不太大的文件内容（小于100KB）
        if (stats.size < 100 * 1024) {
          file.content = await fs.promises.readFile(file.path, 'utf-8');
        }
      } catch (error) {
        // 忽略无法读取的文件
        continue;
      }
    }

    return codeFiles;
  }

  /**
   * 递归遍历目录（复用FileSearchManager的逻辑）
   */
  private async walkDirectory(
    dirPath: string,
    results: ProjectFile[],
    currentDepth: number,
    maxDepth: number
  ): Promise<void> {
    if (currentDepth > maxDepth) return;

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

        // 如果是目录且没有达到最大深度，继续递归
        if (isDirectory && currentDepth < maxDepth) {
          await this.walkDirectory(fullPath, results, currentDepth + 1, maxDepth);
        }
      }
    } catch (error) {
      // 忽略无法访问的目录
    }
  }

  /**
   * 检查文件是否应该忽略（复用FileSearchManager的逻辑）
   */
  private shouldIgnoreFile(relativePath: string, isDirectory: boolean): boolean {
    // 排除生成的文档文件和进度文件
    if (relativePath === 'sawyou.json' || relativePath === '.openai-cli-init-progress.json') {
      return true;
    }

    // 基本的ignore规则，与FileSearchManager保持一致
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
      '.less', '.sass', '.styl',

      // 后端语言
      '.py', '.java', '.go', '.rs', '.php', '.rb', '.swift', '.kt', '.dart',
      '.c', '.cpp', '.cc', '.cxx', '.h', '.hpp', '.hxx',
      '.cs', '.vb', '.fs', '.fsx',
      '.scala', '.clj', '.cljs', '.groovy',
      '.elm', '.hs', '.lhs', '.ml', '.mli',
      '.r', '.R', '.m', '.mm',
      '.pl', '.pm', '.t', '.pod',
      '.lua', '.sol', '.zig', '.nim',

      // 数据库和配置
      '.sql', '.hql', '.psql',
      '.json', '.yaml', '.yml', '.toml', '.xml', '.ini', '.cfg', '.conf',
      '.env', '.properties',

      // 文档和脚本
      '.md', '.txt', '.rst', '.adoc',
      '.sh', '.bash', '.zsh', '.fish', '.ps1', '.bat', '.cmd',

      // 构建和工具
      '.dockerfile', '.Dockerfile',
      '.makefile', '.Makefile',
      '.gradle', '.maven', '.sbt'
    ];

    const ext = path.extname(filePath).toLowerCase();
    const fileName = path.basename(filePath).toLowerCase();

    // 检查扩展名
    if (codeExtensions.includes(ext)) {
      return true;
    }

    // 检查特殊文件名
    const specialFiles = [
      'dockerfile', 'makefile', 'rakefile', 'gemfile', 'podfile',
      'cmakelists.txt', 'requirements.txt', 'setup.py', 'manage.py',
      'gulpfile.js', 'gruntfile.js', 'webpack.config.js'
    ];

    return specialFiles.includes(fileName);
  }

  /**
* 生成项目元数据
*/
  private generateMetadata(): ProjectMetadata {
    const packageJsonPath = path.join(this.projectRoot, 'package.json');
    let packageInfo: any = {};

    try {
      const packageContent = fs.readFileSync(packageJsonPath, 'utf-8');
      packageInfo = JSON.parse(packageContent);
    } catch (error) {
      // 忽略 package.json 读取错误
    }

    return {
      name: packageInfo.name || path.basename(this.projectRoot),
      version: packageInfo.version || '1.0.0',
      description: packageInfo.description,
      generatedAt: new Date().toISOString(),
      generatedBy: 'OpenAI CLI v0.0.3',
      projectPath: this.projectRoot,
      schemaVersion: '1.0.0'
    };
  }

  /**
   * 分析项目概览和结构
   */
  private async analyzeProjectOverviewAndStructure(
    files: ProjectFile[],
    options: { onProgress?: (current: number, total: number) => void; checkInterrupt?: () => boolean }
  ): Promise<{ overview: ProjectOverview; structure: ProjectStructure }> {
    const messages = languageService.getMessages();
    const fileList = files.map(f => `${f.type === 'directory' ? '[DIR]' : '[FILE]'} ${f.relativePath}`).join('\n');

    const chatMessages: ChatMessage[] = [
      {
        role: 'system',
        content: `${messages.projectInit.prompts.systemAnalyzer}

文件列表：
${fileList}`
      },
      {
        role: 'user',
        content: messages.projectInit.prompts.userAnalyzeProject
      }
    ];

    // 报告开始分析
    options.onProgress?.(0, 1);

    const result = await openAIService.chat({
      messages: chatMessages,
      temperature: 0.2,
      maxTokens: 2000,
      responseFormat: 'json_object'
    });

    // 报告分析完成
    options.onProgress?.(1, 1);

    try {
      const parsed = JSON.parse(result);
      return {
        overview: parsed.overview,
        structure: parsed.structure
      };
    } catch (error) {
      // 如果解析失败，返回默认结构
      return this.generateDefaultOverviewAndStructure(files);
    }
  }

  /**
   * 生成默认的概览和结构（当 AI 解析失败时使用）
   */
  private generateDefaultOverviewAndStructure(files: ProjectFile[]): { overview: ProjectOverview; structure: ProjectStructure } {
    const overview: ProjectOverview = {
      type: 'other' as ProjectType,
      techStack: this.detectTechStack(files),
      mainFeatures: [],
      dependencies: [],
      entryPoints: this.detectEntryPoints(files)
    };

    const structure: ProjectStructure = {
      tree: this.buildDirectoryTree(files),
      directories: {},
      architecture: {
        pattern: 'modular' as any,
        layers: [],
        dataFlow: []
      }
    };

    return { overview, structure };
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
    if (files.some(f => f.relativePath.endsWith('.svelte'))) {
      techStack.push('Svelte');
    }

    // 后端语言
    if (files.some(f => f.relativePath.endsWith('.py'))) {
      techStack.push('Python');
    }
    if (files.some(f => f.relativePath.endsWith('.java'))) {
      techStack.push('Java');
    }
    if (files.some(f => f.relativePath.endsWith('.cs'))) {
      techStack.push('C#');
    }
    if (files.some(f => f.relativePath.endsWith('.php'))) {
      techStack.push('PHP');
    }
    if (files.some(f => f.relativePath.endsWith('.rb'))) {
      techStack.push('Ruby');
    }
    if (files.some(f => f.relativePath.endsWith('.go'))) {
      techStack.push('Go');
    }
    if (files.some(f => f.relativePath.endsWith('.rs'))) {
      techStack.push('Rust');
    }
    if (files.some(f => f.relativePath.endsWith('.cpp') || f.relativePath.endsWith('.c') || f.relativePath.endsWith('.cc'))) {
      techStack.push('C/C++');
    }
    if (files.some(f => f.relativePath.endsWith('.swift'))) {
      techStack.push('Swift');
    }
    if (files.some(f => f.relativePath.endsWith('.kt'))) {
      techStack.push('Kotlin');
    }
    if (files.some(f => f.relativePath.endsWith('.scala'))) {
      techStack.push('Scala');
    }
    if (files.some(f => f.relativePath.endsWith('.dart'))) {
      techStack.push('Dart');
    }

    // 框架和平台
    if (files.some(f => f.relativePath.includes('django') || f.relativePath === 'manage.py')) {
      techStack.push('Django');
    }
    if (files.some(f => f.relativePath.includes('flask'))) {
      techStack.push('Flask');
    }
    if (files.some(f => f.relativePath.includes('spring') || f.relativePath.includes('pom.xml'))) {
      techStack.push('Spring');
    }
    if (files.some(f => f.relativePath.includes('laravel') || f.relativePath === 'artisan')) {
      techStack.push('Laravel');
    }
    if (files.some(f => f.relativePath.includes('rails') || f.relativePath === 'Gemfile')) {
      techStack.push('Ruby on Rails');
    }
    if (files.some(f => f.relativePath === 'Dockerfile' || f.relativePath.toLowerCase().includes('dockerfile'))) {
      techStack.push('Docker');
    }
    if (files.some(f => f.relativePath === 'docker-compose.yml' || f.relativePath === 'docker-compose.yaml')) {
      techStack.push('Docker Compose');
    }

    // 数据库
    if (files.some(f => f.relativePath.endsWith('.sql'))) {
      techStack.push('SQL');
    }

    return [...new Set(techStack)]; // 去重
  }

  /**
   * 检测入口点
   */
  private detectEntryPoints(files: ProjectFile[]): EntryPoint[] {
    const entryPoints: EntryPoint[] = [];

    const indexFiles = files.filter(f =>
      f.name === 'index.ts' || f.name === 'index.js' ||
      f.name === 'main.ts' || f.name === 'main.js'
    );

    for (const file of indexFiles) {
      entryPoints.push({
        path: file.relativePath,
        type: 'main',
        description: `入口文件：${file.name}`
      });
    }

    return entryPoints;
  }

  /**
   * 构建目录树
   */
  private buildDirectoryTree(files: ProjectFile[]): DirectoryNode {
    const root: DirectoryNode = {
      name: path.basename(this.projectRoot),
      type: 'directory',
      path: '',
      children: []
    };

    // 简化实现：只构建顶层目录结构
    const topLevelDirs = new Set<string>();
    const topLevelFiles: ProjectFile[] = [];

    for (const file of files) {
      const parts = file.relativePath.split(path.sep);
      if (parts.length === 1) {
        topLevelFiles.push(file);
      } else if (parts.length > 1) {
        topLevelDirs.add(parts[0]);
      }
    }

    // 添加顶层目录
    for (const dir of topLevelDirs) {
      root.children!.push({
        name: dir,
        type: 'directory',
        path: dir,
        children: []
      });
    }

    // 添加顶层文件
    for (const file of topLevelFiles) {
      root.children!.push({
        name: file.name,
        type: 'file',
        path: file.relativePath,
        size: file.size
      });
    }

    return root;
  }

  /**
   * 分析文件依赖关系
   */
  private analyzeFileDependencies(document: ProjectDocument): void {
    // 分析每个文件的依赖关系和被使用情况
    const allFiles = Object.values(document.files);

    for (const file of allFiles) {
      // 确保必要字段存在
      if (!file.dependencies) {
        file.dependencies = [];
      }
      if (!file.usedBy) {
        file.usedBy = [];
      }

      // 基于导入语句分析依赖
      if (file.imports && Array.isArray(file.imports)) {
        const relativeDeps = file.imports
          .filter(imp => imp && imp.from && (imp.from.startsWith('./') || imp.from.startsWith('../')))
          .map(imp => this.resolveRelativePath(file.path, imp.from));

        file.dependencies = [...file.dependencies, ...relativeDeps];
      }
    }

    // 计算反向依赖
    for (const file of allFiles) {
      for (const dep of file.dependencies) {
        const depFile = allFiles.find(f => f.path === dep);
        if (depFile) {
          depFile.usedBy.push(file.path);
        }
      }
    }
  }

  /**
   * 解析相对路径
   */
  private resolveRelativePath(fromPath: string, relativePath: string): string {
    const fromDir = path.dirname(fromPath);
    return path.normalize(path.join(fromDir, relativePath));
  }

  /**
   * 智能截断文件内容
   * 使用 o200k_base 编码器根据上下文token数量进行智能截断
   */
  private truncateFileContent(content: string, filePath: string): string {
    const apiConfig = StorageService.getApiConfig();
    const maxContextTokens = apiConfig.contextTokens || 128000;

    try {
      // 使用 o200k_base 编码器（适用于大多数现代模型）
      const encoder = get_encoding('o200k_base');

      // 计算当前内容的token数量
      const currentTokens = encoder.encode(content).length;

      // 为系统提示词和其他内容预留30%的空间，文件内容最多占用70%
      const maxFileTokens = Math.floor(maxContextTokens * 0.7);

      if (currentTokens <= maxFileTokens) {
        // 如果token数量在限制内，返回完整内容
        encoder.free();
        return content;
      }

      // 需要截断，尝试按行截断以保持代码结构
      const lines = content.split('\n');
      let truncatedContent = '';
      let currentLineTokens = 0;

      for (let i = 0; i < lines.length; i++) {
        const lineWithNewline = lines[i] + (i < lines.length - 1 ? '\n' : '');
        const lineTokens = encoder.encode(lineWithNewline).length;

        if (currentLineTokens + lineTokens > maxFileTokens) {
          // 如果加上这一行会超过限制，添加截断标记
          const messages = languageService.getMessages();
          const truncateMsg = messages.projectInit.warnings.contentTruncated
            .replace('{totalLines}', lines.length.toString())
            .replace('{currentLines}', i.toString());
          truncatedContent += `\n\n// ... [${truncateMsg}] ...`;
          break;
        }

        truncatedContent += lineWithNewline;
        currentLineTokens += lineTokens;
      }

      encoder.free();
      return truncatedContent;

    } catch (error) {
      // 如果token计算失败，回退到简单的字符数截断
      const messages = languageService.getMessages();
      console.warn(`${messages.projectInit.errors.tokenCalculationFailed} ${filePath}:`, error);
      const maxChars = Math.floor(maxContextTokens * 2.5); // 大致估算：1 token ≈ 2.5 字符

      if (content.length <= maxChars) {
        return content;
      }

      // 按行截断
      const lines = content.split('\n');
      let truncatedContent = '';
      let currentChars = 0;

      for (let i = 0; i < lines.length; i++) {
        const lineWithNewline = lines[i] + (i < lines.length - 1 ? '\n' : '');

        if (currentChars + lineWithNewline.length > maxChars) {
          const messages = languageService.getMessages();
          const truncateMsg = messages.projectInit.warnings.contentTruncated
            .replace('{totalLines}', lines.length.toString())
            .replace('{currentLines}', i.toString());
          truncatedContent += `\n\n// ... [${truncateMsg}] ...`;
          break;
        }

        truncatedContent += lineWithNewline;
        currentChars += lineWithNewline.length;
      }

      return truncatedContent;
    }
  }



  /**
* 生成文件说明（并发处理）
*/
  private async generateFileDocumentations(
    files: ProjectFile[],
    options: {
      onProgress?: (current: number, total: number, file?: ProjectFile) => void;
      checkInterrupt?: () => boolean;
      skipFiles?: string[];
    }
  ): Promise<Record<string, FileDocumentation>> {
    const documentations: Record<string, FileDocumentation> = {};
    const filesWithContent = files.filter(f => f.content);
    const { skipFiles = [] } = options;

    // 过滤出需要处理的文件（排除已跳过的文件）
    const filesToProcess = filesWithContent.filter(f => !skipFiles.includes(f.relativePath));
    const totalFiles = filesWithContent.length;

    // 如果有跳过的文件，先模拟它们已经处理完成
    let processedCount = skipFiles.length;

    // 并发控制：从配置中获取最大并发数，默认5
    const apiConfig = StorageService.getApiConfig();
    const BATCH_SIZE = apiConfig.maxConcurrency || 5;
    const batches: ProjectFile[][] = [];

    for (let i = 0; i < filesToProcess.length; i += BATCH_SIZE) {
      batches.push(filesToProcess.slice(i, i + BATCH_SIZE));
    }

    for (const batch of batches) {
      // 检查中断
      if (options.checkInterrupt?.()) throw new Error('Interrupted');

      // 并发处理当前批次的文件
      const batchPromises = batch.map(async (file) => {
        try {
          const doc = await this.generateSingleFileDoc(file, options.checkInterrupt);
          return { file, doc, success: true };
        } catch (error) {
          // 如果被中断，直接抛出错误
          if (error instanceof Error && error.message === 'Interrupted') {
            throw error;
          }
          const messages = languageService.getMessages();
          console.warn(`${messages.projectInit.errors.loadFailed} ${file.relativePath}:`, error);
          return { file, doc: this.createBasicFileDoc(file, messages.projectInit.errors.parseFailed), success: false };
        }
      });

      const batchResults = await Promise.all(batchPromises);

      // 按顺序写入结果（保证文档顺序）
      for (const result of batchResults) {
        // 检查中断
        if (options.checkInterrupt?.()) throw new Error('Interrupted');

        documentations[result.file.relativePath] = result.doc;
        processedCount++;
        options.onProgress?.(processedCount, totalFiles, result.file);
      }

      // 批次间短暂延迟，避免API限流
      if (batches.indexOf(batch) < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    return documentations;
  }

  /**
* 生成单个文件的文档
*/
  private async generateSingleFileDoc(file: ProjectFile, checkInterrupt?: () => boolean): Promise<FileDocumentation> {
    const messages = languageService.getMessages();

    if (!file.content) {
      return this.createBasicFileDoc(file, messages.projectDoc.warnings.noContent);
    }

    const chatMessages: ChatMessage[] = [
      {
        role: 'system',
        content: messages.projectInit.prompts.systemFileAnalyzer
      },
      {
        role: 'user',
        content: messages.projectInit.prompts.userAnalyzeFile
          .replace('{filePath}', file.relativePath)
          .replace('{fileContent}', this.truncateFileContent(file.content, file.relativePath))
      }
    ];

    try {
      const result = await openAIService.chat({
        messages: chatMessages,
        temperature: 0.1,
        maxTokens: 1500,
        responseFormat: 'json_object'
      });

      const parsed = JSON.parse(result);
      return this.createFileDocFromAI(file, parsed);
    } catch (error) {
      // AI 解析失败时，返回基础文档
      const messages = languageService.getMessages();
      return this.createBasicFileDoc(file, messages.projectInit.errors.parseFailed);
    }
  }

  /**
   * 从 AI 结果创建文件文档
   */
  private createFileDocFromAI(file: ProjectFile, aiResult: any): FileDocumentation {
    return {
      path: file.relativePath,
      name: file.name,
      type: this.getFileType(file.relativePath),
      size: file.size || 0,
      purpose: aiResult.purpose || '文件功能待分析',
      exports: Array.isArray(aiResult.exports) ? aiResult.exports : [],
      imports: Array.isArray(aiResult.imports) ? aiResult.imports : [],
      functions: Array.isArray(aiResult.functions) ? aiResult.functions : [],
      classes: Array.isArray(aiResult.classes) ? aiResult.classes : [],
      interfaces: Array.isArray(aiResult.interfaces) ? aiResult.interfaces : [],
      constants: Array.isArray(aiResult.constants) ? aiResult.constants : [],
      dependencies: [],
      usedBy: [],
      importance: aiResult.importance || 'medium',
      tags: Array.isArray(aiResult.tags) ? aiResult.tags : [],
      lastModified: undefined
    };
  }

  /**
   * 创建基础文件文档
   */
  private createBasicFileDoc(file: ProjectFile, purpose: string): FileDocumentation {
    return {
      path: file.relativePath,
      name: file.name,
      type: this.getFileType(file.relativePath),
      size: file.size || 0,
      purpose,
      exports: [],
      imports: [],
      functions: [],
      classes: [],
      interfaces: [],
      constants: [],
      dependencies: [],
      usedBy: [],
      importance: 'medium',
      tags: []
    };
  }

  /**
   * 获取文件类型
   */
  private getFileType(filePath: string): FileType {
    const ext = path.extname(filePath).toLowerCase();
    const fileName = path.basename(filePath).toLowerCase();

    // 前端语言
    if (['.ts', '.tsx'].includes(ext)) return 'typescript';
    if (['.js', '.jsx'].includes(ext)) return 'javascript';
    if (['.vue', '.svelte'].includes(ext)) return 'frontend-framework';
    if (['.html', '.htm'].includes(ext)) return 'markup';
    if (['.css', '.scss', '.less', '.sass', '.styl'].includes(ext)) return 'style';

    // 后端语言
    if (['.py', '.pyw', '.pyi'].includes(ext)) return 'python';
    if (['.java', '.class', '.jar'].includes(ext)) return 'java';
    if (['.cs', '.vb'].includes(ext)) return 'dotnet';
    if (['.php', '.phtml'].includes(ext)) return 'php';
    if (['.rb', '.erb'].includes(ext)) return 'ruby';
    if (['.go', '.mod'].includes(ext)) return 'golang';
    if (['.rs', '.toml'].includes(ext) && filePath.includes('rust')) return 'rust';
    if (['.cpp', '.cc', '.cxx', '.c', '.h', '.hpp', '.hxx'].includes(ext)) return 'cpp';
    if (['.swift'].includes(ext)) return 'swift';
    if (['.kt', '.kts'].includes(ext)) return 'kotlin';
    if (['.scala', '.sc'].includes(ext)) return 'scala';
    if (['.clj', '.cljs', '.cljc'].includes(ext)) return 'clojure';
    if (['.hs', '.lhs'].includes(ext)) return 'haskell';
    if (['.ml', '.mli'].includes(ext)) return 'ocaml';
    if (['.fs', '.fsx', '.fsi'].includes(ext)) return 'fsharp';
    if (['.r', '.R'].includes(ext)) return 'r';
    if (['.m', '.mm'].includes(ext)) return 'objectivec';
    if (['.pl', '.pm', '.t'].includes(ext)) return 'perl';
    if (['.lua'].includes(ext)) return 'lua';
    if (['.dart'].includes(ext)) return 'dart';

    // 数据和配置
    if (['.json', '.jsonc'].includes(ext)) return 'json';
    if (['.yaml', '.yml'].includes(ext)) return 'yaml';
    if (['.xml', '.xsd', '.xsl'].includes(ext)) return 'xml';
    if (['.toml'].includes(ext)) return 'config';
    if (['.ini', '.cfg', '.conf', '.properties'].includes(ext)) return 'config';
    if (['.env'].includes(ext) || fileName.startsWith('.env')) return 'config';

    // 数据库
    if (['.sql', '.hql', '.psql'].includes(ext)) return 'database';

    // 文档
    if (['.md', '.markdown'].includes(ext)) return 'markdown';
    if (['.txt', '.text'].includes(ext)) return 'text';
    if (['.rst', '.adoc'].includes(ext)) return 'documentation';

    // 脚本
    if (['.sh', '.bash', '.zsh', '.fish'].includes(ext)) return 'shell';
    if (['.ps1', '.psm1'].includes(ext)) return 'powershell';
    if (['.bat', '.cmd'].includes(ext)) return 'batch';

    // 构建工具
    if (fileName.includes('dockerfile') || fileName === 'dockerfile') return 'docker';
    if (fileName.includes('makefile') || fileName === 'makefile') return 'build';
    if (['.gradle', '.maven', '.sbt'].includes(ext)) return 'build';

    // 特殊文件
    if (fileName.includes('config') || fileName.includes('.config.')) return 'config';
    if (fileName.includes('test') || fileName.includes('.test.')) return 'test';
    if (fileName.includes('spec') || fileName.includes('.spec.')) return 'test';

    return 'other';
  }


} 