import { useState, forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNotificationStore } from '@/stores/notificationStore';
import { Bell, CheckCircle, XCircle, AlertTriangle, Info, X, Trash2, Check } from 'lucide-react';

const iconMap = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const dotColorMap = {
  success: 'bg-green-400',
  error: 'bg-red-400',
  warning: 'bg-yellow-400',
  info: 'bg-blue-400',
};

export const NotificationCenter = forwardRef<HTMLButtonElement>((_, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const { notifications, unreadCount, dismissNotification, clearAll, markAllRead } = useNotificationStore();

  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  const handleToggle = () => {
    setIsOpen(!isOpen);
    if (!isOpen && unreadCount > 0) {
      // Mark as read when opening
      setTimeout(() => markAllRead(), 300);
    }
  };

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        ref={ref}
        onClick={handleToggle}
        className="relative p-2 rounded-lg hover:bg-white/10 transition-colors"
      >
        <Bell className="w-5 h-5 text-white/80" />
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center px-1 bg-gradient-to-r from-pink-500 to-violet-500 rounded-full text-[10px] font-bold text-white"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </motion.div>
          )}
        </AnimatePresence>
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />

            {/* Dropdown Panel */}
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="absolute right-0 top-full mt-2 w-80 max-h-[400px] bg-[#2D2A3E]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                <span className="text-sm font-semibold text-white">Notifications</span>

                <div className="flex items-center gap-2">
                  {/* Mark all read - only show if unread exist */}
                  {notifications.some(n => !n.read) && (
                    <button
                      onClick={() => {
                        markAllRead();
                      }}
                      className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                      title="Mark all as read"
                    >
                      <Check className="w-4 h-4 text-white/50 hover:text-emerald-400" />
                    </button>
                  )}

                  {/* Clear all - only show if notifications exist */}
                  {notifications.length > 0 && (
                    <button
                      onClick={clearAll}
                      className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                      title="Clear all"
                    >
                      <Trash2 className="w-4 h-4 text-white/50 hover:text-red-400" />
                    </button>
                  )}
                </div>
              </div>

              {/* Notifications List */}
              <div className="overflow-y-auto max-h-[340px]">
                {notifications.length === 0 ? (
                  <div className="py-12 text-center text-white/40">
                    <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No notifications yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {notifications.map((notification) => {
                      const Icon = iconMap[notification.type];
                      return (
                        <motion.div
                          key={notification.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          className={`flex items-start gap-3 px-4 py-3 hover:bg-white/5 transition-colors group ${
                            !notification.read ? 'bg-white/5' : ''
                          }`}
                        >
                          {/* Type indicator dot */}
                          <div className="pt-1.5">
                            <div className={`w-2 h-2 rounded-full ${dotColorMap[notification.type]}`} />
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start gap-2">
                              <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                                notification.type === 'success' ? 'text-green-400' :
                                notification.type === 'error' ? 'text-red-400' :
                                notification.type === 'warning' ? 'text-yellow-400' :
                                'text-blue-400'
                              }`} />
                              <p className="text-sm text-white/90 leading-snug">
                                {notification.message}
                              </p>
                            </div>
                            <p className="text-xs text-white/40 mt-1 ml-6">
                              {formatTime(notification.timestamp)}
                            </p>
                          </div>

                          {/* Dismiss button */}
                          <button
                            onClick={() => dismissNotification(notification.id)}
                            className="p-1 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-white/10 transition-all"
                          >
                            <X className="w-3.5 h-3.5 text-white/60" />
                          </button>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
});

NotificationCenter.displayName = 'NotificationCenter';
