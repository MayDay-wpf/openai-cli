import chalk from 'chalk';
import figlet from 'figlet';
import { input } from '@inquirer/prompts';
import { languageService } from '../../services/language';
import { StorageService, ApiConfig } from '../../services/storage';
import { InteractiveMenu, MenuChoice } from '../components/menu';
import { AnimationUtils, StringUtils } from '../../utils';

export class ConfigPage {
  private readonly gradients = AnimationUtils.getGradients();

  async show(): Promise<void> {
    AnimationUtils.forceClearScreen();
    await this.showHeader();
    await this.showConfigMenu();
  }

  private async showHeader(): Promise<void> {
    const messages = languageService.getMessages();

    // 显示配置页面标题
    const configTitle = figlet.textSync('CONFIG', {
      font: 'ANSI Shadow',
      horizontalLayout: 'default',
      verticalLayout: 'default',
      width: 60
    });

    console.log(this.gradients.secondary(configTitle));
    console.log();

    // 显示副标题
    console.log('  ' + this.gradients.primary(messages.config.subtitle));
    console.log();

    // 显示分割线
    console.log('  ' + chalk.gray('─'.repeat(60)));
    console.log();
  }

  private async showConfigMenu(): Promise<void> {
    const messages = languageService.getMessages();

    const choices: MenuChoice[] = [
      {
        name: messages.config.menuOptions.baseUrl,
        value: 'baseUrl',
        description: messages.config.menuDescription.baseUrl
      },
      {
        name: messages.config.menuOptions.apiKey,
        value: 'apiKey',
        description: messages.config.menuDescription.apiKey
      },
      {
        name: messages.config.menuOptions.model,
        value: 'model',
        description: messages.config.menuDescription.model
      },
      {
        name: messages.config.menuOptions.contextTokens,
        value: 'contextTokens',
        description: messages.config.menuDescription.contextTokens
      },
      {
        name: messages.config.menuOptions.maxConcurrency,
        value: 'maxConcurrency',
        description: messages.config.menuDescription.maxConcurrency
      },
      {
        name: messages.config.menuOptions.viewConfig,
        value: 'viewConfig',
        description: messages.config.menuDescription.viewConfig
      },
      {
        name: messages.config.menuOptions.resetConfig,
        value: 'resetConfig',
        description: messages.config.menuDescription.resetConfig
      },
      {
        name: messages.config.menuOptions.back,
        value: 'back',
        description: messages.config.menuDescription.back
      }
    ];

    const action = await InteractiveMenu.show({
      message: messages.config.menuPrompt + ':',
      choices
    });

    await this.handleConfigAction(action);
  }

  private async handleConfigAction(action: string): Promise<void> {
    const messages = languageService.getMessages();
    console.log();

    switch (action) {
      case 'baseUrl':
        await this.editBaseUrl();
        break;

      case 'apiKey':
        await this.editApiKey();
        break;

      case 'model':
        await this.editModel();
        break;

      case 'contextTokens':
        await this.editContextTokens();
        break;

      case 'maxConcurrency':
        await this.editMaxConcurrency();
        break;

      case 'viewConfig':
        await this.viewCurrentConfig();
        // 查看配置后暂停让用户查看
        console.log();
        await input({
          message: '  ' + chalk.gray('Press Enter to continue...')
        });
        break;

      case 'resetConfig':
        await this.resetConfig();
        break;

      case 'back':
        return; // 直接返回到欢迎页

      default:
        console.log('  ' + chalk.red(messages.welcome.actions.unknownAction));
    }

    // 除了返回操作，其他操作完成后自动返回配置菜单
    if (action !== 'back') {
      await this.show(); // 递归显示配置页面
    }
  }

  private async editBaseUrl(): Promise<void> {
    const messages = languageService.getMessages();
    const currentConfig = StorageService.getApiConfig();

    console.log('  ' + chalk.cyan.bold(messages.config.menuOptions.baseUrl));
    console.log('  ' + chalk.gray(messages.config.menuDescription.baseUrl));

    if (currentConfig.baseUrl) {
      console.log('  ' + chalk.gray(`${messages.config.labels.status}: ${currentConfig.baseUrl}`));
    }
    console.log();

    try {
      const baseUrl = await input({
        message: '  ' + messages.config.prompts.baseUrlInput + ':',
        default: currentConfig.baseUrl || messages.config.prompts.baseUrlPlaceholder,
        validate: (input: string) => {
          if (!input.trim()) {
            return messages.config.messages.invalidInput;
          }

          // 简单的URL验证
          try {
            new URL(input.trim());
            return true;
          } catch {
            return 'Please enter a valid URL';
          }
        }
      });
      const result = { baseUrl };

      if (result.baseUrl && result.baseUrl.trim()) {
        await AnimationUtils.showActionAnimation(messages.config.actions.saving);
        StorageService.saveBaseUrl(result.baseUrl.trim());
        console.log('  ' + chalk.green('✓ ' + messages.config.messages.configSaved));
      }
    } catch (error) {
      // 用户按 ESC 或 Ctrl+C 取消输入，直接返回
      console.log();
      return;
    }
  }

