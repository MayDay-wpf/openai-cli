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
    // 强制清屏，确保完全清除欢迎页面内容
    process.stdout.write('\x1B[2J\x1B[3J\x1B[H');
    process.stdout.write('\x1Bc');
    
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
    while (true) {
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
    return new Promise((resolve, reject) => {
      let currentInput = '';
      let showingCommands = false;
      let filteredCommands: Command[] = [];
      let selectedIndex = 0;

      // 显示初始提示符
      process.stdout.write(chalk.cyan(this.currentMessages.main.prompt));

      // 显示指令列表
      const showCommandList = (commands: Command[]) => {
        if (commands.length === 0) return;
        
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
        process.stdout.write(`\x1B[${currentInput.length + 3}G`);
      };

      // 隐藏指令列表
      const hideCommandList = () => {
        if (!showingCommands || filteredCommands.length === 0) return;
        
        // 移动到指令列表开始位置并清除
        process.stdout.write('\x1B[1B'); // 下移一行到列表开始
        for (let i = 0; i < filteredCommands.length; i++) {
          process.stdout.write('\x1B[2K'); // 清除整行
          if (i < filteredCommands.length - 1) {
            process.stdout.write('\x1B[1B'); // 下移一行
          }
        }
        
        // 返回到输入行
        process.stdout.write(`\x1B[${filteredCommands.length}A`);
        process.stdout.write(`\x1B[${currentInput.length + 3}G`);
      };

      // 更新显示
      const updateDisplay = () => {
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
        if (showingCommands) {
          hideCommandList();
        }
        process.stdin.removeListener('data', onKeyPress);
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(false);
        }
        process.stdin.pause();
      };

      // 键盘事件处理
      const onKeyPress = (key: string) => {
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
            }
          }

          // Backspace 键
          if (keyCode === 127 || keyCode === 8) {
            if (currentInput.length > 0) {
              currentInput = currentInput.slice(0, -1);
              process.stdout.write('\b \b');
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

          // 普通字符
          if (keyCode >= 32 && keyCode <= 126) {
            currentInput += key;
            process.stdout.write(key);
            updateDisplay();
          }
        } catch (error) {
          // 捕获任何异常，避免程序崩溃
          cleanup();
          reject(error);
        }
      };

      // 设置原始模式和事件监听
      try {
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(true);
        }
        process.stdin.resume();
        process.stdin.setEncoding('utf8');
        process.stdin.on('data', onKeyPress);

        // 添加进程退出监听，确保清理
        const handleExit = () => {
          cleanup();
        };
        process.once('SIGINT', handleExit);
        process.once('SIGTERM', handleExit);
        
      } catch (error) {
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