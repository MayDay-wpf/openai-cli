import chalk from 'chalk';
import { Messages } from '../../types/language';
import { Message } from '../../utils/token-calculator';

export interface HistoryEditorResult {
    saved: boolean;
    messages: Message[];
    deletedCount: number;
}

export class HistoryEditor {
    private messages: Messages;
    private originalMessages: Message[];
    private workingMessages: Message[];
    private currentIndex: number = 0;
    private hasChanges: boolean = false;
    private isRunning: boolean = false;
    private isFirstRender: boolean = true;

    constructor(messages: Messages, historyMessages: Message[]) {
        this.messages = messages;
        this.originalMessages = [...historyMessages];
        this.workingMessages = [...historyMessages];
    }

    /**
     * 启动历史记录编辑器
     */
    async start(): Promise<HistoryEditorResult> {
        if (this.workingMessages.length === 0) {
            console.log(chalk.yellow(this.messages.main.historyManagement.editor.noHistoryToEdit));
            return { saved: false, messages: this.originalMessages, deletedCount: 0 };
        }

        // 只保留 user 类型的消息作为可选择的项目
        this.filterUserMessages();

        if (this.workingMessages.length === 0) {
            console.log(chalk.yellow(this.messages.main.historyManagement.editor.noHistoryToEdit));
            return { saved: false, messages: this.originalMessages, deletedCount: 0 };
        }

        this.isRunning = true;
        this.showHeader();
        this.renderMenu();

        return new Promise((resolve) => {
            this.setupKeyListener(resolve);
        });
    }

    /**
     * 筛选出用户消息，并记录它们在原始数组中的位置
     */
    private filterUserMessages(): void {
        const userMessages: (Message & { originalIndex: number })[] = [];
        for (let i = 0; i < this.workingMessages.length; i++) {
            if (this.workingMessages[i].type === 'user') {
                userMessages.push({
                    ...this.workingMessages[i],
                    originalIndex: i // 记录在原始数组中的位置
                });
            }
        }
        this.workingMessages = userMessages as Message[];
    }

    /**
     * 显示编辑器头部信息
     */
    private showHeader(): void {
        console.clear();
        console.log(chalk.bold.cyan('=== ' + this.messages.main.historyManagement.editor.title + ' ==='));
        console.log(chalk.gray(this.messages.main.historyManagement.editor.instructions));
        console.log(chalk.gray('─'.repeat(80)));
        console.log();
        this.showKeyHelp();
        console.log();
    }

    /**
     * 显示按键帮助
     */
    private showKeyHelp(): void {
        const help = this.messages.main.historyManagement.editor.keyHelp;
        console.log(chalk.cyan(help.navigation));
        console.log(chalk.cyan(help.delete));
        console.log(chalk.cyan(help.save));
        console.log(chalk.cyan(help.exit));
    }

    /**
     * 渲染菜单项列表
     */
    private renderMenuItems(): string[] {
        const menuLines: string[] = [];

        for (let i = 0; i < this.workingMessages.length; i++) {
            const message = this.workingMessages[i];
            const isSelected = i === this.currentIndex;

            const timeStr = message.timestamp.toLocaleTimeString(this.messages.main.messages.format.timeLocale, {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });

            // 选择指示器
            const indicator = isSelected ? chalk.cyan('●') : chalk.gray('○');

            // 消息类型标签
            const typeLabel = chalk.bgBlue.white.bold(` ${this.messages.main.historyManagement.editor.userMessage} `);

            // 时间戳
            const timestamp = chalk.blue(` ${timeStr} `);

            // 消息内容（截断长内容）
            const content = message.content.length > 60
                ? message.content.substring(0, 60) + '...'
                : message.content;

            const contentDisplay = isSelected
                ? chalk.white.bold(content)
                : chalk.gray(content);

            menuLines.push(`  ${indicator} ${typeLabel}${timestamp}${contentDisplay}`);
        }

        return menuLines;
    }

