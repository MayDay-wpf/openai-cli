import chalk from 'chalk';
import figlet from 'figlet';
import { Language } from '../../types/language';
import { getCurrentMessages } from '../../locales';
import { AnimationUtils } from '../../utils/animation';

export class MainPage {
  private readonly gradients = AnimationUtils.getGradients();

  constructor(private currentLanguage: Language) {}

  async show(): Promise<void> {
    const messages = getCurrentMessages(this.currentLanguage);
    
    console.clear();
    
    // 主界面标题
    const mainTitle = figlet.textSync('MAIN', {
      font: 'ANSI Shadow',
      horizontalLayout: 'default',
      verticalLayout: 'default',
      width: 60
    });
    
    console.log(this.gradients.rainbow.multiline(mainTitle));
    console.log();
    
    await AnimationUtils.showActionAnimation(messages.welcome.actions.startingMain);
    console.log('  ' + chalk.yellow(messages.welcome.actions.devInProgress));
    console.log();
    
    // 显示主要功能预览
    console.log(chalk.white.bold('AI功能 / AI Features:'));
    console.log(chalk.gray('─'.repeat(40)));
    console.log();
    console.log(chalk.white('  • 代码生成 / Code Generation'));
    console.log(chalk.white('  • 代码审查 / Code Review'));
    console.log(chalk.white('  • 重构建议 / Refactoring Suggestions'));
    console.log(chalk.white('  • 错误调试 / Debug Assistance'));
    console.log(chalk.white('  • 文档生成 / Documentation Generation'));
    console.log();
    console.log(chalk.yellow('  功能开发中... / Feature in development...'));
  }
} 