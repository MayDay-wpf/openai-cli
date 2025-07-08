import chalk from 'chalk';
import boxen from 'boxen';
import { input } from '@inquirer/prompts';
import { select } from '@inquirer/prompts';
import { AnimationUtils, LoadingController } from '../../utils/animation';
import { CommandManager, HelpManager, ResponseManager, Command } from '../components';
import { languageService } from '../../services/language';
import { Messages } from '../../types/language';

interface Message {
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
}

export interface ChatState {
  canSendMessage: boolean;
  isProcessing: boolean;
}

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
  private currentMessages: Messages;

  constructor() {
    this.currentMessages = languageService.getMessages();
    this.commandManager = new CommandManager(this.currentMessages);
    this.helpManager = new HelpManager(this.currentMessages);
    this.responseManager = new ResponseManager(this.currentMessages);
    
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
    
    // 重置聊天状态
    this.setChatState({ canSendMessage: false, isProcessing: false });
    
    // 清空消息
    this.messages = [];
    
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
  }

  // 公开API：注入AI回复
  injectAIReply(content: string): void {
    // 停止loading动画
    if (this.loadingController) {
      this.loadingController.stop();
      this.loadingController = null;
    }

    const aiMessage: Message = {
      type: 'ai',
      content,
      timestamp: new Date()
    };
    this.messages.push(aiMessage);
    this.displayMessage(aiMessage);
  }

  // 公开API：设置聊天状态
  setChatState(state: Partial<ChatState>): void {
    this.chatState = { ...this.chatState, ...state };
  }

  // 公开API：获取聊天状态
  getChatState(): ChatState {
    return { ...this.chatState };
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
    
    // 欢迎方框
    const welcomeBox = boxen(
      chalk.bold(main.title + '\n\n') +
      chalk.gray(main.subtitle),
      {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'cyan',
        title: main.welcomeBox.title,
        titleAlignment: 'center'
      }
    );
    
    process.stdout.write(welcomeBox + '\n\n');
    
    // 开始聊天循环
    await this.startChatLoop();
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
          break;
        }

        if (userInput === '/clear') {
          this.messages = [];
          // 强制清屏
          process.stdout.write('\x1B[2J\x1B[3J\x1B[H');
          process.stdout.write('\x1Bc');
          continue;
        }

        if (userInput === '/help') {
          this.helpManager.showHelp(this.commandManager.getCommands());
          continue;
        }

        if (userInput === '/config') {
          process.stdout.write(chalk.yellow(this.currentMessages.main.messages.configInDevelopment + '\n'));
          continue;
        }

        if (userInput === '/history') {
          this.showHistory();
          continue;
        }

        // 添加用户消息并直接显示
        this.addUserMessage(userInput);
        
        // 模拟AI处理
        await this.simulateAIProcessing();
      }
    } catch (error) {
      console.error('聊天循环出现错误:', error);
    } finally {
      // 确保在退出时清理所有资源
      this.destroy();
    }
  }

  private displayMessage(message: Message): void {
    const timeStr = message.timestamp.toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });

    // 只显示AI回复，用户消息在输入时已经显示，这里只保存到历史记录
    if (message.type === 'ai') {
      // 确保在新行显示AI回复
      const aiLabel = this.currentMessages.main.messages.ai;
      process.stdout.write(chalk.green(`${aiLabel} [${timeStr}]: `) + chalk.white(message.content) + '\n\n');
    }
  }

  private async getUserInput(): Promise<string> {
    // 检查是否已被销毁
    if (this.isDestroyed) {
      return '/exit';
    }
    
    return new Promise((resolve, reject) => {
      let currentInput = '';
      let showingCommands = false;
      let filteredCommands: Command[] = [];
      let selectedIndex = 0;
      let isDestroyed = false;

      // 显示初始提示符
      process.stdout.write(chalk.cyan(this.currentMessages.main.prompt));

      // 显示指令列表
      const showCommandList = (commands: Command[]) => {
        if (commands.length === 0 || isDestroyed) return;
        
        process.stdout.write('\n');
        commands.forEach((cmd, index) => {
          const isSelected = index === selectedIndex;
          const prefix = isSelected ? chalk.cyan('❯ ') : '  ';
          const cmdText = isSelected 
            ? chalk.cyan.bold(cmd.value) + ' - ' + chalk.white.bold(cmd.description)
            : chalk.gray(cmd.value) + ' - ' + chalk.gray(cmd.description);
          process.stdout.write(prefix + cmdText + '\n');
        });
        
        // 返回到输入行
        process.stdout.write(`\x1B[${commands.length + 1}A`);
        // 重新计算光标位置：提示符长度 + 当前输入长度
        const promptLength = this.currentMessages.main.prompt.length;
        process.stdout.write(`\x1B[${promptLength + currentInput.length + 1}G`);
      };

      // 隐藏指令列表
      const hideCommandList = () => {
        if (!showingCommands || filteredCommands.length === 0 || isDestroyed) return;
        
        // 移动到指令列表开始位置并清除
        process.stdout.write('\x1B[1B'); // 下移一行到列表开始
        for (let i = 0; i < filteredCommands.length; i++) {
          process.stdout.write('\x1B[2K'); // 清除整行
          if (i < filteredCommands.length - 1) {
            process.stdout.write('\x1B[1B'); // 下移一行
          }
        }
        
        // 返回到输入行，光标定位到提示符后的正确位置
        process.stdout.write(`\x1B[${filteredCommands.length}A`);
        // 重新计算光标位置：提示符长度 + 当前输入长度
        const promptLength = this.currentMessages.main.prompt.length;
        process.stdout.write(`\x1B[${promptLength + currentInput.length + 1}G`);
      };

      // 更新显示
      const updateDisplay = () => {
        if (isDestroyed) return;
        
        const newFilteredCommands = this.commandManager.filterCommands(currentInput);
        
        if (showingCommands) {
          hideCommandList();
        }
        
        if (currentInput.startsWith('/') && newFilteredCommands.length > 0) {
          filteredCommands = newFilteredCommands;
          selectedIndex = Math.min(selectedIndex, filteredCommands.length - 1);
          showingCommands = true;
          showCommandList(filteredCommands);
        } else {
          showingCommands = false;
          filteredCommands = [];
        }
      };

      // 清理函数
      const cleanup = () => {
        if (isDestroyed) return;
        isDestroyed = true;
        
        if (showingCommands) {
          hideCommandList();
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
      const onKeyPress = (key: string) => {
        if (isDestroyed) return;
        
        try {
          const keyCode = key.charCodeAt(0);

          // Ctrl+C - 优雅退出
          if (keyCode === 3) {
            cleanup();
            process.stdout.write('\n');
            resolve('/exit');
            return;
          }

          // Enter 键
          if (keyCode === 13) {
            if (showingCommands && filteredCommands.length > 0) {
              // 选择当前高亮的指令
              const selectedCommand = filteredCommands[selectedIndex].value;
              cleanup();
              
              // 清除当前行并重新显示
              process.stdout.write('\x1B[2K\x1B[0G');
              process.stdout.write(chalk.cyan(this.currentMessages.main.prompt) + selectedCommand + '\n');
              
              resolve(selectedCommand);
              return;
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
              // 先隐藏命令列表（如果有的话）
              if (showingCommands) {
                hideCommandList();
                showingCommands = false;
              }
              
              // 获取最后一个字符
              const lastChar = currentInput.slice(-1);
              currentInput = currentInput.slice(0, -1);
              
              // 判断是否为多字节字符（如中文）
              if (lastChar.charCodeAt(0) > 127) {
                // 中文字符，需要回退更多位置
                process.stdout.write('\b\b  \b\b');
              } else {
                // ASCII字符
                process.stdout.write('\b \b');
              }
              
              // 重新更新显示
              updateDisplay();
            }
            return;
          }

          // 上下箭头键处理
          if (key.length >= 3 && key.startsWith('\x1B[')) {
            if (key === '\x1B[A') { // 上箭头
              if (showingCommands && filteredCommands.length > 0) {
                hideCommandList();
                selectedIndex = selectedIndex > 0 ? selectedIndex - 1 : filteredCommands.length - 1;
                showCommandList(filteredCommands);
              }
              return;
            } else if (key === '\x1B[B') { // 下箭头
              if (showingCommands && filteredCommands.length > 0) {
                hideCommandList();
                selectedIndex = selectedIndex < filteredCommands.length - 1 ? selectedIndex + 1 : 0;
                showCommandList(filteredCommands);
              }
              return;
            }
          }

          // ESC 键 - 隐藏指令列表
          if (keyCode === 27 && key.length === 1) {
            if (showingCommands) {
              hideCommandList();
              showingCommands = false;
              filteredCommands = [];
            }
            return;
          }

          // 普通字符（支持中文等多字节字符）
          if (key.length === 1 && keyCode >= 32) {
            // 支持所有可打印字符，包括中文
            currentInput += key;
            process.stdout.write(key);
            updateDisplay();
          } else if (key.length > 1) {
            // 处理多字节字符（如中文）
            // 过滤掉控制序列（以\x1B开头的）
            if (!key.startsWith('\x1B')) {
              currentInput += key;
              process.stdout.write(key);
              updateDisplay();
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

  private addUserMessage(content: string): void {
    const userMessage: Message = {
      type: 'user',
      content,
      timestamp: new Date()
    };
    this.messages.push(userMessage);
    this.displayMessage(userMessage);
  }

  private showHistory(): void {
    const main = this.currentMessages.main;
    
    if (this.messages.length === 0) {
      process.stdout.write(chalk.yellow(main.messages.noHistory + '\n'));
      return;
    }

    process.stdout.write(chalk.bold('\n=== ' + main.messages.historyTitle + ' ===\n\n'));
    
    this.messages.forEach((message, index) => {
      const timeStr = message.timestamp.toLocaleTimeString('zh-CN', { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
      });
      
      const userLabel = main.messages.user;
      const aiLabel = main.messages.ai;
      
      const prefix = message.type === 'user' 
        ? chalk.blue(`[${index + 1}] ${userLabel} [${timeStr}]: `)
        : chalk.green(`[${index + 1}] ${aiLabel} [${timeStr}]: `);
      
      process.stdout.write(prefix + chalk.white(message.content) + '\n');
    });
    
    const totalMsg = main.messages.totalMessages.replace('{count}', this.messages.length.toString());
    process.stdout.write(chalk.gray(`\n${totalMsg}\n\n`));
  }

  private async simulateAIProcessing(): Promise<void> {
    // 设置处理状态
    this.setChatState({ isProcessing: true, canSendMessage: false });
    
    // 显示loading动画
    this.loadingController = AnimationUtils.showLoadingAnimation({
      text: this.currentMessages.main.status.thinking
    });
    
    // 模拟处理时间
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 生成模拟回复
    const randomResponse = this.responseManager.getRandomResponse();
    
    // 注入AI回复（会自动停止loading动画）
    this.injectAIReply(randomResponse);
    
    // 恢复状态
    this.setChatState({ isProcessing: false, canSendMessage: true });
  }
} 