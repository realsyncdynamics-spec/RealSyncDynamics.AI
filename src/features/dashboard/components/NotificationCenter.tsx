import { useState, useEffect } from 'react';
import { Bell, X, AlertCircle, CheckCircle2, Info, Zap } from 'lucide-react';

interface Notification {
  id: string;
  type: 'alert' | 'digest' | 'reminder' | 'achievement';
  title: string;
  body: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  isRead: boolean;
  actionUrl?: string;
  actionLabel?: string;
  createdAt: string;
}

interface NotificationCenterProps {
  notifications: Notification[];
  unreadCount: number;
  onMarkAsRead?: (id: string) => void;
  onDismiss?: (id: string) => void;
  onAction?: (notification: Notification) => void;
}

const priorityConfig = {
  low: { color: 'bg-blue-500/10 border-blue-500/20', textColor: 'text-blue-400', label: 'Low' },
  medium: { color: 'bg-yellow-500/10 border-yellow-500/20', textColor: 'text-yellow-400', label: 'Medium' },
  high: { color: 'bg-orange-500/10 border-orange-500/20', textColor: 'text-orange-400', label: 'High' },
  critical: { color: 'bg-red-500/10 border-red-500/20', textColor: 'text-red-400', label: 'Critical' },
};

const typeIcons = {
  alert: <AlertCircle size={16} />,
  digest: <Zap size={16} />,
  reminder: <Info size={16} />,
  achievement: <CheckCircle2 size={16} />,
};

function formatTimeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

export function NotificationCenter({
  notifications,
  unreadCount,
  onMarkAsRead,
  onDismiss,
  onAction,
}: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread' | 'alert' | 'digest'>('all');

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'unread') return !n.isRead;
    if (filter === 'alert') return n.type === 'alert';
    if (filter === 'digest') return n.type === 'digest';
    return true;
  });

  const handleMarkAsRead = (id: string) => {
    if (onMarkAsRead) {
      onMarkAsRead(id);
    }
  };

  const handleDismiss = (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    if (onDismiss) {
      onDismiss(id);
    }
  };

  const handleAction = (notification: Notification) => {
    handleMarkAsRead(notification.id);
    if (onAction) {
      onAction(notification);
    }
  };

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-obsidian-800 transition-colors text-titanium-400 hover:text-titanium-50"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center w-5 h-5 text-xs font-bold bg-red-500 text-white rounded-full">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-obsidian-800 border border-obsidian-700 rounded-lg shadow-2xl overflow-hidden z-50">
          {/* Header */}
          <div className="bg-obsidian-900 border-b border-obsidian-700 px-4 py-3 flex items-center justify-between">
            <h3 className="font-semibold text-titanium-50 flex items-center gap-2">
              <Bell size={16} />
              Notifications
              {unreadCount > 0 && (
                <span className="ml-auto text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </h3>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-obsidian-800 rounded transition-colors text-titanium-400"
            >
              <X size={16} />
            </button>
          </div>

          {/* Filters */}
          <div className="border-b border-obsidian-700 px-4 py-2 flex gap-1 overflow-x-auto">
            {(['all', 'unread', 'alert', 'digest'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2.5 py-1 rounded text-xs font-medium whitespace-nowrap transition-colors ${
                  filter === f
                    ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/40'
                    : 'bg-obsidian-900 text-titanium-400 border border-obsidian-700 hover:text-titanium-50'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto">
            {filteredNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-titanium-400">
                <Bell size={32} className="opacity-30 mb-2" />
                <p className="text-sm">No notifications</p>
              </div>
            ) : (
              <div className="divide-y divide-obsidian-700">
                {filteredNotifications.map((notification) => {
                  const priority = priorityConfig[notification.priority];
                  return (
                    <div
                      key={notification.id}
                      onClick={() => handleMarkAsRead(notification.id)}
                      className={`px-4 py-3 transition-colors cursor-pointer hover:bg-obsidian-700/50 ${
                        !notification.isRead ? 'bg-obsidian-750/50' : ''
                      }`}
                    >
                      <div className="flex gap-3">
                        {/* Icon */}
                        <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${priority.color}`}>
                          {typeIcons[notification.type]}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h4 className={`font-medium text-sm ${!notification.isRead ? 'text-titanium-50' : 'text-titanium-400'}`}>
                              {notification.title}
                            </h4>
                            {!notification.isRead && (
                              <div className="w-2 h-2 rounded-full bg-cyan-400 flex-shrink-0 mt-1" />
                            )}
                          </div>
                          <p className="text-xs text-titanium-500 mb-2 line-clamp-2">
                            {notification.body}
                          </p>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-titanium-600">
                              {formatTimeAgo(notification.createdAt)}
                            </span>
                            <div className="flex items-center gap-2">
                              {notification.actionUrl && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAction(notification);
                                  }}
                                  className="text-xs text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
                                >
                                  {notification.actionLabel || 'View'}
                                </button>
                              )}
                              <button
                                onClick={(e) => handleDismiss(notification.id, e)}
                                className="p-0.5 hover:bg-obsidian-700 rounded transition-colors text-titanium-600 hover:text-titanium-400"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t border-obsidian-700 px-4 py-3 bg-obsidian-900 text-center">
              <a href="/app/notifications" className="text-xs text-cyan-400 hover:text-cyan-300 font-medium transition-colors">
                View all notifications →
              </a>
            </div>
          )}
        </div>
      )}

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
