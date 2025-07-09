import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { ProjectInitService, InitProgress } from '../../services/project-init';
import { StorageService } from '../../services/storage';
import { MultiPhaseProgress } from '../../utils/progress';
import { Messages } from '../../types/language';

export interface InitState {
  isRunning: boolean;
  currentPhase: number;
  totalPhases: number;
  processedFiles: string[]; // 已处理的文件路径
  startTime: number;
  outputPath?: string;
  phaseProgress?: { [phaseIndex: number]: number }; // 每个阶段的进度
  totalFiles?: number; // 总文件数量
  overallProgress: number; // 总体进度百分比 (0-100)
  currentPhaseProgress: number; // 当前阶段进度百分比 (0-100)
  currentPhaseWeight: number; // 当前阶段权重
  accumulatedProgress: number; // 之前阶段累积的进度
}

/**
 * 初始化命令处理器
 * 负责处理项目文档初始化，支持中断和恢复
 */
export class InitHandler {
  private static readonly PROGRESS_FILE = '.openai-cli-init-progress.json';
  private messages: Messages;
  private projectInitService: ProjectInitService;
  private progressManager: MultiPhaseProgress | null = null;
  private currentState: InitState | null = null;
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

      // 检查是否有已保存的进度
      const savedProgress = this.loadProgress();
      if (savedProgress) {
        // 检查是否已经完成
        if (savedProgress.currentPhase >= savedProgress.totalPhases) {
          process.stdout.write(chalk.green(`\n${this.messages.main.init.completed}\n`));
          if (savedProgress.outputPath) {
            process.stdout.write(chalk.green(`${this.messages.main.init.savedTo}: ${savedProgress.outputPath}\n`));
          }
          process.stdout.write(chalk.cyan(`${this.messages.main.init.description}\n\n`));
          return;
        }
        
        const shouldResume = await this.askResumeProgress();
        if (shouldResume) {
          await this.resumeInit(savedProgress);
          return;
        } else {
          this.clearProgress();
        }
      }

