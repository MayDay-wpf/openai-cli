import { Messages } from '../../types/language';

export interface Command {
  value: string;
  name: string;
  description: string;
}

export class CommandManager {
  private messages: Messages;
  private commands: Command[];

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
        value: '/init',
        name: mainCommands.init.name,
        description: mainCommands.init.description
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
} 