class MemoryStore {
    conversations;
    constructor() {
        this.conversations = new Map();
    }
    getHistory(userId) {
        return this.conversations.get(userId) || [];
    }
    saveHistory(userId, messages) {
        this.conversations.set(userId, messages);
    }
    clearHistory(userId) {
        this.conversations.delete(userId);
    }
    addMessage(userId, message) {
        const history = this.getHistory(userId);
        history.push(message);
        this.saveHistory(userId, history);
    }
}
export const memoryStore = new MemoryStore();
//# sourceMappingURL=memory.js.map