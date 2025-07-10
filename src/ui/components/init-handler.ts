import chalk from 'chalk';
import * as path from 'path';
import { ProjectInitService } from '../../services/project-init';
import { StorageService } from '../../services/storage';
import { Messages } from '../../types/language';

/**
 * 初始化命令处理器
 * 负责生成项目描述文件 sawyou.md
 */
export class InitHandler {
  private messages: Messages;
  private projectInitService: ProjectInitService;
  private isInterrupted: boolean = false;
  private interruptHandler: (() => void) | null = null;

  constructor(messages: Messages) {
    this.messages = messages;
    this.projectInitService = new ProjectInitService();
  }

  /**
   * 执行初始化命令
   */
  async execute(): Promise<void> {
    try {
      // 验证API配置
      if (!this.validateApiConfig()) {
        return;
      }

      // 开始生成项目描述
      await this.generateProjectDescription();

    } catch (error) {
      if (!this.isInterrupted && !(error instanceof Error && error.message === 'Interrupted')) {
        const errorMessage = error instanceof Error ? error.message : this.messages.main.init.failed;
        process.stdout.write(chalk.red(`${this.messages.main.init.failed}: ${errorMessage}\n\n`));
      }
    } finally {
      this.cleanup();
    }
  }

  /**
   * 验证API配置
   */
  private validateApiConfig(): boolean {
    const apiValidation = StorageService.validateApiConfig();
    if (!apiValidation.isValid) {
      process.stdout.write(chalk.red(`${this.messages.main.init.configIncomplete}\n`));
      process.stdout.write(chalk.yellow(`${this.messages.main.init.missingItems}: ${apiValidation.missing.join(', ')}\n`));
      process.stdout.write(chalk.blue(`${this.messages.main.init.useConfig}\n\n`));
      return false;
    }
    return true;
  }

  /**
   * 生成项目描述文件
   */
  private async generateProjectDescription(): Promise<void> {
    process.stdout.write(chalk.blue(`\n${this.messages.main.init.starting}\n`));
    process.stdout.write(chalk.gray(`${this.messages.main.init.ctrlcToCancel}\n\n`));

    // 设置中断处理
    this.setupInterruptHandler();

    try {
      const outputPath = path.join(process.cwd(), 'sawyou.md');
      const messages = this.messages;

      const result = await this.projectInitService.generateMarkdownDoc({
        outputPath,
        onStepStart: (stepKey: string) => {
          if (this.isInterrupted) throw new Error('Interrupted');
          const stepMessage = messages.main.init.steps[stepKey as keyof typeof messages.main.init.steps];
          if (stepMessage) {
            console.log(chalk.blue(`📋 ${stepMessage}...`));
          }
        },
        onFileProgress: (current: number, total: number, fileName?: string) => {
          if (this.isInterrupted) throw new Error('Interrupted');
          const percentage = Math.round((current / total) * 100);
          const progress = `[${current}/${total}] ${percentage}%`;
          if (fileName) {
            console.log(chalk.gray(`  ${progress} - ${fileName}`));
          } else {
            console.log(chalk.gray(`  ${progress}`));
          }
        },
        checkInterrupt: () => this.isInterrupted
      });

      if (!this.isInterrupted) {
        console.log(chalk.green(`\n✅ ${this.messages.main.init.completed}`));
        console.log(chalk.green(`📄 ${this.messages.main.init.savedTo}: ${result}`));
        console.log(chalk.cyan(`${this.messages.main.init.description}\n`));
      }

    } catch (error) {
      if (this.isInterrupted || (error instanceof Error && error.message === 'Interrupted')) {
        return;
      }
      throw error;
    }
  }

  /**
   * 设置中断处理
   */
  private setupInterruptHandler(): void {
    this.interruptHandler = () => {
      if (this.isInterrupted) return;

      this.isInterrupted = true;
      process.stdout.write(chalk.yellow(`\n${this.messages.main.init.interrupted}\n\n`));
    };

    process.on('SIGINT', this.interruptHandler);
    process.on('SIGTERM', this.interruptHandler);
  }

  /**
   * 清理资源
   */
  private cleanup(): void {
    if (this.interruptHandler) {
      process.removeListener('SIGINT', this.interruptHandler);
      process.removeListener('SIGTERM', this.interruptHandler);
      this.interruptHandler = null;
    }

    this.isInterrupted = false;
  }

  /**
   * 更新语言设置
   */
  updateLanguage(messages: Messages): void {
    this.messages = messages;
  }
} 