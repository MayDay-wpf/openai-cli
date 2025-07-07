import chalk from 'chalk';
import figlet from 'figlet';
import gradient from 'gradient-string';
import inquirer from 'inquirer';
import ora from 'ora';
import { Language, LANGUAGES } from '../types/language';
import { getCurrentMessages, getAvailableLanguages } from '../locales';
import { InteractiveMenu, MenuChoice } from './menu';

export class WelcomeScreen {
  private currentLanguage: Language = 'zh';
  private readonly gradients = {
    primary: gradient(['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7']),
    secondary: gradient(['#667eea', '#764ba2']),
    accent: gradient(['#f093fb', '#f5576c']),
    success: gradient(['#4facfe', '#00f2fe']),
    rainbow: gradient.rainbow
  };
  
  async show(): Promise<void> {
    await this.showSplashScreen();
    await this.showMainMenu();
  }

  private async showSplashScreen(): Promise<void> {
    console.clear();
    
    // 显示加载动画
    await this.showLoadingAnimation();
    
    // 显示大标题
    this.showGrandTitle();
    
    // 显示副标题和描述
    this.showDescription();
    
    // 显示特色功能展示
    this.showFeatureShowcase();
    
    // 显示装饰性分割线
    this.showDivider();
  }

  private async showLoadingAnimation(): Promise<void> {
    const messages = getCurrentMessages(this.currentLanguage);
    
    // 创建更加炫酷的加载动画
    const spinner = ora({
      text: this.gradients.primary(messages.welcome.starting),
      spinner: {
        interval: 80,
        frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
      }
    }).start();
    
    // 模拟系统初始化过程
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    spinner.succeed(this.gradients.success(messages.welcome.startComplete));
    console.log();
  }

  private showGrandTitle(): void {
    // 创建更大气的标题
    const title1 = figlet.textSync('OPENAI', {
      font: 'ANSI Shadow',
      horizontalLayout: 'default',
      verticalLayout: 'default',
      width: 120,
      whitespaceBreak: true
    });
    
    const title2 = figlet.textSync('CLI AGENT', {
      font: 'ANSI Shadow',
      horizontalLayout: 'default',
      verticalLayout: 'default',
      width: 120,
      whitespaceBreak: true
    });
    
    // 使用多层渐变效果
    console.log(this.gradients.primary.multiline(title1));
    console.log(this.gradients.accent.multiline(title2));
    console.log();
    
    // 添加版本信息和徽章
    const versionBadge = '  [ v1.0.0 ] ';
    const statusBadge = '  [ STABLE ] ';
    const aiBadge = '  [ AI-POWERED ] ';
    
    console.log(
      '  ' +
      chalk.bgBlue.white.bold(versionBadge) + ' ' +
      chalk.bgGreen.white.bold(statusBadge) + ' ' +
      chalk.bgMagenta.white.bold(aiBadge)
    );
    console.log();
  }

  private showDescription(): void {
    const messages = getCurrentMessages(this.currentLanguage);
    
    // 主标题和副标题
    console.log('  ' + this.gradients.primary(messages.welcome.subtitle));
    console.log('  ' + chalk.gray(messages.welcome.description));
    console.log();
  }

  private showFeatureShowcase(): void {
    const messages = getCurrentMessages(this.currentLanguage);
    
    // 简洁的功能列表，使用圆点
    const features = [
      messages.welcome.features.codeGen,
      messages.welcome.features.refactor,
      messages.welcome.features.docs,
      messages.welcome.features.debug,
      messages.welcome.features.bestPractice
    ];
    
    features.forEach(feature => {
      console.log('  ' + chalk.gray('●') + ' ' + chalk.white(feature));
    });
    console.log();
    
    // 简洁的标语
    console.log('  ' + chalk.cyan(messages.welcome.tagline));
    console.log();
  }

  private showDivider(): void {
    console.log('  ' + chalk.gray('─'.repeat(60)));
    console.log();
  }

  private async showMainMenu(): Promise<void> {
    const messages = getCurrentMessages(this.currentLanguage);
    
    const choices: MenuChoice[] = [
      {
        name: messages.welcome.menuOptions.start,
        value: 'start',
        description: 'Enter main application interface'
      },
      {
        name: messages.welcome.menuOptions.config,
        value: 'config',
        description: 'Configure API keys and preferences'
      },
      {
        name: messages.welcome.menuOptions.language,
        value: 'language',
        description: 'Switch interface language'
      },
      {
        name: messages.welcome.menuOptions.help,
        value: 'help',
        description: 'View documentation and usage guide'
      },
      {
        name: messages.welcome.menuOptions.exit,
        value: 'exit',
        description: 'Exit the application'
      }
    ];

    const action = await InteractiveMenu.show({
      message: messages.welcome.menuPrompt + ':',
      choices
    });

    await this.handleMenuSelection(action);
  }

