export class StringUtils {
  /**
   * 掩码化 API Key，只显示前4位和后4位字符
   */
  static maskApiKey(apiKey: string): string {
    if (apiKey.length <= 10) {
      return '*'.repeat(apiKey.length);
    }

    const start = apiKey.substring(0, 4);
    const end = apiKey.substring(apiKey.length - 4);
    const middle = '*'.repeat(apiKey.length - 8);

    return start + middle + end;
  }

  /**
   * 计算字符串在终端中的显示宽度
   * 考虑中文字符、emoji等宽字符
   */
  static getDisplayWidth(str: string): number {
    let width = 0;

    for (const char of str) {
      const code = char.codePointAt(0) || 0;

      // 控制字符不占用显示宽度
      if (code < 32 || (code >= 127 && code < 160)) {
        continue;
      }

      // 中文字符、全角字符等占用2个字符宽度
      if (
        (code >= 0x1100 && code <= 0x115F) || // Hangul Jamo
        (code >= 0x2329 && code <= 0x232A) || // Left/Right-Pointing Angle Bracket
        (code >= 0x2E80 && code <= 0x2E99) || // CJK Radicals Supplement
        (code >= 0x2E9B && code <= 0x2EF3) || // CJK Radicals Supplement
        (code >= 0x2F00 && code <= 0x2FD5) || // Kangxi Radicals
        (code >= 0x2FF0 && code <= 0x2FFB) || // Ideographic Description Characters
        (code >= 0x3000 && code <= 0x303E) || // CJK Symbols and Punctuation
        (code >= 0x3041 && code <= 0x3096) || // Hiragana
        (code >= 0x3099 && code <= 0x30FF) || // Katakana
        (code >= 0x3105 && code <= 0x312D) || // Bopomofo
        (code >= 0x3131 && code <= 0x318E) || // Hangul Compatibility Jamo
        (code >= 0x3190 && code <= 0x31BA) || // Kanbun
        (code >= 0x31C0 && code <= 0x31E3) || // CJK Strokes
        (code >= 0x31F0 && code <= 0x31FF) || // Katakana Phonetic Extensions
        (code >= 0x3200 && code <= 0x32FF) || // Enclosed CJK Letters and Months
        (code >= 0x3300 && code <= 0x33FF) || // CJK Compatibility
        (code >= 0x3400 && code <= 0x4DBF) || // CJK Unified Ideographs Extension A
        (code >= 0x4E00 && code <= 0x9FFF) || // CJK Unified Ideographs
        (code >= 0xA000 && code <= 0xA48C) || // Yi Syllables
        (code >= 0xA490 && code <= 0xA4C6) || // Yi Radicals
        (code >= 0xAC00 && code <= 0xD7A3) || // Hangul Syllables
        (code >= 0xF900 && code <= 0xFAFF) || // CJK Compatibility Ideographs
        (code >= 0xFE10 && code <= 0xFE19) || // Vertical Forms
        (code >= 0xFE30 && code <= 0xFE6F) || // CJK Compatibility Forms
        (code >= 0xFF00 && code <= 0xFF60) || // Fullwidth Forms
        (code >= 0xFFE0 && code <= 0xFFE6) || // Fullwidth Forms
        (code >= 0x1F000 && code <= 0x1F644) || // Emoji
        (code >= 0x1F680 && code <= 0x1F6FF) || // Transport and Map Symbols
        (code >= 0x1F700 && code <= 0x1F77F) || // Alchemical Symbols
        (code >= 0x1F780 && code <= 0x1F7FF) || // Geometric Shapes Extended
        (code >= 0x1F800 && code <= 0x1F8FF) || // Supplemental Arrows-C
        (code >= 0x1F900 && code <= 0x1F9FF) || // Supplemental Symbols and Pictographs
        (code >= 0x20000 && code <= 0x2A6DF) || // CJK Unified Ideographs Extension B
        (code >= 0x2A700 && code <= 0x2B73F) || // CJK Unified Ideographs Extension C
        (code >= 0x2B740 && code <= 0x2B81F) || // CJK Unified Ideographs Extension D
        (code >= 0x2B820 && code <= 0x2CEAF) || // CJK Unified Ideographs Extension E
        (code >= 0x2F800 && code <= 0x2FA1F)    // CJK Compatibility Ideographs Supplement
      ) {
        width += 2;
      } else {
        width += 1;
      }
    }

    return width;
  }

  /**
   * 处理粘贴的文本，移除换行符并清理内容
   */
  static processPastedText(text: string): string {
    return text
      .replace(/\r\n/g, ' ')  // Windows 换行符
      .replace(/\n/g, ' ')    // Unix 换行符
      .replace(/\r/g, ' ')    // Mac 换行符
      .replace(/\t/g, ' ')    // 制表符
      .replace(/\s+/g, ' ')   // 多个连续空格合并为一个
      .trim();
  }
} 