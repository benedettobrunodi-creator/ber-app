import { create } from 'zustand';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

interface NotificationState {
  unreadCount: number;
  badgeVisible: boolean;
}

interface NotificationActions {
  setUnreadCount: (count: number) => void;
  incrementUnread: () => void;
  decrementUnread: () => void;
  clearBadge: () => void;
}

type NotificationStore = NotificationState & NotificationActions;

// ──────────────────────────────────────────────
// Store
// ──────────────────────────────────────────────

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  // State
  unreadCount: 0,
  badgeVisible: false,

  // Actions
  setUnreadCount: (count) =>
    set({
      unreadCount: Math.max(0, count),
      badgeVisible: count > 0,
    }),

  incrementUnread: () => {
    const next = get().unreadCount + 1;
    set({ unreadCount: next, badgeVisible: true });
  },

  decrementUnread: () => {
    const next = Math.max(0, get().unreadCount - 1);
    set({ unreadCount: next, badgeVisible: next > 0 });
  },

  clearBadge: () =>
    set({ unreadCount: 0, badgeVisible: false }),
}));
