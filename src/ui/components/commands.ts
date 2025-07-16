import chalk from 'chalk';
import * as path from 'path';
import { Checkpoint, CheckpointService } from '../../services/checkpoint';
import { HistoryService } from '../../services/history';
import { languageService } from '../../services/language';
import { Messages } from '../../types/language';
import { Message, TokenCalculator } from '../../utils/token-calculator';
import { HistoryEditor, HistoryEditorResult } from './history-editor';

export interface Command {
    value: string;
    name: string;
    description: string;
}

export interface CommandExecutionResult {
    handled: boolean;
    shouldExit?: boolean;
    shouldContinue?: boolean;
    newMessages?: Message[];
    shouldReload?: boolean;
}

export class CommandManager {
    private messages: Messages;
    private commands: Command[];

    // 历史记录管理状态
    private hasExportedHistory = false;
    private isWaitingForFileImport = false;
    private isWaitingForOverwriteConfirm = false;
    private pendingImportFilePath: string | null = null;

    constructor(messages: Messages) {
        this.messages = messages;
        this.commands = this.initializeCommands();
    }

    private initializeCommands(): Command[] {
        const mainCommands = this.messages.main.commands;
        return [
            {
                value: '/exit',
                name: mainCommands.exit.name,
                description: mainCommands.exit.description
            },
            {
                value: '/clear',
                name: mainCommands.clear.name,
                description: mainCommands.clear.description
            },
            {
                value: '/help',
                name: mainCommands.help.name,
                description: mainCommands.help.description
            },
            {
                value: '/history',
                name: mainCommands.history.name,
                description: mainCommands.history.description
            },
            {
                value: '/edit-history',
                name: mainCommands.editHistory.name,
                description: mainCommands.editHistory.description
            },
            {
                value: '/init',
                name: mainCommands.init.name,
                description: mainCommands.init.description
            },
            {
                value: '/export-history',
                name: mainCommands.exportHistory.name,
                description: mainCommands.exportHistory.description
            },
            {
                value: '/import-history',
                name: mainCommands.importHistory.name,
                description: mainCommands.importHistory.description
            },
            {
                value: '/checkpoint',
                name: mainCommands.checkpoint.name,
                description: mainCommands.checkpoint.description
            }
        ];
    }

    getCommands(): Command[] {
        return [...this.commands];
    }

    filterCommands(query: string): Command[] {
        if (!query.startsWith('/')) return [];
        const searchTerm = query.slice(1).toLowerCase();
        if (searchTerm === '') return this.commands;

        return this.commands.filter(cmd =>
            cmd.value.slice(1).toLowerCase().includes(searchTerm) ||
            cmd.description.toLowerCase().includes(searchTerm)
        );
    }

    updateLanguage(messages: Messages): void {
        this.messages = messages;
        this.commands = this.initializeCommands();
    }

    // 重置所有状态
    resetStates(): void {
        this.hasExportedHistory = false;
        this.isWaitingForFileImport = false;
        this.isWaitingForOverwriteConfirm = false;
        this.pendingImportFilePath = null;
    }

    // 获取导出状态
    getHasExportedHistory(): boolean {
        return this.hasExportedHistory;
    }

    // 设置导出状态
    setHasExportedHistory(value: boolean): void {
        this.hasExportedHistory = value;
    }

    // 处理用户输入，返回执行结果
    async handleInput(userInput: string, currentMessages: Message[]): Promise<CommandExecutionResult> {
        // 检查是否在等待覆盖确认状态
        if (this.isWaitingForOverwriteConfirm && this.pendingImportFilePath) {
            return await this.handleOverwriteConfirmation(userInput, currentMessages);
        }

        // 检查是否在等待文件导入状态
        if (this.isWaitingForFileImport) {
            return await this.handleFileImportWaiting(userInput, currentMessages);
        }

        // 检查是否是文件导入格式（@文件路径）
        if (userInput.startsWith('@') && userInput.endsWith('.json')) {
            return await this.handleDirectFileImport(userInput, currentMessages);
        }

        // 检查是否是标准命令
        if (userInput.startsWith('/')) {
            return await this.handleStandardCommand(userInput, currentMessages);
        }

        // 不是命令，返回未处理
        return { handled: false };
    }

