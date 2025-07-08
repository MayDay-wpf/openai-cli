import chalk from 'chalk';

export interface AnimationOptions {
  text: string;
  interval?: number;
}

export interface LoadingController {
  stop(): void;
}

export class AnimationUtils {
  private static readonly gradients = {
    // 使用 chalk 的颜色替代渐变
    primary: (text: string) => chalk.blue.bold(text),
    secondary: (text: string) => chalk.magenta.bold(text),
    accent: (text: string) => chalk.red.bold(text),
    success: (text: string) => chalk.green.bold(text),
    rainbow: {
      multiline: (text: string) => chalk.cyan.bold(text)
    }
  };

  /**
   * 显示可控制的加载动画（异步关闭）
   */
  static showLoadingAnimation(options: AnimationOptions): LoadingController {
    const { text, interval = 80 } = options;
    
    // 预计算彩色文字
    const loadingText = this.gradients.primary(text);
    const staticPart = '  ';  // 缩进
    const textPart = ` ${loadingText}`;  // 空格 + 彩色文字
    
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let frameIndex = 0;
    let animationInterval: NodeJS.Timeout | null = null;
    let isRunning = true;
    
    // 隐藏光标
    process.stdout.write('\x1B[?25l');
    
    // 初始显示
    process.stdout.write(staticPart + chalk.blue.bold(frames[frameIndex]) + textPart);
    
    // 启动动画
    animationInterval = setInterval(() => {
      if (!isRunning) return;
      frameIndex = (frameIndex + 1) % frames.length;
      // 只替换旋转符号部分，保持文字不变
      process.stdout.write('\r' + staticPart + chalk.blue.bold(frames[frameIndex]) + textPart);
    }, interval);
    
    // 返回控制器
    return {
      stop(): void {
        if (!isRunning) return;
        
        isRunning = false;
        
        // 清除动画定时器
        if (animationInterval) {
          clearInterval(animationInterval);
          animationInterval = null;
        }
        
        // 计算需要清除的长度
        const totalLength = staticPart.length + 1 + textPart.length; // 1 是旋转符号的长度
        
        // 清除整行内容
        process.stdout.write('\r' + ' '.repeat(totalLength) + '\r');
        
        // 恢复光标
        process.stdout.write('\x1B[?25h');
      }
    };
  }

  /**
   * 显示简单的动作动画
   */
  static async showActionAnimation(text: string, duration: number = 1500): Promise<void> {
    const controller = this.showLoadingAnimation({
      text,
      interval: 100
    });
    
    // 等待指定时间后停止动画
    await new Promise(resolve => setTimeout(resolve, duration));
    controller.stop();
  }

  /**
   * 显示退出动画（不闪烁版本）
   */
  static async showExitAnimation(farewell: string, exitMessage: string): Promise<void> {
    // 完全清屏并隐藏光标
    this.forceClearScreen();
    process.stdout.write('\x1B[?25l');
    
    // 获取终端高度来更好地居中显示
    const terminalHeight = process.stdout.rows || 24;
    const contentHeight = 12;
    const topPadding = Math.max(1, Math.floor((terminalHeight - contentHeight) / 2));
    
    // 添加顶部填充
    console.log('\n'.repeat(topPadding));
    
    // 显示告别消息（传入的figlet文字）
    console.log(this.gradients.accent(farewell));
    console.log('\n'.repeat(3)); // 增加更多空行分离标题和内容
    console.log('  ' + this.gradients.primary(exitMessage));
    console.log('\n'.repeat(2)); // 在动画前也增加空行
    
    // 使用不闪烁的动画
    const controller = this.showLoadingAnimation({
      text: 'See you again!',
      interval: 100
    });
    await new Promise(resolve => setTimeout(resolve, 100));
    controller.stop();
    console.log('\n'.repeat(1));
    
    // 恢复光标
    process.stdout.write('\x1B[?25h');
  }

  /**
   * 强制清屏，确保完全清除所有内容
   */
  static forceClearScreen(): void {
    // 使用多种ANSI转义序列确保完全清屏
    process.stdout.write('\x1B[2J\x1B[3J\x1B[H');
    // 备用方案：传统清屏
    console.clear();
    // 额外的清屏保险
    process.stdout.write('\x1Bc');
  }

  /**
   * 获取渐变色彩工具
   */
  static getGradients() {
    return this.gradients;
  }
} 