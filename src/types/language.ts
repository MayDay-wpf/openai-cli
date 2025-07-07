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
    startComplete: string;
    title: string;
    subtitle: string;
    description: string;
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
      features: string;
      featureList: {
        codeGen: string;
        review: string;
        refactor: string;
        debug: string;
      };
      moreFeatures: string;
    };
  };
} 