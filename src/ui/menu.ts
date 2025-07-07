import chalk from 'chalk';
import inquirer from 'inquirer';

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
    // 使用inquirer的rawlist类型来自定义样式
    const customChoices = options.choices.map((choice, index) => ({
      name: this.formatChoice(choice, false),
      value: choice.value,
      short: choice.name
    }));

    const result = await inquirer.prompt([
      {
        type: 'list',
        name: 'selection',
        message: options.message,
        choices: customChoices,
        pageSize: options.choices.length + 2,
        loop: false,
        prefix: '',
        // 自定义选择器样式
        transformer: (input: string, answers: any, options: any) => {
          return input;
        }
      }
    ]);

    return result.selection;
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

    const showMenu = () => {
      // 清除之前的选项显示
      process.stdout.write('\x1B[' + (choices.length + 1) + 'A');
      process.stdout.write('\x1B[0J');

      choices.forEach((choice, index) => {
        const isSelected = index === selectedIndex;
        const circle = isSelected ? chalk.cyan('●') : chalk.gray('○');
        const text = isSelected ? chalk.cyan.bold(choice.name) : chalk.white(choice.name);
        const description = choice.description 
          ? (isSelected ? chalk.cyan(` ${choice.description}`) : chalk.gray(` ${choice.description}`))
          : '';
        
        console.log(`  ${circle} ${text}${description}`);
      });
    };

    return new Promise((resolve) => {
      // 初始显示
      showMenu();

      const stdin = process.stdin;
      stdin.setRawMode(true);
      stdin.resume();
      stdin.setEncoding('utf8');

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
            stdin.setRawMode(false);
            stdin.removeListener('data', keyHandler);
            console.log();
            resolve(choices[selectedIndex].value);
            break;
          case '\u0003': // Ctrl+C
            process.exit();
            break;
        }
      };

      stdin.on('data', keyHandler);
    });
  }
} 