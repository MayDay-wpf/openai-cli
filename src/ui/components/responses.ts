import { Messages } from '../../types/language';

export class ResponseManager {
  private messages: Messages;

  constructor(messages: Messages) {
    this.messages = messages;
  }

  getRandomResponse(): string {
    const responses = this.messages.main.responses;
    const responseArray = [
      responses.understanding,
      responses.goodQuestion,
      responses.bestSolution,
      responses.analyzeRoot,
      responses.implementSteps
    ];

    return responseArray[Math.floor(Math.random() * responseArray.length)];
  }

  updateLanguage(messages: Messages): void {
    this.messages = messages;
  }
} 