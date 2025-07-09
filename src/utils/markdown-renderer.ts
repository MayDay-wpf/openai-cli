import { marked } from 'marked';
import { highlight } from 'cli-highlight';
import chalk from 'chalk';

// 正确导入 marked-terminal
const { markedTerminal } = require('marked-terminal');

export interface MarkdownRenderOptions {
  width?: number;
  theme?: string;
  showSectionPrefix?: boolean;
}

export class MarkdownRenderer {
  private options: MarkdownRenderOptions;

  constructor(options: MarkdownRenderOptions = {}) {
    this.options = {
      width: 120,
      theme: 'default',
      showSectionPrefix: true,
      ...options
    };

    // 配置 marked-terminal 选项
    const terminalOptions = {
      // 终端宽度
      width: this.options.width,
      reflowText: true,
      
      // 显示标题前缀
      showSectionPrefix: this.options.showSectionPrefix,
      
      // 解码HTML实体
      unescape: true,
      
      // 支持emoji
      emoji: true,
      
      // 自定义样式
      code: chalk.yellow,
      blockquote: chalk.gray.italic,
      html: chalk.gray,
      heading: chalk.cyan.bold,
      firstHeading: chalk.magenta.underline.bold,
      hr: chalk.reset,
      listitem: chalk.reset,
      table: chalk.reset,
      paragraph: chalk.reset,
      strong: chalk.bold,
      em: chalk.italic,
      codespan: chalk.yellow.bgBlack,
      del: chalk.dim.gray.strikethrough,
      link: chalk.blue.underline,
      href: chalk.blue.underline,
      
      // 表格选项
      tableOptions: {
        chars: {
          'top': '═',
          'top-mid': '╤',
          'top-left': '╔',
          'top-right': '╗',
          'bottom': '═',
          'bottom-mid': '╧',
          'bottom-left': '╚',
          'bottom-right': '╝',
          'left': '║',
          'left-mid': '╟',
          'mid': '─',
          'mid-mid': '┼',
          'right': '║',
          'right-mid': '╢',
          'middle': '│'
        },
        style: { 
          'padding-left': 1, 
          'padding-right': 1,
          head: ['cyan', 'bold'],
          border: ['gray']
        }
      },
      
      // 自定义列表渲染
      list: function(body: string, ordered: boolean) {
        return body;
      }
    };

    // 代码高亮选项
    const highlightOptions = {
      theme: this.options.theme,
      ignoreIllegals: true
    };

    // 配置 marked 使用 marked-terminal
    marked.use(markedTerminal(terminalOptions, highlightOptions));
  }

  /**
   * 渲染 Markdown 文本为终端格式
   */
  render(markdown: string): string {
    try {
      const result = marked.parse(markdown);
      return typeof result === 'string' ? result : markdown;
    } catch (error) {
      console.error('Markdown 渲染失败:', error);
      return markdown; // 返回原始文本
    }
  }

  /**
   * 渲染代码块（单独使用）
   */
  renderCode(code: string, language?: string): string {
    try {
      if (language && language !== 'text' && language !== 'plain') {
        const highlighted = highlight(code, { 
          language: language,
          theme: this.options.theme || 'default',
          ignoreIllegals: true
        });
        
        // 添加代码块边框
        const lines = highlighted.split('\n');
        const maxLength = Math.max(...lines.map(line => this.stripAnsi(line).length));
        const width = Math.min(maxLength + 4, this.options.width || 120);
        const border = '─'.repeat(width - 2);
        
        return [
          chalk.gray('┌' + border + '┐'),
          ...lines.map(line => {
            const padding = ' '.repeat(Math.max(0, width - 4 - this.stripAnsi(line).length));
            return chalk.gray('│ ') + line + padding + chalk.gray(' │');
          }),
          chalk.gray('└' + border + '┘')
        ].join('\n') + '\n';
      } else {
        return chalk.yellow(code) + '\n';
      }
    } catch (error) {
      return chalk.yellow(code) + '\n';
    }
  }

  /**
   * 移除 ANSI 转义码（用于计算实际文本长度）
   */
  private stripAnsi(str: string): string {
    return str.replace(/\x1b\[[0-9;]*m/g, '');
  }

  /**
   * 检测代码语言
   */
  detectLanguage(code: string): string | undefined {
    // 简单的语言检测逻辑
    if (code.includes('function') && code.includes('{')) {
      if (code.includes('const') || code.includes('let') || code.includes('=>')) {
        return 'javascript';
      } else if (code.includes('public') || code.includes('private')) {
        return 'java';
      }
    }
    
    if (code.includes('def ') && code.includes(':')) {
      return 'python';
    }
    
    if (code.includes('#include') || code.includes('int main')) {
      return 'cpp';
    }
    
    if (code.includes('SELECT') || code.includes('FROM')) {
      return 'sql';
    }
    
    if (code.includes('<') && code.includes('>') && code.includes('</')) {
      return 'html';
    }
    
    if (code.includes('{') && code.includes('}') && code.includes(':')) {
      return 'json';
    }
    
    return undefined;
  }
}

// 创建默认实例
export const markdownRenderer = new MarkdownRenderer({
  width: 120,
  theme: 'default',
  showSectionPrefix: true
});

// 便捷函数
export function renderMarkdown(markdown: string, options?: MarkdownRenderOptions): string {
  if (options) {
    const renderer = new MarkdownRenderer(options);
    return renderer.render(markdown);
  }
  return markdownRenderer.render(markdown);
}

export function renderCode(code: string, language?: string): string {
  return markdownRenderer.renderCode(code, language);
} 