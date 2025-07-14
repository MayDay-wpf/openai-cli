import chalk from 'chalk';
import { highlight } from 'cli-highlight';
import { languageService } from '../../services/language';

/**
 * 流式渲染器，用于处理流式输入并进行美观输出
 */
export class StreamRenderer {
    private buffer: string = '';
    private isInCodeBlock: boolean = false;
    private codeBlockLanguage: string = '';
    private codeBlockContent: string = '';
    private currentLine: string = '';
    private codeLineNumber: number = 1;

    // 为 cli-highlight 自定义主题，以提高在深色和浅色终端上的可读性
    private highlightTheme = {
        keyword: chalk.blueBright,
        built_in: chalk.cyanBright,
        type: chalk.cyanBright.dim,
        literal: chalk.blueBright,
        number: chalk.greenBright,
        regexp: chalk.redBright,
        string: chalk.redBright,
        subst: chalk.redBright,
        symbol: chalk.redBright,
        class: chalk.blueBright,
        function: chalk.yellowBright,
        title: chalk.blueBright,
        params: chalk.redBright,
        comment: chalk.green,
        doctag: chalk.green,
        meta: chalk.gray,
        'meta-keyword': chalk.gray,
        'meta-string': chalk.gray,
        section: chalk.blueBright,
        tag: chalk.gray,
        name: chalk.blueBright,
        'builtin-name': chalk.blueBright,
        attr: chalk.cyanBright,
        attribute: chalk.cyanBright,
        variable: chalk.blueBright,
        bullet: chalk.redBright,
        code: chalk.redBright,
        emphasis: chalk.italic,
        strong: chalk.bold,
        formula: chalk.redBright,
        link: chalk.underline,
        quote: chalk.green,
        'selector-attr': chalk.redBright,
        'selector-class': chalk.blueBright,
        'selector-id': chalk.blueBright,
        'selector-pseudo': chalk.blueBright,
        'selector-tag': chalk.blueBright,
        template_variable: chalk.blueBright,
        'template-tag': chalk.blueBright,
        addition: chalk.green,
        deletion: chalk.red,
        default: chalk.white,
    };

    // 支持的语言列表（常见的编程语言）
    private supportedLanguages = new Set([
        'javascript', 'js', 'typescript', 'ts', 'python', 'py', 'java',
        'cpp', 'c++', 'c', 'csharp', 'cs', 'php', 'ruby', 'go',
        'rust', 'swift', 'kotlin', 'scala', 'sql', 'html', 'css',
        'scss', 'sass', 'less', 'xml', 'json', 'yaml', 'yml',
        'bash', 'sh', 'shell', 'powershell', 'dockerfile', 'makefile',
        'perl', 'lua', 'r', 'matlab', 'objective-c', 'dart', 'elixir',
        'erlang', 'haskell', 'clojure', 'groovy', 'actionscript'
    ]);

    /**
     * 检查语言是否被支持，如果不支持则返回默认配置
     */
    private checkLanguageSupport(language: string): { isSupported: boolean; fallbackLanguage?: string } {
        if (!language || language.trim() === '') {
            return { isSupported: false };
        }

        const normalizedLang = language.toLowerCase().trim();

        // 处理一些特殊的语言别名
        const languageAliases: { [key: string]: string } = {
            'vue': 'html',  // Vue文件可以用HTML高亮作为回退
            'jsx': 'javascript',
            'tsx': 'typescript',
            'vue.js': 'html',
            'vuejs': 'html',
            'svelte': 'html',
            'angular': 'typescript',
            'react': 'javascript'
        };

        // 检查是否有别名映射
        if (languageAliases[normalizedLang]) {
            return { isSupported: true, fallbackLanguage: languageAliases[normalizedLang] };
        }

        // 检查是否直接支持
        if (this.supportedLanguages.has(normalizedLang)) {
            return { isSupported: true };
        }

        return { isSupported: false };
    }

    /**
     * 处理流式输入的文本块
     */
    processChunk(chunk: string): string {
        let output = '';
        this.buffer += chunk;

        // 按换行符分割处理
        const lines = this.buffer.split('\n');

        // 保留最后一行（可能不完整）
        this.buffer = lines.pop() || '';

        // 处理完整的行
        for (const line of lines) {
            output += this.processLine(line + '\n');
        }

        return output;
    }

