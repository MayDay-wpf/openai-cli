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
  private configChangeListener: ((config: any) => void) | null = null;

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
      getRecentMessages: () => {
        return this.messages;
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

    // 监听配置变更
    this.configChangeListener = () => {
      // 在非聊天状态下刷新欢迎框显示
      if (this.chatState.canSendMessage && !this.chatState.isProcessing) {
        this.refreshWelcomeBox();
      }
    };
    StorageService.onConfigChange(this.configChangeListener);
  }

  // 销毁方法，清理所有资源
  destroy(): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;

    // 移除配置变更监听器
    if (this.configChangeListener) {
      StorageService.removeConfigChangeListener(this.configChangeListener);
      this.configChangeListener = null;
    }

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

  // 重新加载页面
  async reload(): Promise<void> {
    this.destroy();
    await this.show();
  }

  /**
   * 刷新欢迎框显示（配置变更时调用）
   */
  private refreshWelcomeBox(): void {
    if (this.isDestroyed || this.chatState.isProcessing) return;

    // 先清除屏幕上方的欢迎框区域（保留聊天历史）
    // 移动到顶部并清除前几行
    process.stdout.write('\x1B[H'); // 移动到屏幕顶部

    // 清除前15行（大致是欢迎框的高度）
    for (let i = 0; i < 15; i++) {
      process.stdout.write('\x1B[2K'); // 清除整行
      if (i < 14) {
        process.stdout.write('\x1B[1B'); // 下移一行
      }
    }

    // 返回到顶部重新显示欢迎框
    process.stdout.write('\x1B[H');
    this.showWelcomeBox();

    // 移动到最底部（继续输入位置）
    process.stdout.write('\x1B[999B');
  }

  /**
   * 显示欢迎框
   */
  private showWelcomeBox(): void {
    const main = this.currentMessages.main;

    // 获取当前配置信息
    const currentDir = process.cwd();
    const apiConfig = StorageService.getApiConfig();

    // 简化配置信息显示
    const configLines = [
      `${chalk.gray('Directory:')} ${chalk.white(currentDir)}`,
      `${chalk.gray('API URL:')} ${chalk.white(apiConfig.baseUrl || 'Not configured')}`,
      `${chalk.gray('API Key:')} ${chalk.white(apiConfig.apiKey ? StringUtils.maskApiKey(apiConfig.apiKey) : 'Not configured')}`
    ];

    // 欢迎方框 - 更紧凑的设计
    const welcomeBox = boxen(
      chalk.hex('#FF6B6B').bold(main.title) + '\n' +
      chalk.hex('#4ECDC4').italic(main.subtitle) + '\n\n' +
      configLines.join('\n'),
      {
        padding: { top: 1, bottom: 1, left: 2, right: 2 },
        margin: { top: 1, bottom: 0, left: 2, right: 2 },
        borderStyle: 'round',
        borderColor: 'magenta',
        title: chalk.white.bold('Welcome'),
        titleAlignment: 'center'
      }
    );

    process.stdout.write(welcomeBox + '\n');
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

    // 显示欢迎框
    this.showWelcomeBox();

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
          //process.stdout.write(chalk.red(this.currentMessages.main.status.cannotSendMessage + '\n'));
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


        // 使用 CommandManager 处理用户输入
        const commandResult = await this.commandManager.handleInput(userInput, this.messages);

        if (commandResult.handled) {
          // 命令已被处理
          if (commandResult.shouldReload) {
            await this.reload();
            continue; // 重新加载后继续循环
          }
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

        // 如果 CommandManager 返回未处理，则有可能是普通消息或包含文件引用的消息
        if (!commandResult.handled) {
          // 检查是否是普通消息
          if (!userInput.startsWith('/')) {
            // 添加用户消息并直接显示
            this.messageHandler.addUserMessage(userInput);

            // 处理AI请求
            await this.messageHandler.processAIRequest();
            continue; // 继续下一次循环
          }

          // 处理未被 commandManager.handleInput 捕获的其他命令
          switch (userInput) {
            case '/help':
              this.helpManager.showHelp(this.commandManager.getCommands());
              break;
            case '/config':
              process.stdout.write(chalk.yellow(this.currentMessages.main.messages.configInDevelopment + '\n'));
              break;
            case '/history':
              this.commandManager.showHistory(this.messages);
              break;
            case '/init':
              await this.handleInitCommand();
              break;
            default:
              // 未知命令
              process.stdout.write(chalk.red(this.currentMessages.main.messages.unknownCommand.replace('{command}', userInput) + '\n'));
              break;
          }
          continue;
        }
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
      let cursorPosition = 0;
      let currentState: InputState | null = null;
      let isDestroyed = false;
      let lastDisplayLines = 1;
      let lastSuggestionLines = 0;

      // 显示初始提示符
      const promptText = chalk.cyan(this.currentMessages.main.prompt);
      process.stdout.write(promptText);

      // 单行输入框渲染
      const redrawInputLine = () => {
        if (isDestroyed) return;

        const terminalWidth = process.stdout.columns || 80;
        
        // 首先回到第一行的开头
        process.stdout.write('\r');
        if (lastDisplayLines > 1) {
          // 向上移动到起始行
          process.stdout.write(`\x1B[${lastDisplayLines - 1}A`);
        }
        
        // 清除所有相关行
        for (let i = 0; i < lastDisplayLines; i++) {
          process.stdout.write('\x1B[2K'); // 清除当前行
          if (i < lastDisplayLines - 1) {
            process.stdout.write('\x1B[1B'); // 向下移动到下一行
          }
        }
        
        // 回到第一行开头
        if (lastDisplayLines > 1) {
          process.stdout.write(`\x1B[${lastDisplayLines - 1}A`);
        }
        process.stdout.write('\r');
        
        // 计算新内容的显示信息
        const displayText = promptText + currentInput;
        const displayWidth = StringUtils.getDisplayWidth(displayText);
        const newDisplayLines = Math.ceil(displayWidth / terminalWidth) || 1;
        
        // 输出新内容
        process.stdout.write(displayText);
        
        // 更新行数记录
        lastDisplayLines = newDisplayLines;

        // 计算并设置光标位置
        const promptLength = StringUtils.getDisplayWidth(this.currentMessages.main.prompt);
        const inputToCursor = currentInput.substring(0, cursorPosition);
        const cursorOffset = StringUtils.getDisplayWidth(inputToCursor);
        const totalCursorPos = promptLength + cursorOffset;
        
        const targetLine = Math.floor(totalCursorPos / terminalWidth);
        const targetCol = totalCursorPos % terminalWidth;
        
        // 从当前位置（内容末尾）移动到目标位置
        const currentEndLine = newDisplayLines - 1;
        if (targetLine < currentEndLine) {
          // 需要向上移动
          process.stdout.write(`\x1B[${currentEndLine - targetLine}A`);
        }
        
        // 设置到正确的列位置
        process.stdout.write(`\x1B[${targetCol + 1}G`);
      };

      // 显示建议列表
      const showSuggestions = (state: InputState) => {
        if (!state.showingSuggestions || state.suggestions.length === 0 || isDestroyed) return;

        const title = this.inputHandler.getSuggestionTitle(state.suggestionsType);
        const renderedSuggestions = this.inputHandler.renderSuggestions(
          state.suggestions,
          state.selectedIndex
        );

        // 计算建议列表需要的行数
        let suggestionLines = renderedSuggestions.length;
        if (title) suggestionLines += 1;

        // 输出建议列表
        process.stdout.write('\n');
        if (title) {
          process.stdout.write(title + '\n');
        }
        renderedSuggestions.forEach(suggestion => {
          process.stdout.write(suggestion + '\n');
        });

        // 更新建议行数追踪
        lastSuggestionLines = suggestionLines + 1; // +1 是因为开头的 \n

        // 向上移动回输入行
        process.stdout.write(`\x1B[${lastSuggestionLines}A`);
        
        // 重绘输入行确保显示正确
        redrawInputLine();
      };

      // 隐藏建议列表
      const hideSuggestions = () => {
        if (isDestroyed || lastSuggestionLines === 0) return;

        // 向下移动到建议列表位置并清除
        process.stdout.write(`\x1B[${lastSuggestionLines}B`);
        
        // 向上清除每一行
        for (let i = 0; i < lastSuggestionLines; i++) {
          process.stdout.write('\x1B[1A\x1B[2K'); // 向上一行并清除
        }

        // 重置建议行数
        lastSuggestionLines = 0;
        
        // 重绘输入行
        redrawInputLine();
      };

      // 更新显示
      const updateDisplay = async () => {
        if (isDestroyed) return;

        // 更新选中文件列表
        this.inputHandler.updateSelectedFiles(currentInput);

        // 总是先清除下方内容，避免残留（hideSuggestions 会重绘输入行）
        hideSuggestions();

        // 获取新状态
        const newState = await this.inputHandler.analyzInput(currentInput);
        currentState = newState;

        // 显示新建议（如果有）
        if (newState.showingSuggestions) {
          showSuggestions(newState);
        }
        // 注意：不需要 else 分支，因为 hideSuggestions 已经重绘了输入行
      };

      // 高效更新建议列表选中状态（避免完全重绘）
      const updateSuggestionSelection = (newIndex: number) => {
        if (!currentState?.showingSuggestions || isDestroyed) return;
        
        currentState.selectedIndex = newIndex;
        
        // 先隐藏当前建议，再显示新的
        if (lastSuggestionLines > 0) {
          hideSuggestions();
        }
        showSuggestions(currentState);
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
            const exitAction = await this.commandManager.handleExitWithHistoryCheck(this.messages);
            if (exitAction === 'cancel') {
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
                if (currentState.showingSuggestions) {
                  hideSuggestions();
                }
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
                currentInput = newInput;
                cursorPosition = currentInput.length;
                redrawInputLine();
                await updateDisplay();
                return;
              }
            } else if (currentInput.trim()) {
              // 发送内容
              const finalInput = currentInput.trim();
              cleanup();
              process.stdout.write('\n');
              resolve(finalInput);
              return;
            } else {
              return;
            }
          }

          // Backspace 键
          if (keyCode === 127 || keyCode === 8) {
            if (currentInput.length > 0 && cursorPosition > 0) {
              if (currentState?.showingSuggestions) {
                hideSuggestions();
              }

              currentInput = currentInput.slice(0, cursorPosition - 1) + currentInput.slice(cursorPosition);
              cursorPosition--;
              redrawInputLine();
              await updateDisplay();
            }
            return;
          }

          // 上下左右箭头键处理
          if (key.length >= 3 && key.startsWith('\x1B[')) {
            if (key === '\x1B[A') { // 上箭头
              if (currentState?.showingSuggestions && currentState.suggestions.length > 0) {
                const newIndex = currentState.selectedIndex > 0
                  ? currentState.selectedIndex - 1
                  : currentState.suggestions.length - 1;
                updateSuggestionSelection(newIndex);
              }
              return;
            } else if (key === '\x1B[B') { // 下箭头
              if (currentState?.showingSuggestions && currentState.suggestions.length > 0) {
                const newIndex = currentState.selectedIndex < currentState.suggestions.length - 1
                  ? currentState.selectedIndex + 1
                  : 0;
                updateSuggestionSelection(newIndex);
              }
              return;
            } else if (key === '\x1B[D') { // 左箭头
              if (cursorPosition > 0) {
                if (currentState?.showingSuggestions) {
                  hideSuggestions();
                  currentState.showingSuggestions = false;
                }
                cursorPosition--;
                if (!currentState?.showingSuggestions) {
                  redrawInputLine();
                }
              }
              return;
            } else if (key === '\x1B[C') { // 右箭头
              if (cursorPosition < currentInput.length) {
                if (currentState?.showingSuggestions) {
                  hideSuggestions();
                  currentState.showingSuggestions = false;
                }
                cursorPosition++;
                if (!currentState?.showingSuggestions) {
                  redrawInputLine();
                }
              }
              return;
            }
          }

          // ESC 键处理
          if (keyCode === 27 && key.length === 1) {
            if (currentState?.showingSuggestions) {
              hideSuggestions();
              currentState.showingSuggestions = false;
              currentState.suggestions = [];
            }
            return;
          }

          // 普通字符输入
          const isPrintable = (key.length === 1 && keyCode >= 32) || (key.length > 1 && !key.startsWith('\x1B'));

          if (isPrintable) {
            let textToInsert = key;

            // 处理粘贴内容 - 统一转换为单行
            if (key.includes('\n') || key.includes('\r') || key.length > 10) {
              const hasFileReference = currentInput.includes('@');
              
              if (hasFileReference) {
                textToInsert = StringUtils.processFileContentPaste(key);
              } else {
                // 所有多行内容都转换为单行
                textToInsert = key.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
              }
            }

            if (textToInsert) {
              if (currentState?.showingSuggestions) {
                hideSuggestions();
              }

              currentInput = currentInput.slice(0, cursorPosition) + textToInsert + currentInput.slice(cursorPosition);
              cursorPosition += textToInsert.length;
              redrawInputLine();
              await updateDisplay();
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