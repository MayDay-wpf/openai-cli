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

      const files = await this.fileSearchManager.searchFiles(fileQuery, 8);

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
      const fileName = normalizedPath.substring(lastSlashIndex + 1);
      const dirPath = normalizedPath.substring(0, lastSlashIndex);

      // 当有同名文件冲突时，更突出地显示路径信息
      if (hasConflicts) {
        return `${icon} ${chalk.yellow(fileName)} ${chalk.blue('(' + dirPath + ')')}`;
      } else {
        return `${icon} ${fileName} ${chalk.dim('(' + dirPath + ')')}`;
      }
    }

    // 根目录文件
    return `${icon} ${normalizedPath}`;
  }

  /**
 * 获取文件描述信息
 */
  private getFileDescription(file: FileSearchResult): string {
    const baseType = file.type === 'directory'
      ? this.messages.main.fileSearch.directory
      : this.messages.main.fileSearch.file;

    // 规范化路径显示
    const normalizedPath = file.relativePath.replace(/\\/g, '/');

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

      return prefix + displayText;
    });
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