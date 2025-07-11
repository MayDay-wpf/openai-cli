import { Messages } from '../../types/language';

export const en: Messages = {
  welcome: {
    starting: 'Initializing...',
    tagline: 'Powered by AIBotPRO',
    menuPrompt: 'Select action',
    menuOptions: {
      start: 'Start Application',
      config: 'System Configuration',
      language: 'Language Settings',
      help: 'Help Documentation',
      exit: 'Exit Program'
    },
    menuDescription: {
      start: 'Enter main application interface',
      config: 'Configure API keys and preferences',
      language: 'Switch language settings',
      help: 'View help documentation',
      exit: 'Exit program',
      backToMenu: '← Return to main menu'
    },
    configCheck: {
      title: 'Configuration Check',
      incompleteConfig: '⚠️  Incomplete Configuration',
      missingItems: 'Missing configuration items:',
      baseUrl: '• API Base URL',
      apiKey: '• API Key',
      model: '• Default Model',
      prompt: 'Please select an action:',
      goToConfig: 'Go to Configuration',
      continueAnyway: 'Continue Anyway (may not work properly)',
      backToMenu: '← Back to Main Menu'
    },
    actions: {
      startingMain: 'Launching main interface...',
      startingConfig: 'Opening system configuration...',
      changingLanguage: 'Switching language settings...',
      devInProgress: 'This feature is under development',
      farewell: 'Thank you for using OpenAI CLI Agent',
      unknownAction: 'Unknown action option',
      pressEnter: 'Press Enter to continue...'
    },
    help: {
      title: 'OpenAI CLI Agent Help Documentation',
      usage: 'Instructions',
      usageCommands: {
        interactive: 'openai-cli                    # Launch interactive interface',
        version: 'openai-cli --version          # Show version information',
        help: 'openai-cli --help             # Display help information'
      }
    }
  },
  main: {
    title: 'OpenAI CLI Coding Agent',
    subtitle: 'Start chatting with AI assistant for coding help',
    welcomeBox: {
      title: 'Welcome',
      description: 'Start chatting with AI assistant for coding help',
      configInfo: 'Current Directory: {currentDir}\nBase URL: {baseUrl}\nAPI Key: {apiKey}'
    },
    prompt: '>> ',
    status: {
      cannotSendMessage: 'Cannot send message now, please wait...',
      thinking: 'thinking...',
      configMissing: 'API configuration incomplete, please configure API settings first',
      connectionError: 'Connection failed, please check network and API configuration',
      streamingResponse: 'Receiving response...',
      unknownError: 'Unknown error'
    },
    commands: {
      exit: {
        name: '/exit',
        description: 'Exit program'
      },
      clear: {
        name: '/clear',
        description: 'Clear chat history'
      },
      help: {
        name: '/help',
        description: 'Show help information'
      },
      config: {
        name: '/config',
        description: 'Configuration settings'
      },
      history: {
        name: '/history',
        description: 'View chat history'
      },
      init: {
        name: '/init',
        description: 'Initialize project documentation'
      }
    },
    messages: {
      configInDevelopment: 'Configuration feature is under development...',
      noHistory: 'No chat history',
      historyTitle: 'Chat History',
      totalMessages: 'Total {count} messages',
      user: 'User',
      ai: 'AI',
      userLabel: '👤 User',
      aiLabel: '🤖 AI Assistant',
      codeBlock: {
        lineLabel: 'Line',
        unknownLanguage: 'Unknown Language'
      },
      markdown: {
        codeInline: 'Code',
        linkText: 'Link',
        listItem: 'Item'
      },
      streaming: {
        receiving: 'Receiving response...',
        processing: 'Processing...',
        completed: 'Response completed'
      },
      system: {
        basePrompt: `# Role:

                      - You are a professional AI programming assistant with the following characteristics:

                      - Proficient in multiple programming languages and frameworks

                      - Capable of providing clear and accurate technical solutions

                      - Possess extensive software development experience

                      - Skilled at explaining complex technical concepts

                      - Focus on code quality and best practices

                      # Tool Usage:

                      - You are very adept at using tools to better understand projects and assist users in completing tasks

                      - You can use tools multiple times without any restrictions

                      - You can use any tools directly without user consent

                      *Please provide professional programming advice and solutions based on the user's specific needs.*

                      # The following are the user's role requirements for you: (Ignore if not provided)`,
        fileReferencePrompt: '\n\nThe user has selected the following files (referenced via @ syntax):\n{fileList}\n\nPlease pay attention to these file references. You can answer user questions based on these file paths. Users may ask questions about these files.'
      },
      format: {
        timeLocale: 'en-US'
      },
      tokenUsage: {
        droppedMessages: '⚠️  Dropped {count} earlier messages to stay within token limit',
        tokenStats: '📊 Token usage: {used}/{max} ({percentage}%)',
        nearLimit: '⚠️  Token usage approaching limit',
        overLimit: '❌ Token limit exceeded'
      },
      toolCall: {
        calling: '🛠️ Calling tool: {name}',
        success: '✅ Tool call successful',
        failed: '❌ Tool call failed: {error}'
      }
    },
    help: {
      title: 'Help',
      availableCommands: 'Available Commands',
      smartInput: {
        title: 'Smart Command Input:',
        showMenu: 'Type "/" to show command menu',
        matchCommands: 'Type "/xxx" to match commands',
        directExecute: 'Full command name executes directly',
        fileSearch: 'File Search:',
        showFileSearch: 'Type "@" to show file search menu',
        matchFileSearch: 'Type "@xxx" to match file search',
        navigation: '↑↓ to select, Enter to confirm'
      }
    },
    fileSearch: {
      title: 'File Search',
      commands: 'Available Commands',
      file: 'File',
      directory: 'Directory'
    },
    responses: {
      understanding: 'I understand your question. Let me provide you with a detailed answer...',
      goodQuestion: 'This is a great programming question! I suggest you can do this...',
      bestSolution: 'Based on your description, I think the best solution is...',
      analyzeRoot: 'Let me help you analyze the root cause of this code issue...',
      implementSteps: 'The feature you mentioned is indeed useful, here are the implementation steps...'
    },
    init: {
      configIncomplete: 'API configuration incomplete, cannot use AI service',
      missingItems: 'Missing configuration items',
      useConfig: 'Please use /config command to complete configuration',
      starting: 'Starting project description generation...',
      steps: {
        scanning: 'Scanning project files',
        analyzing: 'Analyzing project structure',
        generating: 'Generating project description',
        saving: 'Saving sawyou.md file'
      },
      aiPrompts: {
        systemPrompt: 'You are a code analyst. Please describe the main function of the file in one concise sentence. Respond in English, no more than 30 words.',
        userPrompt: 'File path: {filePath}\n\nFile content:\n{fileContent}',
        fallback: 'Code file'
      },
      markdownTemplate: {
        projectDescription: 'Project Description',
        projectType: 'Project Type',
        techStack: 'Tech Stack',
        projectStructure: 'Project Structure',
        fileFunctions: 'File Functions',
        generatedBy: 'This document was automatically generated by OpenAI CLI on'
      },
      completed: 'Project description document generated successfully',
      savedTo: 'Document saved to',
      description: 'You can now provide this Markdown document to AI assistant for better project understanding',
      failed: 'Generation failed',
      interrupted: 'Generation interrupted',
      ctrlcToCancel: 'Press Ctrl+C to interrupt generation'
    }
  },
  config: {
    title: 'System Configuration',
    subtitle: 'Configure your OpenAI API settings',
    menuPrompt: 'Select configuration option',
    menuOptions: {
      baseUrl: 'Set API Base URL',
      apiKey: 'Set API Key',
      model: 'Set Default Model',
      contextTokens: 'Set Context Tokens',
      maxConcurrency: 'Set Max Concurrency',
      role: 'Set System Role',
      mcpConfig: 'Edit MCP Config',
      viewConfig: 'View Current Config',
      resetConfig: 'Reset All Config',
      back: '← Back to Main Menu'
    },
    menuDescription: {
      baseUrl: 'Configure the OpenAI API base URL',
      apiKey: 'Set your OpenAI API key',
      model: 'Choose the default AI model to use',
      contextTokens: 'Set the number of context tokens for the model',
      maxConcurrency: 'Set the maximum number of concurrent API requests',
      role: 'Set the system role and behavior characteristics of the AI assistant',
      mcpConfig: 'Edit Model Context Protocol (MCP) server configuration',
      viewConfig: 'View all currently saved configuration',
      resetConfig: 'Clear all saved configurations',
      back: 'Return to the main menu interface'
    },
    prompts: {
      baseUrlInput: 'Enter API base URL',
      apiKeyInput: 'Enter your API key',
      modelInput: 'Enter default model name',
      contextTokensInput: 'Enter context tokens count',
      maxConcurrencyInput: 'Enter maximum concurrency',
      roleInput: 'Edit system role description',
      mcpConfigInput: 'Edit MCP configuration JSON',
      baseUrlPlaceholder: 'https://api.openai.com/v1',
      apiKeyPlaceholder: 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      modelPlaceholder: 'gpt-4o-mini',
      contextTokensPlaceholder: '128000',
      maxConcurrencyPlaceholder: '5',
      rolePlaceholder: 'You are a professional AI programming assistant with the following characteristics:\n- Proficient in multiple programming languages and frameworks\n- Able to provide clear and accurate technical solutions\n- Rich experience in software development\n- Good at explaining complex technical concepts\n- Focus on code quality and best practices\n\nPlease provide professional programming advice and solutions based on user-specific needs.',
      mcpConfigPlaceholder: '{\n  "mcpServers": {\n    "context7": {\n      "url": "https://mcp.context7.com/mcp"\n    },\n    "npm-search": {\n      "command": "npx",\n      "args": ["-y", "npm-search-mcp-server"]\n    }\n  }\n}',
      confirmReset: 'Are you sure you want to reset all configurations? This action cannot be undone'
    },
    messages: {
      configSaved: 'Configuration saved successfully',
      configReset: 'All configurations have been reset',
      resetCancelled: 'Reset operation cancelled',
      invalidInput: 'Invalid input, please try again',
      currentConfig: 'Current Configuration',
      noConfigFound: 'No configuration found',
      roleEditorPrompt: 'Press Enter to open editor, save and close the editor to automatically save configuration',
      mcpConfigEditorPrompt: 'Press Enter to open JSON editor, save and close the editor to automatically save configuration',
      invalidUrl: 'Please enter a valid URL',
      invalidNumber: 'Please enter a valid positive number',
      contextTokensRange: 'Context tokens should be between 1,000 and 2,000,000',
      maxConcurrencyRange: 'Max concurrency should be between 1 and 100',
      allConfigured: 'All configurations are set',
      invalidJson: 'Invalid JSON format, please check syntax',
      mcpConfigUpdated: 'MCP configuration updated, system automatically added required built-in services',
      mcpSystemServicesRestored: 'Missing system MCP services have been automatically restored'
    },
    labels: {
      baseUrl: 'API Base URL',
      apiKey: 'API Key',
      model: 'Default Model',
      contextTokens: 'Context Tokens',
      maxConcurrency: 'Max Concurrency',
      role: 'System Role',
      mcpConfig: 'MCP Config',
      status: 'Status',
      configured: 'Configured',
      notConfigured: 'Not Configured'
    },
    actions: {
      saving: 'Saving configuration...',
      resetting: 'Resetting configuration...',
      loading: 'Loading configuration...',
      custom: 'Custom',
      cancel: 'Cancel',
      pressEnter: 'Press Enter to continue...',
      yes: 'Yes',
      no: 'No'
    }
  },
  systemDetector: {
    title: 'System Status Detection',
    checking: 'Detecting system configuration...',
    roleTitle: 'System Role Settings',
    mcpTitle: 'MCP Tool Services',
    noRole: 'No system role set',
    noMcpServices: 'No MCP services configured',
    mcpConnecting: 'Connecting to MCP services...',
    mcpConnected: 'Connected',
    mcpFailed: 'Connection failed',
    mcpNotFound: 'Service not found',
    toolsFound: 'Available tools',
    noTools: 'No tools available',
    serverStatus: 'Server status',
    ready: 'System ready',
    pressEnterToContinue: 'Press Enter to continue...',
    progress: {
      detectingRole: 'Detecting system role configuration',
      detectingMcp: 'Detecting MCP service configuration',
      connectingMcp: 'Connecting to MCP servers',
      fetchingTools: 'Fetching available tools',
      completed: 'System detection completed'
    },
    transport: {
      tryingHttp: 'Trying HTTP connection',
      httpFailed: 'HTTP connection failed, trying SSE',
      tryingSse: 'Trying SSE connection',
      sseFailed: 'SSE connection failed',
      fallbackComplete: 'Using fallback connection method'
    },
    builtinServices: {
      name: 'Built-in Service',
      running: 'Running',
      protected: 'System Protected',
      cannotDelete: 'Built-in services are protected and cannot be deleted'
    },
    services: {
      fileReader: {
        name: 'file-reader',
        description: 'Built-in file reading service - running natively'
      },
      fileOperations: {
        name: 'file-operations',
        description: 'Built-in file operations service - create/delete files and directories'
      }
    },
    validation: {
      mcpConfigStructure: 'MCP configuration must contain mcpServers object',
      invalidJson: 'Invalid JSON format, please check syntax'
    }
  }
}; 