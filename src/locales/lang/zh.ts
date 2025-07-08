import { Messages } from '../../types/language';

export const zh: Messages = {
  welcome: {
    starting: '正在初始化...',
    tagline: 'Powered by AIBotPRO',
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
      usage: '指令',
      usageCommands: {
        interactive: 'openai-cli                    # 启动交互式界面',
        version: 'openai-cli --version          # 查看版本信息',
        help: 'openai-cli --help             # 显示帮助信息'
      }
    }
  },
  main: {
    title: 'OpenAI CLI 编程助手',
    subtitle: '开始与 AI 助手对话，获取编程帮助',
    welcomeBox: {
      title: '欢迎',
      description: '开始与 AI 助手对话，获取编程帮助'
    },
    prompt: '>> ',
    status: {
      cannotSendMessage: '当前无法发送消息，请等待...',
      thinking: '思考中...'
    },
    commands: {
      exit: {
        name: '/exit',
        description: '退出程序'
      },
      clear: {
        name: '/clear',
        description: '清空聊天记录'
      },
      help: {
        name: '/help',
        description: '显示帮助信息'
      },
      config: {
        name: '/config',
        description: '配置设置'
      },
      history: {
        name: '/history',
        description: '查看聊天历史'
      }
    },
    messages: {
      configInDevelopment: '配置功能开发中...',
      noHistory: '暂无聊天记录',
      historyTitle: '聊天历史',
      totalMessages: '总共 {count} 条消息',
      user: '用户',
      ai: 'AI'
    },
    help: {
      title: '帮助',
      availableCommands: '可用指令',
      smartInput: {
        title: '智能指令输入:',
        showMenu: '输入 "/" 显示指令选择菜单',
        matchCommands: '输入 "/xxx" 智能匹配指令',
        directExecute: '完整指令名直接执行',
        navigation: '↑↓ 键选择，Enter 确认'
      }
    },
    responses: {
      understanding: '我理解您的问题。让我为您提供一个详细的解答...',
      goodQuestion: '这是一个很好的编程问题！我建议您可以这样做...',
      bestSolution: '基于您的描述，我认为最佳的解决方案是...',
      analyzeRoot: '让我帮您分析一下这个代码问题的根本原因...',
      implementSteps: '您提到的这个功能确实很有用，以下是实现步骤...'
    }
  },
  config: {
    title: '系统配置',
    subtitle: '配置您的 OpenAI API 设置',
    menuPrompt: '请选择配置项',
    menuOptions: {
      baseUrl: '设置 API 基础地址',
      apiKey: '设置 API 密钥',
      model: '设置默认模型',
      viewConfig: '查看当前配置',
      resetConfig: '重置所有配置',
      back: '返回主菜单'
    },
    menuDescription: {
      baseUrl: '配置 OpenAI API 的基础URL地址',
      apiKey: '设置您的 OpenAI API 密钥',
      model: '选择默认使用的AI模型',
      viewConfig: '查看当前保存的所有配置信息',
      resetConfig: '清除所有已保存的配置',
      back: '返回到主菜单界面'
    },
    prompts: {
      baseUrlInput: '请输入 API 基础地址',
      apiKeyInput: '请输入您的 API 密钥',
      modelInput: '请输入默认模型名称',
      baseUrlPlaceholder: 'https://api.openai.com/v1',
      apiKeyPlaceholder: 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      modelPlaceholder: 'gpt-4o-mini',
      confirmReset: '确定要重置所有配置吗？此操作不可撤销'
    },
    messages: {
      configSaved: '配置已成功保存',
      configReset: '所有配置已重置',
      resetCancelled: '重置操作已取消',
      invalidInput: '输入无效，请重新输入',
      currentConfig: '当前配置信息',
      noConfigFound: '未找到配置信息'
    },
    labels: {
      baseUrl: 'API 基础地址',
      apiKey: 'API 密钥',
      model: '默认模型',
      status: '状态',
      configured: '已配置',
      notConfigured: '未配置'
    },
    actions: {
      saving: '正在保存配置...',
      resetting: '正在重置配置...',
      loading: '正在加载配置...',
      custom: '自定义',
      cancel: '取消',
      pressEnter: '按回车键继续...',
      yes: '是',
      no: '否'
    }
  }
}; 