  private async editApiKey(): Promise<void> {
    const messages = languageService.getMessages();
    const currentConfig = StorageService.getApiConfig();

    console.log('  ' + chalk.cyan.bold(messages.config.menuOptions.apiKey));
    console.log('  ' + chalk.gray(messages.config.menuDescription.apiKey));

    if (currentConfig.apiKey) {
      const maskedKey = StringUtils.maskApiKey(currentConfig.apiKey);
      console.log('  ' + chalk.gray(`${messages.config.labels.status}: ${maskedKey}`));
    }
    console.log();
    const apiKey = await input({
      message: '  ' + messages.config.prompts.apiKeyInput + ':',
      validate: (input: string) => {
        if (!input.trim()) {
          return messages.config.messages.invalidInput;
        }
        return true;
      }
    });
    const result = { apiKey };

    if (result.apiKey && result.apiKey.trim()) {
      await AnimationUtils.showActionAnimation(messages.config.actions.saving);
      StorageService.saveApiKey(result.apiKey.trim());
      console.log('  ' + chalk.green('✓ ' + messages.config.messages.configSaved));
    }
  }

  private async editModel(): Promise<void> {
    const messages = languageService.getMessages();
    const currentConfig = StorageService.getApiConfig();

    console.log('  ' + chalk.cyan.bold(messages.config.menuOptions.model));
    console.log('  ' + chalk.gray(messages.config.menuDescription.model));

    if (currentConfig.model) {
      console.log('  ' + chalk.gray(`${messages.config.labels.status}: ${currentConfig.model}`));
    }
    console.log();

    // 提供一些常用模型的选项，包含退出选项
    const commonModelChoices: MenuChoice[] = [
      { name: 'gpt-4.1', value: 'gpt-4.1' },
      { name: 'gpt-4o', value: 'gpt-4o' },
      { name: 'o3', value: 'o3' },
      { name: 'o3-mini', value: 'o3-mini' },
      { name: 'o4-mini', value: 'o4-mini' },
      { name: messages.config.actions.custom, value: 'custom' },
      { name: messages.config.actions.cancel, value: 'cancel' }
    ];

    const modelChoice = await InteractiveMenu.show({
      message: '  ' + messages.config.prompts.modelInput + ':',
      choices: commonModelChoices
    });

    let finalModel = modelChoice;

    if (modelChoice === 'custom') {
      const model = await input({
        message: '  ' + messages.config.prompts.modelInput + ':',
        default: currentConfig.model || messages.config.prompts.modelPlaceholder,
        validate: (input: string) => {
          if (!input.trim()) {
            return messages.config.messages.invalidInput;
          }
          return true;
        }
      });
      finalModel = model;
    }
    if (modelChoice === 'cancel') {
      return;
    }

    if (finalModel && finalModel.trim()) {
      await AnimationUtils.showActionAnimation(messages.config.actions.saving);
      StorageService.saveModel(finalModel.trim());
      console.log('  ' + chalk.green('✓ ' + messages.config.messages.configSaved));
    }
  }

  private async editContextTokens(): Promise<void> {
    const messages = languageService.getMessages();
    const currentConfig = StorageService.getApiConfig();

    console.log('  ' + chalk.cyan.bold(messages.config.menuOptions.contextTokens));
    console.log('  ' + chalk.gray(messages.config.menuDescription.contextTokens));

    if (currentConfig.contextTokens) {
      console.log('  ' + chalk.gray(`${messages.config.labels.status}: ${currentConfig.contextTokens}`));
    }
    console.log();

    try {
      const contextTokens = await input({
        message: '  ' + messages.config.prompts.contextTokensInput + ':',
        default: currentConfig.contextTokens?.toString() || messages.config.prompts.contextTokensPlaceholder,
        validate: (input: string) => {
          if (!input.trim()) {
            return messages.config.messages.invalidInput;
          }

          const num = parseInt(input.trim());
          if (isNaN(num) || num <= 0) {
            return 'Please enter a valid positive number';
          }
          
          if (num < 1000 || num > 2000000) {
            return 'Context tokens should be between 1,000 and 2,000,000';
          }

          return true;
        }
      });

      if (contextTokens && contextTokens.trim()) {
        const tokenCount = parseInt(contextTokens.trim());
        await AnimationUtils.showActionAnimation(messages.config.actions.saving);
        StorageService.saveContextTokens(tokenCount);
        console.log('  ' + chalk.green('✓ ' + messages.config.messages.configSaved));
      }
    } catch (error) {
      // 用户按 ESC 或 Ctrl+C 取消输入，直接返回
      console.log();
      return;
    }
  }