  private async handleMenuSelection(action: string): Promise<void> {
    const messages = getCurrentMessages(this.currentLanguage);
    console.log();
    
    switch (action) {
      case 'start':
        await this.showActionAnimation(messages.welcome.actions.startingMain);
        console.log('  ' + chalk.yellow(messages.welcome.actions.devInProgress));
        break;
        
      case 'config':
        await this.showActionAnimation(messages.welcome.actions.startingConfig);
        console.log('  ' + chalk.yellow(messages.welcome.actions.devInProgress));
        break;
        
      case 'language':
        await this.handleLanguageSelection();
        return; // 直接返回，语言切换后会重新显示界面
        
      case 'help':
        console.clear();
        this.showHelp();
        break;
        
      case 'exit':
        await this.showExitAnimation();
        return;
        
      default:
        console.log('  ' + chalk.red(messages.welcome.actions.unknownAction));
    }
    
    // 等待用户按键继续
    console.log();
    await inquirer.prompt([
      {
        type: 'input',
        name: 'continue',
        message: '  ' + chalk.gray(messages.welcome.actions.pressEnter),
        prefix: '  '
      }
    ]);
    
    // 重新显示菜单（除非是退出）
    await this.showMainMenu();
  }

  private async showActionAnimation(text: string): Promise<void> {
    const spinner = ora({
      text: this.gradients.primary(text),
      spinner: 'dots12'
    }).start();
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    spinner.stop();
    console.log('  ' + this.gradients.success('✓ ') + text);
  }

  private async handleLanguageSelection(): Promise<void> {
    const availableLanguages = getAvailableLanguages();
    const choices: MenuChoice[] = availableLanguages.map(code => {
      const config = LANGUAGES[code];
      return {
        name: config.nativeName,
        value: code,
        description: config.name
      };
    });

    const selectedLanguage = await InteractiveMenu.show({
      message: 'Select Language / 选择语言:',
      choices
    }) as Language;

    if (selectedLanguage !== this.currentLanguage) {
      this.currentLanguage = selectedLanguage;
      
      const messages = getCurrentMessages(this.currentLanguage);
      await this.showActionAnimation(messages.welcome.actions.changingLanguage);
      
      // 重新显示整个界面
      await this.show();
    } else {
      await this.showMainMenu();
    }
  }

  private async showExitAnimation(): Promise<void> {
    const messages = getCurrentMessages(this.currentLanguage);
    
    console.clear();
    console.log();
    
    // 显示告别消息
    const farewell = figlet.textSync('GOODBYE', {
      font: 'ANSI Shadow',
      horizontalLayout: 'default',
      verticalLayout: 'default',
      width: 80
    });
    
    console.log(this.gradients.accent.multiline(farewell));
    console.log();
    console.log('  ' + this.gradients.primary(messages.welcome.actions.farewell));
    console.log();
    
    // 显示感谢动画
    const spinner = ora({
      text: this.gradients.secondary('正在安全退出系统... / Safely exiting system...'),
      spinner: 'bouncingBar'
    }).start();
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    spinner.succeed(this.gradients.success('再见！/ See you again!'));
    
    process.exit(0);
  }

  private showHelp(): void {
    const messages = getCurrentMessages(this.currentLanguage);
    
    // 帮助页面标题
    const helpTitle = figlet.textSync('HELP', {
      font: 'ANSI Shadow',
      horizontalLayout: 'default',
      verticalLayout: 'default',
      width: 60
    });
    
    console.log(this.gradients.primary.multiline(helpTitle));
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
    console.log(chalk.white.bold(messages.welcome.help.features + ':'));
    console.log(chalk.white('  ' + messages.welcome.help.featureList.codeGen));
    console.log(chalk.white('  ' + messages.welcome.help.featureList.review));
    console.log(chalk.white('  ' + messages.welcome.help.featureList.refactor));
    console.log(chalk.white('  ' + messages.welcome.help.featureList.debug));
    console.log();
    
    console.log(chalk.yellow(messages.welcome.help.moreFeatures));
    console.log();
  }
} 