    // 处理覆盖确认
    private async handleOverwriteConfirmation(userInput: string, currentMessages: Message[]): Promise<CommandExecutionResult> {
        const choice = userInput.toLowerCase().trim();
        const historyMgmt = this.messages.main.historyManagement;

        if (choice === 'y' || choice === 'yes' || choice === '是') {
            // 用户确认覆盖，强制导入
            this.isWaitingForOverwriteConfirm = false;
            const filePath = this.pendingImportFilePath!;
            this.pendingImportFilePath = null;

            const importedMessages = await HistoryService.forceImportHistoryFromFile(filePath, this.messages);
            if (importedMessages) {
                this.hasExportedHistory = false;
                const successMsg = historyMgmt.importFromFileSuccess
                    .replace('{filePath}', filePath)
                    .replace('{count}', importedMessages.length.toString());
                console.log(chalk.green(successMsg));
                return { handled: true, shouldContinue: true, newMessages: importedMessages };
            }
        } else if (choice === 'n' || choice === 'no' || choice === '否') {
            // 用户取消覆盖
            this.isWaitingForOverwriteConfirm = false;
            this.pendingImportFilePath = null;
            console.log(chalk.yellow(historyMgmt.importCancel));
            return { handled: true, shouldContinue: true };
        } else {
            // 无效输入，重新提示
            console.log(chalk.red(historyMgmt.overwriteInvalidInput));
            return { handled: true, shouldContinue: true };
        }

        return { handled: true, shouldContinue: true };
    }

    // 处理文件导入等待状态
    private async handleFileImportWaiting(userInput: string, currentMessages: Message[]): Promise<CommandExecutionResult> {
        const historyMgmt = this.messages.main.historyManagement;

        if (userInput.startsWith('@')) {
            // 用户通过文件选择器或直接输入了文件路径
            return await this.handleDirectFileImport(userInput, currentMessages);
        } else {
            // 用户输入了其他内容，取消文件导入模式
            this.isWaitingForFileImport = false;
            console.log(chalk.gray(historyMgmt.fileImportCancelled));
            // 继续正常处理用户输入，但不作为命令处理
            return { handled: false };
        }
    }

    // 处理直接文件导入
    private async handleDirectFileImport(userInput: string, currentMessages: Message[]): Promise<CommandExecutionResult> {
        const filePath = userInput.slice(1); // 移除 @ 前缀
        this.isWaitingForFileImport = false; // 重置等待状态
        return await this.importHistoryFromFile(filePath, currentMessages);
    }

    // 处理标准命令
    private async handleStandardCommand(userInput: string, currentMessages: Message[]): Promise<CommandExecutionResult> {
        if (userInput.startsWith('/checkpoint')) {
            return await this.handleCheckpointCommand();
        }

        switch (userInput) {
            case '/export-history':
                return await this.handleExportHistory(currentMessages);

            case '/import-history':
                return this.handleImportHistory();

            case '/edit-history':
                return await this.handleEditHistory(currentMessages);

            case '/clear':
                this.hasExportedHistory = false; // 清空历史时重置导出状态
                return { handled: true, shouldReload: true };

            case '/history': {
                await this.showHistory(currentMessages);
                return { handled: true, shouldContinue: true };
            }

            default:
                return { handled: false };
        }
    }

