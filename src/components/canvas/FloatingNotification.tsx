import { motion, AnimatePresence } from 'framer-motion';
import { useNotificationStore } from '@/stores/notificationStore';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const iconMap = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const colorMap = {
  success: 'bg-green-500/20 border-green-500/40 text-green-300',
  error: 'bg-red-500/20 border-red-500/40 text-red-300',
  warning: 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300',
  info: 'bg-blue-500/20 border-blue-500/40 text-blue-300',
};

const iconColorMap = {
  success: 'text-green-400',
  error: 'text-red-400',
  warning: 'text-yellow-400',
  info: 'text-blue-400',
};

interface FloatingNotificationProps {
  bellRef?: React.RefObject<HTMLButtonElement | null>;
}

export function FloatingNotification({ bellRef }: FloatingNotificationProps) {
  const { activeNotification, clearActiveNotification } = useNotificationStore();

  const handleDismiss = () => {
    clearActiveNotification();
  };

  // Calculate fly-to position based on bell location
  const getFlyToPosition = () => {
    if (bellRef?.current) {
      const rect = bellRef.current.getBoundingClientRect();
      return {
        x: rect.left + rect.width / 2 - window.innerWidth / 2,
        y: rect.top - window.innerHeight + 100,
        scale: 0,
        opacity: 0,
      };
    }
    // Default fly-to-top-right if no bell ref
    return { x: 200, y: -300, scale: 0, opacity: 0 };
  };

  return (
    <AnimatePresence mode="wait">
      {activeNotification && (
        <motion.div
          key={activeNotification.id}
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={
            activeNotification.flyToHeader
              ? getFlyToPosition()
              : { opacity: 1, y: 0, scale: 1 }
          }
          exit={{ opacity: 0, y: -20, scale: 0.9 }}
          transition={{
            type: 'spring',
            stiffness: 400,
            damping: 30,
            duration: activeNotification.flyToHeader ? 0.4 : 0.3,
          }}
          data-testid="floating-notification"
          data-notification-type={activeNotification.type}
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-sm shadow-lg ${colorMap[activeNotification.type]}`}
        >
          {(() => {
            const Icon = iconMap[activeNotification.type];
            return <Icon className={`w-5 h-5 flex-shrink-0 ${iconColorMap[activeNotification.type]}`} />;
          })()}
          <span className="text-sm font-medium text-white/90 max-w-xs">
            {activeNotification.message}
          </span>
          <button
            onClick={handleDismiss}
            className="ml-2 p-1 rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4 text-white/60" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
