import { editor, input } from '@inquirer/prompts';
import chalk from 'chalk';
import figlet from 'figlet';
import { languageService } from '../../services/language';
import { McpConfig, StorageService } from '../../services/storage';
import { AnimationUtils, StringUtils } from '../../utils';
import { InteractiveMenu, MenuChoice } from '../components/menu';

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
        name: messages.config.menuOptions.role,
        value: 'role',
        description: messages.config.menuDescription.role
      },
      {
        name: messages.config.menuOptions.mcpConfig,
        value: 'mcpConfig',
        description: messages.config.menuDescription.mcpConfig
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

      case 'role':
        await this.editRole();
        break;

      case 'mcpConfig':
        await this.editMcpConfig();
        break;

      case 'viewConfig':
        await this.viewCurrentConfig();
        // 查看配置后暂停让用户查看，使用自定义的等待输入方法避免终端状态冲突
        console.log();
        await this.waitForEnter();
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
            return messages.config.messages.invalidUrl;
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
            return messages.config.messages.invalidNumber;
          }

          if (num < 1000 || num > 2000000) {
            return messages.config.messages.contextTokensRange;
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
            return messages.config.messages.invalidNumber;
          }

          if (num < 1 || num > 100) {
            return messages.config.messages.maxConcurrencyRange;
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

  private async editRole(): Promise<void> {
    const messages = languageService.getMessages();
    const currentConfig = StorageService.getApiConfig();

    console.log('  ' + chalk.cyan.bold(messages.config.menuOptions.role));
    console.log('  ' + chalk.gray(messages.config.menuDescription.role));

    if (currentConfig.role) {
      console.log('  ' + chalk.gray(`${messages.config.labels.status}: `));
      console.log('    ' + chalk.gray(currentConfig.role.split('\n').join('\n    ')));
    }
    console.log();
    console.log('  ' + chalk.gray(messages.config.messages.roleEditorPrompt));

    try {
      const role = await editor({
        message: '  ' + messages.config.prompts.roleInput + ':',
        default: currentConfig.role || messages.config.prompts.rolePlaceholder,
        validate: (input: string) => {
          if (!input.trim()) {
            return messages.config.messages.invalidInput;
          }
          return true;
        }
      });

      // 重置终端状态，防止影响后续交互
      this.resetTerminalState();

      if (role && role.trim()) {
        await AnimationUtils.showActionAnimation(messages.config.actions.saving);
        StorageService.saveRole(role.trim());
        console.log('  ' + chalk.green('✓ ' + messages.config.messages.configSaved));
      }
    } catch (error) {
      // 用户按 ESC 或 Ctrl+C 取消输入，也需要重置终端状态
      this.resetTerminalState();
      console.log();
      return;
    }
  }

  private async editMcpConfig(): Promise<void> {
    const messages = languageService.getMessages();
    const currentConfigJson = StorageService.getMcpConfigJson();

    console.log('  ' + chalk.cyan.bold(messages.config.menuOptions.mcpConfig));
    console.log('  ' + chalk.gray(messages.config.menuDescription.mcpConfig));

    if (currentConfigJson && currentConfigJson !== '{\n  "mcpServers": {}\n}') {
      console.log('  ' + chalk.gray(`${messages.config.labels.status}: `));
      const lines = currentConfigJson.split('\n');
      lines.slice(0, 5).forEach(line => {
        console.log('    ' + chalk.gray(line));
      });
      if (lines.length > 5) {
        console.log('    ' + chalk.gray('...'));
      }
    }
    console.log();
    console.log('  ' + chalk.gray(messages.config.messages.mcpConfigEditorPrompt));

    try {
      const mcpConfigJson = await editor({
        message: '  ' + messages.config.prompts.mcpConfigInput + ':',
        default: currentConfigJson || messages.config.prompts.mcpConfigPlaceholder,
        validate: (input: string) => {
          if (!input.trim()) {
            return messages.config.messages.invalidInput;
          }

          // 验证JSON格式
          try {
            JSON.parse(input.trim());
            return true;
          } catch {
            return messages.config.messages.invalidJson;
          }
        }
      });

      // 重置终端状态，防止影响后续交互
      this.resetTerminalState();

      if (mcpConfigJson && mcpConfigJson.trim()) {
        await AnimationUtils.showActionAnimation(messages.config.actions.saving);
        StorageService.saveMcpConfigFromJson(mcpConfigJson.trim());
        console.log('  ' + chalk.green('✓ ' + messages.config.messages.configSaved));
      }
    } catch (error) {
      // 用户按 ESC 或 Ctrl+C 取消输入，也需要重置终端状态
      this.resetTerminalState();
      console.log();
      return;
    }
  }

  /**
 * 重置终端状态，防止editor等外部工具影响后续交互
 */
  private resetTerminalState(): void {
    // 恢复光标显示
    process.stdout.write('\x1B[?25h');

    // 确保stdin处于正确状态，让InteractiveMenu能正常工作
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      // 立即resume，让后续的InteractiveMenu可以正常接管
      process.stdin.resume();
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

    this.displayConfigItem(
      messages.config.labels.role,
      config.role,
      config.role ? messages.config.labels.configured : messages.config.labels.notConfigured
    );

    const mcpConfig = StorageService.getMcpConfig();
    const serverNames = Object.keys(mcpConfig.mcpServers);
    const hasMcpServers = serverNames.length > 0;

    let mcpDisplayValue: string | undefined;
    if (hasMcpServers) {
      // 显示服务器名称列表，如果太多则显示前几个
      if (serverNames.length <= 3) {
        mcpDisplayValue = serverNames.join(', ');
      } else {
        mcpDisplayValue = `${serverNames.slice(0, 2).join(', ')} +${serverNames.length - 2} more`;
      }
    }

    // MCP配置需要特殊处理，显示更详细的信息
    if (hasMcpServers) {
      this.displayMcpConfigItem(messages.config.labels.mcpConfig, mcpConfig, messages.config.labels.configured);
    } else {
      this.displayConfigItem(
        messages.config.labels.mcpConfig,
        mcpDisplayValue,
        messages.config.labels.notConfigured
      );
    }

    console.log();

    // 显示配置完整性状态
    const validation = StorageService.validateApiConfig();
    if (validation.isValid) {
      console.log('  ' + chalk.green('✓ ' + messages.config.messages.allConfigured));
    } else {
      console.log('  ' + chalk.yellow(`⚠ Missing: ${validation.missing.join(', ')}`));
    }
  }

  private displayConfigItem(label: string, value: string | undefined, status: string): void {
    const statusColor = value ? chalk.green : chalk.yellow;

    console.log('  ' + chalk.white.bold(label + ':'));

    if (value) {
      // 对于多行内容，特别是role，进行特殊处理
      if (label.includes('角色') || label.includes('Role')) {
        console.log('    ' + chalk.gray('Value: '));
        const lines = value.split('\n');
        lines.forEach(line => {
          console.log('      ' + chalk.white(line));
        });
      } else {
        console.log('    ' + chalk.gray('Value: ') + chalk.white(value));
      }
    } else {
      console.log('    ' + chalk.gray('Value: ') + chalk.gray('(not set)'));
    }

    console.log('    ' + chalk.gray('Status: ') + statusColor(status));
    console.log();
  }

  private displayMcpConfigItem(label: string, mcpConfig: McpConfig, status: string): void {
    const statusColor = chalk.green;

    console.log('  ' + chalk.white.bold(label + ':'));
    console.log('    ' + chalk.gray('Servers: '));

    // 显示每个MCP服务器的详细信息
    Object.entries(mcpConfig.mcpServers).forEach(([serverName, serverConfig]) => {
      console.log('      ' + chalk.cyan('●') + ' ' + chalk.white.bold(serverName));

      // 智能检测服务器类型并显示相应信息
      if (serverConfig.url) {
        // HTTP/HTTPS类型的服务器
        console.log('        ' + chalk.gray('Type: ') + chalk.white('HTTP'));
        console.log('        ' + chalk.gray('URL: ') + chalk.white(serverConfig.url));
      } else if (serverConfig.command) {
        // STDIO类型的服务器
        console.log('        ' + chalk.gray('Type: ') + chalk.white('STDIO'));
        console.log('        ' + chalk.gray('Command: ') + chalk.white(serverConfig.command));
        if (serverConfig.args && Array.isArray(serverConfig.args)) {
          console.log('        ' + chalk.gray('Args: ') + chalk.white(serverConfig.args.join(' ')));
        }
      } else if (serverConfig.transport) {
        // 其他传输类型
        console.log('        ' + chalk.gray('Type: ') + chalk.white(serverConfig.transport.toUpperCase()));
      } else {
        // 未知类型，显示原始配置
        console.log('        ' + chalk.gray('Type: ') + chalk.yellow('Unknown'));
      }

      // 显示其他配置信息（排除已经显示的主要字段）
      const excludeKeys = ['url', 'command', 'args', 'transport'];
      const extraConfig = Object.entries(serverConfig).filter(([key]) => !excludeKeys.includes(key));

      if (extraConfig.length > 0) {
        extraConfig.forEach(([key, value]) => {
          let displayValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
          // 如果是token类似的敏感信息，进行部分隐藏
          if (key.toLowerCase().includes('token') || key.toLowerCase().includes('key') || key.toLowerCase().includes('password')) {
            displayValue = displayValue.length > 10 ? displayValue.substring(0, 8) + '...' : displayValue;
          }
          console.log('        ' + chalk.gray(`${key}: `) + chalk.white(displayValue));
        });
      }
    });

    console.log('    ' + chalk.gray('Status: ') + statusColor(status));
    console.log();
  }

  /**
   * 等待用户按Enter键，避免与InteractiveMenu的终端状态冲突
   */
  private async waitForEnter(): Promise<void> {
    return new Promise((resolve) => {
      console.log('  ' + chalk.gray('Press Enter to continue...'));

      // 确保stdin处于正确状态
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
      }
      process.stdin.resume();
      process.stdin.setEncoding('utf8');

      const cleanup = () => {
        // 重要：不要在这里设置setRawMode(false)，让InteractiveMenu自己管理
        process.stdin.removeListener('data', keyHandler);
        process.stdin.pause();
      };

      const keyHandler = (key: string) => {
        switch (key) {
          case '\r': // 回车
          case '\n':
            cleanup();
            resolve();
            break;
          case '\u0003': // Ctrl+C
            cleanup();
            process.exit();
            break;
          // 忽略其他按键，只响应Enter和Ctrl+C
        }
      };

      process.stdin.on('data', keyHandler);
    });
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