import chalk from 'chalk';

export interface NativeInputOptions {
    message: string;
    default?: string;
    validate?: (input: string) => string | boolean;
    transform?: (input: string) => string;
    mask?: boolean; // 是否隐藏输入内容（如密码）
}

export class NativeInput {
    /**
     * 原生输入方法，兼容InteractiveMenu的stdin状态管理
     */
    static async prompt(options: NativeInputOptions): Promise<string> {
        return new Promise((resolve, reject) => {
            // 显示提示信息
            process.stdout.write(chalk.white(options.message));
            if (options.default) {
                process.stdout.write(chalk.gray(` (${options.default})`));
            }
            process.stdout.write(' ');

            let inputBuffer = '';
            let isCompleted = false;

            // 确保stdin处于正确状态
            if (process.stdin.isTTY) {
                process.stdin.setRawMode(true);
            }
            process.stdin.resume();
            process.stdin.setEncoding('utf8');

            const cleanup = () => {
                process.stdin.removeListener('data', keyHandler);
                process.stdin.removeListener('error', errorHandler);
                if (process.stdin.isTTY) {
                    try {
                        process.stdin.setRawMode(false);
                    } catch (error) {
                        // 忽略错误
                    }
                }
                process.stdin.pause();
            };

            const errorHandler = (error: Error) => {
                if (!isCompleted) {
                    isCompleted = true;
                    cleanup();
                    reject(error);
                }
            };

            const validateAndComplete = (input: string) => {
                const finalInput = input.trim() || options.default || '';

                // 验证输入
                if (options.validate) {
                    const validationResult = options.validate(finalInput);
                    if (validationResult !== true) {
                        const errorMessage = typeof validationResult === 'string' ? validationResult : '输入无效';
                        process.stdout.write('\n' + chalk.red(`✗ ${errorMessage}\n`));
                        process.stdout.write(chalk.white(options.message));
                        if (options.default) {
                            process.stdout.write(chalk.gray(` (${options.default})`));
                        }
                        process.stdout.write(' ');
                        inputBuffer = '';
                        return false;
                    }
                }

                // 转换输入
                const transformedInput = options.transform ? options.transform(finalInput) : finalInput;

                process.stdout.write('\n');
                cleanup();
                resolve(transformedInput);
                return true;
            };

            const keyHandler = (key: string) => {
                if (isCompleted) return;

                const keyCode = key.charCodeAt(0);

                switch (keyCode) {
                    case 3: // Ctrl+C
                        isCompleted = true;
                        process.stdout.write('\n');
                        cleanup();
                        reject(new Error('用户取消输入'));
                        break;

                    case 13: // Enter
                        isCompleted = true;
                        validateAndComplete(inputBuffer);
                        break;

                    case 127: // Backspace
                    case 8:   // Backspace (some terminals)
                        if (inputBuffer.length > 0) {
                            inputBuffer = inputBuffer.slice(0, -1);
                            // 清除当前行并重新显示
                            process.stdout.write('\r');
                            process.stdout.write(' '.repeat(200)); // 清除行
                            process.stdout.write('\r');
                            process.stdout.write(chalk.white(options.message));
                            if (options.default) {
                                process.stdout.write(chalk.gray(` (${options.default})`));
                            }
                            process.stdout.write(' ');
                            if (options.mask) {
                                process.stdout.write('*'.repeat(inputBuffer.length));
                            } else {
                                process.stdout.write(inputBuffer);
                            }
                        }
                        break;

                    case 27: // ESC
                        isCompleted = true;
                        process.stdout.write('\n');
                        cleanup();
                        reject(new Error('用户取消输入'));
                        break;

                    default:
                        // 普通字符输入
                        if (keyCode >= 32 && keyCode <= 126) {
                            inputBuffer += key;
                            if (options.mask) {
                                process.stdout.write('*');
                            } else {
                                process.stdout.write(key);
                            }
                        }
                        break;
                }
            };

            process.stdin.on('data', keyHandler);
            process.stdin.on('error', errorHandler);
        });
    }

    /**
     * 简化的输入方法
     */
    static async text(message: string, defaultValue?: string): Promise<string> {
        return this.prompt({
            message,
            default: defaultValue
        });
    }

    /**
     * 密码输入方法
     */
    static async password(message: string): Promise<string> {
        return this.prompt({
            message,
            mask: true
        });
    }

    /**
     * 数字输入方法
     */
    static async number(message: string, defaultValue?: number, min?: number, max?: number): Promise<number> {
        const result = await this.prompt({
            message,
            default: defaultValue?.toString(),
            validate: (input: string) => {
                const num = parseInt(input.trim());
                if (isNaN(num)) {
                    return '请输入有效的数字';
                }
                if (min !== undefined && num < min) {
                    return `数字不能小于 ${min}`;
                }
                if (max !== undefined && num > max) {
                    return `数字不能大于 ${max}`;
                }
                return true;
            }
        });
        return parseInt(result);
    }

    /**
     * URL输入方法
     */
    static async url(message: string, defaultValue?: string): Promise<string> {
        return this.prompt({
            message,
            default: defaultValue,
            validate: (input: string) => {
                if (!input.trim()) {
                    return '请输入URL';
                }
                try {
                    new URL(input.trim());
                    return true;
                } catch {
                    return '请输入有效的URL地址';
                }
            }
        });
    }
} 