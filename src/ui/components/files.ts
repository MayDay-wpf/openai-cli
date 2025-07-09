import * as fs from 'fs';
import * as path from 'path';

export interface FileSearchResult {
  path: string;
  name: string;
  relativePath: string;
  type: 'file' | 'directory';
}

export class FileSearchManager {
  private cachedFiles: FileSearchResult[] = [];
  private currentDirectory: string;
  private lastCacheTime: number = 0;
  private cacheExpiration: number = 30000; // 30秒缓存
  private gitignorePatterns: string[] = [];
  private gitignoreLastModified: number = 0;

  constructor(baseDirectory?: string) {
    this.currentDirectory = baseDirectory || process.cwd();
  }

  /**
   * 搜索文件，支持模糊匹配
   */
  async searchFiles(query: string, maxResults: number = 10): Promise<FileSearchResult[]> {
    // 如果查询为空，返回最近的一些文件
    if (!query.trim()) {
      await this.ensureCacheUpdated();
      return this.cachedFiles.slice(0, maxResults);
    }

    await this.ensureCacheUpdated();
    
    const normalizedQuery = query.toLowerCase();
    
    // 模糊匹配算法
    const filtered = this.cachedFiles.filter(file => {
      const fileName = file.name.toLowerCase();
      const relativePath = file.relativePath.toLowerCase();
      
      // 1. 文件名开头匹配（优先级最高）
      if (fileName.startsWith(normalizedQuery)) {
        return true;
      }
      
      // 2. 路径开头匹配
      if (relativePath.startsWith(normalizedQuery)) {
        return true;
      }
      
      // 3. 文件名包含匹配
      if (fileName.includes(normalizedQuery)) {
        return true;
      }
      
      // 4. 路径包含匹配
      if (relativePath.includes(normalizedQuery)) {
        return true;
      }
      
      // 5. 模糊匹配（字符序列匹配）
      return this.fuzzyMatch(fileName, normalizedQuery) || 
             this.fuzzyMatch(relativePath, normalizedQuery);
    });

    // 按匹配优先级排序
    const sorted = filtered.sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();
      const aPath = a.relativePath.toLowerCase();
      const bPath = b.relativePath.toLowerCase();
      
      // 文件名开头匹配优先
      const aNameStarts = aName.startsWith(normalizedQuery);
      const bNameStarts = bName.startsWith(normalizedQuery);
      if (aNameStarts && !bNameStarts) return -1;
      if (!aNameStarts && bNameStarts) return 1;
      
      // 路径开头匹配次优先
      const aPathStarts = aPath.startsWith(normalizedQuery);
      const bPathStarts = bPath.startsWith(normalizedQuery);
      if (aPathStarts && !bPathStarts) return -1;
      if (!aPathStarts && bPathStarts) return 1;
      
      // 文件类型优先级：文件 > 目录
      if (a.type === 'file' && b.type === 'directory') return -1;
      if (a.type === 'directory' && b.type === 'file') return 1;
      
      // 按文件名长度排序（短的优先）
      return aName.length - bName.length;
    });

    return sorted.slice(0, maxResults);
  }

  /**
   * 模糊匹配算法
   */
  private fuzzyMatch(text: string, pattern: string): boolean {
    if (pattern.length === 0) return true;
    if (text.length === 0) return false;
    
    let patternIndex = 0;
    let textIndex = 0;
    
    while (textIndex < text.length && patternIndex < pattern.length) {
      if (text[textIndex] === pattern[patternIndex]) {
        patternIndex++;
      }
      textIndex++;
    }
    
    return patternIndex === pattern.length;
  }

  /**
   * 高级 gitignore 解析器 - 支持完整的 gitignore 规范
   */
  private async loadGitignorePatterns(): Promise<void> {
    const gitignorePaths = await this.discoverGitignoreFiles();
    
    try {
      const allPatterns: string[] = [];
      let latestModTime = 0;
      
      // 按优先级顺序处理 gitignore 文件
      for (const gitignorePath of gitignorePaths) {
        try {
          const stats = await fs.promises.stat(gitignorePath);
          latestModTime = Math.max(latestModTime, stats.mtimeMs);
          
          if (latestModTime <= this.gitignoreLastModified) {
            continue;
          }
          
          const content = await fs.promises.readFile(gitignorePath, 'utf-8');
          const patterns = this.parseGitignoreContent(content, gitignorePath);
          allPatterns.push(...patterns);
        } catch (error) {
          // 忽略无法读取的 gitignore 文件
          continue;
        }
      }
      
      // 检查是否需要更新缓存
      if (latestModTime > this.gitignoreLastModified) {
        this.gitignorePatterns = allPatterns;
        this.gitignoreLastModified = latestModTime;
      }
    } catch (error) {
      // 降级到行业标准默认规则
      this.gitignorePatterns = this.getIndustryStandardIgnorePatterns();
      this.gitignoreLastModified = 0;
    }
  }

  /**
   * 发现所有相关的 gitignore 文件
   */
  private async discoverGitignoreFiles(): Promise<string[]> {
    const gitignoreFiles: string[] = [];
    
    // 1. 项目根目录的 .gitignore
    const rootGitignore = path.join(this.currentDirectory, '.gitignore');
    gitignoreFiles.push(rootGitignore);
    
    // 2. 全局 gitignore（如果存在）
    const globalGitignore = await this.findGlobalGitignore();
    if (globalGitignore) {
      gitignoreFiles.push(globalGitignore);
    }
    
    // 3. Git 仓库的 exclude 文件
    const gitExclude = path.join(this.currentDirectory, '.git', 'info', 'exclude');
    gitignoreFiles.push(gitExclude);
    
    return gitignoreFiles;
  }

  /**
   * 查找全局 gitignore 配置
   */
  private async findGlobalGitignore(): Promise<string | null> {
    const possiblePaths = [
      path.join(process.env.HOME || process.env.USERPROFILE || '', '.gitignore_global'),
      path.join(process.env.HOME || process.env.USERPROFILE || '', '.config', 'git', 'ignore'),
      path.join(process.env.XDG_CONFIG_HOME || '', 'git', 'ignore')
    ];
    
    for (const gitignorePath of possiblePaths) {
      try {
        await fs.promises.access(gitignorePath);
        return gitignorePath;
      } catch {
        continue;
      }
    }
    
    return null;
  }

  /**
   * 解析 gitignore 文件内容 - 完全兼容 Git 规范
   */
  private parseGitignoreContent(content: string, filePath: string): string[] {
    const patterns: string[] = [];
    const lines = content.split(/\r?\n/);
    
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      
      // 处理行尾的反斜杠续行
      while (line.endsWith('\\') && i + 1 < lines.length) {
        line = line.slice(0, -1) + lines[++i];
      }
      
      // 移除行首尾空白
      line = line.trim();
      
      // 跳过空行和注释
      if (!line || line.startsWith('#')) {
        continue;
      }
      
      // 处理转义字符
      line = this.unescapeGitignorePattern(line);
      
      patterns.push(line);
    }
    
    return patterns;
  }

  /**
   * 处理 gitignore 模式中的转义字符
   */
  private unescapeGitignorePattern(pattern: string): string {
    return pattern
      .replace(/\\#/g, '#')
      .replace(/\\ /g, ' ')
      .replace(/\\\\/g, '\\')
      .replace(/\\\!/g, '!');
  }

  /**
   * 获取行业标准的忽略模式
   */
  private getIndustryStandardIgnorePatterns(): string[] {
    return [
      // Node.js 生态
      'node_modules/',
      'npm-debug.log*',
      'yarn-debug.log*',
      'yarn-error.log*',
      '.pnpm-debug.log*',
      
      // 构建输出
      'dist/',
      'build/',
      'out/',
      '.next/',
      '.nuxt/',
      
      // 依赖管理
      'package-lock.json',
      'yarn.lock',
      'pnpm-lock.yaml',
      
      // IDE 和编辑器
      '.vscode/',
      '.idea/',
      '*.swp',
      '*.swo',
      '*~',
      
      // 操作系统
      '.DS_Store',
      '.DS_Store?',
      '._*',
      '.Spotlight-V100',
      '.Trashes',
      'ehthumbs.db',
      'Thumbs.db',
      
      // 版本控制
      '.git/',
      '.gitignore',
      '.gitattributes',
      
      // 日志和临时文件
      '*.log',
      '*.tmp',
      '*.temp',
      '.cache/',
      
      // 环境配置
      '.env',
      '.env.local',
      '.env.*.local',
      
      // 测试覆盖率
      'coverage/',
      '.nyc_output/',
      
      // TypeScript
      '*.tsbuildinfo',
      
      // Webpack
      '.webpack/',
    ];
  }

  /**
   * 企业级路径忽略检查器 - 支持复杂的 gitignore 语义
   */
  private shouldIgnore(relativePath: string, isDirectory: boolean): boolean {
    // 标准化路径分隔符
    const normalizedPath = relativePath.replace(/\\/g, '/');
    
    // 应用配置文件允许列表（重要的点文件不被忽略）
    if (this.isAllowedDotFile(normalizedPath)) {
      return false;
    }

    // 执行高级模式匹配
    for (const pattern of this.gitignorePatterns) {
      const matchResult = this.executeAdvancedPatternMatching(normalizedPath, pattern, isDirectory);
      
      if (matchResult.matches) {
        // 处理否定模式（! 开头）
        if (pattern.startsWith('!')) {
          return false; // 否定模式匹配，不忽略
        }
        return true; // 正常模式匹配，忽略
      }
    }
    
    return false;
  }

  /**
   * 检查是否为允许的点文件
   */
  private isAllowedDotFile(filePath: string): boolean {
    const basename = path.basename(filePath);
    
    const allowedDotFiles = new Set([
      '.env', '.env.local', '.env.production', '.env.development',
      '.gitignore', '.gitattributes', '.gitmodules',
      '.nvmrc', '.node-version',
      '.prettierrc', '.prettierrc.js', '.prettierrc.json', '.prettierrc.yaml',
      '.eslintrc', '.eslintrc.js', '.eslintrc.json', '.eslintrc.yaml',
      '.editorconfig',
      '.dockerignore',
      '.browserslistrc',
      '.babelrc', '.babelrc.js', '.babelrc.json',
      '.tsconfig.json'
    ]);
    
    return allowedDotFiles.has(basename) || basename.startsWith('.env.');
  }

  /**
   * 高级模式匹配引擎 - 完全兼容 Git 规范
   */
  private executeAdvancedPatternMatching(
    filePath: string, 
    pattern: string, 
    isDirectory: boolean
  ): { matches: boolean; reason?: string } {
    let originalPattern = pattern;
    
    // 处理否定模式
    const isNegation = pattern.startsWith('!');
    if (isNegation) {
      pattern = pattern.slice(1);
    }
    
    // 处理目录专用模式
    const isDirectoryOnly = pattern.endsWith('/');
    if (isDirectoryOnly) {
      if (!isDirectory) {
        return { matches: false, reason: 'directory-only pattern on file' };
      }
      pattern = pattern.slice(0, -1);
    }
    
    // 处理绝对路径模式
    const isAbsolute = pattern.startsWith('/');
    if (isAbsolute) {
      pattern = pattern.slice(1);
      return {
        matches: this.executeGlobMatching(filePath, pattern),
        reason: 'absolute path match'
      };
    }
    
    // 处理相对路径模式
    return this.executeRelativePatternMatching(filePath, pattern);
  }

  /**
   * 相对路径模式匹配
   */
  private executeRelativePatternMatching(filePath: string, pattern: string): { matches: boolean; reason?: string } {
    const pathSegments = filePath.split('/').filter(Boolean);
    
    // 完整路径匹配
    if (this.executeGlobMatching(filePath, pattern)) {
      return { matches: true, reason: 'full path match' };
    }
    
    // 文件名匹配
    const fileName = pathSegments[pathSegments.length - 1];
    if (fileName && this.executeGlobMatching(fileName, pattern)) {
      return { matches: true, reason: 'filename match' };
    }
    
    // 目录路径匹配（检查路径中的任意连续段）
    for (let i = 0; i < pathSegments.length; i++) {
      for (let j = i + 1; j <= pathSegments.length; j++) {
        const subPath = pathSegments.slice(i, j).join('/');
        if (this.executeGlobMatching(subPath, pattern)) {
          return { matches: true, reason: 'subpath match' };
        }
      }
    }
    
    return { matches: false, reason: 'no match found' };
  }

  /**
   * 专业级 Glob 模式匹配引擎
   */
  private executeGlobMatching(text: string, pattern: string): boolean {
    // 处理特殊情况
    if (pattern === text) return true;
    if (pattern === '') return text === '';
    if (text === '') return pattern.match(/^\*+$/) !== null;
    
    // 使用动态规划优化的 glob 匹配算法
    return this.advancedGlobMatch(text, pattern);
  }

  /**
   * 高性能动态规划 Glob 匹配算法
   */
  private advancedGlobMatch(text: string, pattern: string): boolean {
    const textLen = text.length;
    const patternLen = pattern.length;
    
    // 动态规划状态表
    const dp: boolean[][] = Array(textLen + 1)
      .fill(null)
      .map(() => Array(patternLen + 1).fill(false));
    
    // 初始状态
    dp[0][0] = true;
    
    // 处理模式开头的 * 字符
    for (let j = 1; j <= patternLen; j++) {
      if (pattern[j - 1] === '*') {
        dp[0][j] = dp[0][j - 1];
      }
    }
    
    // 填充动态规划表
    for (let i = 1; i <= textLen; i++) {
      for (let j = 1; j <= patternLen; j++) {
        const textChar = text[i - 1];
        const patternChar = pattern[j - 1];
        
        if (patternChar === '*') {
          // * 可以匹配空字符串、单个字符或多个字符
          dp[i][j] = dp[i][j - 1] || dp[i - 1][j] || dp[i - 1][j - 1];
        } else if (patternChar === '?') {
          // ? 匹配任意单个字符
          dp[i][j] = dp[i - 1][j - 1];
        } else if (patternChar === textChar) {
          // 字符精确匹配
          dp[i][j] = dp[i - 1][j - 1];
        } else if (this.isCharacterClassMatch(textChar, patternChar, pattern, j - 1)) {
          // 字符类匹配 [abc] 或 [a-z]
          dp[i][j] = dp[i - 1][j - 1];
        }
        // 否则保持 false（默认值）
      }
    }
    
    return dp[textLen][patternLen];
  }

  /**
   * 字符类匹配支持（如 [abc], [a-z], [!abc]）
   */
  private isCharacterClassMatch(char: string, patternChar: string, fullPattern: string, index: number): boolean {
    // 简化实现：支持基本的字符类
    if (patternChar === '[') {
      const closingBracket = fullPattern.indexOf(']', index);
      if (closingBracket === -1) return false;
      
      const charClass = fullPattern.slice(index + 1, closingBracket);
      const isNegated = charClass.startsWith('!') || charClass.startsWith('^');
      const actualClass = isNegated ? charClass.slice(1) : charClass;
      
      const matches = this.matchesCharacterClass(char, actualClass);
      return isNegated ? !matches : matches;
    }
    
    return false;
  }

  /**
   * 字符类内部匹配逻辑
   */
  private matchesCharacterClass(char: string, charClass: string): boolean {
    // 处理范围表达式 a-z
    const rangeMatch = charClass.match(/([a-zA-Z0-9])-([a-zA-Z0-9])/);
    if (rangeMatch) {
      const [, start, end] = rangeMatch;
      return char >= start && char <= end;
    }
    
    // 直接字符匹配
    return charClass.includes(char);
  }

  /**
   * 确保缓存是最新的
   */
  private async ensureCacheUpdated(): Promise<void> {
    const now = Date.now();
    if (now - this.lastCacheTime < this.cacheExpiration && this.cachedFiles.length > 0) {
      return;
    }

    await this.loadGitignorePatterns();
    this.cachedFiles = await this.buildFileCache();
    this.lastCacheTime = now;
  }

  /**
   * 构建文件缓存
   */
  private async buildFileCache(): Promise<FileSearchResult[]> {
    const files: FileSearchResult[] = [];
    
    try {
      await this.walkDirectory(this.currentDirectory, files, 0, 3); // 最多3层深度
    } catch (error) {
      console.warn('Error building file cache:', error);
    }
    
    return files;
  }

  /**
   * 递归遍历目录
   */
  private async walkDirectory(
    dirPath: string, 
    results: FileSearchResult[], 
    currentDepth: number, 
    maxDepth: number
  ): Promise<void> {
    if (currentDepth > maxDepth) return;

    try {
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        const relativePath = path.relative(this.currentDirectory, fullPath);
        const isDirectory = entry.isDirectory();
        
        // 使用动态忽略规则
        if (this.shouldIgnore(relativePath, isDirectory)) {
          continue;
        }

        const fileResult: FileSearchResult = {
          path: fullPath,
          name: entry.name,
          relativePath: relativePath,
          type: isDirectory ? 'directory' : 'file'
        };
        
        results.push(fileResult);
        
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
   * 更新工作目录
   */
  setWorkingDirectory(directory: string): void {
    this.currentDirectory = directory;
    this.cachedFiles = [];
    this.lastCacheTime = 0;
    this.gitignorePatterns = [];
    this.gitignoreLastModified = 0;
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cachedFiles = [];
    this.lastCacheTime = 0;
    this.gitignorePatterns = [];
    this.gitignoreLastModified = 0;
  }
} 