import { MainPage, ChatState } from './ui/pages/main';

// 这是一个演示如何使用 MainPage API 的示例文件

export class ChatAPI {
  private mainPage: MainPage;

  constructor() {
    this.mainPage = new MainPage();
  }

  // 启动聊天界面
  async startChat(): Promise<void> {
    await this.mainPage.show();
  }

  // 发送AI回复
  sendAIReply(message: string): void {
    this.mainPage.injectAIReply(message);
  }

  // 禁用用户输入
  disableUserInput(): void {
    this.mainPage.setChatState({ canSendMessage: false });
  }

  // 启用用户输入
  enableUserInput(): void {
    this.mainPage.setChatState({ canSendMessage: true });
  }

  // 设置处理状态
  setProcessingState(isProcessing: boolean): void {
    this.mainPage.setChatState({ 
      isProcessing,
      canSendMessage: !isProcessing 
    });
  }

  // 获取当前状态
  getCurrentState(): ChatState {
    return this.mainPage.getChatState();
  }
}

// 使用示例：
export async function exampleUsage() {
  const chatAPI = new ChatAPI();
  
  // 启动聊天
  await chatAPI.startChat();
  
  // 在某个异步操作中注入AI回复
  setTimeout(() => {
    chatAPI.sendAIReply('这是一个外部注入的AI回复！');
  }, 5000);
  
  // 模拟处理状态变更
  setTimeout(() => {
    chatAPI.setProcessingState(true);
    
    setTimeout(() => {
      chatAPI.sendAIReply('处理完成！这是结果。');
      chatAPI.setProcessingState(false);
    }, 3000);
  }, 10000);
} 