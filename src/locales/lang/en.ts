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
      exit: 'Exit program'
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
      description: 'Start chatting with AI assistant for coding help'
    },
    prompt: '>> ',
    status: {
      cannotSendMessage: 'Cannot send message now, please wait...',
      thinking: 'thinking...'
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
        navigation: '↑↓ to select, Enter to confirm'
      }
    },
    responses: {
      understanding: 'I understand your question. Let me provide you with a detailed answer...',
      goodQuestion: 'This is a great programming question! I suggest you can do this...',
      bestSolution: 'Based on your description, I think the best solution is...',
      analyzeRoot: 'Let me help you analyze the root cause of this code issue...',
      implementSteps: 'The feature you mentioned is indeed useful, here are the implementation steps...'
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
      viewConfig: 'View Current Config',
      resetConfig: 'Reset All Config',
      back: 'Back to Main Menu'
    },
    menuDescription: {
      baseUrl: 'Configure the OpenAI API base URL',
      apiKey: 'Set your OpenAI API key',
      model: 'Choose the default AI model to use',
      viewConfig: 'View all currently saved configuration',
      resetConfig: 'Clear all saved configurations',
      back: 'Return to the main menu interface'
    },
    prompts: {
      baseUrlInput: 'Enter API base URL',
      apiKeyInput: 'Enter your API key',
      modelInput: 'Enter default model name',
      baseUrlPlaceholder: 'https://api.openai.com/v1',
      apiKeyPlaceholder: 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      modelPlaceholder: 'gpt-4o-mini',
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
  }
}; 