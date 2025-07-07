import { Messages, Language } from '../types/language';
import { zh } from './lang/zh';
import { en } from './lang/en';

const availableMessages: Partial<Record<Language, Messages>> = {
  zh,
  en
  // 其他语言可以在这里添加
  // ja: 需要时导入日语翻译
  // ko: 需要时导入韩语翻译
  // 等等...
};

export const getCurrentMessages = (lang: Language): Messages => {
  // 如果请求的语言不可用，回退到英语
  return availableMessages[lang] || availableMessages.en || en;
};

export const getAvailableLanguages = (): Language[] => {
  return Object.keys(availableMessages) as Language[];
}; 