export type Language = 'en' | 'zh';

export interface LanguageConfig {
  name: string;
  nativeName: string;
}

export const LANGUAGES: Record<Language, LanguageConfig> = {
  en: { name: 'English', nativeName: 'English' },
  zh: { name: 'Chinese', nativeName: '中文' },
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
    updateCheck: {
      newVersionAvailable: string;
      currentVersion: string;
      latestVersion: string;
      updateCommand: string;
      updatePrompt: string;
      updateNow: string;
      skipUpdate: string;
      updateDescription: string;
      skipDescription: string;
      updating: string;
      manualUpdate: string;
      updateInstructions: string;
      updateFailed: string;
      updateSuccess: string;
      restartRequired: string;
      restartInstructions: string;
      errorDetails: string;
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
      editHistory: { name: string; description: string };
      init: { name: string; description: string };
      exportHistory: { name: string; description: string };
      importHistory: { name: string; description: string };
      checkpoint: { name: string; description: string };
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
      toolLabel: string;
      unknownCommand: string;
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
      toolCall: {
        calling: string;
        receiving: string;
        success: string;
        failed: string;
        handle: string;
        rejected: string;
        approved: string;
        confirm: string;
        confirmOptions: string;
        pleaseSelect: string;
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
      fileReadError: string;
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
      steps: {
        scanning: string;
        analyzing: string;
        generating: string;
        saving: string;
      };
      aiPrompts: {
        systemPrompt: string;
        userPrompt: string;
        fallback: string;
      };
      markdownTemplate: {
        projectDescription: string;
        projectType: string;
        techStack: string;
        projectStructure: string;
        fileFunctions: string;
        generatedBy: string;
      };
      completed: string;
      savedTo: string;
      description: string;
      failed: string;
      interrupted: string;
      ctrlcToCancel: string;
    };
    historyManagement: {
      noHistory: string;
      exportSuccess: string;
      exportFailed: string;
      importSuccess: string;
      importFailed: string;
      importConfirm: string;
      importOverwrite: string;
      importCancel: string;
      invalidFormat: string;
      fileNotFound: string;
      fileSelectPrompt: string;
      exportingHistory: string;
      importingHistory: string;
      confirmExit: string;
      confirmExitPrompt: string;
      confirmExitOptions: string;
      exportBeforeExit: string;
      exportBeforeExitPrompt: string;
      exportBeforeExitOptions: string;
      defaultSavePath: string;
      enterDefaultPrompt: string;
      importInstructions: string;
      importStep1: string;
      importStep2: string;
      importStep3: string;
      importExample: string;
      jsonFileDetected: string;
      historyImportTip: string;
      directImportTip: string;
      importFromFileSuccess: string;
      importFromFileFailed: string;
      fileSearchTip: string;
      messageCount: string;
      exportFailedDirectExit: string;
      fileImportWaiting: string;
      fileImportWaitingTip: string;
      fileImportCancelled: string;
      selectJsonFileOnly: string;
      overwriteConfirmOptions: string;
      overwriteInvalidInput: string;
      editor: {
        title: string;
        instructions: string;
        noHistoryToEdit: string;
        userMessage: string;
        aiMessage: string;
        deletedMessage: string;
        deleteConfirm: string;
        deleteConfirmOptions: string;
        saveConfirm: string;
        saveConfirmOptions: string;
        saveSuccess: string;
        saveCancel: string;
        deletedCount: string;
        exitWithoutSave: string;
        exitWithoutSaveOptions: string;
        keyHelp: {
          navigation: string;
          delete: string;
          save: string;
          exit: string;
        };
      };
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
      role: string;
      mcpConfig: string;
      mcpFunctionConfirmation: string;
      maxToolCalls: string;
      viewConfig: string;
      resetConfig: string;
      back: string;
      terminalSensitiveWords: string;
    };
    menuDescription: {
      baseUrl: string;
      apiKey: string;
      model: string;
      contextTokens: string;
      maxConcurrency: string;
      role: string;
      mcpConfig: string;
      mcpFunctionConfirmation: string;
      maxToolCalls: string;
      viewConfig: string;
      resetConfig: string;
      back: string;
      terminalSensitiveWords: string;
    };
    prompts: {
      baseUrlInput: string;
      apiKeyInput: string;
      modelInput: string;
      contextTokensInput: string;
      maxConcurrencyInput: string;
      maxToolCallsInput: string;
      roleInput: string;
      mcpConfigInput: string;
      baseUrlPlaceholder: string;
      apiKeyPlaceholder: string;
      modelPlaceholder: string;
      contextTokensPlaceholder: string;
      maxConcurrencyPlaceholder: string;
      maxToolCallsPlaceholder: string;
      rolePlaceholder: string;
      mcpConfigPlaceholder: string;
      mcpFunctionConfirmationPrompt: string;
      confirmMcpFunctionConfirmation: string;
      confirmReset: string;
      terminalSensitiveWordsInput: string;
      terminalSensitiveWordsPlaceholder: string;
    };
    messages: {
      configSaved: string;
      configReset: string;
      resetCancelled: string;
      invalidInput: string;
      currentConfig: string;
      noConfigFound: string;
      roleEditorPrompt: string;
      mcpConfigEditorPrompt: string;
      invalidUrl: string;
      invalidNumber: string;
      contextTokensRange: string;
      maxConcurrencyRange: string;
      allConfigured: string;
      invalidJson: string;
      mcpConfigUpdated: string;
      mcpSystemServicesRestored: string;
      mcpFunctionConfirmationSaved: string;
      noMcpFunctionsFound: string;
      mcpFunctionConfirmationInstructions: string;

      terminalSensitiveWordsEditorPrompt: string;
      commandExecuting: string;
    };
    labels: {
      baseUrl: string;
      apiKey: string;
      model: string;
      contextTokens: string;
      maxConcurrency: string;
      maxToolCalls: string;
      role: string;
      mcpConfig: string;
      mcpFunctionConfirmation: string;

      terminalSensitiveWords: string;
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
  // 新增终端服务相关的国际化配置
  terminal: {
    execution: {
      executing: string;
      workingDirectory: string;
      timeoutDetection: string;
      realTimeOutput: string;
      interactiveMode: string;
      backgroundMode: string;
      separator: string;
      completed: string;
      failed: string;
      success: string;
      exitCode: string;
      signal: string;
      error: string;
      pid: string;
      processId: string;
      startTime: string;
    };
    smartDetection: {
      timeoutPrompt: string;
      longRunningDetected: string;
      choicePrompt: string;
      options: {
        background: {
          name: string;
          description: string;
        };
        wait: {
          name: string;
          description: string;
        };
        kill: {
          name: string;
          description: string;
        };
      };
      backgroundMoved: string;
      continueWaiting: string;
      userTerminated: string;
      autoBackground: string;
    };
    backgroundProcess: {
      launching: string;
      launched: string;
      startupFailed: string;
      startupOutput: string;
      managementTips: string;
      listCommand: string;
      killCommand: string;
      normalExit: string;
      abnormalExit: string;
      maybeExited: string;
    };
    interactiveProcess: {
      executing: string;
      supportInteraction: string;
      startupFailed: string;
      executionSuccess: string;
      executionFailed: string;
    };
    processManagement: {
      listTitle: string;
      noProcesses: string;
      processTerminated: string;
      processNotExists: string;
      terminationFailed: string;
      directory: string;
      command: string;
    };
    responses: {
      commandRefused: string;
      commandCancelled: string;
      commandSuccess: string;
      commandFailed: string;
      backgroundSuccess: string;
      backgroundFailed: string;
      interactiveSuccess: string;
      interactiveFailed: string;
      outputSummary: string;
      errorOutput: string;
      checkOutput: string;
    };
  };
  systemDetector: {
    title: string;
    checking: string;
    roleTitle: string;
    mcpTitle: string;

    noRole: string;
    noMcpServices: string;
    mcpConnecting: string;
    mcpConnected: string;
    mcpFailed: string;
    mcpNotFound: string;

    toolsFound: string;
    noTools: string;
    serverStatus: string;
    ready: string;
    pressEnterToContinue: string;
    progress: {
      detectingRole: string;
      detectingMcp: string;

      connectingMcp: string;

      fetchingTools: string;
      completed: string;
    };
    transport: {
      tryingHttp: string;
      httpFailed: string;
      tryingSse: string;
      sseFailed: string;
      fallbackComplete: string;
    };
    builtinServices: {
      name: string;
      running: string;
      protected: string;
      cannotDelete: string;
    };
    services: {
      fileSystem: {
        name: string;
        description: string;
      };
    };
    validation: {
      mcpConfigStructure: string;
      invalidJson: string;
    };
  };
} 