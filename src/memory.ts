import { BaseMessage } from "@langchain/core/messages";

class MemoryStore {
  private conversations: Map<string, BaseMessage[]>;

  constructor() {
    this.conversations = new Map();
  }

  // Get conversation history for a user
  getHistory(userId: string): BaseMessage[] {
    return this.conversations.get(userId) || [];
  }

  // Save conversation history for a user
  saveHistory(userId: string, messages: BaseMessage[]): void {
    this.conversations.set(userId, messages);
  }

  // Clear conversation history for a user
  clearHistory(userId: string): void {
    this.conversations.delete(userId);
  }

  // Add message to history for a user
  addMessage(userId: string, message: BaseMessage): void {
    const history = this.getHistory(userId);
    history.push(message);
    this.saveHistory(userId, history);
  }
}

export const memoryStore = new MemoryStore(); 