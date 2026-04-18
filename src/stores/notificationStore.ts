import { create } from 'zustand';

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  timestamp: number;
  read: boolean;
  flyToHeader?: boolean; // trigger animation
}

interface NotificationState {
  notifications: Notification[];
  activeNotification: Notification | null;
  unreadCount: number;
  addNotification: (type: NotificationType, message: string) => void;
  dismissNotification: (id: string) => void;
  clearActiveNotification: () => void;
  clearAll: () => void;
  markAllRead: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  activeNotification: null,
  unreadCount: 0,

  addNotification: (type, message) => {
    const notification: Notification = {
      id: crypto.randomUUID(),
      type,
      message,
      timestamp: Date.now(),
      read: false,
      flyToHeader: false,
    };

    set((state) => ({
      notifications: [notification, ...state.notifications].slice(0, 50), // Keep max 50
      activeNotification: notification,
      unreadCount: state.unreadCount + 1,
    }));

    const visibleDurationMs = type === 'error' ? 6000 : 3000;

    // Auto-dismiss active notification after a short visible period
    setTimeout(() => {
      const current = get().activeNotification;
      if (current?.id === notification.id) {
        // Trigger fly-to-header animation
        set({ activeNotification: { ...notification, flyToHeader: true } });

        // Clear after animation completes
        setTimeout(() => {
          set((state) => ({
            activeNotification: state.activeNotification?.id === notification.id
              ? null
              : state.activeNotification,
          }));
        }, 500);
      }
    }, visibleDurationMs);
  },

  dismissNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
      activeNotification: state.activeNotification?.id === id ? null : state.activeNotification,
      unreadCount: Math.max(0, state.unreadCount - (state.notifications.find(n => n.id === id && !n.read) ? 1 : 0)),
    }));
  },

  clearActiveNotification: () => {
    set({ activeNotification: null });
  },

  clearAll: () => {
    set({ notifications: [], unreadCount: 0 });
  },

  markAllRead: () => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    }));
  },
}));
