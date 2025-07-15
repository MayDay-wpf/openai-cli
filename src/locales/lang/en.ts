import { Messages } from '../../types/language';

export const en: Messages = {
  welcome: {
    starting: 'Initializing...',
    tagline: 'Powered by AIBotPRO https://aibotpro.cn',
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
      incompleteConfig: '☆ Incomplete Configuration',
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
      editHistory: {
        name: '/edit-history',
        description: 'Edit chat history records'
      },
      init: {
        name: '/init',
        description: 'Initialize project documentation'
      },
      exportHistory: {
        name: '/export-history',
        description: 'Export chat history'
      },
      importHistory: {
        name: '/import-history',
        description: 'Import chat history'
      }
    },
    messages: {
      configInDevelopment: 'Configuration feature is under development...',
      noHistory: 'No chat history',
      historyTitle: 'Chat History',
      totalMessages: 'Total {count} messages',
      user: 'User',
      ai: 'AI',
      userLabel: '● User',
      aiLabel: '◎ AI Assistant',
      toolLabel: '◆ Tool',
      unknownCommand: 'Unknown command: {command}',
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
        basePrompt: '# Role:\n' +
          '- You are a professional AI programming assistant with the following characteristics:\n' +
          '- Proficient in multiple programming languages and frameworks\n' +
          '- Capable of providing clear and accurate technical solutions\n' +
          '- Possess extensive software development experience\n' +
          '- Skilled at explaining complex technical concepts\n' +
          '- Focus on code quality and best practices\n' +
          '{role}\n\n' +
          '# Tool Usage Rules (MUST be strictly followed):\n' +
          '- **One Tool at a Time**: You must strictly adhere to the "one tool per step" principle. In each response, you are only allowed to call one tool. It is strictly forbidden to call multiple tools sequentially or in parallel in a single response.\n' +
          '- **Independent JSON Arguments**: The arguments for each tool must be a single, well-formed JSON object. It is strictly forbidden to concatenate multiple JSON objects as arguments.\n' +
          '- **Incorrect Example (Absolutely Forbidden)**: \n' +
          '  - Bad Call: `<tool_name>{"param":"value1"}{"param":"value2"}</tool_name>`\n' +
          '  - Error Log: `500 invalid arguments for function some_tool, args: {"path":"."}{"path":"."}`\n' +
          '  - This behavior causes fatal parsing errors and must be completely avoided.\n' +
          '- **Correct Example (Must Follow)**: \n' +
          '  - First Response: `<tool_name>{"path":"."}</tool_name>`\n' +
          '  - (After waiting for user response) Second Response: `<another_tool>{"arg":"value"}</another_tool>`\n' +
          '- **Self-Correction**: If you find yourself or the system generating output similar to the incorrect example above, you must immediately stop and correct your behavior, strictly following the "one tool at a time" and "independent JSON arguments" rules.\n\n' +
          '# Original Tool Usage Instructions:\n' +
          '## File System:\n' +
          '- You are very adept at using tools to better understand projects and assist users in completing tasks.\n' +
          '- You can use tools multiple times without any restrictions.\n' +
          '- You can use any tools directly without user consent.\n' +
          '- Especially, proactively use file operation tools (e.g., `list_directory`, `read_file`, `edit_file`) to explore projects, understand code, and directly help users solve problems.\n' +
          '- Step By Step execution principle, do not complete all work at once using tools, but execute step by step, and then execute the next step after each step is completed.\n' +
          '## TODO:\n' +
          '- When facing programming tasks, you should actively use `create_todos` to plan tasks.\n' +
          '- When each task is completed, you should immediately use `update_todos` to update the status of the TODO item.\n' +
          '- When facing complex tasks, you can flexibly use `add_todos` to modify the plan.\n' +
          '## Terminal:\n' +
          '- You should use the terminal tool `execute_command` to check for various compilation errors or reference errors, such as `node --check script.js` or `code .` or `npm run build` or `dotnet build` and more commands that conform to the current project build.\n' +
          '- When the user needs to execute a command, you should actively use `execute_command` to execute the command.\n' +
          '- When the programming task is completed, you should actively use `execute_command` to execute the build check, for example, `npm run build` or `dotnet build` and more commands that conform to the current project build.\n' +
          '# Description File:\n' +
          'There is a description file called sawyou.md in the project. You can use the `read_file` tool to read the file content and answer user questions based on the file content.\n' +
          'sawyou.md may not exist, and you can ignore it when you check that it does not exist. You can also remind the user to use the `/init` command to generate the description file in subsequent responses.\n' +
          'sawyou.md is not a high-priority file, and if it does not exist, it does not affect your active and serious full answer to user questions.\n' +
          '*Please provide professional programming advice and solutions based on the user\'s specific needs.*\n\n' +
          '# Execution environment\n' +
          '- Current working directory: {cwd}\n' +
          '- Current time: {time}',
        fileReferencePrompt: '\n\n# User-selected files\nThe user has selected the following files:\n{fileList}\n\nPlease pay attention to these file references. You can answer user questions based on these file paths. Users reference these files using @ syntax in their input, but here shows the pure file paths (without @ symbols).'
      },
      format: {
        timeLocale: 'en-US'
      },
      tokenUsage: {
        droppedMessages: '◉ Dropped {count} earlier messages to stay within token limit',
        tokenStats: '◈ Token usage: {used}/{max} ({percentage}%)',
        nearLimit: '☆ Token usage approaching limit',
        overLimit: '✖ Token limit exceeded'
      },
      toolCall: {
        calling: '◆ Calling tool: {name}',
        receiving: 'Receiving tool call...',
        success: '★ Tool call successful',
        failed: '✖ Tool call failed: {error}',
        handle: '☆ This function requires manual confirmation to execute',
        rejected: '✖ User rejected to execute this function',
        approved: '★ User confirmed to execute this function',
        confirm: 'Do you want to execute this function?',
        confirmOptions: '[y]yes  [n]no  [Enter]default(yes)',
        pleaseSelect: 'Please select: '
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
      directory: 'Directory',
      fileReadError: 'Error reading file: {filePath}'
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
    },
    historyManagement: {
      noHistory: 'No chat history found',
      exportSuccess: 'History exported successfully',
      exportFailed: 'Failed to export history',
      importSuccess: 'History imported successfully',
      importFailed: 'Failed to import history',
      importConfirm: 'Are you sure you want to import history?',
      importOverwrite: 'Existing history detected, do you want to overwrite it?',
      importCancel: 'Import cancelled',
      invalidFormat: 'Invalid file format',
      fileNotFound: 'File not found',
      fileSelectPrompt: 'Please enter file path',
      exportingHistory: 'Exporting history...',
      importingHistory: 'Importing history...',
      confirmExit: 'Are you sure you want to exit?',
      confirmExitPrompt: 'Chat history detected, do you want to export before exit?',
      confirmExitOptions: '[y]Export and exit  [n]Exit directly  [c]Cancel',
      exportBeforeExit: 'Export history',
      exportBeforeExitPrompt: 'Please select action',
      exportBeforeExitOptions: '[y]Export  [n]Skip  [c]Cancel',
      defaultSavePath: 'Default save path',
      enterDefaultPrompt: 'Press Enter to use default',
      importInstructions: 'History import instructions:',
      importStep1: '1. Type @ to start file search',
      importStep2: '2. Select .json history file',
      importStep3: '3. Or directly type @filepath (e.g., @chat-history.json)',
      importExample: 'Example: @chat-history-2025-07-11T14-42-16.json',
      jsonFileDetected: 'JSON file detected',
      historyImportTip: 'Tip: If this is a history file, you can use /import-history command, then enter file path',
      directImportTip: 'Or directly type',
      importFromFileSuccess: 'Successfully imported {count} messages from file {filePath}. (you can input /history to view)',
      importFromFileFailed: 'Failed to import history from file {filePath}.',
      fileSearchTip: 'Tip: Use @ symbol to search and select files',
      messageCount: 'messages',
      exportFailedDirectExit: 'Export failed, exiting directly',
      fileImportWaiting: '◐ You can now type @ to search files, or directly type file path',
      fileImportWaitingTip: '   Type anything else to cancel file import mode',
      fileImportCancelled: 'File import mode cancelled',
      selectJsonFileOnly: 'Please select .json format history file',
      overwriteConfirmOptions: '[y]yes  [n]no',
      overwriteInvalidInput: 'Please enter y(yes) or n(no)',
      editor: {
        title: 'History Record Editor',
        instructions: 'Use ↑↓ arrow keys to select, [Del/d] delete, [q/Esc] exit, [s] save',
        noHistoryToEdit: 'No history records to edit',
        userMessage: 'User',
        aiMessage: 'AI',
        deletedMessage: 'Deleted',
        deleteConfirm: 'Are you sure you want to delete this message? This will also delete related AI responses.',
        deleteConfirmOptions: '[y/yes] Delete  [n/no] Cancel',
        saveConfirm: 'Do you want to save the changes?',
        saveConfirmOptions: '[y/yes] Save  [n/no] Discard',
        saveSuccess: 'History records saved',
        saveCancel: 'Changes discarded',
        deletedCount: 'Deleted {count} messages',
        exitWithoutSave: 'There are unsaved changes, are you sure you want to exit?',
        exitWithoutSaveOptions: '[y/yes] Exit  [n/no] Return',
        keyHelp: {
          navigation: 'Navigation: ↑/↓ select message',
          delete: 'Delete: Del/d delete selected message',
          save: 'Save: s save changes',
          exit: 'Exit: q/Esc exit editor'
        }
      }
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
      mcpFunctionConfirmation: 'Set MCP Function Confirmation',
      maxToolCalls: 'Set Max Tool Calls',
      viewConfig: 'View Current Config',
      resetConfig: 'Reset All Config',
      terminalSensitiveWords: 'Terminal Sensitive Words',
      back: '← Back to Main Menu'
    },
    menuDescription: {
      baseUrl: 'Configure the OpenAI API base URL',
      apiKey: 'Set your OpenAI API key',
      model: 'Choose the default AI model to use',
      contextTokens: 'Set the number of context tokens for the model',
      maxConcurrency: 'Set the maximum number of concurrent executions for MCP services.',
      role: 'Set the global system role prompt for the AI model.',
      mcpConfig: 'Configure external MCP (Multi-Capability-Provision) services.',
      mcpFunctionConfirmation: 'Set which MCP functions require manual confirmation before execution.',
      maxToolCalls: 'Set the maximum number of tool calls allowed in a single conversation turn.',
      viewConfig: 'View all current configuration values.',
      resetConfig: 'Reset all settings to their default values.',
      terminalSensitiveWords: 'Configure the list of sensitive words for terminal execution, with wildcard support.',
      back: 'Return to the main welcome screen.'
    },
    prompts: {
      baseUrlInput: 'Please enter the API Base URL',
      apiKeyInput: 'Enter your API key',
      modelInput: 'Enter default model name',
      contextTokensInput: 'Enter context tokens count',
      maxConcurrencyInput: 'Please enter the max concurrency',
      maxToolCallsInput: 'Please enter the max tool calls',
      maxToolCallsPlaceholder: '25',
      roleInput: 'Please enter the system role prompt',
      mcpConfigInput: 'Please edit the MCP services configuration (JSON)',
      baseUrlPlaceholder: 'https://api.openai.com/v1',
      apiKeyPlaceholder: 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      modelPlaceholder: 'gpt-4.1-mini',
      contextTokensPlaceholder: '128000',
      maxConcurrencyPlaceholder: '5',
      rolePlaceholder: 'You are a professional AI programming assistant with the following characteristics:\n- Proficient in multiple programming languages and frameworks\n- Able to provide clear and accurate technical solutions\n- Rich experience in software development\n- Good at explaining complex technical concepts\n- Focus on code quality and best practices\n\nPlease provide professional programming advice and solutions based on user-specific needs.',
      mcpConfigPlaceholder: '{\n  "mcpServers": {\n    \n  }\n}',
      mcpFunctionConfirmationPrompt: 'Select MCP functions that require manual confirmation',
      confirmMcpFunctionConfirmation: 'Enable MCP function manual confirmation',
      confirmReset: 'Are you sure you want to reset all configurations? This action cannot be undone',
      terminalSensitiveWordsInput: 'Please edit the terminal sensitive words list',
      terminalSensitiveWordsPlaceholder: 'rm -rf\nmv\ncp\ndd'
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
      mcpSystemServicesRestored: 'Missing system MCP services have been automatically restored',
      mcpFunctionConfirmationSaved: 'MCP function confirmation settings saved',
      noMcpFunctionsFound: 'No MCP functions found',
      mcpFunctionConfirmationInstructions: 'Instructions: [Space]toggle  [a]select all  [i]invert selection  [Enter]save',
      terminalSensitiveWordsEditorPrompt: 'One sensitive word per line, supports * wildcard',
      commandExecuting: 'Command is executing'
    },
    labels: {
      baseUrl: 'API Base URL',
      apiKey: 'API Key',
      model: 'Model',
      contextTokens: 'Context Tokens',
      maxConcurrency: 'Max Concurrency',
      maxToolCalls: 'Max Tool Calls',
      role: 'System Role',
      mcpConfig: 'MCP Services Config',
      mcpFunctionConfirmation: 'MCP Function Confirmation',
      terminalSensitiveWords: 'Terminal Sensitive Words',
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
      fileSystem: {
        name: 'file-system',
        description: 'Built-in unified file system service - reading, editing, creating files and directory management'
      }
    },
    validation: {
      mcpConfigStructure: 'MCP configuration must contain mcpServers object',
      invalidJson: 'Invalid JSON format, please check syntax'
    }
  }
}; 