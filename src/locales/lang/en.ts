import { Messages } from '../../types/language';

export const en: Messages = {
  welcome: {
    starting: 'Initializing OpenAI CLI Agent...',
    startComplete: 'System initialization complete',
    title: 'OpenAI CLI Agent',
    subtitle: 'Next-Generation AI Programming Assistant',
    description: 'Professional AI-powered programming tool',
    tagline: 'Powered by OpenAI GPT',
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
      usage: 'Basic Usage',
      usageCommands: {
        interactive: 'openai-cli                    # Launch interactive interface',
        version: 'openai-cli --version          # Show version information',
        help: 'openai-cli --help             # Display help information'
      },
      features: 'Core Features',
      featureList: {
        codeGen: '• Intelligent code generation and completion',
        review: '• AI code review and optimization suggestions',
        refactor: '• Automated refactoring and formatting',
        debug: '• Smart error diagnosis and fix guidance'
      },
      moreFeatures: 'More powerful features are in development'
    }
  }
}; 