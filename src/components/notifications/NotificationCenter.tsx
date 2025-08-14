/**
 * Professional Notification System
 * Toast notifications with queuing, persistence and actions
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Info, 
  X, 
  MoreHorizontal,
  Undo2,
  ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAppStore, selectNotifications } from '@/core/state/AppStore';
import { Logger } from '@/core/logging/Logger';

interface NotificationAction {
  label: string;
  action: () => void;
  variant?: 'default' | 'outline' | 'destructive';
}

interface EnhancedNotification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message?: string;
  timestamp: number;
  dismissed?: boolean;
  persistent?: boolean;
  actions?: NotificationAction[];
  progress?: number;
  link?: {
    url: string;
    label: string;
  };
}

const NotificationComponent: React.FC<{
  notification: EnhancedNotification;
  onDismiss: (id: string) => void;
  onAction: (action: NotificationAction) => void;
}> = ({ notification, onDismiss, onAction }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!notification.persistent) {
      const duration = 5000; // 5 seconds
      const interval = setInterval(() => {
        const elapsed = Date.now() - notification.timestamp;
        const remaining = Math.max(0, duration - elapsed);
        
        if (remaining === 0) {
          onDismiss(notification.id);
        } else {
          setTimeLeft(remaining);
        }
      }, 100);

      return () => clearInterval(interval);
    }
  }, [notification, onDismiss]);

  const getIcon = () => {
    switch (notification.type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const getBorderColor = () => {
    switch (notification.type) {
      case 'success':
        return 'border-l-green-500';
      case 'warning':
        return 'border-l-yellow-500';
      case 'error':
        return 'border-l-red-500';
      default:
        return 'border-l-blue-500';
    }
  };

  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}j`;
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.9 }}
      transition={{ duration: 0.3, type: "spring", stiffness: 300 }}
      className={`
        relative bg-card border-l-4 ${getBorderColor()} rounded-lg shadow-elegant p-4 
        max-w-md w-full overflow-hidden
      `}
    >
      {/* Progress bar for auto-dismiss */}
      {!notification.persistent && timeLeft !== null && (
        <div className="absolute top-0 left-0 w-full h-1 bg-muted">
          <motion.div
            className="h-full bg-primary"
            initial={{ width: '100%' }}
            animate={{ width: `${(timeLeft / 5000) * 100}%` }}
            transition={{ duration: 0.1, ease: 'linear' }}
          />
        </div>
      )}

      {/* Notification progress */}
      {notification.progress !== undefined && (
        <div className="absolute top-0 left-0 w-full h-1 bg-muted">
          <motion.div
            className="h-full bg-primary"
            initial={{ width: '0%' }}
            animate={{ width: `${notification.progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      )}

      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {getIcon()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <h4 className="font-medium text-sm leading-tight">
                {notification.title}
              </h4>
              
              {notification.message && (
                <motion.p
                  className="text-xs text-muted-foreground mt-1 leading-relaxed"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 }}
                >
                  {isExpanded || notification.message.length <= 100
                    ? notification.message
                    : `${notification.message.substring(0, 100)}...`
                  }
                  
                  {notification.message.length > 100 && (
                    <button
                      onClick={() => setIsExpanded(!isExpanded)}
                      className="ml-1 text-primary hover:underline"
                    >
                      {isExpanded ? 'Moins' : 'Plus'}
                    </button>
                  )}
                </motion.p>
              )}
            </div>

            <div className="flex items-center gap-1">
              <Badge variant="outline" className="text-xs">
                {formatTimeAgo(notification.timestamp)}
              </Badge>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDismiss(notification.id)}
                className="h-6 w-6 p-0 hover:bg-muted"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          </div>

          {/* Actions */}
          {notification.actions && notification.actions.length > 0 && (
            <motion.div
              className="flex items-center gap-2 mt-3"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              {notification.actions.map((action, index) => (
                <Button
                  key={index}
                  variant={action.variant || 'outline'}
                  size="sm"
                  onClick={() => onAction(action)}
                  className="h-7 text-xs"
                >
                  {action.label}
                </Button>
              ))}
            </motion.div>
          )}

          {/* Link */}
          {notification.link && (
            <motion.div
              className="mt-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <a
                href={notification.link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ExternalLink className="w-3 h-3" />
                {notification.link.label}
              </a>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export const NotificationCenter: React.FC = () => {
  const notifications = useAppStore(selectNotifications);
  const { dismissNotification } = useAppStore();
  const [recentlyDismissed, setRecentlyDismissed] = useState<string[]>([]);

  const handleDismiss = (id: string) => {
    dismissNotification(id);
    setRecentlyDismissed(prev => [...prev, id]);
    
    // Remove from recently dismissed after 10 seconds
    setTimeout(() => {
      setRecentlyDismissed(prev => prev.filter(dismissedId => dismissedId !== id));
    }, 10000);
    
    Logger.logUserAction('dismiss_notification', { notificationId: id });
  };

  const handleAction = (action: NotificationAction) => {
    action.action();
    Logger.logUserAction('notification_action', { actionLabel: action.label });
  };

  const handleUndo = (id: string) => {
    // In a real app, you'd restore the notification from the recently dismissed list
    setRecentlyDismissed(prev => prev.filter(dismissedId => dismissedId !== id));
    Logger.logUserAction('undo_dismiss_notification', { notificationId: id });
  };

  return (
    <div className="fixed top-4 right-4 z-50 space-y-3 max-h-screen overflow-y-auto">
      <AnimatePresence mode="popLayout">
        {notifications.map((notification) => (
          <NotificationComponent
            key={notification.id}
            notification={notification as EnhancedNotification}
            onDismiss={handleDismiss}
            onAction={handleAction}
          />
        ))}
      </AnimatePresence>

      {/* Undo notifications */}
      <AnimatePresence>
        {recentlyDismissed.map((id) => (
          <motion.div
            key={`undo-${id}`}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-muted border rounded-lg p-3 max-w-md w-full"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-muted-foreground">
                Notification masquée
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleUndo(id)}
                className="h-6 text-xs"
              >
                <Undo2 className="w-3 h-3 mr-1" />
                Annuler
              </Button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

// Enhanced notification functions
export const createNotification = (
  type: EnhancedNotification['type'],
  title: string,
  options: Partial<Omit<EnhancedNotification, 'id' | 'type' | 'title' | 'timestamp'>> = {}
) => {
  const { addNotification } = useAppStore.getState();
  
  addNotification({
    type,
    title,
    ...options,
  });
};

export const createProgressNotification = (
  title: string,
  initialProgress = 0
): {
  id: string;
  updateProgress: (progress: number) => void;
  complete: (message?: string) => void;
  error: (message?: string) => void;
} => {
  const id = `progress_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  createNotification('info', title, {
    persistent: true,
    progress: initialProgress,
  });

  return {
    id,
    updateProgress: (progress: number) => {
      // Update notification progress
      const { ui } = useAppStore.getState();
      const notification = ui.notifications.find(n => n.id === id);
      if (notification) {
        (notification as any).progress = progress;
      }
    },
    complete: (message = 'Terminé avec succès') => {
      createNotification('success', title, { message });
      const { dismissNotification } = useAppStore.getState();
      dismissNotification(id);
    },
    error: (message = 'Une erreur est survenue') => {
      createNotification('error', title, { message });
      const { dismissNotification } = useAppStore.getState();
      dismissNotification(id);
    },
  };
};