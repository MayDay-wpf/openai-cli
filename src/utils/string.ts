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
} 