import axios from 'axios';
import chalk from 'chalk';
import { spawn } from 'child_process';
import { InteractiveMenu } from '../ui/components/menu';
import { languageService } from './language';

const packageJson = require('../../package.json');

export interface UpdateInfo {
    hasUpdate: boolean;
    currentVersion: string;
    latestVersion: string;
    packageName: string;
}

export class UpdateChecker {
    private readonly packageName: string = packageJson.name;
    private readonly currentVersion: string = packageJson.version;
    private readonly npmRegistryUrl = 'https://registry.npmjs.org';

    /**
     * 检查是否有可用的更新
     */
    async checkForUpdates(): Promise<UpdateInfo> {
        try {
            const response = await axios.get(
                `${this.npmRegistryUrl}/${this.packageName}/latest`,
                {
                    timeout: 5000,
                    headers: {
                        'Accept': 'application/json'
                    }
                }
            );

            const latestVersion = response.data.version;
            const hasUpdate = this.compareVersions(this.currentVersion, latestVersion) < 0;

            return {
                hasUpdate,
                currentVersion: this.currentVersion,
                latestVersion,
                packageName: this.packageName
            };
        } catch (error) {
            // 如果网络错误或其他问题，默认认为没有更新
            return {
                hasUpdate: false,
                currentVersion: this.currentVersion,
                latestVersion: this.currentVersion,
                packageName: this.packageName
            };
        }
    }

    /**
     * 显示更新提示并获取用户选择
     */
    async showUpdatePrompt(updateInfo: UpdateInfo): Promise<boolean> {
        const messages = languageService.getMessages();
        const updateCheck = messages.welcome.updateCheck;

        console.log();
        console.log('  ' + chalk.yellow.bold(updateCheck.newVersionAvailable));
        console.log('  ' + chalk.gray(updateCheck.currentVersion + ': ') + chalk.white(updateInfo.currentVersion));
        console.log('  ' + chalk.gray(updateCheck.latestVersion + ': ') + chalk.green.bold(updateInfo.latestVersion));
        console.log();
        console.log('  ' + chalk.cyan(updateCheck.updateCommand));
        console.log('  ' + chalk.gray(`npm install -g ${updateInfo.packageName}`));
        console.log();

        const choices = [
            {
                name: updateCheck.updateNow,
                value: 'yes',
                description: updateCheck.updateDescription
            },
            {
                name: updateCheck.skipUpdate,
                value: 'no',
                description: updateCheck.skipDescription
            }
        ];

        const choice = await InteractiveMenu.show({
            message: updateCheck.updatePrompt,
            choices
        });

        return choice === 'yes';
    }

    /**
     * 执行更新命令
     */
    async performUpdate(): Promise<void> {
        const messages = languageService.getMessages();
        const updateCheck = messages.welcome.updateCheck;

        console.log();
        console.log('  ' + chalk.blue(updateCheck.updating));
        console.log();

        try {
            // 检测操作系统来选择合适的命令
            const isWindows = process.platform === 'win32';
            const npmCommand = isWindows ? 'npm.cmd' : 'npm';

            // 执行 npm install -g 命令
            const result = await this.executeNpmInstall(npmCommand);

            if (result.success) {
                console.log('  ' + chalk.green.bold(updateCheck.updateSuccess));
                console.log('  ' + chalk.gray(updateCheck.updateInstructions));
                console.log();

                // 提示用户重启
                console.log('  ' + chalk.yellow.bold(updateCheck.restartRequired));
                console.log('  ' + chalk.gray(updateCheck.restartInstructions));
                console.log();
            } else {
                console.log('  ' + chalk.red.bold(updateCheck.updateFailed));
                console.log('  ' + chalk.gray(updateCheck.errorDetails + ': ' + result.error));
                console.log();
                console.log('  ' + chalk.yellow(updateCheck.manualUpdate));
                console.log('  ' + chalk.gray(`npm install -g ${this.packageName}`));
                console.log();
            }
        } catch (error) {
            console.log('  ' + chalk.red.bold(updateCheck.updateFailed));
            console.log('  ' + chalk.gray(updateCheck.errorDetails + ': ' + (error as Error).message));
            console.log();
            console.log('  ' + chalk.yellow(updateCheck.manualUpdate));
            console.log('  ' + chalk.gray(`npm install -g ${this.packageName}`));
            console.log();
        }
    }

    /**
     * 执行npm install命令
     */
    private async executeNpmInstall(npmCommand: string): Promise<{ success: boolean; error?: string }> {
        return new Promise((resolve) => {
            const args = ['install', '-g', this.packageName];
            const child = spawn(npmCommand, args, {
                stdio: ['inherit', 'pipe', 'pipe'],
                shell: true
            });

            let output = '';
            let errorOutput = '';

            // 实时显示输出
            child.stdout?.on('data', (data) => {
                const text = data.toString();
                output += text;
                // 显示npm的输出，但加上缩进
                process.stdout.write('  ' + text.replace(/\n/g, '\n  '));
            });

            child.stderr?.on('data', (data) => {
                const text = data.toString();
                errorOutput += text;
                // 错误信息也显示，但用红色
                process.stdout.write('  ' + chalk.red(text.replace(/\n/g, '\n  ')));
            });

            child.on('close', (code) => {
                console.log(); // 添加换行
                if (code === 0) {
                    resolve({ success: true });
                } else {
                    resolve({
                        success: false,
                        error: errorOutput || `Process exited with code ${code}`
                    });
                }
            });

            child.on('error', (error) => {
                resolve({
                    success: false,
                    error: error.message
                });
            });
        });
    }

    /**
     * 比较两个版本号
     * @param current 当前版本
     * @param latest 最新版本
     * @returns -1: current < latest, 0: equal, 1: current > latest
     */
    private compareVersions(current: string, latest: string): number {
        const currentParts = current.split('.').map(Number);
        const latestParts = latest.split('.').map(Number);

        for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
            const currentPart = currentParts[i] || 0;
            const latestPart = latestParts[i] || 0;

            if (currentPart < latestPart) return -1;
            if (currentPart > latestPart) return 1;
        }

        return 0;
    }
}

export const updateChecker = new UpdateChecker(); 