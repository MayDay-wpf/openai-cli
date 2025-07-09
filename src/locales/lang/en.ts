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
      streamingResponse: 'Receiving response...'
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
      ai: 'AI'
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
      starting: 'Starting project documentation initialization...',
      phases: {
        scanning: 'Scanning project files',
        analyzing: 'Analyzing project structure',
        generating: 'Generating file documentation',
        consolidating: 'Generating JSON document'
      },
      completed: 'Project documentation initialization completed',
      savedTo: 'Documentation saved to',
      description: 'You can now provide this document to AI assistant for better project understanding',
      failed: 'Initialization failed',
      interrupted: 'Initialization interrupted',
      resuming: 'Resuming initialization progress',
      progressSaved: 'Progress saved',
      ctrlcToCancel: 'Press Ctrl+C to interrupt initialization'
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
      baseUrlPlaceholder: 'https://api.openai.com/v1',
      apiKeyPlaceholder: 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      modelPlaceholder: 'gpt-4o-mini',
      contextTokensPlaceholder: '128000',
      maxConcurrencyPlaceholder: '5',
      confirmReset: 'Are you sure you want to reset all configurations? This action cannot be undone'
    },
    messages: {
      configSaved: 'Configuration saved successfully',
      configReset: 'All configurations have been reset',
      resetCancelled: 'Reset operation cancelled',
      invalidInput: 'Invalid input, please try again',
      currentConfig: 'Current Configuration',
      noConfigFound: 'No configuration found'
    },
    labels: {
      baseUrl: 'API Base URL',
      apiKey: 'API Key',
      model: 'Default Model',
      contextTokens: 'Context Tokens',
      maxConcurrency: 'Max Concurrency',
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
  // Project initialization multilingual support
  projectInit: {
    errors: {
      loadFailed: 'Failed to load project document',
      documentNotFound: 'Project document not found',
      parseFailed: 'Failed to parse document',
      tokenCalculationFailed: 'Token calculation failed for file, using character count truncation'
    },
    prompts: {
      systemAnalyzer: 'You are a professional code analyst. Please analyze this project and generate structured JSON data.\n\nRequirements:\n1. Analyze project type, tech stack, and main features\n2. Identify project dependencies and entry points\n3. Analyze directory structure and architecture patterns\n4. Return strict JSON format, including overview and structure sections',
      systemFileAnalyzer: 'You are a professional code analyst. Please analyze the following code file and return structured JSON format documentation.\n\nRequirements:\n1. Analyze the main functionality and purpose of the file\n2. Extract exports, imports, functions, classes and other information\n3. Return strict JSON format\n\nJSON format example:\n{\n  "purpose": "Main functionality description",\n  "exports": [{"name": "functionName", "type": "function", "description": "description"}],\n  "imports": [{"from": "./path", "imports": ["name1"], "type": "named"}],\n  "functions": [{"name": "funcName", "isAsync": false, "isExported": true}],\n  "classes": [],\n  "interfaces": [],\n  "constants": [],\n  "tags": ["tag1", "tag2"],\n  "importance": "high"\n}',
      userAnalyzeProject: 'Please analyze this project and return JSON format overview and structure information. JSON format as follows:\n{\n  "overview": {\n    "type": "cli-tool",\n    "techStack": ["TypeScript", "Node.js"],\n    "mainFeatures": ["feature1", "feature2"],\n    "dependencies": [{"name": "chalk", "type": "runtime"}],\n    "entryPoints": [{"path": "src/index.ts", "type": "main", "description": "main entry"}]\n  },\n  "structure": {\n    "tree": {"name": "root", "type": "directory", "path": "", "children": []},\n    "directories": {},\n    "architecture": {"pattern": "modular", "layers": [], "dataFlow": []}\n  }\n}',
      userAnalyzeFile: 'Please analyze the following file and return JSON format documentation:\n\nFile path: {filePath}\nFile content:\n```\n{fileContent}\n```'
    },
    warnings: {
      contentTruncated: 'File content truncated, original file has {totalLines} lines, currently showing {currentLines} lines',
      fallbackEncoding: 'Using character count truncation'
    },
    info: {
      batchDelay: 'Brief delay between batches to avoid API rate limiting',
      progressSaved: 'Progress saved'
    }
  },
  // Project document query multilingual support
  projectDoc: {
    errors: {
      documentNotFound: 'Project document not found',
      loadFailed: 'Failed to load project document',
      invalidFormat: 'Invalid document format',
      fuzzyMatchNotFound: 'No matching file found'
    },
    warnings: {
      cacheExpired: 'Cache expired, reloading document',
      noContent: 'File content cannot be read'
    },
    info: {
      cacheHit: 'Using cached document',
      exportCompleted: 'Document export completed'
    },
    stats: {
      totalFiles: 'Total files',
      fileTypes: 'File type distribution',
      avgSize: 'Average file size',
      totalSize: 'Total file size',
      topTags: 'Top tags',
      mostConnected: 'Most connected files'
    }
  }
}; 