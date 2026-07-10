import { useState } from 'react';
import { Eye, Plus, Shield, Trash2, Check, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import { useRealtimeActivityLog } from './useRealtimeActivityLog';

interface ActivityLogPanelProps {
  sessionId: string | null;
}

const ACTION_TYPE_ICONS: Record<string, React.ReactNode> = {
  command: <Shield size={12} className="text-blue-400" />,
  member_join: <Plus size={12} className="text-green-400" />,
  member_leave: <Trash2 size={12} className="text-red-400" />,
  member_invited: <Eye size={12} className="text-cyan-400" />,
  approval_requested: <AlertCircle size={12} className="text-yellow-400" />,
  approval_completed: <Check size={12} className="text-purple-400" />,
};

export function ActivityLogPanel({ sessionId }: ActivityLogPanelProps) {
  const { activities, loading, error, connectionStatus } = useRealtimeActivityLog(sessionId, 100);

  const getRelativeTime = (date: Date): string => {
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return date.toLocaleDateString();
  };

  if (!sessionId) {
    return (
      <div className="p-4 text-titanium-400 text-sm">
        No session active
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 bg-obsidian-900 border-l border-titanium-700 max-w-sm">
      {/* Header */}
      <div>
        <h3 className="font-mono text-xs uppercase tracking-wider text-titanium-400 mb-3">
          Activity Log
        </h3>
      </div>

      {/* Error */}
      {error && (
        <div className="text-xs text-red-400 bg-red-900/20 p-2 rounded border border-red-700">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && activities.length === 0 && (
        <div className="text-xs text-titanium-400 italic">
          Loading activity...
        </div>
      )}

      {/* Activity List */}
      {!loading && activities.length > 0 && (
        <div className="space-y-1 max-h-96 overflow-y-auto">
          {activities.map((entry) => (
            <div
              key={entry.id}
              className="flex items-start gap-2 px-3 py-2 bg-obsidian-800 rounded border border-titanium-700 hover:border-titanium-600 transition-colors"
            >
              <div className="flex-shrink-0 mt-0.5">
                {ACTION_TYPE_ICONS[entry.actionType] || <Shield size={12} className="text-titanium-500" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-titanium-300 truncate">
                  {entry.action}
                </div>
                <div className="text-[10px] text-titanium-600 mt-1">
                  {getRelativeTime(entry.createdAt)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && activities.length === 0 && (
        <div className="text-xs text-titanium-500 italic">
          No activity yet
        </div>
      )}

      {/* Connection Status */}
      <div className="flex items-center justify-between px-3 py-2 bg-obsidian-800 rounded border border-titanium-700">
        <div className="flex items-center gap-2">
          {connectionStatus === 'connected' ? (
            <Wifi size={12} className="text-green-400 animate-pulse" />
          ) : (
            <WifiOff size={12} className="text-yellow-400" />
          )}
          <span className="font-mono text-[10px] text-titanium-500">
            {connectionStatus === 'connected'
              ? 'Live'
              : connectionStatus === 'reconnecting'
                ? 'Reconnecting…'
                : 'Offline'}
          </span>
        </div>
      </div>
    </div>
  );
}
