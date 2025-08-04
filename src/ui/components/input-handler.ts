import chalk from 'chalk';
import { Messages } from '../../types/language';
import { isImageFile } from '../../utils/file-types';
import { CommandManager } from './commands';
import { FileSearchManager, FileSearchResult } from './files';

export interface InputSuggestion {
  type: 'command' | 'file';
  value: string;
  display: string;
  description: string;
}

export interface InputState {
  input: string;
  suggestions: InputSuggestion[];
  selectedIndex: number;
  showingSuggestions: boolean;
  suggestionsType: 'command' | 'file' | null;
}

export class InputHandler {
  private commandManager: CommandManager;
  private fileSearchManager: FileSearchManager;
  private messages: Messages;
  private selectedFiles: Set<string> = new Set();
  private selectedImageFiles: Set<string> = new Set();
  private selectedTextFiles: Set<string> = new Set();

  constructor(
    commandManager: CommandManager,
    fileSearchManager: FileSearchManager,
    messages: Messages
  ) {
    this.commandManager = commandManager;
    this.fileSearchManager = fileSearchManager;
    this.messages = messages;
  }

  /**
   * 分析输入并返回建议
   */
  async analyzInput(input: string): Promise<InputState> {
    const state: InputState = {
      input,
      suggestions: [],
      selectedIndex: 0,
      showingSuggestions: false,
      suggestionsType: null
    };

    // 检查是否是命令输入
    if (input.startsWith('/')) {
      const commands = this.commandManager.filterCommands(input);
      if (commands.length > 0) {
        state.suggestions = commands.map(cmd => ({
          type: 'command',
          value: cmd.value,
          display: cmd.value,
          description: cmd.description
        }));
        state.showingSuggestions = true;
        state.suggestionsType = 'command';
      }
      return state;
    }

    // 检查是否是文件搜索输入
    const lastAtIndex = input.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      // 获取@后面的查询字符串
      const fileQuery = input.substring(lastAtIndex + 1);

      // 如果查询字符串后面有空格，说明已经完成选择，不显示建议
      if (fileQuery.includes(' ')) {
        return state;
      }

      // 使用同步搜索避免异步问题
      const files = this.fileSearchManager.searchFilesSync(fileQuery, 8);

      if (files.length > 0) {
        // 检查是否有同名文件需要特殊处理
        const hasConflicts = this.checkForNameConflicts(files);

        state.suggestions = files.map(file => ({
          type: 'file',
          value: file.relativePath,
          display: this.formatFileDisplay(file, hasConflicts),
          description: this.getFileDescription(file)
        }));
        state.showingSuggestions = true;
        state.suggestionsType = 'file';
      }
      return state;
    }

