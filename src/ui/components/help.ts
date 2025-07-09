import chalk from 'chalk';
import boxen from 'boxen';
import { Messages } from '../../types/language';
import { Command } from './commands';

export class HelpManager {
  private messages: Messages;

  constructor(messages: Messages) {
    this.messages = messages;
  }

  showHelp(commands: Command[]): void {
    const help = this.messages.main.help;
    const smartInput = help.smartInput;
    
    const commandList = commands.map(cmd => 
      `${chalk.cyan(cmd.name)} - ${chalk.gray(cmd.description)}`
    ).join('\n');

    const helpContent = 
      chalk.bold(help.availableCommands + '\n\n') +
      commandList + '\n\n' +
      chalk.yellow(smartInput.title + '\n') +
      chalk.gray('• ' + smartInput.showMenu + '\n') +
      chalk.gray('• ' + smartInput.matchCommands + '\n') +
      chalk.gray('• ' + smartInput.directExecute + '\n') +
      chalk.gray('• ' + smartInput.fileSearch + '\n') +
      chalk.gray('• ' + smartInput.showFileSearch + '\n') +
      chalk.gray('• ' + smartInput.matchFileSearch + '\n') +
      chalk.gray('• ' + smartInput.navigation);

    const helpBox = boxen(helpContent, {
      padding: 1,
      margin: { top: 1, bottom: 1, left: 0, right: 0 },
      borderStyle: 'round',
      borderColor: 'blue',
      title: help.title,
      titleAlignment: 'center'
    });
    
    process.stdout.write(helpBox + '\n');
  }

  updateLanguage(messages: Messages): void {
    this.messages = messages;
  }
} 