  private async editMaxConcurrency(): Promise<void> {
    const messages = languageService.getMessages();
    const currentConfig = StorageService.getApiConfig();

    console.log('  ' + chalk.cyan.bold(messages.config.menuOptions.maxConcurrency));
    console.log('  ' + chalk.gray(messages.config.menuDescription.maxConcurrency));

    if (currentConfig.maxConcurrency) {
      console.log('  ' + chalk.gray(`${messages.config.labels.status}: ${currentConfig.maxConcurrency}`));
    }
    console.log();

    try {
      const maxConcurrency = await input({
        message: '  ' + messages.config.prompts.maxConcurrencyInput + ':',
        default: currentConfig.maxConcurrency?.toString() || messages.config.prompts.maxConcurrencyPlaceholder,
        validate: (input: string) => {
          if (!input.trim()) {
            return messages.config.messages.invalidInput;
          }

          const num = parseInt(input.trim());
          if (isNaN(num) || num <= 0) {
            return 'Please enter a valid positive number';
          }
          
          if (num < 1 || num > 100) {
            return 'Max concurrency should be between 1 and 100';
          }

          return true;
        }
      });

      if (maxConcurrency && maxConcurrency.trim()) {
        const concurrencyCount = parseInt(maxConcurrency.trim());
        await AnimationUtils.showActionAnimation(messages.config.actions.saving);
        StorageService.saveMaxConcurrency(concurrencyCount);
        console.log('  ' + chalk.green('✓ ' + messages.config.messages.configSaved));
      }
    } catch (error) {
      // 用户按 ESC 或 Ctrl+C 取消输入，直接返回
      console.log();
      return;
    }
  }

  private async viewCurrentConfig(): Promise<void> {
    const messages = languageService.getMessages();

    console.log('  ' + chalk.cyan.bold(messages.config.messages.currentConfig));
    console.log('  ' + chalk.gray('─'.repeat(40)));
    console.log();

    await AnimationUtils.showActionAnimation(messages.config.actions.loading, 0);

    const config = StorageService.getApiConfig();

    if (!StorageService.hasConfig()) {
      console.log('  ' + chalk.yellow(messages.config.messages.noConfigFound));
      return;
    }

    // 显示配置状态
    this.displayConfigItem(
      messages.config.labels.baseUrl,
      config.baseUrl,
      config.baseUrl ? messages.config.labels.configured : messages.config.labels.notConfigured
    );

    this.displayConfigItem(
      messages.config.labels.apiKey,
      config.apiKey ? StringUtils.maskApiKey(config.apiKey) : undefined,
      config.apiKey ? messages.config.labels.configured : messages.config.labels.notConfigured
    );

    this.displayConfigItem(
      messages.config.labels.model,
      config.model,
      config.model ? messages.config.labels.configured : messages.config.labels.notConfigured
    );

    this.displayConfigItem(
      messages.config.labels.contextTokens,
      config.contextTokens?.toString(),
      config.contextTokens ? messages.config.labels.configured : messages.config.labels.notConfigured
    );

    this.displayConfigItem(
      messages.config.labels.maxConcurrency,
      config.maxConcurrency?.toString(),
      config.maxConcurrency ? messages.config.labels.configured : messages.config.labels.notConfigured
    );

    console.log();

    // 显示配置完整性状态
    const validation = StorageService.validateApiConfig();
    if (validation.isValid) {
      console.log('  ' + chalk.green('✓ All configurations are set'));
    } else {
      console.log('  ' + chalk.yellow(`⚠ Missing: ${validation.missing.join(', ')}`));
    }
  }

  private displayConfigItem(label: string, value: string | undefined, status: string): void {
    const statusColor = value ? chalk.green : chalk.yellow;
    const valueDisplay = value || chalk.gray('(not set)');

    console.log('  ' + chalk.white.bold(label + ':'));
    console.log('    ' + chalk.gray('Value: ') + valueDisplay);
    console.log('    ' + chalk.gray('Status: ') + statusColor(status));
    console.log();
  }

  private async resetConfig(): Promise<void> {
    const messages = languageService.getMessages();

    console.log('  ' + chalk.yellow.bold(messages.config.menuOptions.resetConfig));
    console.log('  ' + chalk.gray(messages.config.menuDescription.resetConfig));
    console.log();

    const confirmationChoices: MenuChoice[] = [
      { name: messages.config.actions.yes, value: 'yes' },
      { name: messages.config.actions.no, value: 'no' }
    ];

    const confirmation = await InteractiveMenu.show({
      message: '  ' + messages.config.prompts.confirmReset,
      choices: confirmationChoices
    });

    if (confirmation === 'yes') {
      await AnimationUtils.showActionAnimation(messages.config.actions.resetting);
      StorageService.clearConfig();
      console.log('  ' + chalk.green('✓ ' + messages.config.messages.configReset));
    } else {
      console.log('  ' + chalk.gray(messages.config.messages.resetCancelled));
    }
  }


} 