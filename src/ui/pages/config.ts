import { checkbox, editor } from '@inquirer/prompts';
import chalk from 'chalk';
import figlet from 'figlet';
import { languageService } from '../../services/language';
import { McpConfig, McpFunctionConfirmationConfig, StorageService } from '../../services/storage';
import { AnimationUtils, StringUtils } from '../../utils';
import { InteractiveMenu, MenuChoice, NativeInput } from '../components';

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
        name: messages.config.menuOptions.mcpFunctionConfirmation,
        value: 'mcpFunctionConfirmation',
        description: messages.config.menuDescription.mcpFunctionConfirmation
      },
      {
        name: messages.config.menuOptions.maxToolCalls,
        value: 'maxToolCalls',
        description: messages.config.menuDescription.maxToolCalls
      },
      {
        name: messages.config.menuOptions.terminalSensitiveWords,
        value: 'terminalSensitiveWords',
        description: messages.config.menuDescription.terminalSensitiveWords
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

      case 'mcpFunctionConfirmation':
        await this.editMcpFunctionConfirmation();
        break;

      case 'maxToolCalls':
        await this.editMaxToolCalls();
        break;

      case 'terminalSensitiveWords':
        await this.editTerminalSensitiveWords();
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
      const baseUrl = await NativeInput.url(
        '  ' + messages.config.prompts.baseUrlInput + ':',
        currentConfig.baseUrl || messages.config.prompts.baseUrlPlaceholder
      );
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

    try {
      const apiKey = await NativeInput.text('  ' + messages.config.prompts.apiKeyInput + ':');

      if (apiKey && apiKey.trim()) {
        await AnimationUtils.showActionAnimation(messages.config.actions.saving);
        StorageService.saveApiKey(apiKey.trim());
        console.log('  ' + chalk.green('✓ ' + messages.config.messages.configSaved));
      }
    } catch (error) {
      // 用户按 ESC 或 Ctrl+C 取消输入，直接返回
      console.log();
      return;
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
      const model = await NativeInput.text(
        '  ' + messages.config.prompts.modelInput + ':',
        currentConfig.model || messages.config.prompts.modelPlaceholder
      );
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
      const contextTokens = await NativeInput.number(
        '  ' + messages.config.prompts.contextTokensInput + ':',
        currentConfig.contextTokens || parseInt(messages.config.prompts.contextTokensPlaceholder),
        1000,
        2000000
      );

      if (contextTokens) {
        await AnimationUtils.showActionAnimation(messages.config.actions.saving);
        StorageService.saveContextTokens(contextTokens);
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
      const maxConcurrency = await NativeInput.number(
        '  ' + messages.config.prompts.maxConcurrencyInput + ':',
        currentConfig.maxConcurrency || parseInt(messages.config.prompts.maxConcurrencyPlaceholder),
        1,
        100
      );

      if (maxConcurrency) {
        await AnimationUtils.showActionAnimation(messages.config.actions.saving);
        StorageService.saveMaxConcurrency(maxConcurrency);
        console.log('  ' + chalk.green('✓ ' + messages.config.messages.configSaved));
      }
    } catch (error) {
      // 用户按 ESC 或 Ctrl+C 取消输入，直接返回
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

          // 使用新的验证方法
          const validation = StorageService.validateMcpConfigJson(input.trim());
          if (!validation.isValid) {
            return validation.error || messages.config.messages.invalidJson;
          }

          return true;
        }
      });

      // 重置终端状态，防止影响后续交互
      this.resetTerminalState();

      if (mcpConfigJson && mcpConfigJson.trim()) {
        await AnimationUtils.showActionAnimation(messages.config.actions.saving);

        // 验证并保存配置
        const validation = StorageService.validateMcpConfigJson(mcpConfigJson.trim());
        if (validation.isValid && validation.parsedConfig) {
          StorageService.saveMcpConfig(validation.parsedConfig);

          // 显示保存成功消息
          console.log('  ' + chalk.green('✓ ' + messages.config.messages.configSaved));

          // 如果有系统服务被恢复，显示额外信息
          if (validation.hasSystemUpdates && validation.restoredServices && validation.restoredServices.length > 0) {
            console.log('  ' + chalk.yellow('ℹ ' + messages.config.messages.mcpSystemServicesRestored));
            validation.restoredServices.forEach(serviceName => {
              console.log('    ' + chalk.gray(`- ${serviceName} (${messages.systemDetector.builtinServices.protected})`));
            });
          }
        }
      }
    } catch (error) {
      // 用户按 ESC 或 Ctrl+C 取消输入，也需要重置终端状态
      this.resetTerminalState();
      console.log();
      return;
    }
  }

  private async editMcpFunctionConfirmation(): Promise<void> {
    const messages = languageService.getMessages();
    const currentConfig = StorageService.getMcpFunctionConfirmationConfig();

    console.log('  ' + chalk.cyan.bold(messages.config.menuOptions.mcpFunctionConfirmation));
    console.log('  ' + chalk.gray(messages.config.menuDescription.mcpFunctionConfirmation));
    console.log();

    try {
      // 获取所有可用的MCP函数（包括内置和外部）
      await AnimationUtils.showActionAnimation('Detecting and connecting MCP services...', 500);

      // 使用SystemDetector获取所有工具定义
      const { SystemDetector } = await import('../../services/system-detector');
      const systemDetector = new SystemDetector();

      try {
        // 先执行完整的系统检测，这会连接所有MCP服务器
        const detectionResult = await systemDetector.detectSystem();

        // 然后获取所有工具定义
        const allToolDefinitions = await systemDetector.getAllToolDefinitions();

        if (!allToolDefinitions || allToolDefinitions.length === 0) {
          console.log('  ' + chalk.yellow(messages.config.messages.noMcpFunctionsFound));
          console.log('  ' + chalk.gray('Please configure MCP servers first, or check if MCP servers are running.'));

          // 显示检测到的服务器状态
          if (detectionResult.mcpServers && detectionResult.mcpServers.length > 0) {
            console.log();
            console.log('  ' + chalk.gray('MCP server status:'));
            detectionResult.mcpServers.forEach(server => {
              const statusIcon = server.status === 'connected' ? chalk.green('✓') : chalk.red('✗');
              const toolsInfo = server.tools ? ` (${server.tools.length} tools)` : ' (no tools)';
              console.log(`    ${statusIcon} ${server.name}: ${server.status}${toolsInfo}`);
              if (server.error) {
                console.log(`      ${chalk.gray('Error:')} ${chalk.red(server.error)}`);
              }
            });
          }
          return;
        }

        console.log('  ' + chalk.green(`✓ Found ${allToolDefinitions.length} MCP functions`));

        // 显示服务器连接状态
        if (detectionResult.mcpServers && detectionResult.mcpServers.length > 0) {
          const connectedServers = detectionResult.mcpServers.filter(s => s.status === 'connected');
          const totalTools = detectionResult.mcpServers.reduce((sum, s) => sum + (s.tools?.length || 0), 0);
          console.log('  ' + chalk.gray(`Connected ${connectedServers.length}/${detectionResult.mcpServers.length} servers, ${totalTools} tools`));
        }
        console.log();

        // 创建复选框选项
        const checkboxOptions = allToolDefinitions.map(toolDef => {
          const functionName = toolDef.function.name;
          const description = toolDef.function.description || 'No description available';

          // 提取服务器名（从函数名中）
          const serverName = functionName.includes('_') ? functionName.split('_')[0] : 'unknown';

          return {
            name: `[${serverName}] ${functionName} - ${description.length > 50 ? description.substring(0, 50) + '...' : description}`,
            value: functionName,
            checked: currentConfig[functionName] === true
          };
        });

        // 显示当前配置状态
        const confirmedFunctions = Object.keys(currentConfig).filter(key => currentConfig[key] === true);
        if (confirmedFunctions.length > 0) {
          console.log('  ' + chalk.gray(`${messages.config.labels.status}: ${confirmedFunctions.length} ${messages.config.labels.configured}`));
          confirmedFunctions.forEach(funcName => {
            console.log('    ' + chalk.green('✓ ') + chalk.gray(funcName));
          });
        } else {
          console.log('  ' + chalk.gray(`${messages.config.labels.status}: ${messages.config.labels.notConfigured}`));
        }
        console.log();

        // 显示操作说明
        console.log('  ' + chalk.yellow(messages.config.messages.mcpFunctionConfirmationInstructions));
        console.log();

        // 使用复选框让用户选择
        const selectedFunctions = await checkbox({
          message: '  ' + messages.config.prompts.mcpFunctionConfirmationPrompt + ':',
          choices: checkboxOptions,
          pageSize: 10,
          validate: (answer) => {
            // 允许空选择，表示所有函数都不需要确认
            return true;
          },
          // 添加自定义指令
          instructions: false // 禁用默认指令，我们已经显示了自定义指令
        });

        // 重置终端状态
        this.resetTerminalState();

        // 构建新的配置
        const newConfig: McpFunctionConfirmationConfig = {};

        // 先将所有函数设为不需要确认
        allToolDefinitions.forEach(toolDef => {
          const functionName = toolDef.function.name;
          newConfig[functionName] = false;
        });

        // 然后将选中的函数设为需要确认
        selectedFunctions.forEach(functionName => {
          newConfig[functionName] = true;
        });

        // 保存配置
        await AnimationUtils.showActionAnimation(messages.config.actions.saving);
        StorageService.saveMcpFunctionConfirmationConfig(newConfig);

        // 显示保存结果
        console.log('  ' + chalk.green('✓ ' + messages.config.messages.mcpFunctionConfirmationSaved));

        if (selectedFunctions.length > 0) {
          console.log('  ' + chalk.gray(`${selectedFunctions.length} functions need to be confirmed manually.`));
          selectedFunctions.forEach(funcName => {
            console.log('    ' + chalk.green('✓ ') + chalk.white(funcName));
          });
        } else {
          console.log('  ' + chalk.gray('All MCP functions will execute automatically without confirmation.'));
        }

        // 清理SystemDetector资源
        await systemDetector.cleanup();

      } catch (mcpError) {
        console.log('  ' + chalk.yellow(`Failed to retrieve MCP function list: ${mcpError instanceof Error ? mcpError.message : String(mcpError)}`));
        console.log('  ' + chalk.gray('Please ensure that the MCP service is configured correctly and the server is running.'));
        return;
      }

    } catch (error) {
      // 用户按 ESC 或 Ctrl+C 取消输入，也需要重置终端状态
      this.resetTerminalState();
      console.log();
      return;
    }
  }

  private async editMaxToolCalls(): Promise<void> {
    const messages = languageService.getMessages();
    const currentConfig = StorageService.getApiConfig();

    console.log('  ' + chalk.cyan.bold(messages.config.menuOptions.maxToolCalls));
    console.log('  ' + chalk.gray(messages.config.menuDescription.maxToolCalls));

    if (currentConfig.maxToolCalls) {
      console.log('  ' + chalk.gray(`${messages.config.labels.status}: ${currentConfig.maxToolCalls}`));
    }
    console.log();

    try {
      const maxToolCalls = await NativeInput.number(
        '  ' + messages.config.prompts.maxToolCallsInput + ':',
        currentConfig.maxToolCalls || parseInt(messages.config.prompts.maxToolCallsPlaceholder),
        1,
        100
      );

      if (maxToolCalls) {
        await AnimationUtils.showActionAnimation(messages.config.actions.saving);
        StorageService.saveMaxToolCalls(maxToolCalls);
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
      messages.config.labels.maxToolCalls,
      config.maxToolCalls?.toString(),
      config.maxToolCalls ? messages.config.labels.configured : messages.config.labels.notConfigured
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

    // 显示MCP函数确认配置
    const mcpFunctionConfig = StorageService.getMcpFunctionConfirmationConfig();
    const confirmedFunctions = Object.keys(mcpFunctionConfig).filter(key => mcpFunctionConfig[key] === true);

    let mcpFunctionDisplayValue: string | undefined;
    if (confirmedFunctions.length > 0) {
      if (confirmedFunctions.length <= 3) {
        mcpFunctionDisplayValue = confirmedFunctions.join(', ');
      } else {
        mcpFunctionDisplayValue = `${confirmedFunctions.slice(0, 2).join(', ')} +${confirmedFunctions.length - 2} more`;
      }
    }

    this.displayConfigItem(
      messages.config.labels.mcpFunctionConfirmation,
      mcpFunctionDisplayValue,
      confirmedFunctions.length > 0 ? messages.config.labels.configured : messages.config.labels.notConfigured
    );

    const terminalSensitiveWords = config.terminalSensitiveWords || [];
    let terminalWordsDisplayValue: string | undefined;
    if (terminalSensitiveWords.length > 0) {
      if (terminalSensitiveWords.length <= 5) {
        terminalWordsDisplayValue = terminalSensitiveWords.join(', ');
      } else {
        terminalWordsDisplayValue = `${terminalSensitiveWords.slice(0, 5).join(', ')} +${terminalSensitiveWords.length - 5} more`;
      }
    }

    this.displayConfigItem(
      messages.config.labels.terminalSensitiveWords,
      terminalWordsDisplayValue,
      terminalSensitiveWords.length > 0 ? messages.config.labels.configured : messages.config.labels.notConfigured
    );

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
    const messages = languageService.getMessages();
    console.log('  ' + chalk.white.bold(label + ':'));
    console.log('    ' + chalk.gray('Servers: '));

    // 显示每个MCP服务器的详细信息
    Object.entries(mcpConfig.mcpServers).forEach(([serverName, serverConfig]) => {
      // 判断是否为系统自带服务
      const isBuiltIn = serverConfig.transport === 'builtin' ||
        (serverName === 'file-system' && serverConfig.description?.includes('Unified file system service'));
      const serverIcon = isBuiltIn ? chalk.green('●') : chalk.cyan('●');
      const serverLabel = isBuiltIn ? chalk.white.bold(serverName) + chalk.gray(' (' + messages.systemDetector.builtinServices.name + ')') : chalk.white.bold(serverName);

      console.log('      ' + serverIcon + ' ' + serverLabel);

      // 智能检测服务器类型并显示相应信息
      if (serverConfig.transport === 'builtin') {
        // 内置服务
        console.log('        ' + chalk.gray('Type: ') + chalk.green('BUILTIN'));
        console.log('        ' + chalk.gray('Status: ') + chalk.green(messages.systemDetector.builtinServices.running));
      } else if (serverConfig.url) {
        // HTTP/HTTPS类型的服务器
        console.log('        ' + chalk.gray('Type: ') + chalk.white('HTTP'));
        console.log('        ' + chalk.gray('URL: ') + chalk.white(serverConfig.url));
      } else if (serverConfig.command) {
        // STDIO类型的服务器
        console.log('        ' + chalk.gray('Type: ') + chalk.white('STDIO'));
        if (!isBuiltIn) {
          // 只有非系统服务才显示详细的command和args
          console.log('        ' + chalk.gray('Command: ') + chalk.white(serverConfig.command));
          if (serverConfig.args && Array.isArray(serverConfig.args)) {
            console.log('        ' + chalk.gray('Args: ') + chalk.white(serverConfig.args.join(' ')));
          }
        }
      } else if (serverConfig.transport) {
        // 其他传输类型
        console.log('        ' + chalk.gray('Type: ') + chalk.white(serverConfig.transport.toUpperCase()));
      } else {
        // 未知类型，显示原始配置
        console.log('        ' + chalk.gray('Type: ') + chalk.yellow('Unknown'));
      }

      // 显示描述信息
      if (serverConfig.description) {
        console.log('        ' + chalk.gray('Description: ') + chalk.white(serverConfig.description));
      }

      // 显示其他配置信息（排除已经显示的主要字段）
      const excludeKeys = ['url', 'command', 'args', 'transport', 'description'];
      const extraConfig = Object.entries(serverConfig).filter(([key]) => !excludeKeys.includes(key));

      if (extraConfig.length > 0 && !isBuiltIn) {
        // 系统自带服务不显示复杂的配置细节
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

  private async editTerminalSensitiveWords(): Promise<void> {
    const messages = languageService.getMessages();
    const currentConfig = StorageService.getApiConfig();
    const currentWords = currentConfig.terminalSensitiveWords || [];

    console.log('  ' + chalk.cyan.bold(messages.config.menuOptions.terminalSensitiveWords));
    console.log('  ' + chalk.gray(messages.config.menuDescription.terminalSensitiveWords));

    if (currentWords.length > 0) {
      console.log('  ' + chalk.gray(`${messages.config.labels.status}: ${currentWords.length} words configured`));
      currentWords.slice(0, 5).forEach(word => {
        console.log('    ' + chalk.gray(`- ${word}`));
      });
      if (currentWords.length > 5) {
        console.log('    ' + chalk.gray('...'));
      }
    } else {
      console.log('  ' + chalk.gray(`${messages.config.labels.status}: ${messages.config.labels.notConfigured}`));
    }
    console.log();
    console.log('  ' + chalk.gray(messages.config.messages.terminalSensitiveWordsEditorPrompt));

    try {
      const wordsString = await editor({
        message: '  ' + messages.config.prompts.terminalSensitiveWordsInput + ':',
        default: currentWords.join('\n'),
        validate: (input: string) => {
          return true;
        }
      });

      this.resetTerminalState();

      if (wordsString !== undefined) {
        const newWords = wordsString.split('\n').map(w => w.trim()).filter(w => w.length > 0);
        await AnimationUtils.showActionAnimation(messages.config.actions.saving);
        StorageService.saveTerminalSensitiveWords(newWords);
        console.log('  ' + chalk.green('✓ ' + messages.config.messages.configSaved));
      }
    } catch (error) {
      this.resetTerminalState();
      console.log();
      return;
    }
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