import { useCallback } from 'react';
import { useNotificationStore, NotificationType } from '@/stores/notificationStore';

/**
 * Custom hook for easy notification usage
 * Can be used as a drop-in replacement for toast patterns
 *
 * Usage:
 * const { notify, success, error, info, warning } = useNotification();
 *
 * // Simple usage
 * success("File saved!");
 * error("Something went wrong");
 *
 * // Or with notify for dynamic type
 * notify("success", "Operation completed");
 */
export function useNotification() {
  const addNotification = useNotificationStore((state) => state.addNotification);

  const notify = useCallback((type: NotificationType, message: string) => {
    addNotification(type, message);
  }, [addNotification]);

  const success = useCallback((message: string) => {
    addNotification('success', message);
  }, [addNotification]);

  const error = useCallback((message: string) => {
    addNotification('error', message);
  }, [addNotification]);

  const info = useCallback((message: string) => {
    addNotification('info', message);
  }, [addNotification]);

  const warning = useCallback((message: string) => {
    addNotification('warning', message);
  }, [addNotification]);

  return {
    notify,
    success,
    error,
    info,
    warning,
  };
}
