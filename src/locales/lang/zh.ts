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
      exit: '退出程序',
      backToMenu: '← 返回主菜单'
    },
    configCheck: {
      title: '配置检查',
      incompleteConfig: '⚠️  配置不完整',
      missingItems: '缺少以下配置项：',
      baseUrl: '• API 基础地址',
      apiKey: '• API 密钥',
      model: '• 默认模型',
      prompt: '请选择操作：',
      goToConfig: '前往配置',
      continueAnyway: '继续使用（可能无法正常工作）',
      backToMenu: '← 返回主菜单'
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
      description: '开始与 AI 助手对话，获取编程帮助',
      configInfo: '当前目录: {currentDir}\nBase URL: {baseUrl}\nAPI Key: {apiKey}'
    },
    prompt: '>> ',
    status: {
      cannotSendMessage: '当前无法发送消息，请等待...',
      thinking: '思考中...',
      configMissing: 'API配置不完整，请先配置API信息',
      connectionError: '连接失败，请检查网络和API配置',
      streamingResponse: '正在接收回复...'
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
      },
      init: {
        name: '/init',
        description: '初始化项目文档'
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
        fileSearch: '文件搜索:',
        showFileSearch: '输入 "@" 显示文件搜索菜单',
        matchFileSearch: '输入 "@xxx" 智能匹配文件搜索',
        navigation: '↑↓ 键选择，Enter 确认'
      }
    },
    fileSearch: {
      title: '文件搜索',
      commands: '可用指令',
      file: '文件',
      directory: '目录'
    },
    responses: {
      understanding: '我理解您的问题。让我为您提供一个详细的解答...',
      goodQuestion: '这是一个很好的编程问题！我建议您可以这样做...',
      bestSolution: '基于您的描述，我认为最佳的解决方案是...',
      analyzeRoot: '让我帮您分析一下这个代码问题的根本原因...',
      implementSteps: '您提到的这个功能确实很有用，以下是实现步骤...'
    },
    init: {
      configIncomplete: 'API配置不完整，无法使用AI服务',
      missingItems: '缺少配置项',
      useConfig: '请使用 /config 命令完成配置',
      starting: '开始初始化项目文档...',
      phases: {
        scanning: '扫描项目文件',
        analyzing: '分析项目结构',
        generating: '生成文件文档',
        consolidating: '生成 JSON 文档'
      },
      completed: '项目文档初始化完成',
      savedTo: '文档已保存到',
      description: '您现在可以将此文档提供给AI助手以获得更好的项目理解',
      failed: '初始化失败',
      interrupted: '初始化被中断',
      resuming: '恢复初始化进度',
      progressSaved: '进度已保存',
      ctrlcToCancel: '按 Ctrl+C 可中断初始化'
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
      contextTokens: '设置上下文Token',
      maxConcurrency: '设置API最大并发',
      viewConfig: '查看当前配置',
      resetConfig: '重置所有配置',
      back: '← 返回主菜单'
    },
    menuDescription: {
      baseUrl: '配置 OpenAI API 的基础URL地址',
      apiKey: '设置您的 OpenAI API 密钥',
      model: '选择默认使用的AI模型',
      contextTokens: '设置模型上下文Token数量',
      maxConcurrency: '设置API请求的最大并发数量',
      viewConfig: '查看当前保存的所有配置信息',
      resetConfig: '清除所有已保存的配置',
      back: '返回到主菜单界面'
    },
    prompts: {
      baseUrlInput: '请输入 API 基础地址',
      apiKeyInput: '请输入您的 API 密钥',
      modelInput: '请输入默认模型名称',
      contextTokensInput: '请输入上下文Token数量',
      maxConcurrencyInput: '请输入最大并发数',
      baseUrlPlaceholder: 'https://api.openai.com/v1',
      apiKeyPlaceholder: 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      modelPlaceholder: 'gpt-4o-mini',
      contextTokensPlaceholder: '128000',
      maxConcurrencyPlaceholder: '5',
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
      contextTokens: '上下文Token',
      maxConcurrency: 'API最大并发',
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
  },
  // 项目初始化多语言支持
  projectInit: {
    errors: {
      loadFailed: '加载项目文档失败',
      documentNotFound: '项目文档不存在',
      parseFailed: '解析文档失败',
      tokenCalculationFailed: '文件的token计算失败，使用字符数截断'
    },
    prompts: {
      systemAnalyzer: '你是一个专业的代码分析师。请分析这个项目并生成结构化的 JSON 数据。\n\n要求：\n1. 分析项目类型、技术栈、主要功能\n2. 识别项目依赖和入口点\n3. 分析目录结构和架构模式\n4. 返回严格的 JSON 格式，包含 overview 和 structure 两个部分',
      systemFileAnalyzer: '你是一个专业的代码分析师。请分析以下代码文件并返回结构化的 JSON 格式文档。\n\n要求：\n1. 分析文件的主要功能和用途\n2. 提取导出、导入、函数、类等信息\n3. 返回严格的 JSON 格式\n\nJSON 格式示例：\n{\n  "purpose": "文件主要功能描述",\n  "exports": [{"name": "功能名", "type": "function", "description": "描述"}],\n  "imports": [{"from": "./path", "imports": ["name1"], "type": "named"}],\n  "functions": [{"name": "funcName", "isAsync": false, "isExported": true}],\n  "classes": [],\n  "interfaces": [],\n  "constants": [],\n  "tags": ["tag1", "tag2"],\n  "importance": "high"\n}',
      userAnalyzeProject: '请分析这个项目并返回 JSON 格式的概览和结构信息。JSON 格式如下：\n{\n  "overview": {\n    "type": "cli-tool",\n    "techStack": ["TypeScript", "Node.js"],\n    "mainFeatures": ["功能1", "功能2"],\n    "dependencies": [{"name": "chalk", "type": "runtime"}],\n    "entryPoints": [{"path": "src/index.ts", "type": "main", "description": "主入口"}]\n  },\n  "structure": {\n    "tree": {"name": "root", "type": "directory", "path": "", "children": []},\n    "directories": {},\n    "architecture": {"pattern": "modular", "layers": [], "dataFlow": []}\n  }\n}',
      userAnalyzeFile: '请分析以下文件并返回 JSON 格式的文档：\n\n文件路径: {filePath}\n文件内容:\n```\n{fileContent}\n```'
    },
    warnings: {
      contentTruncated: '文件内容已截断，原始文件共{totalLines}行，当前显示{currentLines}行',
      fallbackEncoding: '使用字符数截断'
    },
    info: {
      batchDelay: '批次间短暂延迟，避免API限流',
      progressSaved: '进度已保存'
    }
  },
  // 项目文档查询多语言支持
  projectDoc: {
    errors: {
      documentNotFound: '项目文档不存在',
      loadFailed: '加载项目文档失败',
      invalidFormat: '文档格式无效',
      fuzzyMatchNotFound: '未找到匹配的文件'
    },
    warnings: {
      cacheExpired: '缓存已过期，重新加载文档',
      noContent: '文件内容无法读取'
    },
    info: {
      cacheHit: '使用缓存的文档',
      exportCompleted: '文档导出完成'
    },
    stats: {
      totalFiles: '文件总数',
      fileTypes: '文件类型分布',
      avgSize: '平均文件大小',
      totalSize: '总文件大小',
      topTags: '热门标签',
      mostConnected: '连接度最高的文件'
    }
  }
}; 