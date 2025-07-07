import { Messages } from '../../types/language';

export const zh: Messages = {
  welcome: {
    starting: '正在初始化 OpenAI CLI Agent...',
    startComplete: '系统初始化完成',
    title: 'OpenAI CLI Agent',
    subtitle: '下一代智能编程助手',
    description: '专业AI驱动的编程工具',
    tagline: 'Powered by OpenAI GPT',
    menuPrompt: '请选择操作',
    menuOptions: {
      start: '开始使用',
      config: '系统配置',
      language: '语言设置',
      help: '帮助文档',
      exit: '退出程序'
    },
    menuDescription: {
      start: '进入主功能界面',
      config: '配置API密钥和偏好',
      language: '切换语言设置',
      help: '查看帮助文档',
      exit: '退出程序'
    },
    actions: {
      startingMain: '正在启动主功能界面...',
      startingConfig: '正在打开系统配置...',
      changingLanguage: '正在切换语言设置...',
      devInProgress: '该功能正在开发中',
      farewell: '感谢使用 OpenAI CLI Agent',
      unknownAction: '未知的操作选项',
      pressEnter: '按回车键继续...'
    },
    help: {
      title: 'OpenAI CLI Agent 帮助文档',
      usage: '基本用法',
      usageCommands: {
        interactive: 'openai-cli                    # 启动交互式界面',
        version: 'openai-cli --version          # 查看版本信息',
        help: 'openai-cli --help             # 显示帮助信息'
      },
      features: '核心功能',
      featureList: {
        codeGen: '• 智能代码生成和补全',
        review: '• AI代码审查和优化建议',
        refactor: '• 自动化重构和格式化',
        debug: '• 智能错误诊断和修复指导'
      },
      moreFeatures: '更多强大功能正在开发中'
    }
  }
}; 