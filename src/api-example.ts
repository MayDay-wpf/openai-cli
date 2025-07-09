import { openAIService, ChatMessage } from './services';

/**
 * OpenAI服务使用示例
 */
export async function exampleStreamChat() {
  try {
    // 准备聊天消息
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: '你是一个有用的AI助手，专门帮助用户解决编程问题。'
      },
      {
        role: 'user',
        content: '请用TypeScript写一个简单的Hello World程序。'
      }
    ];

    console.log('开始流式聊天...\n');

    // 使用流式输出
    const response = await openAIService.streamChat({
      messages,
      model: 'gpt-3.5-turbo',
      temperature: 0.7,
      maxTokens: 1000,
      onChunk: (chunk: string) => {
        // 实时输出每个文本块
        process.stdout.write(chunk);
      },
      onComplete: (fullResponse: string) => {
        console.log('\n\n--- 流式输出完成 ---');
        console.log('完整回复长度:', fullResponse.length);
      },
      onError: (error: Error) => {
        console.error('流式输出错误:', error.message);
      }
    });

    return response;

  } catch (error) {
    console.error('示例执行失败:', error);
    throw error;
  }
}

/**
 * 非流式聊天示例
 */
export async function exampleNormalChat() {
  try {
    const messages: ChatMessage[] = [
      {
        role: 'user',
        content: '什么是TypeScript？'
      }
    ];

    console.log('发送聊天请求...');
    
    const response = await openAIService.chat({
      messages,
      model: 'gpt-3.5-turbo',
      temperature: 0.5
    });

    console.log('回复:', response);
    return response;

  } catch (error) {
    console.error('聊天失败:', error);
    throw error;
  }
}

/**
 * 验证API配置示例
 */
export async function exampleValidateConfig() {
  try {
    console.log('验证API配置...');
    
    const result = await openAIService.validateConfig();
    
    if (result.valid) {
      console.log('✅ API配置有效');
    } else {
      console.log('❌ API配置无效:', result.error);
    }

    return result;

  } catch (error) {
    console.error('配置验证失败:', error);
    throw error;
  }
}

/**
 * 获取模型列表示例
 */
export async function exampleGetModels() {
  try {
    console.log('获取可用模型...');
    
    const models = await openAIService.getModels();
    
    console.log('可用模型:');
    models.forEach(model => console.log(`  - ${model}`));

    return models;

  } catch (error) {
    console.error('获取模型列表失败:', error);
    throw error;
  }
} 