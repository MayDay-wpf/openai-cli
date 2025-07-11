import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { Messages } from '../types/language';
import { Message } from '../utils/token-calculator';

export interface HistoryData {
    version: string;
    exportTime: string;
    messages: Message[];
    metadata?: {
        exportedBy?: string;
        totalMessages?: number;
    };
}

export class HistoryService {
    private static readonly HISTORY_VERSION = '1.0.0';
    private static readonly DEFAULT_FILENAME = 'chat-history.json';

    /**
     * 导出历史记录到JSON文件
     */
    static async exportHistory(messages: Message[], messagesConfig: Messages): Promise<boolean> {
        if (messages.length === 0) {
            console.log(chalk.yellow(messagesConfig.main.historyManagement.noHistory));
            return false;
        }

        try {
            console.log(chalk.cyan(messagesConfig.main.historyManagement.exportingHistory));

            // 获取用户指定的保存路径
            const savePath = await this.getSavePath(messagesConfig);
            if (!savePath) {
                console.log(chalk.yellow(messagesConfig.main.historyManagement.importCancel));
                return false;
            }

            // 准备导出数据
            const historyData: HistoryData = {
                version: this.HISTORY_VERSION,
                exportTime: new Date().toISOString(),
                messages: messages.map(msg => ({
                    type: msg.type,
                    content: msg.content,
                    timestamp: msg.timestamp
                })),
                metadata: {
                    exportedBy: 'OpenAI CLI Agent',
                    totalMessages: messages.length
                }
            };

            // 确保目录存在
            const dir = path.dirname(savePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            // 写入文件
            fs.writeFileSync(savePath, JSON.stringify(historyData, null, 2), 'utf-8');

            console.log(chalk.green(`${messagesConfig.main.historyManagement.exportSuccess}: ${savePath}`));
            return true;
        } catch (error: any) {
            console.error(chalk.red(`${messagesConfig.main.historyManagement.exportFailed}: ${error.message}`));
            return false;
        }
    }

    /**
     * 从JSON文件导入历史记录（旧方法，保持兼容性）
     */
    static async importHistory(currentMessages: Message[], messagesConfig: Messages): Promise<Message[] | null> {
        console.log(chalk.yellow(messagesConfig.main.historyManagement.fileSelectPrompt));
        console.log(chalk.gray(messagesConfig.main.historyManagement.fileSearchTip));
        return null; // 返回 null 表示需要用户选择文件
    }

    /**
     * 从JSON文件导入历史记录
     */
    static async importHistoryFromFile(filePath: string, currentMessages: Message[], messagesConfig: Messages): Promise<Message[] | 'need_confirm' | null> {
        try {
            // 检查文件是否存在
            if (!fs.existsSync(filePath)) {
                console.error(chalk.red(messagesConfig.main.historyManagement.fileNotFound));
                return null;
            }

            // 读取并解析文件
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            let historyData: HistoryData;

            try {
                historyData = JSON.parse(fileContent);
            } catch (parseError) {
                console.error(chalk.red(messagesConfig.main.historyManagement.invalidFormat));
                return null;
            }

            // 验证数据格式
            if (!this.validateHistoryData(historyData)) {
                console.error(chalk.red(messagesConfig.main.historyManagement.invalidFormat));
                return null;
            }

            // 如果当前有历史记录，返回需要确认状态
            if (currentMessages.length > 0) {
                return 'need_confirm';
            }

            // 转换导入的消息
            const importedMessages: Message[] = historyData.messages.map(msg => ({
                type: msg.type,
                content: msg.content,
                timestamp: new Date(msg.timestamp)
            }));

            const successMsg = `${messagesConfig.main.historyManagement.importSuccess} (${importedMessages.length} ${messagesConfig.main.historyManagement.messageCount})`;
            console.log(chalk.green(successMsg));
            return importedMessages;
        } catch (error: any) {
            console.error(chalk.red(`${messagesConfig.main.historyManagement.importFailed}: ${error.message}`));
            return null;
        }
    }

    /**
     * 强制导入历史记录（覆盖现有记录）
     */
    static async forceImportHistoryFromFile(filePath: string, messagesConfig: Messages): Promise<Message[] | null> {
        try {
            // 检查文件是否存在
            if (!fs.existsSync(filePath)) {
                console.error(chalk.red(messagesConfig.main.historyManagement.fileNotFound));
                return null;
            }

            // 读取并解析文件
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            let historyData: HistoryData;

            try {
                historyData = JSON.parse(fileContent);
            } catch (parseError) {
                console.error(chalk.red(messagesConfig.main.historyManagement.invalidFormat));
                return null;
            }

            // 验证数据格式
            if (!this.validateHistoryData(historyData)) {
                console.error(chalk.red(messagesConfig.main.historyManagement.invalidFormat));
                return null;
            }

            // 转换导入的消息
            const importedMessages: Message[] = historyData.messages.map(msg => ({
                type: msg.type,
                content: msg.content,
                timestamp: new Date(msg.timestamp)
            }));

            const successMsg = `${messagesConfig.main.historyManagement.importSuccess} (${importedMessages.length} ${messagesConfig.main.historyManagement.messageCount})`;
            console.log(chalk.green(successMsg));
            return importedMessages;
        } catch (error: any) {
            console.error(chalk.red(`${messagesConfig.main.historyManagement.importFailed}: ${error.message}`));
            return null;
        }
    }

    /**
     * 询问用户是否在退出前导出历史记录
     */
    static async confirmExportBeforeExit(messages: Message[], messagesConfig: Messages): Promise<'export' | 'skip' | 'cancel'> {
        if (messages.length === 0) {
            return 'skip';
        }

        // 显示提示信息
        console.log(chalk.yellow(messagesConfig.main.historyManagement.confirmExitPrompt));
        console.log(chalk.gray(messagesConfig.main.historyManagement.confirmExitOptions));

        // 返回 'export' 作为默认选择，让调用方决定如何处理
        return 'export';
    }

    /**
     * 获取保存路径
     */
    private static async getSavePath(messagesConfig: Messages): Promise<string | null> {
        return new Promise((resolve) => {
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });

            // 默认文件名带时间戳
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const defaultPath = path.join(process.cwd(), `chat-history-${timestamp}.json`);

            console.log(chalk.gray(`${messagesConfig.main.historyManagement.defaultSavePath}: ${defaultPath}`));
            rl.question(chalk.cyan(`${messagesConfig.main.historyManagement.fileSelectPrompt} (${messagesConfig.main.historyManagement.enterDefaultPrompt}): `), (answer) => {
                rl.close();
                const userPath = answer.trim();

                if (!userPath) {
                    resolve(defaultPath);
                } else {
                    // 如果用户只输入了文件名（没有路径），则保存到当前目录
                    const finalPath = path.isAbsolute(userPath) ? userPath : path.join(process.cwd(), userPath);
                    // 如果没有扩展名，自动添加 .json
                    const pathWithExt = path.extname(finalPath) ? finalPath : `${finalPath}.json`;
                    resolve(pathWithExt);
                }
            });
        });
    }

    /**
     * 获取导入文件路径
     */
    private static async getImportPath(messagesConfig: Messages): Promise<string | null> {
        return new Promise((resolve) => {
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });

            rl.question(chalk.cyan(`${messagesConfig.main.historyManagement.fileSelectPrompt}: `), (answer) => {
                rl.close();
                const userPath = answer.trim();

                if (!userPath) {
                    resolve(null);
                } else {
                    // 如果用户只输入了文件名（没有路径），则从当前目录查找
                    const finalPath = path.isAbsolute(userPath) ? userPath : path.join(process.cwd(), userPath);
                    resolve(finalPath);
                }
            });
        });
    }

    /**
     * 确认是否覆盖现有历史记录
     */
    private static async confirmOverwrite(messagesConfig: Messages): Promise<boolean> {
        return new Promise((resolve) => {
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });

            console.log(chalk.yellow(messagesConfig.main.historyManagement.importOverwrite));
            rl.question(chalk.cyan('(y/n): '), (answer) => {
                rl.close();
                const choice = answer.toLowerCase().trim();
                resolve(choice === 'y' || choice === 'yes');
            });
        });
    }

    /**
     * 验证历史数据格式
     */
    private static validateHistoryData(data: any): data is HistoryData {
        return (
            data &&
            typeof data === 'object' &&
            typeof data.version === 'string' &&
            typeof data.exportTime === 'string' &&
            Array.isArray(data.messages) &&
            data.messages.every((msg: any) =>
                msg &&
                typeof msg === 'object' &&
                (msg.type === 'user' || msg.type === 'ai') &&
                typeof msg.content === 'string' &&
                (typeof msg.timestamp === 'string' || msg.timestamp instanceof Date)
            )
        );
    }
} 