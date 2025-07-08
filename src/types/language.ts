export type Language = 'zh' | 'en' | 'ja' | 'ko' | 'fr' | 'de' | 'es' | 'ru';

export interface LanguageConfig {
  name: string;
  nativeName: string;
}

export const LANGUAGES: Record<Language, LanguageConfig> = {
  zh: { name: 'Chinese', nativeName: '中文' },
  en: { name: 'English', nativeName: 'English' },
  ja: { name: 'Japanese', nativeName: '日本語' },
  ko: { name: 'Korean', nativeName: '한국어' },
  fr: { name: 'French', nativeName: 'Français' },
  de: { name: 'German', nativeName: 'Deutsch' },
  es: { name: 'Spanish', nativeName: 'Español' },
  ru: { name: 'Russian', nativeName: 'Русский' }
};

export interface Messages {
  welcome: {
    starting: string;
    tagline: string;
    menuPrompt: string;
    menuOptions: {
      start: string;
      config: string;
      language: string;
      help: string;
      exit: string;
    };
    menuDescription: {
      start: string;
      config: string;
      language: string;
      help: string;
      exit: string;
      backToMenu: string;
    };
    configCheck: {
      title: string;
      incompleteConfig: string;
      missingItems: string;
      baseUrl: string;
      apiKey: string;
      model: string;
      prompt: string;
      goToConfig: string;
      continueAnyway: string;
      backToMenu: string;
    };
    actions: {
      startingMain: string;
      startingConfig: string;
      changingLanguage: string;
      devInProgress: string;
      farewell: string;
      unknownAction: string;
      pressEnter: string;
    };
    help: {
      title: string;
      usage: string;
      usageCommands: {
        interactive: string;
        version: string;
        help: string;
      };
    };
  };
  main: {
    title: string;
    subtitle: string;
    welcomeBox: {
      title: string;
      description: string;
    };
    prompt: string;
    status: {
      cannotSendMessage: string;
      thinking: string;
    };
    commands: {
      exit: {
        name: string;
        description: string;
      };
      clear: {
        name: string;
        description: string;
      };
      help: {
        name: string;
        description: string;
      };
      config: {
        name: string;
        description: string;
      };
      history: {
        name: string;
        description: string;
      };
    };
    messages: {
      configInDevelopment: string;
      noHistory: string;
      historyTitle: string;
      totalMessages: string;
      user: string;
      ai: string;
    };
    help: {
      title: string;
      availableCommands: string;
      smartInput: {
        title: string;
        showMenu: string;
        matchCommands: string;
        directExecute: string;
        navigation: string;
      };
    };
    responses: {
      understanding: string;
      goodQuestion: string;
      bestSolution: string;
      analyzeRoot: string;
      implementSteps: string;
    };
  };
  config: {
    title: string;
    subtitle: string;
    menuPrompt: string;
    menuOptions: {
      baseUrl: string;
      apiKey: string;
      model: string;
      viewConfig: string;
      resetConfig: string;
      back: string;
    };
    menuDescription: {
      baseUrl: string;
      apiKey: string;
      model: string;
      viewConfig: string;
      resetConfig: string;
      back: string;
    };
    prompts: {
      baseUrlInput: string;
      apiKeyInput: string;
      modelInput: string;
      baseUrlPlaceholder: string;
      apiKeyPlaceholder: string;
      modelPlaceholder: string;
      confirmReset: string;
    };
    messages: {
      configSaved: string;
      configReset: string;
      resetCancelled: string;
      invalidInput: string;
      currentConfig: string;
      noConfigFound: string;
    };
    labels: {
      baseUrl: string;
      apiKey: string;
      model: string;
      status: string;
      configured: string;
      notConfigured: string;
    };
    actions: {
      saving: string;
      resetting: string;
      loading: string;
      custom: string;
      cancel: string;
      pressEnter: string;
      yes: string;
      no: string;
    };
  };
} 