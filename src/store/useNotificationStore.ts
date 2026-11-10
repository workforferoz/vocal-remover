import { create } from 'zustand';
import type { NotificationItem } from '../types';

interface NotificationState {
  notifications: NotificationItem[];
  showNotification: (item: Omit<NotificationItem, 'id' | 'timestamp'>) => void;
  dismissNotification: (id: string) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],

  showNotification: (item) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newItem: NotificationItem = {
      ...item,
      id,
      timestamp: Date.now(),
      durationMs: item.durationMs ?? 4500,
    };

    set((state) => ({
      notifications: [...state.notifications.slice(-4), newItem],
    }));

    if (newItem.durationMs && newItem.durationMs > 0) {
      setTimeout(() => {
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        }));
      }, newItem.durationMs);
    }
  },

  dismissNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }));
  },
}));