    /**
     * 渲染完整菜单
     */
    private renderMenu(): void {
        if (!this.isFirstRender) {
            // 隐藏光标，减少闪烁
            process.stdout.write('\x1B[?25l');

            // 计算需要移动的行数（菜单项数量 + 可能的状态行）
            const linesToMove = this.workingMessages.length + (this.hasChanges ? 2 : 1);

            // 移动到菜单开始位置
            process.stdout.write(`\x1B[${linesToMove}A`);

            // 清除从当前位置到屏幕末尾的内容
            process.stdout.write('\x1B[0J');
        }

        // 批量渲染所有菜单项
        const menuLines = this.renderMenuItems();
        process.stdout.write(menuLines.join('\n') + '\n');

        // 添加空行
        console.log();

        // 显示状态信息
        if (this.hasChanges) {
            const unsavedText = this.messages.main.historyManagement.editor.keyHelp.save.includes('保存')
                ? '有未保存的修改'
                : 'Unsaved changes';
            console.log(chalk.yellow('* ' + unsavedText));
        }

        if (!this.isFirstRender) {
            // 显示光标
            process.stdout.write('\x1B[?25h');
        }

        this.isFirstRender = false;
    }

    /**
     * 设置键盘监听器
     */
    private setupKeyListener(resolve: (result: HistoryEditorResult) => void): void {
        // 隐藏光标以减少闪烁
        process.stdout.write('\x1B[?25l');

        if (process.stdin.isTTY) {
            process.stdin.setRawMode(true);
        }
        process.stdin.resume();
        process.stdin.setEncoding('utf8');

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
            // 恢复光标显示
            process.stdout.write('\x1B[?25h');
        };

        const onKeyPress = async (key: string) => {
            if (!this.isRunning) return;

            const keyCode = key.charCodeAt(0);

            // 处理特殊按键
            if (key === '\x1B[A') { // 上箭头
                this.moveUp();
            } else if (key === '\x1B[B') { // 下箭头
                this.moveDown();
            } else if (key === '\x7f' || key.toLowerCase() === 'd') { // Delete 或 d
                await this.deleteCurrentMessage(resolve);
            } else if (key.toLowerCase() === 's') { // s - 保存
                await this.saveChanges(resolve);
            } else if (key.toLowerCase() === 'q' || key === '\x1b') { // q 或 Esc - 退出
                await this.exitEditor(resolve);
            } else if (keyCode === 3) { // Ctrl+C
                await this.exitEditor(resolve);
            }
        };

