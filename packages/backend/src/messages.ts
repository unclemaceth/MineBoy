/**
 * Scrolling message management
 * Stores messages that will be displayed in the HUD scrolling banner
 */

interface Message {
  id: string;
  text: string;
  createdAt: number;
}

class MessageStore {
  private messages: Message[] = [
    {
      id: 'welcome',
      text: 'MineBoy it Mines stuff!',
      createdAt: Date.now(),
    },
  ];

  /**
   * Get all active messages
   */
  getMessages(): string[] {
    return this.messages.map(m => m.text);
  }

  /**
   * Get all messages with metadata
   */
  getAllMessages(): Message[] {
    return [...this.messages];
  }

  /**
   * Add a new message
   */
  addMessage(text: string): Message {
    const message: Message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      text,
      createdAt: Date.now(),
    };
    this.messages.push(message);
    console.log(`[Messages] Added: "${text}" (${message.id})`);
    return message;
  }

  /**
   * Remove a message by ID
   */
  removeMessage(id: string): boolean {
    const index = this.messages.findIndex(m => m.id === id);
    if (index !== -1) {
      const removed = this.messages.splice(index, 1)[0];
      console.log(`[Messages] Removed: "${removed.text}" (${id})`);
      return true;
    }
    return false;
  }

  /**
   * Clear all messages
   */
  clearAll(): void {
    this.messages = [];
    console.log('[Messages] Cleared all messages');
  }

  /**
   * Update a message by ID
   */
  updateMessage(id: string, newText: string): boolean {
    const message = this.messages.find(m => m.id === id);
    if (message) {
      const oldText = message.text;
      message.text = newText;
      console.log(`[Messages] Updated: "${oldText}" -> "${newText}" (${id})`);
      return true;
    }
    return false;
  }
}

export const messageStore = new MessageStore();
