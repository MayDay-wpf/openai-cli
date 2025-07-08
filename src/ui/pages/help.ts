import chalk from 'chalk';
import figlet from 'figlet';
import { languageService } from '../../services/language';
import { AnimationUtils } from '../../utils/animation';

export class HelpPage {
  private readonly gradients = AnimationUtils.getGradients();

  async show(): Promise<void> {
    AnimationUtils.forceClearScreen();
    this.showHelp();
  }

  private showHelp(): void {
    const messages = languageService.getMessages();
    
    // 帮助页面标题
    const helpTitle = figlet.textSync('HELP', {
      font: 'ANSI Shadow',
      horizontalLayout: 'default',
      verticalLayout: 'default',
      width: 60
    });
    
    console.log(this.gradients.primary(helpTitle));
    console.log();
    console.log(chalk.cyan.bold(messages.welcome.help.title));
    console.log(chalk.gray('─'.repeat(50)));
    console.log();
    
    // 基本用法
    console.log(chalk.white.bold(messages.welcome.help.usage + ':'));
    console.log(chalk.gray('  ' + messages.welcome.help.usageCommands.interactive));
    console.log(chalk.gray('  ' + messages.welcome.help.usageCommands.version));
    console.log(chalk.gray('  ' + messages.welcome.help.usageCommands.help));
    console.log();
    
    // 核心功能
    console.log();
  }
} 