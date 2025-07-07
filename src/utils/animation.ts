import chalk from 'chalk';
import gradient from 'gradient-string';

export interface AnimationOptions {
  text: string;
  duration?: number;
  interval?: number;
  successText?: string;
}

export class AnimationUtils {
  private static readonly gradients = {
    primary: gradient(['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7']),
    secondary: gradient(['#667eea', '#764ba2']),
    accent: gradient(['#f093fb', '#f5576c']),
    success: gradient(['#4facfe', '#00f2fe']),
    rainbow: gradient.rainbow
  };

  /**
   * 显示不闪烁的加载动画（左右结构）
   */
  static async showLoadingAnimation(options: AnimationOptions): Promise<void> {
    const { text, duration = 2000, interval = 80, successText } = options;
    
    // 预计算彩色文字，避免每次都重新计算渐变
    const loadingText = this.gradients.primary(text);
    const staticPart = '  ';  // 缩进
    const textPart = ` ${loadingText}`;  // 空格 + 彩色文字
    
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let frameIndex = 0;
    
    // 隐藏光标
    process.stdout.write('\x1B[?25l');
    
    // 初始显示
    process.stdout.write(staticPart + chalk.cyan(frames[frameIndex]) + textPart);
    
    const animationInterval = setInterval(() => {
      frameIndex = (frameIndex + 1) % frames.length;
      // 只替换旋转符号部分，保持文字不变
      process.stdout.write('\r' + staticPart + chalk.cyan(frames[frameIndex]) + textPart);
    }, interval);
    
    // 等待指定时间
    await new Promise(resolve => setTimeout(resolve, duration));
    
    // 清除动画
    clearInterval(animationInterval);
    
    // 显示完成状态
    const finalText = successText || text;
    const successColorText = this.gradients.success(finalText);
    process.stdout.write('\r' + staticPart + chalk.green('✓') + ` ${successColorText}`);
    console.log(); // 换行
    
    // 恢复光标
    process.stdout.write('\x1B[?25h');
  }

  /**
   * 显示简单的动作动画
   */
  static async showActionAnimation(text: string, duration: number = 1500): Promise<void> {
    await this.showLoadingAnimation({
      text,
      duration,
      interval: 100
    });
  }

  /**
   * 显示退出动画（不闪烁版本）
   */
  static async showExitAnimation(farewell: string, exitMessage: string): Promise<void> {
    // 完全清屏并隐藏光标
    process.stdout.write('\x1B[2J\x1B[H\x1B[?25l');
    
    // 获取终端高度来更好地居中显示
    const terminalHeight = process.stdout.rows || 24;
    const contentHeight = 12;
    const topPadding = Math.max(1, Math.floor((terminalHeight - contentHeight) / 2));
    
    // 添加顶部填充
    console.log('\n'.repeat(topPadding));
    
    // 显示告别消息（传入的figlet文字）
    console.log(this.gradients.accent.multiline(farewell));
    console.log();
    console.log('  ' + this.gradients.primary(exitMessage));
    console.log();
    
    // 使用不闪烁的动画
    await this.showLoadingAnimation({
      text: '正在安全退出系统... / Safely exiting system...',
      duration: 2000,
      successText: '再见！/ See you again!'
    });
    
    // 添加底部填充
    const bottomPadding = Math.max(1, terminalHeight - topPadding - contentHeight);
    console.log('\n'.repeat(bottomPadding));
    
    // 恢复光标
    process.stdout.write('\x1B[?25h');
  }

  /**
   * 获取渐变色彩工具
   */
  static getGradients() {
    return this.gradients;
  }
} 