        process.stdin.on('data', onKeyPress);
        process.stdin.on('error', cleanup);
        process.stdin.on('end', cleanup);
    }

    /**
     * 向上移动光标
     */
    private moveUp(): void {
        if (this.currentIndex > 0) {
            this.currentIndex--;
        } else {
            this.currentIndex = this.workingMessages.length - 1; // 循环到末尾
        }
        this.renderMenu();
    }

    /**
     * 向下移动光标
     */
    private moveDown(): void {
        if (this.currentIndex < this.workingMessages.length - 1) {
            this.currentIndex++;
        } else {
            this.currentIndex = 0; // 循环到开头
        }
        this.renderMenu();
    }

    /**
     * 删除当前选中的消息
     */
    private async deleteCurrentMessage(resolve: (result: HistoryEditorResult) => void): Promise<void> {
        if (this.workingMessages.length === 0) return;

        const confirmed = await this.confirmDelete();
        if (!confirmed) {
            this.fullRerender();
            return;
        }

        // 删除选中的用户消息
        this.workingMessages.splice(this.currentIndex, 1);
        this.hasChanges = true;

        // 调整光标位置
        if (this.currentIndex >= this.workingMessages.length && this.workingMessages.length > 0) {
            this.currentIndex = this.workingMessages.length - 1;
        }

        // 如果没有消息了，自动保存并退出
        if (this.workingMessages.length === 0) {
            await this.saveChanges(resolve);
            return;
        }

        this.fullRerender();
    }

    /**
     * 完全重新渲染
     */
    private fullRerender(): void {
        this.showHeader();
        this.isFirstRender = true;
        this.renderMenu();
    }

    /**
     * 确认删除操作
     */
    private async confirmDelete(): Promise<boolean> {
        return new Promise((resolve) => {
            console.log();
            console.log(chalk.yellow(this.messages.main.historyManagement.editor.deleteConfirm));
            console.log(chalk.gray(this.messages.main.historyManagement.editor.deleteConfirmOptions));

            if (process.stdin.isTTY) {
                process.stdin.setRawMode(true);
            }

            const onConfirmKey = (key: string) => {
                const keyLower = key.toLowerCase();

                if (keyLower === 'y' || key === '是') {
                    process.stdin.removeListener('data', onConfirmKey);
                    resolve(true);
                } else if (keyLower === 'n' || key === '否') {
                    process.stdin.removeListener('data', onConfirmKey);
                    resolve(false);
                }
                // 忽略其他按键
            };

            process.stdin.on('data', onConfirmKey);
        });
    }

    /**
     * 保存修改
     */
    private async saveChanges(resolve: (result: HistoryEditorResult) => void): Promise<void> {
        this.isRunning = false;

        // 构建最终的消息列表，包括删除用户消息后相应的AI消息
        const finalMessages = this.buildFinalMessages();
        const deletedCount = this.originalMessages.length - finalMessages.length;

        this.cleanup();
        console.clear();

        console.log(chalk.green(this.messages.main.historyManagement.editor.saveSuccess));
        if (deletedCount > 0) {
            const deletedMsg = this.messages.main.historyManagement.editor.deletedCount
                .replace('{count}', deletedCount.toString());
            console.log(chalk.gray(deletedMsg));
        }

        resolve({ saved: true, messages: finalMessages, deletedCount });
    }

    /**
     * 构建最终的消息列表
     */
    private buildFinalMessages(): Message[] {
        const finalMessages: Message[] = [];
        const userMessages = this.workingMessages;

        // 重新构建完整的消息列表，包括相应的AI回复
        for (const userMsg of userMessages) {
            const originalIndex = (userMsg as any).originalIndex;

            // 添加用户消息
            finalMessages.push({
                type: userMsg.type,
                content: userMsg.content,
                timestamp: userMsg.timestamp
            });

            // 查找并添加紧随其后的AI消息
            if (originalIndex + 1 < this.originalMessages.length) {
                const nextMsg = this.originalMessages[originalIndex + 1];
                if (nextMsg.type === 'ai') {
                    finalMessages.push(nextMsg);
                }
            }
        }

        return finalMessages;
    }

    /**
     * 退出编辑器
     */
    private async exitEditor(resolve: (result: HistoryEditorResult) => void): Promise<void> {
        if (this.hasChanges) {
            const shouldSave = await this.confirmSave();
            if (shouldSave === 'save') {
                await this.saveChanges(resolve);
                return;
            } else if (shouldSave === 'cancel') {
                this.fullRerender();
                return;
            }
            // 否则继续退出，不保存
        }

        this.isRunning = false;
        this.cleanup();
        console.clear();

        console.log(chalk.gray(this.messages.main.historyManagement.editor.saveCancel));
        resolve({ saved: false, messages: this.originalMessages, deletedCount: 0 });
    }

    /**
     * 确认是否保存修改
     */
    private async confirmSave(): Promise<'save' | 'exit' | 'cancel'> {
        return new Promise((resolve) => {
            console.log();
            console.log(chalk.yellow(this.messages.main.historyManagement.editor.exitWithoutSave));
            console.log(chalk.gray(this.messages.main.historyManagement.editor.exitWithoutSaveOptions));

            if (process.stdin.isTTY) {
                process.stdin.setRawMode(true);
            }

            const onConfirmKey = (key: string) => {
                const keyLower = key.toLowerCase();

                if (keyLower === 'y' || key === '是') {
                    process.stdin.removeListener('data', onConfirmKey);
                    resolve('exit');
                } else if (keyLower === 'n' || key === '否') {
                    process.stdin.removeListener('data', onConfirmKey);
                    resolve('cancel');
                }
                // 忽略其他按键
            };

            process.stdin.on('data', onConfirmKey);
        });
    }

    /**
     * 清理资源
     */
    private cleanup(): void {
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
        // 恢复光标显示
        process.stdout.write('\x1B[?25h');
    }
} 