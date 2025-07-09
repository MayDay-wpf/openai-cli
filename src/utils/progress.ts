import chalk from 'chalk';

export interface ProgressOptions {
  width?: number;
  format?: string;
  clear?: boolean;
}

/**
 * 终端进度条工具
 */
export class ProgressBar {
  private current: number = 0;
  private total: number = 100;
  private width: number = 30;
  private format: string = '{bar} {percentage}% | {current}/{total} | {phase}';
  private lastLine: string = '';
  private clear: boolean = true;

  constructor(total: number, options: ProgressOptions = {}) {
    this.total = total;
    this.width = options.width || 30;
    this.format = options.format || this.format;
    this.clear = options.clear !== false;
  }

  /**
   * 更新进度
   */
  update(current: number, data: { phase?: string; file?: string } = {}): void {
    this.current = Math.min(current, this.total);
    
    const percentage = Math.round((this.current / this.total) * 100);
    const completed = Math.round((this.current / this.total) * this.width);
    const remaining = this.width - completed;
    
    // 构建进度条
    const bar = chalk.green('='.repeat(completed)) + chalk.gray('-'.repeat(remaining));
    
    // 构建显示文本
    let line = this.format
      .replace('{bar}', bar)
      .replace('{percentage}', percentage.toString().padStart(3))
      .replace('{current}', this.current.toString())
      .replace('{total}', this.total.toString())
      .replace('{phase}', data.phase || '');

    if (data.file) {
      line += chalk.dim(` (${data.file})`);
    }

    // 清除上一行并输出新的进度
    if (this.clear && this.lastLine) {
      process.stdout.write('\r' + ' '.repeat(this.lastLine.length) + '\r');
    }
    
    process.stdout.write(line);
    this.lastLine = line;
  }

  /**
   * 完成进度条
   */
  complete(message?: string): void {
    this.update(this.total);
    
    if (message) {
      if (this.clear) {
        process.stdout.write('\r' + ' '.repeat(this.lastLine.length) + '\r');
      } else {
        process.stdout.write('\n');
      }
      console.log(chalk.green('[OK] ' + message));
    } else {
      process.stdout.write('\n');
    }
  }

  /**
   * 显示错误
   */
  error(message: string): void {
    if (this.clear && this.lastLine) {
      process.stdout.write('\r' + ' '.repeat(this.lastLine.length) + '\r');
    } else if (!message) {
      // 如果没有消息且不清除，只是换行
      process.stdout.write('\n');
      return;
    } else {
      process.stdout.write('\n');
    }
    
    // 只有当message不为空时才输出错误信息
    if (message) {
      console.log(chalk.red('[ERROR] ' + message));
    }
  }

  /**
   * 清空当前行
   */
  clearLine(): void {
    if (this.lastLine) {
      process.stdout.write('\r' + ' '.repeat(this.lastLine.length) + '\r');
      this.lastLine = '';
    }
  }
}

/**
 * 创建简单的步骤进度显示器
 */
export class StepProgress {
  private steps: string[] = [];
  private currentStep: number = 0;
  private startTime: number = Date.now();

  constructor(steps: string[]) {
    this.steps = steps;
  }

  /**
   * 开始下一步
   */
  nextStep(): void {
    if (this.currentStep < this.steps.length) {
      const step = this.steps[this.currentStep];
      const stepNum = this.currentStep + 1;
      const total = this.steps.length;
      
      console.log(chalk.blue(`[${stepNum}/${total}]`) + ` ${step}`);
      this.currentStep++;
    }
  }

  /**
   * 完成所有步骤
   */
  complete(): void {
    const elapsed = Date.now() - this.startTime;
    const seconds = (elapsed / 1000).toFixed(1);
    console.log(chalk.green(`[COMPLETE] 所有步骤完成！用时 ${seconds} 秒`));
  }

  /**
   * 显示错误
   */
  error(message: string): void {
    console.log(chalk.red(`[ERROR] ${message}`));
  }
}

/**
 * 多阶段进度管理器
 */
export class MultiPhaseProgress {
  private phases: Array<{ name: string; weight: number }> = [];
  private currentPhase: number = 0;
  private phaseProgress: number = 0;
  private progressBar: ProgressBar;

  constructor(phases: Array<{ name: string; weight: number }>) {
    this.phases = phases;
    const totalWeight = phases.reduce((sum, phase) => sum + phase.weight, 0);
    this.progressBar = new ProgressBar(totalWeight, {
      format: '{bar} {percentage}% | {phase}'
    });
  }

  /**
   * 更新当前阶段的进度
   */
  updatePhase(progress: number, file?: string): void {
    if (this.currentPhase >= this.phases.length) return;

    const phase = this.phases[this.currentPhase];
    this.phaseProgress = Math.min(progress, phase.weight);
    
    // 计算总进度
    const totalProgress = this.phases
      .slice(0, this.currentPhase)
      .reduce((sum, p) => sum + p.weight, 0) + this.phaseProgress;

    this.progressBar.update(totalProgress, {
      phase: phase.name,
      file
    });
  }

  /**
   * 进入下一阶段
   */
  nextPhase(): void {
    if (this.currentPhase < this.phases.length - 1) {
      this.currentPhase++;
      this.phaseProgress = 0;
    }
  }

  /**
   * 完成所有阶段
   */
  complete(message?: string): void {
    this.progressBar.complete(message);
  }

  /**
   * 显示错误
   */
  error(message: string): void {
    this.progressBar.error(message);
  }

  /**
   * 清空当前行
   */
  clearLine(): void {
    this.progressBar.clearLine();
  }

  /**
   * 直接设置总体进度（用于恢复状态）
   */
  setOverallProgress(overallProgress: number, currentPhase: number, phaseName?: string): void {
    this.currentPhase = currentPhase;
    this.progressBar.update(overallProgress, {
      phase: phaseName || (this.phases[currentPhase]?.name || '')
    });
  }
} 