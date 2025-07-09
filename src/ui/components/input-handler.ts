import chalk from 'chalk';
import { CommandManager, Command } from './commands';
import { FileSearchManager, FileSearchResult } from './files';
import { Messages } from '../../types/language';

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
        state.suggestions = files.map(file => ({
          type: 'file',
          value: file.relativePath,
          display: this.formatFileDisplay(file),
          description: file.type === 'directory' 
            ? this.messages.main.fileSearch.directory
            : this.messages.main.fileSearch.file
        }));
        state.showingSuggestions = true;
        state.suggestionsType = 'file';
      }
      return state;
    }

    return state;
  }

  /**
   * 格式化文件显示文本
   */
  private formatFileDisplay(file: FileSearchResult): string {
    const icon = file.type === 'directory' ? '[DIR]' : '[FILE]';
    const name = file.name;
    const dir = file.relativePath.includes('/') 
      ? file.relativePath.substring(0, file.relativePath.lastIndexOf('/'))
      : '';
    
    if (dir) {
      return `${icon} ${name} (${dir})`;
    }
    return `${icon} ${name}`;
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
        // 添加到选中文件列表
        this.selectedFiles.add(suggestion.value);
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
        displayText = isSelected
          ? chalk.yellow.bold(suggestion.display) + ' - ' + chalk.white.bold(suggestion.description)
          : chalk.gray(suggestion.display) + ' - ' + chalk.gray(suggestion.description);
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
    
    // 更新选中文件列表，只保留仍在输入中的文件
    this.selectedFiles = new Set(fileReferences);
  }

  /**
   * 从输入文本中提取文件引用
   */
  private extractFileReferences(input: string): string[] {
    const fileReferences: string[] = [];
    // 匹配 @文件路径 模式，文件路径可以包含字母、数字、点、斜杠、连字符、下划线
    const regex = /@([a-zA-Z0-9./\-_]+)(?=\s|$)/g;
    let match;
    
    while ((match = regex.exec(input)) !== null) {
      const filePath = match[1];
      if (filePath.length > 0) {
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
   * 清除选中文件列表
   */
  clearSelectedFiles(): void {
    this.selectedFiles.clear();
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