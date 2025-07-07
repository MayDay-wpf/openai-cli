import chalk from 'chalk';
import figlet from 'figlet';
import { Language } from '../../types/language';
import { getCurrentMessages } from '../../locales';
import { AnimationUtils } from '../../utils/animation';

export class ConfigPage {
  private readonly gradients = AnimationUtils.getGradients();

  constructor(private currentLanguage: Language) {}

  async show(): Promise<void> {
    const messages = getCurrentMessages(this.currentLanguage);
    
    console.clear();
    
    // 配置页面标题
    const configTitle = figlet.textSync('CONFIG', {
      font: 'ANSI Shadow',
      horizontalLayout: 'default',
      verticalLayout: 'default',
      width: 60
    });
    
    console.log(this.gradients.secondary.multiline(configTitle));
    console.log();
    
    await AnimationUtils.showActionAnimation(messages.welcome.actions.startingConfig);
    console.log('  ' + chalk.yellow(messages.welcome.actions.devInProgress));
    console.log();
    
    // 显示配置选项预览
    console.log(chalk.white.bold('配置选项 / Configuration Options:'));
    console.log(chalk.gray('─'.repeat(40)));
    console.log();
    console.log(chalk.white('  • API密钥设置 / API Key Settings'));
    console.log(chalk.white('  • 代理配置 / Proxy Configuration'));
    console.log(chalk.white('  • 输出格式 / Output Format'));
    console.log(chalk.white('  • 默认模型 / Default Model'));
    console.log();
    console.log(chalk.yellow('  功能开发中... / Feature in development...'));
  }
} 