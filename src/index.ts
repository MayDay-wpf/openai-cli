#!/usr/bin/env node

// 抑制 punycode 弃用警告
process.removeAllListeners('warning');
process.on('warning', (warning) => {
  // 忽略 punycode 模块的弃用警告
  if (warning.name === 'DeprecationWarning' && warning.message.includes('punycode')) {
    return;
  }
  // 显示其他警告
  console.warn(warning.message);
});

import { Command } from 'commander';
import { WelcomeScreen } from './ui/screens/welcome';
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