    return state;
  }

  /**
 * 检查是否有同名文件冲突
 */
  private checkForNameConflicts(files: FileSearchResult[]): boolean {
    const nameSet = new Set<string>();
    for (const file of files) {
      if (nameSet.has(file.name)) {
        return true; // 发现同名文件
      }
      nameSet.add(file.name);
    }
    return false;
  }

  /**
   * 格式化文件显示文本
   */
  private formatFileDisplay(file: FileSearchResult, hasConflicts: boolean = false): string {
    const icon = file.type === 'directory' ? '📁' : '📄';

    // 规范化路径分隔符
    const normalizedPath = file.relativePath.replace(/\\/g, '/');

    // 如果路径包含目录分隔符，分离文件名和目录路径
    if (normalizedPath.includes('/')) {
      const lastSlashIndex = normalizedPath.lastIndexOf('/');
      let fileName = normalizedPath.substring(lastSlashIndex + 1);
      let dirPath = normalizedPath.substring(0, lastSlashIndex);

      // 限制文件名长度，避免过长显示，考虑终端宽度
      const maxFileNameLength = Math.min(40, Math.floor((process.stdout.columns || 80) * 0.4));
      if (fileName.length > maxFileNameLength) {
        fileName = fileName.substring(0, maxFileNameLength - 3) + '...';
      }

      // 限制目录路径长度，考虑终端宽度
      const maxDirPathLength = Math.min(30, Math.floor((process.stdout.columns || 80) * 0.3));
      if (dirPath.length > maxDirPathLength) {
        dirPath = '...' + dirPath.substring(dirPath.length - (maxDirPathLength - 3));
      }

      // 当有同名文件冲突时，更突出地显示路径信息
      if (hasConflicts) {
        return `${icon} ${chalk.yellow(fileName)} ${chalk.blue('(' + dirPath + ')')}`;
      } else {
        return `${icon} ${fileName} ${chalk.dim('(' + dirPath + ')')}`;
      }
    }

    // 根目录文件 - 也限制长度，考虑终端宽度
    let displayPath = normalizedPath;
    const maxPathLength = Math.min(50, Math.floor((process.stdout.columns || 80) * 0.5));
    if (displayPath.length > maxPathLength) {
      displayPath = displayPath.substring(0, maxPathLength - 3) + '...';
    }

    return `${icon} ${displayPath}`;
  }

  /**
 * 获取文件描述信息
 */
  private getFileDescription(file: FileSearchResult): string {
    const baseType = file.type === 'directory'
      ? this.messages.main.fileSearch.directory
      : this.messages.main.fileSearch.file;

    // 规范化路径显示
    let normalizedPath = file.relativePath.replace(/\\/g, '/');
    
    // 限制描述中的路径长度，避免过长，考虑终端宽度
    const maxDescriptionLength = Math.min(60, Math.floor((process.stdout.columns || 80) * 0.6));
    if (normalizedPath.length > maxDescriptionLength) {
      normalizedPath = '...' + normalizedPath.substring(normalizedPath.length - (maxDescriptionLength - 3));
    }

    // 显示类型和完整路径，确保同名文件可区分
    return `${baseType} • ${normalizedPath}`;
  }

  /**
   * 处理建议选择
   */
  handleSuggestionSelection(
    currentInput: string,
    suggestion: InputSuggestion
  ): string {
    if (suggestion.type === 'command') {
      return suggestion.value;
    }

    if (suggestion.type === 'file') {
      const lastAtIndex = currentInput.lastIndexOf('@');
      if (lastAtIndex !== -1) {
        // 替换@后面的内容为选中的文件路径，并添加空格
        const newInput = currentInput.substring(0, lastAtIndex + 1) + suggestion.value + ' ';
        // 立即更新选中文件列表，确保同步
        this.updateSelectedFiles(newInput);
        return newInput;
      }
    }

    return currentInput;
  }

  /**
 * 渲染建议列表
 */
  renderSuggestions(suggestions: InputSuggestion[], selectedIndex: number): string[] {
    return suggestions.map((suggestion, index) => {
      const isSelected = index === selectedIndex;
      const prefix = isSelected ? chalk.cyan('● ') : chalk.gray('○ ');

      let displayText: string;
      if (suggestion.type === 'command') {
        displayText = isSelected
          ? chalk.cyan.bold(suggestion.display) + ' - ' + chalk.white.bold(suggestion.description)
          : chalk.gray(suggestion.display) + ' - ' + chalk.gray(suggestion.description);
      } else {
        // 文件类型：使用更清晰的格式显示
        const display = suggestion.display;
        const description = suggestion.description;

        if (isSelected) {
          displayText = chalk.yellow.bold(display) + chalk.white(' - ') + chalk.white.dim(description);
        } else {
          displayText = chalk.gray(display) + chalk.gray(' - ') + chalk.gray.dim(description);
        }
      }

      // 确保每行都不会超过终端宽度，避免自动换行导致的显示问题
      const terminalWidth = process.stdout.columns || 80;
      const maxLineWidth = Math.max(40, terminalWidth - 4); // 至少保留40个字符，留出一些边距
      const fullLine = prefix + displayText;
      
      // 使用 StringUtils 计算实际显示宽度（考虑ANSI颜色代码）
      const displayWidth = this.getDisplayWidthWithAnsi(fullLine);
      
      if (displayWidth > maxLineWidth) {
        // 截断过长的行，但保留颜色格式
        return this.truncateWithColor(fullLine, maxLineWidth);
      }
      
      return fullLine;
    });
  }

  /**
   * 计算包含ANSI颜色代码的字符串显示宽度
   */
  private getDisplayWidthWithAnsi(str: string): number {
    // 移除ANSI转义序列来计算实际显示宽度
    const cleanStr = str.replace(/\x1b\[[0-9;]*m/g, '');
    let width = 0;
    
    for (const char of cleanStr) {
      const code = char.codePointAt(0) || 0;
      if (code < 32 || (code >= 127 && code < 160)) {
        continue;
      }
      
      // 中文字符等宽字符占2个字符位置
      if (this.isWideChar(code)) {
        width += 2;
      } else {
        width += 1;
      }
    }
    
    return width;
  }

  /**
   * 检查是否是宽字符（中文、日文等）
   */
  private isWideChar(code: number): boolean {
    return (
      (code >= 0x1100 && code <= 0x115F) || // Hangul Jamo
      (code >= 0x2E80 && code <= 0x2E99) || // CJK Radicals Supplement
      (code >= 0x2E9B && code <= 0x2EF3) || // CJK Radicals Supplement
      (code >= 0x2F00 && code <= 0x2FD5) || // Kangxi Radicals
      (code >= 0x3000 && code <= 0x303E) || // CJK Symbols and Punctuation
      (code >= 0x3041 && code <= 0x3096) || // Hiragana
      (code >= 0x3099 && code <= 0x30FF) || // Katakana
      (code >= 0x3105 && code <= 0x312D) || // Bopomofo
      (code >= 0x3131 && code <= 0x318E) || // Hangul Compatibility Jamo
      (code >= 0x3400 && code <= 0x4DBF) || // CJK Unified Ideographs Extension A
      (code >= 0x4E00 && code <= 0x9FFF) || // CJK Unified Ideographs
      (code >= 0xAC00 && code <= 0xD7A3) || // Hangul Syllables
      (code >= 0xF900 && code <= 0xFAFF) || // CJK Compatibility Ideographs
      (code >= 0xFF00 && code <= 0xFF60) || // Fullwidth Forms
      (code >= 0xFFE0 && code <= 0xFFE6) || // Fullwidth Forms
      (code >= 0x20000 && code <= 0x2A6DF) || // CJK Unified Ideographs Extension B
      (code >= 0x2A700 && code <= 0x2B73F) || // CJK Unified Ideographs Extension C
      (code >= 0x2B740 && code <= 0x2B81F) || // CJK Unified Ideographs Extension D
      (code >= 0x2B820 && code <= 0x2CEAF) || // CJK Unified Ideographs Extension E
      (code >= 0x2F800 && code <= 0x2FA1F)    // CJK Compatibility Ideographs Supplement
    );
  }

  /**
   * 在保持颜色格式的情况下截断字符串
   */
  private truncateWithColor(str: string, maxWidth: number): string {
    // 确保最小宽度，为省略号留出空间
    const minWidth = Math.max(10, maxWidth - 3);
    
    // 简单实现：移除末尾字符直到宽度合适
    let currentStr = str;
    while (this.getDisplayWidthWithAnsi(currentStr) > minWidth && currentStr.length > 0) {
      // 从后往前移除字符，但避免破坏ANSI序列
      const lastNonAnsiIndex = currentStr.search(/\x1b\[[0-9;]*m$/);
      if (lastNonAnsiIndex > 0) {
        currentStr = currentStr.substring(0, lastNonAnsiIndex);
      } else {
        currentStr = currentStr.substring(0, currentStr.length - 1);
      }
    }
    return currentStr + '...';
  }

  /**
   * 获取建议类型的标题
   */
  getSuggestionTitle(type: 'command' | 'file' | null): string {
    switch (type) {
      case 'command':
        return chalk.blue('[CMD] ' + this.messages.main.help.availableCommands + ':');
      case 'file':
        return chalk.green('[FILE] ' + this.messages.main.fileSearch.title + ':');
      default:
        return '';
    }
  }

  /**
   * 更新选中文件列表（当用户修改输入时调用）
   */
  updateSelectedFiles(currentInput: string): void {
    // 从输入中提取所有@文件引用
    const fileReferences = this.extractFileReferences(currentInput);

    this.selectedImageFiles.clear();
    this.selectedTextFiles.clear();

    for (const file of fileReferences) {
      if (isImageFile(file)) {
        this.selectedImageFiles.add(file);
      } else {
        this.selectedTextFiles.add(file);
      }
    }

    // 更新选中文件列表，只保留仍在输入中的文件
    this.selectedFiles = new Set(fileReferences);
  }

  /**
   * 强制同步输入文本和选中文件列表
   * 当需要确保文件列表与当前输入完全同步时调用
   */
  syncSelectedFiles(currentInput: string): void {
    this.updateSelectedFiles(currentInput);
  }

  /**
   * 从输入文本中提取文件引用
   * 支持的格式：
   * - "@文件路径 " - 文件路径后跟空格
   * - "@文件路径" - 文件路径在字符串末尾
   * - "@src/components/input-handler.ts 这是用户消息" - 文件路径后跟用户自定义消息
   */
  private extractFileReferences(input: string): string[] {
    const fileReferences: string[] = [];

    // 使用正则表达式匹配 @ 后跟非空白字符，直到遇到空格或字符串结尾
    // [^\s@]+ 匹配一个或多个非空白且非@字符（文件路径）
    // (?=\s|$) 正向前瞻，确保后面是空格或字符串结尾
    const spaceDelimitedRegex = /@([^\s@]+)(?=\s|$)/g;
    let match;

    while ((match = spaceDelimitedRegex.exec(input)) !== null) {
      const filePath = match[1];
      if (filePath && filePath.length > 0) {
        fileReferences.push(filePath);
      }
    }

    return fileReferences;
  }

  /**
   * 获取当前选中的文件列表
   */
  getSelectedFiles(): string[] {
    return Array.from(this.selectedFiles);
  }

  /**
   * 获取当前选中的图片文件列表
   */
  getSelectedImageFiles(): string[] {
    return Array.from(this.selectedImageFiles);
  }

  /**
   * 获取当前选中的文本文件列表
   */
  getSelectedTextFiles(): string[] {
    return Array.from(this.selectedTextFiles);
  }

  /**
   * 清除选中文件列表
   */
  clearSelectedFiles(): void {
    this.selectedFiles.clear();
    this.selectedImageFiles.clear();
    this.selectedTextFiles.clear();
  }

  /**
   * 检查指定文件是否已选中
   */
  isFileSelected(filePath: string): boolean {
    return this.selectedFiles.has(filePath);
  }

  /**
   * 更新语言设置
   */
  updateLanguage(messages: Messages): void {
    this.messages = messages;
  }
} 