    /**
 * 处理单行文本
 */
    private processLine(line: string): string {
        const cleanLine = line.replace('\n', '');

        // 检测代码块开始/结束
        if (cleanLine.startsWith('```')) {
            if (!this.isInCodeBlock) {
                // 代码块开始
                this.isInCodeBlock = true;
                this.codeBlockLanguage = cleanLine.substring(3).trim();
                this.codeBlockContent = '';
                this.codeLineNumber = 1;

                // 显示代码块头部
                const messages = languageService.getMessages();
                const language = this.codeBlockLanguage || messages.main.messages.codeBlock.unknownLanguage;
                const terminalWidth = process.stdout.columns || 120;
                const languageLabel = ` ${language.toUpperCase()} `;
                const remainingWidth = terminalWidth - languageLabel.length;

                return chalk.bgBlackBright.whiteBright.bold(languageLabel) + chalk.gray('─'.repeat(Math.max(0, remainingWidth))) + '\n';
            } else {
                // 代码块结束
                this.isInCodeBlock = false;
                this.codeBlockContent = '';
                this.codeBlockLanguage = '';

                // 显示代码块底部
                const terminalWidth = process.stdout.columns || 120;
                return chalk.gray('─'.repeat(terminalWidth)) + '\n';
            }
        }

        if (this.isInCodeBlock) {
            // 在代码块内，添加行号和背景色
            const lineNum = this.codeLineNumber.toString().padStart(3, ' ');
            const highlightedCode = this.highlightCodeLine(cleanLine, this.codeBlockLanguage);
            this.codeLineNumber++;

            // 获取终端宽度，默认120列
            const terminalWidth = process.stdout.columns || 120;
            const lineNumberWidth = 5; // 行号部分宽度 " 123 "
            const availableWidth = terminalWidth - lineNumberWidth;

            // 计算实际字符长度（去除ANSI颜色代码）
            const stripAnsi = (str: string) => str.replace(/\x1b\[[0-9;]*m/g, '');
            const actualCodeLength = stripAnsi(highlightedCode).length;

            // 确保填充到正确宽度
            const paddingNeeded = Math.max(0, availableWidth - actualCodeLength);
            const paddedCode = highlightedCode + ' '.repeat(paddingNeeded);

            // 更改为更通用的颜色方案，以兼容亮色和暗色主题
            return chalk.bgBlackBright.whiteBright.bold(` ${lineNum} `) +
                paddedCode + '\n';
        }

        // 普通文本行的美化处理
        return this.formatRegularLine(cleanLine) + '\n';
    }

    /**
     * 代码高亮（完整代码块）
     */
    private highlightCode(code: string, language: string): string {
        const languageCheck = this.checkLanguageSupport(language);

        try {
            if (languageCheck.isSupported) {
                const targetLanguage = languageCheck.fallbackLanguage || language;
                return highlight(code, { language: targetLanguage, theme: this.highlightTheme });
            } else {
                // 不支持的语言使用黄色高亮
                return chalk.yellow(code);
            }
        } catch (error) {
            // 如果高亮失败，也使用黄色高亮
            return chalk.yellow(code);
        }
    }

    /**
     * 单行代码高亮
     */
    private highlightCodeLine(codeLine: string, language: string): string {
        const languageCheck = this.checkLanguageSupport(language);

        try {
            if (languageCheck.isSupported) {
                const targetLanguage = languageCheck.fallbackLanguage || language;
                return highlight(codeLine, { language: targetLanguage, theme: this.highlightTheme });
            } else {
                // 不支持的语言使用黄色高亮
                return chalk.yellow(codeLine);
            }
        } catch (error) {
            // 如果高亮失败，也使用黄色高亮
            return chalk.yellow(codeLine);
        }
    }

    /**
     * 格式化普通文本行
     */
    private formatRegularLine(line: string): string {
        const messages = languageService.getMessages();

        // 处理标题
        if (line.startsWith('# ')) {
            return chalk.bold.cyan(line);
        } else if (line.startsWith('## ')) {
            return chalk.bold.blue(line);
        } else if (line.startsWith('### ')) {
            return chalk.bold.magenta(line);
        } else if (line.startsWith('#### ')) {
            return chalk.bold.yellow(line);
        }

        // 处理列表项
        if (line.match(/^[\s]*[-*+]\s/)) {
            return chalk.green(line);
        }

        // 处理数字列表
        if (line.match(/^[\s]*\d+\.\s/)) {
            return chalk.cyan(line);
        }

        // 处理行内代码
        line = line.replace(/`([^`]+)`/g, (match, code) => {
            return chalk.yellow.bgBlack(` ${code} `);
        });

        // 处理加粗文本
        line = line.replace(/\*\*([^*]+)\*\*/g, (match, text) => {
            return chalk.bold(text);
        });

        // 处理斜体文本
        line = line.replace(/\*([^*]+)\*/g, (match, text) => {
            return chalk.italic(text);
        });

        // 处理链接
        line = line.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
            return chalk.blue.underline(text) + chalk.dim(` (${url})`);
        });

        // 粗体和斜体
        line = line.replace(/\*\*\*([^\*]+)\*\*\*/g, chalk.bold.italic('$1'));
        line = line.replace(/\*\*([^\*]+)\*\*/g, chalk.bold('$1'));
        line = line.replace(/\*([^\*]+)\*/g, chalk.italic('$1'));

        return line;
    }

    /**
     * 获取MIME类型
     */
    private getMimeType(extension: string): string | null {
        const mimeTypes: { [key: string]: string } = {
            '.png': 'image/png',
            '.jpeg': 'image/jpeg',
            '.jpg': 'image/jpeg',
            '.webp': 'image/webp',
            '.gif': 'image/gif',
        };
        return mimeTypes[extension] || null;
    }

    /**
 * 完成处理，处理缓冲区中剩余的内容
 */
    finalize(): string {
        if (this.buffer.length > 0) {
            const result = this.processLine(this.buffer + '\n');
            this.buffer = '';
            return result;
        }

        // 如果还在代码块中，重置状态（因为现在是按行处理的）
        if (this.isInCodeBlock) {
            this.isInCodeBlock = false;
            this.codeBlockContent = '';
            this.codeBlockLanguage = '';
        }

        return '';
    }

    /**
     * 重置渲染器状态
     */
    reset(): void {
        this.buffer = '';
        this.isInCodeBlock = false;
        this.codeBlockLanguage = '';
        this.codeBlockContent = '';
        this.currentLine = '';
        this.codeLineNumber = 1;
    }
}