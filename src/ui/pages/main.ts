import boxen from 'boxen';
import chalk from 'chalk';
import { languageService } from '../../services/language';
import { StorageService } from '../../services/storage';
import { SystemDetector } from '../../services/system-detector';
import { Messages } from '../../types/language';
import { LoadingController, StringUtils } from '../../utils';
import { ChatState, CommandManager, FileSearchManager, HelpManager, InitHandler, InputHandler, InputState, Message, MessageHandler, MessageHandlerCallbacks, ResponseManager } from '../components';

export class MainPage {
  private messages: Message[] = [];
  private chatState: ChatState = {
    canSendMessage: true,
    isProcessing: false
  };
  private loadingController: LoadingController | null = null;
  private isDestroyed = false;

  // 组件管理器
  private commandManager: CommandManager;
  private helpManager: HelpManager;
  private responseManager: ResponseManager;
  private fileSearchManager: FileSearchManager;
  private inputHandler: InputHandler;
  private initHandler: InitHandler;
  private messageHandler: MessageHandler;
  private currentMessages: Messages;
  private systemDetector: SystemDetector;

  constructor() {
    this.currentMessages = languageService.getMessages();
    this.commandManager = new CommandManager(this.currentMessages);
    this.helpManager = new HelpManager(this.currentMessages);
    this.responseManager = new ResponseManager(this.currentMessages);
    this.fileSearchManager = new FileSearchManager();
    this.inputHandler = new InputHandler(
      this.commandManager,
      this.fileSearchManager,
      this.currentMessages
    );
    this.initHandler = new InitHandler(this.currentMessages);
    this.systemDetector = new SystemDetector();

    // 创建 MessageHandler 回调
    const messageHandlerCallbacks: MessageHandlerCallbacks = {
      onStateChange: (state: Partial<ChatState>) => {
        this.setChatState(state);
      },
      onLoadingStart: (controller: LoadingController) => {
        this.loadingController = controller;
      },
      onLoadingStop: () => {
        if (this.loadingController) {
          this.loadingController.stop();
          this.loadingController = null;
        }
      },
      getSelectedImageFiles: () => {
        return this.getSelectedImageFiles();
      },
      getSelectedTextFiles: () => {
        return this.getSelectedTextFiles();
      },
      addMessage: (message: Message) => {
        this.messages.push(message);
      },
      getRecentMessages: (count: number = 20) => {
        return this.messages.slice(-count);
      },
      getSystemDetector: () => {
        return this.systemDetector;
      }
    };

    this.messageHandler = new MessageHandler(this.currentMessages, messageHandlerCallbacks);

    // 监听语言变化
    languageService.onLanguageChange((language) => {
      this.updateLanguage();
    });
  }

  // 销毁方法，清理所有资源
  destroy(): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;

    // 停止loading动画
    if (this.loadingController) {
      this.loadingController.stop();
      this.loadingController = null;
    }

    // 清理SystemDetector资源
    this.systemDetector.cleanup().catch(error => {
      // 忽略清理错误
    });

    // 重置聊天状态
    this.setChatState({ canSendMessage: false, isProcessing: false });

    // 清空消息
    this.messages = [];

    // 重置命令管理器状态
    this.commandManager.resetStates();

    // 清除选中文件列表
    this.clearSelectedFiles();

    // 清理stdin状态
    if (process.stdin.isTTY) {
      try {
        process.stdin.setRawMode(false);
      } catch (error) {
        // 忽略错误
      }
    }

    // 移除所有可能的事件监听器
    process.stdin.removeAllListeners('data');
    process.stdin.removeAllListeners('error');
    process.stdin.removeAllListeners('end');

