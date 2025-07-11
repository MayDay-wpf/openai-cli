import { Messages } from '../../types/language';

export const zh: Messages = {
  welcome: {
    starting: '正在初始化...',
    tagline: 'Powered by AIBotPRO https://aibotpro.cn',
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
      streamingResponse: '正在接收回复...',
      unknownError: '未知错误'
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
      editHistory: {
        name: '/edit-history',
        description: '编辑聊天历史记录'
      },
      init: {
        name: '/init',
        description: '生成项目描述文档 (sawyou.md)'
      },
      exportHistory: {
        name: '/export-history',
        description: '导出聊天历史记录'
      },
      importHistory: {
        name: '/import-history',
        description: '导入聊天历史记录'
      }
    },
    messages: {
      configInDevelopment: '配置功能开发中...',
      noHistory: '暂无聊天记录',
      historyTitle: '聊天历史',
      totalMessages: '总共 {count} 条消息',
      user: '用户',
      ai: 'AI',
      userLabel: '👤 用户',
      aiLabel: '🤖 AI助手',
      codeBlock: {
        lineLabel: '行',
        unknownLanguage: '未知语言'
      },
      markdown: {
        codeInline: '代码',
        linkText: '链接',
        listItem: '项目'
      },
      streaming: {
        receiving: '正在接收回复...',
        processing: '处理中...',
        completed: '回复完成'
      },
      system: {
        basePrompt: '# 角色:\n' +
          '- 你是一个专业的AI编程助手，具有以下特点：\n' +
          '- 熟练掌握多种编程语言和框架\n' +
          '- 能够提供清晰、准确的技术解决方案\n' +
          '- 具有丰富的软件开发经验\n' +
          '- 善于解释复杂的技术概念\n' +
          '- 注重代码质量和最佳实践\n' +
          '# 工具使用:\n' +
          '- 你非常善用工具来帮助自己更加理解项目获帮助用户完成工作\n' +
          '- 你可以多次使用工具，且无任何限制\n' +
          '- 使用任何工具不需要用户同意，你可以直接使用\n' +
          '- 尤其要积极使用文件操作工具（如`list_dir`, `read_file`, `edit_file`）来探索项目、理解代码并直接帮助用户解决问题。\n\n' +
          '*请根据用户的具体需求提供专业的编程建议和解决方案。*\n\n' +
          '# 下面是用户对你的角色要求:（如果没有请忽略）\n\n' +
          '# 执行环境\n' +
          '- 当前工作目录: {cwd}\n' +
          '- 当前时间: {time}',
        fileReferencePrompt: '\n\n# 用户选择的文件\n用户选中了以下文件：\n{fileList}\n\n请注意这些文件引用，你可以基于这些文件路径来回答用户的问题。用户在输入中使用@语法来引用这些文件，但此处显示的是纯文件路径（不包含@符号）。'
      },
      format: {
        timeLocale: 'zh-CN'
      },
      tokenUsage: {
        droppedMessages: '⚠️  为保持在Token限制内，已丢弃 {count} 条较早的消息',
        tokenStats: '📊 Token使用情况: {used}/{max} ({percentage}%)',
        nearLimit: '⚠️  Token使用接近限制',
        overLimit: '❌ Token超出限制'
      },
      toolCall: {
        calling: '🛠️ 调用工具: {name}',
        receiving: '正在接收工具调用...',
        success: '✅ 工具调用成功',
        failed: '❌ 工具调用失败: {error}',
        handle: '⚠️ 此函数需要手动确认才能执行',
        rejected: '❌ 用户拒绝执行此函数',
        approved: '✅ 用户确认执行此函数',
        confirm: '是否执行此函数？',
        confirmOptions: '[y]是  [n]否  [Enter]默认(是)',
        pleaseSelect: '请选择: '
      }
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
      directory: '目录',
      fileReadError: '读取文件失败: {filePath}'
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
      starting: '开始生成项目描述文档...',
      steps: {
        scanning: '扫描项目文件',
        analyzing: '分析项目结构',
        generating: '生成项目描述',
        saving: '保存 sawyou.md 文件'
      },
      aiPrompts: {
        systemPrompt: '你是一个代码分析师。请用一句话简洁描述文件的主要功能。返回中文，不超过30字。',
        userPrompt: '文件路径：{filePath}\n\n文件内容：\n{fileContent}',
        fallback: '代码文件'
      },
      markdownTemplate: {
        projectDescription: '项目描述',
        projectType: '项目类型',
        techStack: '技术栈',
        projectStructure: '项目结构',
        fileFunctions: '文件功能简述',
        generatedBy: '此文档由 OpenAI CLI 自动生成于'
      },
      completed: '项目描述文档生成完成',
      savedTo: '文档已保存到',
      description: '您现在可以将此 Markdown 文档提供给AI助手以获得更好的项目理解',
      failed: '生成失败',
      interrupted: '生成被中断',
      ctrlcToCancel: '按 Ctrl+C 可中断生成'
    },
    historyManagement: {
      noHistory: '暂无聊天历史记录',
      exportSuccess: '历史记录导出成功',
      exportFailed: '历史记录导出失败',
      importSuccess: '历史记录导入成功',
      importFailed: '历史记录导入失败',
      importConfirm: '确定要导入历史记录吗？',
      importOverwrite: '检测到现有历史记录，是否要覆盖？',
      importCancel: '导入已取消',
      invalidFormat: '文件格式无效',
      fileNotFound: '文件不存在',
      fileSelectPrompt: '请输入文件路径',
      exportingHistory: '正在导出历史记录...',
      importingHistory: '正在导入历史记录...',
      confirmExit: '确定要退出吗？',
      confirmExitPrompt: '检测到聊天历史记录，是否在退出前导出？',
      confirmExitOptions: '[y]导出并退出  [n]直接退出  [c]取消',
      exportBeforeExit: '导出历史记录',
      exportBeforeExitPrompt: '请选择操作',
      exportBeforeExitOptions: '[y]导出  [n]跳过  [c]取消',
      defaultSavePath: '默认保存路径',
      enterDefaultPrompt: '回车使用默认',
      importInstructions: '历史记录导入说明：',
      importStep1: '1. 输入 @ 符号开始搜索文件',
      importStep2: '2. 选择 .json 历史记录文件',
      importStep3: '3. 或者直接输入 @文件路径（如：@chat-history.json）',
      importExample: '示例：@chat-history-2025-07-11T14-42-16.json',
      jsonFileDetected: '检测到 JSON 文件',
      historyImportTip: '提示：如果这是历史记录文件，可以使用 /import-history 命令，然后输入文件路径',
      directImportTip: '或者直接输入',
      importFromFileSuccess: '成功从文件 {filePath} 导入 {count} 条历史记录。(您可以输入 /history 查看)',
      importFromFileFailed: '从文件 {filePath} 导入历史记录失败。',
      fileSearchTip: '提示：使用 @ 符号可以搜索和选择文件',
      messageCount: '条消息',
      exportFailedDirectExit: '导出失败，直接退出',
      fileImportWaiting: '🔍 现在您可以输入 @ 开始搜索文件，或直接输入文件路径',
      fileImportWaitingTip: '   输入其他内容将取消文件导入模式',
      fileImportCancelled: '已取消文件导入模式',
      selectJsonFileOnly: '请选择 .json 格式的历史记录文件',
      overwriteConfirmOptions: '[y]是  [n]否',
      overwriteInvalidInput: '请输入 y(是) 或 n(否)',
      editor: {
        title: '历史记录编辑器',
        instructions: '使用 ↑↓ 箭头键选择，[Del/d] 删除，[q/Esc] 退出，[s] 保存',
        noHistoryToEdit: '没有历史记录可编辑',
        userMessage: 'User',
        aiMessage: 'AI',
        deletedMessage: '已删除',
        deleteConfirm: '确定要删除此消息吗？这将同时删除相关的AI回复。',
        deleteConfirmOptions: '[y/是] 删除  [n/否] 取消',
        saveConfirm: '是否保存修改？',
        saveConfirmOptions: '[y/是] 保存  [n/否] 放弃',
        saveSuccess: '历史记录已保存',
        saveCancel: '修改已放弃',
        deletedCount: '已删除 {count} 条消息',
        exitWithoutSave: '有未保存的修改，确定要退出吗？',
        exitWithoutSaveOptions: '[y/是] 退出  [n/否] 返回',
        keyHelp: {
          navigation: '导航：↑/↓ 选择消息',
          delete: '删除：Del/d 删除选中消息',
          save: '保存：s 保存修改',
          exit: '退出：q/Esc 退出编辑器'
        }
      }
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
      role: '设置系统角色',
      mcpConfig: '编辑 MCP 配置',
      mcpFunctionConfirmation: '设置 MCP 函数确认',
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
      role: '设置AI助手的系统角色和行为特征',
      mcpConfig: '编辑 Model Context Protocol (MCP) 服务器配置',
      mcpFunctionConfirmation: '选择需要手动确认的 MCP 函数',
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
      roleInput: '请编辑系统角色描述',
      mcpConfigInput: '请编辑 MCP 配置 JSON',
      baseUrlPlaceholder: 'https://api.openai.com/v1',
      apiKeyPlaceholder: 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      modelPlaceholder: 'gpt-4.1-mini',
      contextTokensPlaceholder: '128000',
      maxConcurrencyPlaceholder: '5',
      rolePlaceholder: '你是一个专业的AI编程助手，具有以下特点：\n- 熟练掌握多种编程语言和框架\n- 能够提供清晰、准确的技术解决方案\n- 具有丰富的软件开发经验\n- 善于解释复杂的技术概念\n- 注重代码质量和最佳实践\n\n请根据用户的具体需求提供专业的编程建议和解决方案。',
      mcpConfigPlaceholder: '{\n  "mcpServers": {\n   \n  }\n}',
      mcpFunctionConfirmationPrompt: '选择需要手动确认的 MCP 函数',
      confirmMcpFunctionConfirmation: '是否启用MCP函数手动确认',
      confirmReset: '确定要重置所有配置吗？此操作不可撤销'
    },
    messages: {
      configSaved: '配置已成功保存',
      configReset: '所有配置已重置',
      resetCancelled: '重置操作已取消',
      invalidInput: '输入无效，请重新输入',
      currentConfig: '当前配置信息',
      noConfigFound: '未找到配置信息',
      roleEditorPrompt: '按回车键打开编辑器，编辑完成后保存并关闭编辑器即可自动保存配置',
      mcpConfigEditorPrompt: '按回车键打开JSON编辑器，编辑完成后保存并关闭编辑器即可自动保存配置',
      invalidUrl: '请输入有效的URL地址',
      invalidNumber: '请输入有效的正数',
      contextTokensRange: '上下文Token数量应在 1,000 到 2,000,000 之间',
      maxConcurrencyRange: '最大并发数应在 1 到 100 之间',
      allConfigured: '所有配置项已设置完成',
      invalidJson: '无效的JSON格式，请检查语法',
      mcpConfigUpdated: 'MCP配置已更新，系统自动添加了必需的内置服务',
      mcpSystemServicesRestored: '已自动恢复缺失的系统MCP服务',
      mcpFunctionConfirmationSaved: 'MCP函数确认设置已保存',
      noMcpFunctionsFound: '未找到可用的MCP函数',
      mcpFunctionConfirmationInstructions: '操作说明: [空格]选中/取消  [a]全选  [i]全反选  [Enter]保存'
    },
    labels: {
      baseUrl: 'API 基础地址',
      apiKey: 'API 密钥',
      model: '默认模型',
      contextTokens: '上下文Token',
      maxConcurrency: 'API最大并发',
      role: '系统角色',
      mcpConfig: 'MCP 配置',
      mcpFunctionConfirmation: 'MCP函数确认',
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
  systemDetector: {
    title: '系统状态检测',
    checking: '正在检测系统配置...',
    roleTitle: '系统角色设置',
    mcpTitle: 'MCP 工具服务',
    noRole: '未设置系统角色',
    noMcpServices: '未配置MCP服务',
    mcpConnecting: '正在连接MCP服务...',
    mcpConnected: '已连接',
    mcpFailed: '连接失败',
    mcpNotFound: '服务未找到',
    toolsFound: '可用工具',
    noTools: '无可用工具',
    serverStatus: '服务器状态',
    ready: '系统准备就绪',
    pressEnterToContinue: '按 Enter 键继续...',
    progress: {
      detectingRole: '检测系统角色配置',
      detectingMcp: '检测MCP服务配置',
      connectingMcp: '连接到MCP服务器',
      fetchingTools: '获取可用工具列表',
      completed: '系统检测完成'
    },
    transport: {
      tryingHttp: '尝试HTTP连接',
      httpFailed: 'HTTP连接失败，尝试SSE',
      tryingSse: '尝试SSE连接',
      sseFailed: 'SSE连接失败',
      fallbackComplete: '使用备用连接方式'
    },
    builtinServices: {
      name: '内置服务',
      running: '运行中',
      protected: '系统保护',
      cannotDelete: '内置服务受系统保护，无法删除'
    },
    services: {
      fileSystem: {
        name: 'file-system',
        description: '系统自带的统一文件系统服务 - 文件读取、编辑、创建和目录管理'
      }
    },
    validation: {
      mcpConfigStructure: 'MCP配置必须包含 mcpServers 对象',
      invalidJson: '无效的JSON格式，请检查语法'
    }
  }
}; 