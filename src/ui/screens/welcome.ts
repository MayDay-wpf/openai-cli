import { input } from '@inquirer/prompts';
import chalk from 'chalk';
import figlet from 'figlet';
import { languageService } from '../../services/language';
import { StorageService } from '../../services/storage';
import { Language } from '../../types/language';
import { AnimationUtils } from '../../utils/animation';
import { InteractiveMenu, MenuChoice } from '../components/menu';
import { ConfigPage } from '../pages/config';
import { HelpPage } from '../pages/help';
import { MainPage } from '../pages/main';

export class WelcomeScreen {
  private readonly gradients = AnimationUtils.getGradients();

  async show(): Promise<void> {
    await this.showSplashScreen();
    await this.showMainMenu();
  }



  private async showSplashScreen(): Promise<void> {
    // 隐藏光标减少闪烁
    process.stdout.write('\x1B[?25l');
    AnimationUtils.forceClearScreen();

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
    const messages = languageService.getMessages();

    // 使用统一的动画工具
    const controller = AnimationUtils.showLoadingAnimation({
      text: messages.welcome.starting,
      interval: 80
    });
    await new Promise(resolve => setTimeout(resolve, 100));
    controller.stop();
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
    console.log(this.gradients.primary(title1));
    console.log(this.gradients.accent(title2));
    console.log();

    // 添加版本信息和徽章
    const versionBadge = '  [ v0.0.4 ] ';
    const statusBadge = '  [ BETA ] ';
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
    const messages = languageService.getMessages();

    // 主标题和副标题
    console.log('  ' + this.gradients.primary(messages.welcome.tagline));
    console.log();
  }

  private showDivider(): void {
    console.log('  ' + chalk.gray('─'.repeat(60)));
    console.log();
  }

  private async showMainMenu(): Promise<void> {
    const messages = languageService.getMessages();

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
    const messages = languageService.getMessages();
    console.log();

    switch (action) {
      case 'start':
        try {
          // 检查配置是否完整
          const configValidation = StorageService.validateApiConfig();

          if (!configValidation.isValid) {
            // 显示配置不完整的警告
            const shouldGoToConfig = await this.showConfigWarning(configValidation.missing);

            if (shouldGoToConfig) {
              // 用户选择配置，跳转到配置页面
              const configPage = new ConfigPage();
              await configPage.show();
              // 配置完成后重新显示欢迎页面
              await this.show();
            } else {
              // 用户选择返回主菜单，清屏并重新显示整个欢迎页面
              await this.show();
            }
            return;
          }

          // 配置完整，启动主页面
          const mainPage = new MainPage();
          await mainPage.show();
          // 确保MainPage实例被正确清理
          mainPage.destroy();
          // 对话页面结束后，直接重新显示欢迎页面，不需要等待用户按键
          await this.show();
        } catch (error) {
          console.error('  ' + chalk.red('对话页面出现错误:'), error);
          // 出错时也重新显示欢迎页面
          await this.show();
        }
        return;

      case 'config':
        const configPage = new ConfigPage();
        await configPage.show();
        // 配置页面完成后，重新显示完整的欢迎页
        await this.show();
        return;

      case 'language':
        await this.handleLanguageSelection();
        return; // 直接返回，语言切换后会重新显示界面

      case 'help':
        const helpPage = new HelpPage();
        await helpPage.show();
        // 帮助页面结束后，等待用户按键继续
        console.log();
        await input({
          message: '  ' + chalk.gray(messages.welcome.actions.pressEnter)
        });

        // 强制清屏后重新显示完整的欢迎页面
        process.stdout.write('\x1B[2J\x1B[3J\x1B[H');
        console.clear();
        process.stdout.write('\x1Bc');
        await this.show();
        break;

      case 'exit':
        await this.showExitAnimation();
        return;

      default:
        console.log('  ' + chalk.red(messages.welcome.actions.unknownAction));
        await this.showMainMenu();
    }
  }

  private async handleLanguageSelection(): Promise<void> {
    const choices = languageService.createLanguageMenuChoices();

    const selectedLanguage = await InteractiveMenu.show({
      message: 'Select Language / 选择语言:',
      choices
    }) as Language;

    const currentLanguage = languageService.getCurrentLanguage();
    if (selectedLanguage !== currentLanguage) {
      languageService.setLanguage(selectedLanguage);

      const messages = languageService.getMessages();
      await AnimationUtils.showActionAnimation(messages.welcome.actions.changingLanguage);

      // 重新显示整个界面
      await this.show();
    } else {
      await this.showMainMenu();
    }
  }

  private async showExitAnimation(): Promise<void> {
    console.log('\n'.repeat(5));
    const messages = languageService.getMessages();

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

  private async showConfigWarning(missingItems: string[]): Promise<boolean> {
    const messages = languageService.getMessages();
    const configCheck = messages.welcome.configCheck;

    // 显示配置警告
    console.log();
    console.log('  ' + chalk.yellow.bold(configCheck.incompleteConfig));
    console.log();
    console.log('  ' + chalk.gray(configCheck.missingItems));

    // 显示缺少的配置项
    missingItems.forEach(item => {
      let itemName = '';
      switch (item) {
        case 'baseUrl':
          itemName = configCheck.baseUrl;
          break;
        case 'apiKey':
          itemName = configCheck.apiKey;
          break;
        case 'model':
          itemName = configCheck.model;
          break;
      }
      console.log('    ' + chalk.red(itemName));
    });

    console.log();

    // 显示选择菜单 - 只允许前往配置或返回主菜单
    const choices: MenuChoice[] = [
      {
        name: configCheck.goToConfig,
        value: 'config',
        description: messages.welcome.menuDescription.config
      },
      {
        name: configCheck.backToMenu,
        value: 'back',
        description: messages.welcome.menuDescription.backToMenu
      }
    ];

    const choice = await InteractiveMenu.show({
      message: '  ' + configCheck.prompt,
      choices
    });

    return choice === 'config';
  }
} 