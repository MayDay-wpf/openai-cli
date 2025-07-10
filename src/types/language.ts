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
      configInfo: string;
    };
    prompt: string;
    status: {
      cannotSendMessage: string;
      thinking: string;
      configMissing: string;
      connectionError: string;
      streamingResponse: string;
      unknownError: string;
    };
    commands: {
      exit: { name: string; description: string };
      clear: { name: string; description: string };
      help: { name: string; description: string };
      config: { name: string; description: string };
      history: { name: string; description: string };
      init: { name: string; description: string };
    };
    messages: {
      configInDevelopment: string;
      noHistory: string;
      historyTitle: string;
      totalMessages: string;
      user: string;
      ai: string;
      userLabel: string;
      aiLabel: string;
      codeBlock: {
        lineLabel: string;
        unknownLanguage: string;
      };
      markdown: {
        codeInline: string;
        linkText: string;
        listItem: string;
      };
      streaming: {
        receiving: string;
        processing: string;
        completed: string;
      };
      system: {
        basePrompt: string;
        fileReferencePrompt: string;
      };
      format: {
        timeLocale: string;
      };
      tokenUsage: {
        droppedMessages: string;
        tokenStats: string;
        nearLimit: string;
        overLimit: string;
      };
    };
    help: {
      title: string;
      availableCommands: string;
      smartInput: {
        title: string;
        showMenu: string;
        matchCommands: string;
        directExecute: string;
        fileSearch: string;
        showFileSearch: string;
        matchFileSearch: string;
        navigation: string;
      };
    };
    fileSearch: {
      title: string;
      commands: string;
      file: string;
      directory: string;
    };
    responses: {
      understanding: string;
      goodQuestion: string;
      bestSolution: string;
      analyzeRoot: string;
      implementSteps: string;
    };
    init: {
      configIncomplete: string;
      missingItems: string;
      useConfig: string;
      starting: string;
      phases: {
        scanning: string;
        analyzing: string;
        generating: string;
        consolidating: string;
      };
      completed: string;
      savedTo: string;
      description: string;
      failed: string;
      interrupted: string;
      resuming: string;
      progressSaved: string;
      ctrlcToCancel: string;
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
      contextTokens: string;
      maxConcurrency: string;
      viewConfig: string;
      resetConfig: string;
      back: string;
    };
    menuDescription: {
      baseUrl: string;
      apiKey: string;
      model: string;
      contextTokens: string;
      maxConcurrency: string;
      viewConfig: string;
      resetConfig: string;
      back: string;
    };
    prompts: {
      baseUrlInput: string;
      apiKeyInput: string;
      modelInput: string;
      contextTokensInput: string;
      maxConcurrencyInput: string;
      baseUrlPlaceholder: string;
      apiKeyPlaceholder: string;
      modelPlaceholder: string;
      contextTokensPlaceholder: string;
      maxConcurrencyPlaceholder: string;
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
      contextTokens: string;
      maxConcurrency: string;
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
  // 添加项目初始化和文档查询的多语言支持
  projectInit: {
    errors: {
      loadFailed: string;
      documentNotFound: string;
      parseFailed: string;
      tokenCalculationFailed: string;
    };
    prompts: {
      systemAnalyzer: string;
      systemFileAnalyzer: string;
      userAnalyzeProject: string;
      userAnalyzeFile: string;
    };
    warnings: {
      contentTruncated: string;
      fallbackEncoding: string;
    };
    info: {
      batchDelay: string;
      progressSaved: string;
    };
  };
  projectDoc: {
    errors: {
      documentNotFound: string;
      loadFailed: string;
      invalidFormat: string;
      fuzzyMatchNotFound: string;
    };
    warnings: {
      cacheExpired: string;
      noContent: string;
    };
    info: {
      cacheHit: string;
      exportCompleted: string;
    };
    stats: {
      totalFiles: string;
      fileTypes: string;
      avgSize: string;
      totalSize: string;
      topTags: string;
      mostConnected: string;
    };
  };
} 