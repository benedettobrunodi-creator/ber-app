import { create } from 'zustand';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface ChatMessageSender {
  id: string;
  name: string;
  avatarUrl?: string;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  body: string;
  attachmentUrl: string | null;
  attachmentType: string | null;
  readBy: string[];
  createdAt: string;
  sender?: ChatMessageSender;
}

interface ChatState {
  activeRoomId: string | null;
  messages: Map<string, ChatMessage[]>;
  typingUsers: Map<string, string[]>;
  onlineUsers: Set<string>;
}

interface ChatActions {
  setActiveRoom: (roomId: string | null) => void;
  addMessage: (message: ChatMessage) => void;
  setMessages: (roomId: string, messages: ChatMessage[]) => void;
  addTypingUser: (roomId: string, userId: string) => void;
  removeTypingUser: (roomId: string, userId: string) => void;
  setOnlineUsers: (userIds: string[]) => void;
  clearRoom: (roomId: string) => void;
}

type ChatStore = ChatState & ChatActions;

// ──────────────────────────────────────────────
// Store
// ──────────────────────────────────────────────

export const useChatStore = create<ChatStore>((set, get) => ({
  // State
  activeRoomId: null,
  messages: new Map(),
  typingUsers: new Map(),
  onlineUsers: new Set(),

  // Actions
  setActiveRoom: (roomId) =>
    set({ activeRoomId: roomId }),

  addMessage: (message) => {
    const { messages } = get();
    const roomMessages = messages.get(message.roomId) ?? [];

    // Prevent duplicate messages (idempotency for socket re-deliveries)
    if (roomMessages.some((m) => m.id === message.id)) {
      return;
    }

    const updated = new Map(messages);
    updated.set(message.roomId, [...roomMessages, message]);

    set({ messages: updated });
  },

  setMessages: (roomId, msgs) => {
    const updated = new Map(get().messages);
    updated.set(roomId, msgs);
    set({ messages: updated });
  },

  addTypingUser: (roomId, userId) => {
    const { typingUsers } = get();
    const current = typingUsers.get(roomId) ?? [];

    if (current.includes(userId)) return;

    const updated = new Map(typingUsers);
    updated.set(roomId, [...current, userId]);
    set({ typingUsers: updated });
  },

  removeTypingUser: (roomId, userId) => {
    const { typingUsers } = get();
    const current = typingUsers.get(roomId);

    if (!current) return;

    const filtered = current.filter((id) => id !== userId);
    const updated = new Map(typingUsers);

    if (filtered.length === 0) {
      updated.delete(roomId);
    } else {
      updated.set(roomId, filtered);
    }

    set({ typingUsers: updated });
  },

  setOnlineUsers: (userIds) =>
    set({ onlineUsers: new Set(userIds) }),

  clearRoom: (roomId) => {
    const updatedMessages = new Map(get().messages);
    updatedMessages.delete(roomId);

    const updatedTyping = new Map(get().typingUsers);
    updatedTyping.delete(roomId);

    set({
      messages: updatedMessages,
      typingUsers: updatedTyping,
      activeRoomId: get().activeRoomId === roomId ? null : get().activeRoomId,
    });
  },
}));