    // 处理检查点命令
    private async handleCheckpointCommand(): Promise<CommandExecutionResult> {
        const checkpointService = CheckpointService.getInstance();
        const tasks = checkpointService.getCheckpointsByTask();

        if (tasks.size === 0) {
            console.log(chalk.yellow('No checkpoints found.'));
            return { handled: true, shouldContinue: true };
        }

        const taskChoices = Array.from(tasks.entries())
            .sort((a, b) => {
                const timeA = new Date(a[1][0]?.timestamp || 0).getTime();
                const timeB = new Date(b[1][0]?.timestamp || 0).getTime();
                return timeB - timeA;
            })
            .map(([taskId, checkpoints]) => ({
                id: taskId,
                name: this.formatTaskName(checkpoints),
                checkpoints: checkpoints,
            }));

        const specialChoices = [
            { id: 'clear_all', name: '🧹 Clear All Checkpoints' },
            { id: 'close', name: '❌ Close Menu' },
        ];

        const allChoices = [...taskChoices, ...specialChoices];
        let currentIndex = 0;
        let isRunning = true;
        let isFirstRender = true;

        const header = () => {
            console.log(chalk.bold.cyan('=== Checkpoint Manager ==='));
            console.log(chalk.gray('Use UP/DOWN arrows to navigate, ENTER to select, Q to quit.'));
            console.log(chalk.gray('─'.repeat(80)));
            console.log();
        };

        const renderMenu = () => {
            if (!isFirstRender) {
                process.stdout.write('\x1B[?25l');
                const linesToMove = allChoices.length;
                process.stdout.write(`\x1B[${linesToMove}A`);
                process.stdout.write('\x1B[0J');
            }

            allChoices.forEach((choice, index) => {
                const isSelected = index === currentIndex;
                const indicator = isSelected ? chalk.cyan('●') : chalk.gray('○');
                const name = isSelected ? chalk.white.bold(choice.name) : chalk.gray(choice.name);
                console.log(`  ${indicator} ${name}`);
            });

            process.stdout.write('\x1B[?25h');
            isFirstRender = false;
        };

        return new Promise((resolve) => {
            const cleanup = () => {
                isRunning = false;
                process.stdin.removeAllListeners('data');
                if (process.stdin.isTTY) {
                    process.stdin.setRawMode(false);
                }
                process.stdin.pause();
                process.stdout.write('\x1B[?25h'); // Show cursor

                // Clear only the menu UI instead of the whole console
                const headerHeight = 4;
                const menuHeight = allChoices.length;
                const totalHeight = headerHeight + menuHeight;

                // Move cursor up to the start of the header
                process.stdout.write(`\x1B[${totalHeight}A`);
                // Clear from cursor to the end of the screen
                process.stdout.write(`\x1B[0J`);
            };

            const keyHandler = async (key: string) => {
                if (!isRunning) return;

                if (key === '\x1B[A') { // Up
                    currentIndex = (currentIndex - 1 + allChoices.length) % allChoices.length;
                    renderMenu();
                } else if (key === '\x1B[B') { // Down
                    currentIndex = (currentIndex + 1) % allChoices.length;
                    renderMenu();
                } else if (key === '\r' || key === '\n') { // Enter
                    const selection = allChoices[currentIndex].id;
                    cleanup();

                    if (selection === 'close') {
                        // Just exit
                    } else if (selection === 'clear_all') {
                        await checkpointService.clearAllCheckpoints();
                        console.log(chalk.green('\n✅ All checkpoints have been cleared.'));
                    } else {
                        const success = await checkpointService.restoreByTask(selection);
                        if (success) {
                            console.log(chalk.green(`\n✅ Task ${selection} restored successfully.`));
                            console.log(chalk.yellow('It is recommended to restart the application to reload file states.'));
                        } else {
                            console.log(chalk.red(`\n❌ Failed to restore task ${selection}. Check logs for details.`));
                        }
                    }
                    resolve({ handled: true, shouldContinue: true });
                } else if (key === 'q' || key === '\x1b' || key.charCodeAt(0) === 3) { // q, esc, ctrl+c
                    cleanup();
                    resolve({ handled: true, shouldContinue: true });
                }
            };

            if (process.stdin.isTTY) {
                process.stdin.setRawMode(true);
            }
            process.stdin.resume();
            process.stdin.setEncoding('utf8');
            process.stdin.on('data', keyHandler);

            header();
            renderMenu();
        });
    }

    private formatTaskName(checkpoints: Checkpoint[]): string {
        if (!checkpoints || checkpoints.length === 0) return "Invalid Task";
        const first = checkpoints[0];
        const time = new Date(first.timestamp).toLocaleString();
        const fileList = checkpoints.map(c => path.basename(c.originalPath)).join(', ');
        return `${chalk.cyan(time)} - ${first.description.substring(0, 50)}... (${chalk.yellow(checkpoints.length)} files: ${fileList.substring(0, 40)}...)`;
    }