      // 开始新的初始化
      await this.startNewInit();

    } catch (error) {
      // 只有在明确不是中断的情况下才显示错误
      if (!this.isInterrupted && !(error instanceof Error && error.message === 'Interrupted')) {
        // 真正的错误才显示错误信息
        const errorMessage = error instanceof Error ? error.message : this.messages.main.init.failed;
        process.stdout.write(chalk.red(`${this.messages.main.init.failed}: ${errorMessage}\n\n`));
      }
      // 中断情况下什么都不做，因为中断处理器已经输出了信息
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
   * 开始新的初始化
   */
  private async startNewInit(skipFiles: string[] = [], currentPhase: number = 0): Promise<void> {
    process.stdout.write(chalk.blue(`\n${this.messages.main.init.starting}\n`));
    process.stdout.write(chalk.gray(`${this.messages.main.init.ctrlcToCancel}\n\n`));

    // 调整进度条权重分配
    const phases = [
      { name: this.messages.main.init.phases.scanning, weight: 5 },
      { name: this.messages.main.init.phases.analyzing, weight: 10 },
      { name: this.messages.main.init.phases.generating, weight: 80 },
      { name: this.messages.main.init.phases.consolidating, weight: 5 }
    ];

    this.progressManager = new MultiPhaseProgress(phases);
    let currentPhaseIndex = currentPhase - 1; // 从恢复阶段开始，-1是为了让第一次onPhaseChange正确递增

    // 初始化状态（如果还没有状态的话）
    if (!this.currentState) {
      this.currentState = {
        isRunning: true,
        currentPhase: currentPhase,
        totalPhases: phases.length,
        processedFiles: skipFiles,
        startTime: Date.now(),
        overallProgress: 0,
        currentPhaseProgress: 0,
        currentPhaseWeight: phases[currentPhase]?.weight || 0,
        accumulatedProgress: 0
      };
    }

    // 如果是恢复状态，直接用保存的总体进度恢复进度条
    if (currentPhase > 0 && this.currentState && this.currentState.overallProgress > 0) {
      this.progressManager.setOverallProgress(
        this.currentState.overallProgress,
        this.currentState.currentPhase,
        phases[this.currentState.currentPhase]?.name
      );
    }

    // 设置中断处理
    this.setupInterruptHandler();

    try {
      const outputPath = path.join(process.cwd(), 'sawyou.json');
      const result = await this.projectInitService.init({
        outputPath,
        onPhaseChange: (phase: string) => {
          if (this.isInterrupted) throw new Error('Interrupted');
          
          // 进入新阶段
          currentPhaseIndex++;
          
          // 只有当真正进入新阶段时才调用nextPhase
          if (currentPhaseIndex > this.currentState!.currentPhase) {
            this.progressManager?.nextPhase();
          }
          
          // 更新状态
          if (this.currentState) {
            this.currentState.currentPhase = currentPhaseIndex;
            this.currentState.currentPhaseWeight = phases[currentPhaseIndex]?.weight || 0;
            this.currentState.currentPhaseProgress = 0;
            
            // 计算累积进度（之前阶段的总和）
            this.currentState.accumulatedProgress = phases
              .slice(0, currentPhaseIndex)
              .reduce((sum, p) => sum + p.weight, 0);
            
            this.currentState.overallProgress = this.currentState.accumulatedProgress;
            this.saveProgress(this.currentState);
          }
          
          // 如果不是恢复状态，显示当前阶段开始
          if (currentPhaseIndex === this.currentState!.currentPhase) {
            this.progressManager?.updatePhase(0);
          }
        },
        onProgress: (progress: InitProgress) => {
          if (this.isInterrupted) throw new Error('Interrupted');
          
          if (currentPhaseIndex >= 0 && currentPhaseIndex < phases.length && this.currentState) {
            // 计算当前阶段内的进度
            const phaseProgressPercent = (progress.current / progress.total) * 100;
            const phaseProgress = (progress.current / progress.total) * this.currentState.currentPhaseWeight;
            
            // 更新进度条显示
            this.progressManager?.updatePhase(phaseProgress, progress.file);
            
            // 更新状态
            this.currentState.currentPhaseProgress = phaseProgressPercent;
            this.currentState.overallProgress = this.currentState.accumulatedProgress + phaseProgress;
            
            // 如果是文件生成阶段且有文件路径，保存到已处理列表
            if (progress.file && progress.file.includes('.')) {
              if (!this.currentState.processedFiles.includes(progress.file)) {
                this.currentState.processedFiles.push(progress.file);
              }
            }
            
            // 保存进度到文件
            this.saveProgress(this.currentState);
          }
        },
        onError: (error: Error) => {
          // 只有非中断错误才显示ERROR
          if (!this.isInterrupted && error.message !== 'Interrupted') {
            this.progressManager?.error(`${this.messages.main.init.failed}: ${error.message}`);
          }
        },
        checkInterrupt: () => this.isInterrupted,
        skipFiles: skipFiles, // 传递跳过的文件列表
        currentPhase: currentPhase // 传递当前阶段
      });

      if (!this.isInterrupted) {
        this.progressManager?.complete(this.messages.main.init.completed);
        
        process.stdout.write(chalk.green(`${this.messages.main.init.savedTo}: ${result}\n`));
        process.stdout.write(chalk.cyan(`${this.messages.main.init.description}\n\n`));
        
        // 更新为完成状态而不是删除
        if (this.currentState) {
          this.currentState.currentPhase = phases.length; // 标记为完成
          this.currentState.isRunning = false;
          this.currentState.outputPath = result;
          this.saveProgress(this.currentState);
        }
      }

    } catch (error) {
      // 检查是否是中断错误（通过错误消息或标志位）
      if (this.isInterrupted || (error instanceof Error && error.message === 'Interrupted')) {
        // 中断是正常行为，不抛出错误
        return;
      }
      // 只有真正的错误才抛出
      throw error;
    }
  }

  /**
   * 恢复初始化
   */
  private async resumeInit(savedState: InitState): Promise<void> {
    process.stdout.write(chalk.blue(`\n${this.messages.main.init.resuming}...\n`));
    process.stdout.write(chalk.gray(`从第 ${savedState.currentPhase + 1} 阶段继续，已处理 ${savedState.processedFiles.length} 个文件\n`));
    process.stdout.write(chalk.gray(`总体进度: ${savedState.overallProgress.toFixed(1)}%\n\n`));
    
    // 从保存的状态继续，但使用修改过的逻辑跳过已处理的文件
    this.currentState = {
      ...savedState,
      isRunning: true,
      startTime: Date.now() // 重置开始时间
    };
    
    // 调用专门的恢复初始化方法
    await this.resumeInitWithProgress(savedState);
  }

  /**
   * 从保存的进度恢复初始化，保持进度条状态
   */
  private async resumeInitWithProgress(savedState: InitState): Promise<void> {
    // 直接调用 startNewInit，但先设置好状态和进度管理器
    this.currentState = {
      ...savedState,
      isRunning: true,
      startTime: Date.now()
    };
    
    // 从当前阶段继续，不要重复创建进度条
    await this.startNewInit(savedState.processedFiles, savedState.currentPhase);
  }

  /**
   * 询问是否恢复进度
   */
  private async askResumeProgress(): Promise<boolean> {
    // 简化实现：直接返回true自动恢复
    // 在实际应用中可以使用inquirer询问用户
    process.stdout.write(chalk.yellow(`${this.messages.main.init.resuming}...\n`));
    return true;
  }

  /**
   * 设置中断处理
   */
  private setupInterruptHandler(): void {
    this.interruptHandler = () => {
      if (this.isInterrupted) return; // 避免重复处理
      
      // 立即设置中断标志，这是最重要的
      this.isInterrupted = true;
      
      // 立即停止进度条显示
      if (this.progressManager) {
        this.progressManager.clearLine(); // 清空当前行
      }
      
      // 保存进度
      if (this.currentState) {
        this.currentState.isRunning = false;
        this.currentState.outputPath = this.currentState.outputPath || path.join(process.cwd(), 'sawyou.json');
        this.saveProgress(this.currentState);
      }
      
      // 输出中断信息
      process.stdout.write(chalk.yellow(`\n${this.messages.main.init.interrupted}\n`));
      process.stdout.write(chalk.blue(`${this.messages.main.init.progressSaved}\n\n`));
    };

    // 不移除现有监听器，只添加我们的处理器
    process.on('SIGINT', this.interruptHandler);
    process.on('SIGTERM', this.interruptHandler);
  }

  /**
   * 保存进度到文件
   */
  private saveProgress(state: InitState): void {
    try {
      const progressPath = path.join(process.cwd(), InitHandler.PROGRESS_FILE);
      fs.writeFileSync(progressPath, JSON.stringify(state, null, 2));
    } catch (error) {
      // 忽略保存错误
    }
  }

  /**
   * 从文件加载进度
   */
  private loadProgress(): InitState | null {
    try {
      const progressPath = path.join(process.cwd(), InitHandler.PROGRESS_FILE);
      if (fs.existsSync(progressPath)) {
        const content = fs.readFileSync(progressPath, 'utf-8');
        return JSON.parse(content);
      }
    } catch (error) {
      // 忽略加载错误
    }
    return null;
  }

  /**
   * 清除进度文件
   */
  private clearProgress(): void {
    try {
      const progressPath = path.join(process.cwd(), InitHandler.PROGRESS_FILE);
      if (fs.existsSync(progressPath)) {
        fs.unlinkSync(progressPath);
      }
    } catch (error) {
      // 忽略清除错误
    }
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
    this.currentState = null;
    this.progressManager = null;
  }

  /**
   * 更新语言设置
   */
  updateLanguage(messages: Messages): void {
    this.messages = messages;
  }
} 