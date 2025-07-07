#!/usr/bin/env node

import { Command } from 'commander';
import { WelcomeScreen } from './ui/welcome';
const packageJson = require('../package.json');

const program = new Command();

program
  .name('openai-cli')
  .description('OpenAI CLI Coding Agent - 您的智能编程助手')
  .version(packageJson.version);

program
  .action(async () => {
    const welcome = new WelcomeScreen();
    await welcome.show();
  });

program.parse(); 