    // 处理导出历史记录
    private async handleExportHistory(currentMessages: Message[]): Promise<CommandExecutionResult> {
        const exportSuccess = await HistoryService.exportHistory(currentMessages, this.messages);
        if (exportSuccess) {
            this.hasExportedHistory = true;
        }
        return { handled: true, shouldContinue: true };
    }

    // 处理导入历史记录命令
    private handleImportHistory(): CommandExecutionResult {
        const historyMgmt = this.messages.main.historyManagement;
        console.log(chalk.cyan(historyMgmt.importInstructions));
        console.log(chalk.white(historyMgmt.importStep1));
        console.log(chalk.white(historyMgmt.importStep2));
        console.log(chalk.white(historyMgmt.importStep3));
        console.log(chalk.gray(historyMgmt.importExample));
        console.log();

        // 设置等待文件导入状态
        this.isWaitingForFileImport = true;
        console.log(chalk.yellow(historyMgmt.fileImportWaiting));
        console.log(chalk.gray(historyMgmt.fileImportWaitingTip));

        return { handled: true, shouldContinue: true };
    }

    // 处理编辑历史记录
    private async handleEditHistory(currentMessages: Message[]): Promise<CommandExecutionResult> {
        if (currentMessages.length === 0) {
            const historyMgmt = this.messages.main.historyManagement;
            console.log(chalk.yellow(historyMgmt.editor.noHistoryToEdit));
            return { handled: true, shouldContinue: true };
        }

        const editor = new HistoryEditor(this.messages, currentMessages);
        const result: HistoryEditorResult = await editor.start();

        if (result.saved) {
            this.hasExportedHistory = false; // 编辑后重置导出状态
            return { handled: true, shouldContinue: true, newMessages: result.messages };
        } else {
            return { handled: true, shouldContinue: true };
        }
    }

    // 从文件导入历史记录
    async importHistoryFromFile(filePath: string, currentMessages: Message[]): Promise<CommandExecutionResult> {
        const importedMessages = await HistoryService.importHistoryFromFile(filePath, currentMessages, this.messages);

        if (importedMessages === 'need_confirm') {
            // 需要用户确认是否覆盖现有历史记录
            const historyMgmt = this.messages.main.historyManagement;
            console.log(chalk.yellow(historyMgmt.importOverwrite));
            console.log(chalk.gray(historyMgmt.overwriteConfirmOptions));

            // 设置等待覆盖确认状态
            this.isWaitingForOverwriteConfirm = true;
            this.pendingImportFilePath = filePath;

            return { handled: true, shouldContinue: true };
        } else if (importedMessages) {
            // 成功导入
            this.hasExportedHistory = false; // 导入新历史后重置导出状态
            const historyMgmt = this.messages.main.historyManagement;
            const successMsg = historyMgmt.importFromFileSuccess
                .replace('{filePath}', filePath)
                .replace('{count}', importedMessages.length.toString());
            console.log(chalk.green(successMsg));
            return { handled: true, shouldContinue: true, newMessages: importedMessages };
        } else {
            // 导入失败
            const historyMgmt = this.messages.main.historyManagement;
            const failedMsg = historyMgmt.importFromFileFailed.replace('{filePath}', filePath);
            console.log(chalk.red(failedMsg));
            return { handled: true, shouldContinue: true };
        }
    }