    try {
      process.stdin.pause();
    } catch (error) {
      // 忽略错误
    }
  }

  private updateLanguage(): void {
    this.currentMessages = languageService.getMessages();
    this.commandManager.updateLanguage(this.currentMessages);
    this.helpManager.updateLanguage(this.currentMessages);
    this.responseManager.updateLanguage(this.currentMessages);
    this.inputHandler.updateLanguage(this.currentMessages);
    this.initHandler.updateLanguage(this.currentMessages);
    this.messageHandler.updateLanguage(this.currentMessages);
  }

  // 公开API：注入AI回复
  injectAIReply(content: string): void {
    // 停止loading动画
    if (this.loadingController) {
      this.loadingController.stop();
      this.loadingController = null;
    }

    this.messageHandler.injectAIReply(content);
  }

  // 公开API：设置聊天状态
  setChatState(state: Partial<ChatState>): void {
    this.chatState = { ...this.chatState, ...state };
  }

  // 公开API：获取聊天状态
  getChatState(): ChatState {
    return { ...this.chatState };
  }

  // 公开API：获取当前选中的图片文件列表
  getSelectedImageFiles(): string[] {
    return this.inputHandler.getSelectedImageFiles();
  }

  // 公开API：获取当前选中的文本文件列表
  getSelectedTextFiles(): string[] {
    return this.inputHandler.getSelectedTextFiles();
  }

  // 公开API：清除选中文件列表
  clearSelectedFiles(): void {
    this.inputHandler.clearSelectedFiles();
  }

  async show(): Promise<void> {
    // 确保之前的状态已清理
    if (this.isDestroyed) {
      // 重新初始化
      this.isDestroyed = false;
      this.chatState = {
        canSendMessage: true,
        isProcessing: false
      };
      this.messages = [];
      this.commandManager.resetStates();
      this.loadingController = null;
    }

    // 强制清屏，确保完全清除欢迎页面内容
    process.stdout.write('\x1B[2J\x1B[3J\x1B[H');
    process.stdout.write('\x1Bc');

    // 确保stdin处于正确状态
    try {
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }
      process.stdin.removeAllListeners('data');
      process.stdin.removeAllListeners('error');
      process.stdin.removeAllListeners('end');
      process.stdin.pause();
    } catch (error) {
      // 忽略清理错误
    }

    const main = this.currentMessages.main;

    // 获取当前配置信息
    const currentDir = process.cwd();
    const apiConfig = StorageService.getApiConfig();

    // 构建配置信息显示文本
    const configInfo = main.welcomeBox.configInfo
      .replace('{currentDir}', currentDir)
      .replace('{baseUrl}', apiConfig.baseUrl || 'unknown')
      .replace('{apiKey}', apiConfig.apiKey ? StringUtils.maskApiKey(apiConfig.apiKey) : 'unknown');

    // 欢迎方框
    const welcomeBox = boxen(
      chalk.hex('#FF6B6B').bold(main.title + '\n\n') +
      chalk.hex('#4ECDC4').italic(main.subtitle) + '\n\n' +
      chalk.hex('#45B7D1')('─'.repeat(50)) + '\n' +
      configInfo,
      {
        padding: 1,
        margin: 1,
        borderStyle: 'double',
        borderColor: 'magenta',
        title: main.welcomeBox.title,
        titleAlignment: 'center'
      }
    );

    process.stdout.write(welcomeBox + '\n\n');

    // 在显示输入之前先进行系统检测
    await this.performSystemDetection();

    // 开始聊天循环
    await this.startChatLoop();
  }

  private async performSystemDetection(): Promise<void> {
    try {
      // 检测系统状态
      const detectionResult = await this.systemDetector.detectSystem();

      // 显示系统信息
      await this.systemDetector.displaySystemInfo(detectionResult);

      // 添加空行分隔，直接进入输入状态
      if (detectionResult.hasRole || detectionResult.hasMcpServices) {
        console.log(); // 添加空行分隔
      }
    } catch (error) {
      console.error('系统检测失败:', error);
      // 检测失败不影响后续流程，继续进入聊天
    }
  }

  private async startChatLoop(): Promise<void> {
    try {
      while (true) {
        // 检查是否已被销毁
        if (this.isDestroyed) {
          break;
        }

        // 检查是否可以发送消息
        if (!this.chatState.canSendMessage) {
          process.stdout.write(chalk.red(this.currentMessages.main.status.cannotSendMessage + '\n'));
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }

        // 获取用户输入
        const userInput = await this.getUserInput();

        if (userInput === '/exit') {
          const exitAction = await this.commandManager.handleExitWithHistoryCheck(this.messages);
          if (exitAction !== 'cancel') {
            break;
          } else {
            continue; // 用户取消退出，继续聊天循环
          }
        }

        if (userInput === '/clear') {
          this.messages = [];
          this.commandManager.setHasExportedHistory(false);
          // 清除选中文件列表
          this.clearSelectedFiles();
          // 强制清屏
          process.stdout.write('\x1B[2J\x1B[3J\x1B[H');
          process.stdout.write('\x1Bc');
          continue;
        }

        // 使用 CommandManager 处理用户输入
        const commandResult = await this.commandManager.handleInput(userInput, this.messages);

        if (commandResult.handled) {
          // 命令已被处理
          if (commandResult.newMessages) {
            this.messages = commandResult.newMessages;
          }
          if (commandResult.shouldContinue) {
            continue;
          }
          if (commandResult.shouldExit) {
            break;
          }
        }

        // 如果 CommandManager 没有处理，检查是否需要处理文件选择
        const selectedTextFiles = this.getSelectedTextFiles();
        if (this.commandManager.isWaitingForFileImportState() && selectedTextFiles.some(f => f.startsWith('@'))) {
          const fileResult = await this.commandManager.handleFileSelection(selectedTextFiles, this.messages);
          if (fileResult.handled) {
            if (fileResult.newMessages) {
              this.messages = fileResult.newMessages;
            }
            continue;
          }
        }

        // 处理其他命令
        if (userInput === '/help') {
          this.helpManager.showHelp(this.commandManager.getCommands());
          continue;
        }

        if (userInput === '/config') {
          process.stdout.write(chalk.yellow(this.currentMessages.main.messages.configInDevelopment + '\n'));
          continue;
        }

        if (userInput === '/history') {
          this.messageHandler.showHistory(this.messages);
          continue;
        }

        if (userInput === '/edit-history') {
          // /edit-history 命令由 CommandManager 处理
          const commandResult = await this.commandManager.handleInput(userInput, this.messages);
          if (commandResult.handled && commandResult.newMessages) {
            this.messages = commandResult.newMessages;
          }
          continue;
        }

        if (userInput === '/init') {
          await this.handleInitCommand();
          continue;
        }

        // 检查是否选择了 JSON 文件，询问是否要导入历史记录
        const selectedFiles = this.getSelectedTextFiles();
        if (selectedFiles.some(f => f.includes('@') && f.includes('.json'))) {
          const jsonFiles = selectedFiles.filter(file => file.endsWith('.json'));
          if (jsonFiles.length > 0) {
            const historyMgmt = this.currentMessages.main.historyManagement;
            console.log(chalk.yellow(`${historyMgmt.jsonFileDetected}：${jsonFiles.join(', ')}`));
            console.log(chalk.cyan(historyMgmt.historyImportTip));
            console.log(chalk.gray(`${historyMgmt.directImportTip}：@${jsonFiles[0]}`));
          }
        }

        // 添加用户消息并直接显示
        this.messageHandler.addUserMessage(userInput);

        // 处理AI请求
        await this.messageHandler.processAIRequest();
      }
    } catch (error) {
      console.error('聊天循环出现错误:', error);
    } finally {
      // 确保在退出时清理所有资源
      this.destroy();
    }
  }

  private async getUserInput(): Promise<string> {
    // 检查是否已被销毁
    if (this.isDestroyed) {
      return '/exit';
    }

    return new Promise(async (resolve, reject) => {
      let currentInput = '';
      let currentState: InputState | null = null;
      let isDestroyed = false;

      // 显示初始提示符
      process.stdout.write(chalk.cyan(this.currentMessages.main.prompt));

      // 显示建议列表
      const showSuggestions = (state: InputState) => {
        if (!state.showingSuggestions || state.suggestions.length === 0 || isDestroyed) return;

        // 显示标题
        const title = this.inputHandler.getSuggestionTitle(state.suggestionsType);
        if (title) {
          process.stdout.write('\n' + title + '\n');
        } else {
          process.stdout.write('\n');
        }

        // 显示建议
        const renderedSuggestions = this.inputHandler.renderSuggestions(
          state.suggestions,
          state.selectedIndex
        );

        renderedSuggestions.forEach(suggestion => {
          process.stdout.write(suggestion + '\n');
        });

        // 返回到输入行
        const linesToGoUp = renderedSuggestions.length + (title ? 2 : 1);
        process.stdout.write(`\x1B[${linesToGoUp}A`);

        // 重新计算光标位置：提示符长度 + 当前输入显示宽度
        const promptLength = StringUtils.getDisplayWidth(this.currentMessages.main.prompt);
        const inputWidth = StringUtils.getDisplayWidth(currentInput);
        process.stdout.write(`\x1B[${promptLength + inputWidth + 1}G`);
      };

      // 隐藏建议列表
      const hideSuggestions = () => {
        if (!currentState?.showingSuggestions || currentState.suggestions.length === 0 || isDestroyed) return;

        // 移动到建议列表开始位置并清除
        process.stdout.write('\x1B[1B'); // 下移一行到列表开始

        // 清除标题行（如果有）
        const hasTitle = !!this.inputHandler.getSuggestionTitle(currentState.suggestionsType);
        if (hasTitle) {
          process.stdout.write('\x1B[2K'); // 清除标题行
          process.stdout.write('\x1B[1B'); // 下移到建议开始
        }

        // 清除所有建议行
        for (let i = 0; i < currentState.suggestions.length; i++) {
          process.stdout.write('\x1B[2K'); // 清除整行
          if (i < currentState.suggestions.length - 1) {
            process.stdout.write('\x1B[1B'); // 下移一行
          }
        }

        // 返回到输入行
        const linesToGoUp = currentState.suggestions.length + (hasTitle ? 1 : 0);
        process.stdout.write(`\x1B[${linesToGoUp}A`);

        // 重新计算光标位置，使用显示宽度而不是字符长度
        const promptLength = StringUtils.getDisplayWidth(this.currentMessages.main.prompt);
        const inputWidth = StringUtils.getDisplayWidth(currentInput);
        process.stdout.write(`\x1B[${promptLength + inputWidth + 1}G`);
      };

      // 更新显示
      const updateDisplay = async () => {
        if (isDestroyed) return;

        // 更新选中文件列表
        this.inputHandler.updateSelectedFiles(currentInput);

        // 隐藏当前建议
        if (currentState?.showingSuggestions) {
          hideSuggestions();
        }

        // 获取新状态
        const newState = await this.inputHandler.analyzInput(currentInput);
        currentState = newState;

        // 显示新建议
        if (newState.showingSuggestions) {
          showSuggestions(newState);
        }
      };

      // 强制刷新输入行显示
      const refreshInputLine = () => {
        if (isDestroyed) return;

        // 清除当前行并重新显示
        process.stdout.write('\x1B[2K\x1B[0G');
        process.stdout.write(chalk.cyan(this.currentMessages.main.prompt) + currentInput);
      };

      // 清理函数
      const cleanup = () => {
        if (isDestroyed) return;
        isDestroyed = true;

        if (currentState?.showingSuggestions) {
          hideSuggestions();
        }

        // 移除所有事件监听器
        process.stdin.removeAllListeners('data');
        process.stdin.removeAllListeners('error');
        process.stdin.removeAllListeners('end');

        // 重置stdin状态
        if (process.stdin.isTTY) {
          try {
            process.stdin.setRawMode(false);
          } catch (error) {
            // 忽略错误，可能已经被重置
          }
        }

        // 暂停stdin
        try {
          process.stdin.pause();
        } catch (error) {
          // 忽略错误
        }

        // 移除进程退出监听器
        process.removeListener('SIGINT', handleExit);
        process.removeListener('SIGTERM', handleExit);
      };

      // 键盘事件处理
      const onKeyPress = async (key: string) => {
        if (isDestroyed) return;

        try {
          const keyCode = key.charCodeAt(0);

          // Ctrl+C - 优雅退出
          if (keyCode === 3) {
            cleanup();
            process.stdout.write('\n');
            // 检查是否需要导出历史记录
            const exitAction = await this.commandManager.handleExitWithHistoryCheck(this.messages);
            if (exitAction === 'cancel') {
              // 用户取消退出，重新开始输入循环
              return;
            }
            resolve('/exit');
            return;
          }

          // Enter 键
          if (keyCode === 13) {
            if (currentState?.showingSuggestions && currentState.suggestions.length > 0) {
              // 选择当前高亮的建议
              const selectedSuggestion = currentState.suggestions[currentState.selectedIndex];
              const newInput = this.inputHandler.handleSuggestionSelection(currentInput, selectedSuggestion);

              if (selectedSuggestion.type === 'command') {
                // 命令类型直接执行
                // 先手动隐藏建议列表，确保清除干净
                if (currentState.showingSuggestions) {
                  hideSuggestions();
                }

                // 清除整行并重新显示命令
                process.stdout.write('\x1B[2K\x1B[0G');
                process.stdout.write(chalk.cyan(this.currentMessages.main.prompt) + newInput + '\n');

                cleanup();
                resolve(newInput);
                return;
              } else {
                // 文件类型，更新输入内容
                if (currentState.showingSuggestions) {
                  hideSuggestions();
                }

                // 更新输入内容
                currentInput = newInput;

                // 刷新输入行显示
                refreshInputLine();

                // 更新显示
                await updateDisplay();
                return;
              }
            } else if (currentInput.trim()) {
              // 正常输入
              cleanup();
              process.stdout.write('\n');
              resolve(currentInput.trim());
              return;
            } else {
              // 空输入，什么都不做
              return;
            }
          }

          // Backspace 键
          if (keyCode === 127 || keyCode === 8) {
            if (currentInput.length > 0) {
              // 先隐藏建议列表（如果有的话）
              if (currentState?.showingSuggestions) {
                hideSuggestions();
              }

              // 获取最后一个字符及其显示宽度
              const lastChar = currentInput.slice(-1);
              const lastCharWidth = StringUtils.getDisplayWidth(lastChar);
              currentInput = currentInput.slice(0, -1);

              // 根据字符的实际显示宽度回退光标
              if (lastCharWidth === 2) {
                // 宽字符（如中文），占用2个字符宽度
                process.stdout.write('\b\b  \b\b');
              } else {
                // 窄字符（如ASCII），占用1个字符宽度
                process.stdout.write('\b \b');
              }

              // 重新更新显示
              await updateDisplay();
            }
            return;
          }

          // 上下箭头键处理
          if (key.length >= 3 && key.startsWith('\x1B[')) {
            if (key === '\x1B[A') { // 上箭头
              if (currentState?.showingSuggestions && currentState.suggestions.length > 0) {
                hideSuggestions();
                const newIndex = currentState.selectedIndex > 0
                  ? currentState.selectedIndex - 1
                  : currentState.suggestions.length - 1;
                currentState.selectedIndex = newIndex;
                showSuggestions(currentState);
              }
              return;
            } else if (key === '\x1B[B') { // 下箭头
              if (currentState?.showingSuggestions && currentState.suggestions.length > 0) {
                hideSuggestions();
                const newIndex = currentState.selectedIndex < currentState.suggestions.length - 1
                  ? currentState.selectedIndex + 1
                  : 0;
                currentState.selectedIndex = newIndex;
                showSuggestions(currentState);
              }
              return;
            }
          }

          // ESC 键 - 隐藏建议列表
          if (keyCode === 27 && key.length === 1) {
            if (currentState?.showingSuggestions) {
              hideSuggestions();
              currentState.showingSuggestions = false;
              currentState.suggestions = [];
            }
            return;
          }

          // 普通字符（支持中文等多字节字符）
          if (key.length === 1 && keyCode >= 32) {
            // 支持所有可打印字符，包括中文
            currentInput += key;
            process.stdout.write(key);
            await updateDisplay();
          } else if (key.length > 1) {
            // 处理多字节字符或粘贴内容
            // 过滤掉控制序列（以\x1B开头的）
            if (!key.startsWith('\x1B')) {
              // 检查是否为粘贴的长文本（包含换行符或长度较大）
              if (key.includes('\n') || key.includes('\r') || key.length > 10) {
                // 处理粘贴内容
                const processedText = StringUtils.processPastedText(key);
                if (processedText) {
                  // 先隐藏建议列表（如果有的话）
                  if (currentState?.showingSuggestions) {
                    hideSuggestions();
                  }

                  // 添加处理后的文本到输入
                  currentInput += processedText;

                  // 刷新输入行显示
                  refreshInputLine();

                  // 更新显示
                  await updateDisplay();
                }
              } else {
                // 正常的多字节字符（如中文字符）
                currentInput += key;
                process.stdout.write(key);
                await updateDisplay();
              }
            }
          }
        } catch (error) {
          // 捕获任何异常，避免程序崩溃
          cleanup();
          reject(error);
        }
      };

      // 错误处理
      const onError = (error: Error) => {
        if (!isDestroyed) {
          cleanup();
          reject(error);
        }
      };

      // 进程退出处理
      const handleExit = () => {
        if (!isDestroyed) {
          cleanup();
          resolve('/exit');
        }
      };

      // 设置原始模式和事件监听
      try {
        // 确保stdin处于正确的状态
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(true);
        }
        process.stdin.resume();
        process.stdin.setEncoding('utf8');

        // 添加事件监听器
        process.stdin.on('data', onKeyPress);
        process.stdin.on('error', onError);

        // 添加进程退出监听，确保清理
        process.on('SIGINT', handleExit);
        process.on('SIGTERM', handleExit);

      } catch (error) {
        cleanup();
        reject(error);
      }
    });
  }

  /**
   * 处理 /init 命令
   */
  private async handleInitCommand(): Promise<void> {
    await this.initHandler.execute();
  }
} 