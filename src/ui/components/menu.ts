import { select } from '@inquirer/prompts';
import chalk from 'chalk';

export interface MenuChoice {
    name: string;
    value: string;
    description?: string;
}

export interface MenuOptions {
    message: string;
    choices: MenuChoice[];
}

export class GeminiStyleMenu {
    static async show(options: MenuOptions): Promise<string> {
        // 使用新的@inquirer/prompts的select
        const choices = options.choices.map(choice => ({
            name: this.formatChoice(choice, false),
            value: choice.value,
            description: choice.description
        }));

        const result = await select({
            message: options.message,
            choices
        });

        return result;
    }

    private static formatChoice(choice: MenuChoice, isSelected: boolean): string {
        const circle = isSelected ? '●' : '○';
        const textColor = isSelected ? chalk.cyan : chalk.white;
        const circleColor = isSelected ? chalk.cyan : chalk.gray;

        let formatted = `${circleColor(circle)} ${textColor(choice.name)}`;

        if (choice.description) {
            formatted += chalk.gray(` - ${choice.description}`);
        }

        return formatted;
    }
}

// 扩展inquirer的样式
export class InteractiveMenu {
    static async show(options: MenuOptions): Promise<string> {
        console.log(chalk.white(options.message));
        console.log();

        let selectedIndex = 0;
        const choices = options.choices;
        let isFirstRender = true;

        const renderMenu = (): string[] => {
            return choices.map((choice, index) => {
                const isSelected = index === selectedIndex;
                const circle = isSelected ? chalk.cyan('●') : chalk.gray('○');
                const text = isSelected ? chalk.cyan.bold(choice.name) : chalk.white(choice.name);
                const description = choice.description
                    ? (isSelected ? chalk.cyan(` ${choice.description}`) : chalk.gray(` ${choice.description}`))
                    : '';

                return `  ${circle} ${text}${description}`;
            });
        };

        const showMenu = () => {
            if (!isFirstRender) {
                // 隐藏光标，减少闪烁
                process.stdout.write('\x1B[?25l');
                // 移动到菜单开始位置
                process.stdout.write('\x1B[' + choices.length + 'A');
                // 清除从当前位置到屏幕末尾的内容
                process.stdout.write('\x1B[0J');
            }

            // 批量渲染所有菜单项
            const menuLines = renderMenu();
            process.stdout.write(menuLines.join('\n') + '\n');

            if (!isFirstRender) {
                // 显示光标
                process.stdout.write('\x1B[?25h');
            }

            isFirstRender = false;
        };

        return new Promise((resolve) => {
            // 隐藏光标以减少闪烁
            process.stdout.write('\x1B[?25l');

            // 初始显示
            showMenu();

            const stdin = process.stdin;
            stdin.setRawMode(true);
            stdin.resume();
            stdin.setEncoding('utf8');

            const cleanup = () => {
                stdin.setRawMode(false);
                stdin.removeListener('data', keyHandler);
                // 恢复光标显示
                process.stdout.write('\x1B[?25h');
            };

            const keyHandler = (key: string) => {
                switch (key) {
                    case '\u001B[A': // 上箭头
                        selectedIndex = selectedIndex > 0 ? selectedIndex - 1 : choices.length - 1;
                        showMenu();
                        break;
                    case '\u001B[B': // 下箭头
                        selectedIndex = selectedIndex < choices.length - 1 ? selectedIndex + 1 : 0;
                        showMenu();
                        break;
                    case '\r': // 回车
                    case '\n':
                        cleanup();
                        console.log();
                        resolve(choices[selectedIndex].value);
                        break;
                    case '\u0003': // Ctrl+C
                        cleanup();
                        process.exit();
                        break;
                }
            };

            stdin.on('data', keyHandler);
        });
    }
} 