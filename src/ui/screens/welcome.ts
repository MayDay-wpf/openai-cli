import chalk from 'chalk';
import figlet from 'figlet';
import inquirer from 'inquirer';
import { Language, LANGUAGES } from '../../types/language';
import { getCurrentMessages, getAvailableLanguages } from '../../locales';
import { InteractiveMenu, MenuChoice } from '../components/menu';
import { AnimationUtils } from '../../utils/animation';
import { HelpPage } from '../pages/help';
import { ConfigPage } from '../pages/config';
import { MainPage } from '../pages/main';

export class WelcomeScreen {
  private currentLanguage: Language = 'zh';
  private readonly gradients = AnimationUtils.getGradients();
  
  async show(): Promise<void> {
    await this.showSplashScreen();
    await this.showMainMenu();
  }

  private async showSplashScreen(): Promise<void> {
    // 隐藏光标减少闪烁
    process.stdout.write('\x1B[?25l');
    console.clear();
    
    // 显示加载动画
    await this.showLoadingAnimation();
    
    // 显示大标题
    this.showGrandTitle();
    
    // 显示副标题和描述
    this.showDescription();
    
    // 显示装饰性分割线
    this.showDivider();
    
    // 恢复光标
    process.stdout.write('\x1B[?25h');
  }

  private async showLoadingAnimation(): Promise<void> {
    const messages = getCurrentMessages(this.currentLanguage);
    
    // 添加一些空行来为加载动画预留空间
    console.log('\n'.repeat(3));
    
    // 使用统一的动画工具
    await AnimationUtils.showLoadingAnimation({
      text: messages.welcome.starting,
      duration: 2000,
      successText: messages.welcome.startComplete
    });
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
        description: messages.welcome.menuDescription.start
      },
      {
        name: messages.welcome.menuOptions.config,
        value: 'config',
        description: messages.welcome.menuDescription.config
      },
      {
        name: messages.welcome.menuOptions.language,
        value: 'language',
        description: messages.welcome.menuDescription.language
      },
      {
        name: messages.welcome.menuOptions.help,
        value: 'help',
        description: messages.welcome.menuDescription.help
      },
      {
        name: messages.welcome.menuOptions.exit,
        value: 'exit',
        description: messages.welcome.menuDescription.exit
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
        const mainPage = new MainPage(this.currentLanguage);
        await mainPage.show();
        break;
        
      case 'config':
        const configPage = new ConfigPage(this.currentLanguage);
        await configPage.show();
        break;
        
      case 'language':
        await this.handleLanguageSelection();
        return; // 直接返回，语言切换后会重新显示界面
        
      case 'help':
        const helpPage = new HelpPage(this.currentLanguage);
        await helpPage.show();
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
      await AnimationUtils.showActionAnimation(messages.welcome.actions.changingLanguage);
      
      // 重新显示整个界面
      await this.show();
    } else {
      await this.showMainMenu();
    }
  }

  private async showExitAnimation(): Promise<void> {
    const messages = getCurrentMessages(this.currentLanguage);
    
    // 显示告别消息
    const farewell = figlet.textSync('GOODBYE', {
      font: 'ANSI Shadow',
      horizontalLayout: 'default',
      verticalLayout: 'default',
      width: 80
    });
    
    await AnimationUtils.showExitAnimation(farewell, messages.welcome.actions.farewell);
    
    process.exit(0);
  }
} 