    // 处理退出前的历史记录导出检查
    async handleExitWithHistoryCheck(currentMessages: Message[]): Promise<'export' | 'skip' | 'cancel'> {
        // 如果已经导出过历史记录，或者没有历史记录，直接退出
        if (this.hasExportedHistory || currentMessages.length === 0) {
            return 'skip';
        }

        const historyMgmt = this.messages.main.historyManagement;

        // 显示提示信息
        console.log(chalk.yellow(historyMgmt.confirmExitPrompt));
        console.log(chalk.gray(historyMgmt.confirmExitOptions));

        return new Promise((resolve) => {
            // 设置原始模式处理单个按键
            if (process.stdin.isTTY) {
                process.stdin.setRawMode(true);
            }
            process.stdin.resume();
            process.stdin.setEncoding('utf8');

            const onKeyPress = async (key: string) => {
                const keyCode = key.charCodeAt(0);

                // 清理输入监听器
                const cleanup = () => {
                    process.stdin.removeAllListeners('data');
                    process.stdin.removeAllListeners('error');
                    process.stdin.removeAllListeners('end');
                    if (process.stdin.isTTY) {
                        try {
                            process.stdin.setRawMode(false);
                        } catch (error) {
                            // 忽略错误
                        }
                    }
                    process.stdin.pause();
                };

                if (keyCode === 89 || keyCode === 121) { // Y 或 y
                    cleanup();
                    process.stdout.write('y\n');
                    try {
                        const exportSuccess = await HistoryService.exportHistory(currentMessages, this.messages);
                        if (exportSuccess) {
                            this.hasExportedHistory = true;
                        }
                        resolve('export');
                    } catch (error) {
                        console.error(chalk.red(historyMgmt.exportFailedDirectExit));
                        resolve('export');
                    }
                } else if (keyCode === 78 || keyCode === 110) { // N 或 n
                    cleanup();
                    process.stdout.write('n\n');
                    this.hasExportedHistory = true; // 用户选择跳过，也标记为已处理
                    resolve('skip');
                } else if (keyCode === 67 || keyCode === 99 || keyCode === 3) { // C 或 c 或 Ctrl+C
                    cleanup();
                    process.stdout.write('c\n');
                    resolve('cancel');
                } else if (keyCode === 13) { // Enter - 默认选择导出
                    cleanup();
                    process.stdout.write('y\n');
                    try {
                        const exportSuccess = await HistoryService.exportHistory(currentMessages, this.messages);
                        if (exportSuccess) {
                            this.hasExportedHistory = true;
                        }
                        resolve('export');
                    } catch (error) {
                        console.error(chalk.red(historyMgmt.exportFailedDirectExit));
                        resolve('export');
                    }
                }
                // 忽略其他按键
            };

            // 错误处理
            const onError = () => {
                process.stdin.removeAllListeners('data');
                process.stdin.removeAllListeners('error');
                process.stdin.removeAllListeners('end');
                if (process.stdin.isTTY) {
                    try {
                        process.stdin.setRawMode(false);
                    } catch (error) {
                        // 忽略错误
                    }
                }
                process.stdin.pause();
                resolve('skip');
            };

            process.stdin.on('data', onKeyPress);
            process.stdin.on('error', onError);
            process.stdin.on('end', onError);
        });
    }

    // 检查是否在等待文件导入
    isWaitingForFileImportState(): boolean {
        return this.isWaitingForFileImport;
    }

    /**
     * 显示历史记录
     */
    async showHistory(messages: Message[]): Promise<void> {
        const historyMessages = languageService.getMessages();

        console.log(chalk.bold.yellow(`\n--- ${historyMessages.main.messages.historyTitle} ---`));
        if (messages.length === 0) {
            console.log(chalk.gray(historyMessages.main.messages.noHistory));
        } else {
            messages.forEach((msg) => {
                const time = msg.timestamp.toLocaleTimeString(historyMessages.main.messages.format.timeLocale, {
                    hour: '2-digit',
                    minute: '2-digit',
                });
                const role = chalk.bold(msg.type.toUpperCase());
                let content = '';
                if (typeof msg.content === 'string') {
                    content = msg.content.length > 100 ? msg.content.substring(0, 97) + '...' : msg.content;
                } else if (msg.tool_calls) {
                    content = `[TOOL CALLS: ${msg.tool_calls.map((tc: any) => tc.function.name).join(', ')}]`;
                } else if (msg.content) {
                    content = '[OBJECT CONTENT]';
                }
                console.log(`${chalk.cyan(time)} [${role}] - ${content}`);
            });

            // 显示Token使用统计
            const stats = await TokenCalculator.getContextUsageStats(messages, '', 0.8);
            const statsMessage = historyMessages.main.messages.tokenUsage.tokenStats
                .replace('{used}', stats.used.toString())
                .replace('{max}', stats.maxAllowed.toString())
                .replace('{percentage}', stats.percentage.toString());

            console.log(chalk.bold.yellow(`\n--- Token Usage ---`));
            console.log(statsMessage);
            if (stats.isNearLimit) {
                console.log(chalk.yellow(historyMessages.main.messages.tokenUsage.nearLimit));
            }
        }
        console.log(chalk.bold.yellow('---------------------\n'));
    }
}