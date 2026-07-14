import { useState } from 'react';
import { Check, X, Clock, Wifi, WifiOff } from 'lucide-react';
import { useApprovalWorkflow } from './useApprovalWorkflow';
import { useRealtimeApprovals } from './useRealtimeApprovals';

interface ApprovalQueuePanelProps {
  sessionId: string | null;
}

const STATUS_COLORS: Record<'pending' | 'approved' | 'rejected', string> = {
  pending: 'bg-yellow-900/20 border-yellow-700 text-yellow-300',
  approved: 'bg-green-900/20 border-green-700 text-green-300',
  rejected: 'bg-red-900/20 border-red-700 text-red-300',
};

const STATUS_ICONS: Record<'pending' | 'approved' | 'rejected', React.ReactNode> = {
  pending: <Clock size={14} />,
  approved: <Check size={14} />,
  rejected: <X size={14} />,
};

export function ApprovalQueuePanel({ sessionId }: ApprovalQueuePanelProps) {
  const { approveAudit, rejectAudit } = useApprovalWorkflow(sessionId);
  const { approvals, loading: rtLoading, error: rtError, connectionStatus } = useRealtimeApprovals();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});
  const [isActing, setIsActing] = useState<Record<string, boolean>>({});

  // Filter for pending approvals only (real-time)
  const pendingApprovals = approvals.filter((a) => a.status === 'pending');
  const completedApprovals = approvals.filter((a) => a.status !== 'pending');

  const handleApprove = async (approvalId: string) => {
    setIsActing((prev) => ({ ...prev, [approvalId]: true }));
    await approveAudit(approvalId);
    setIsActing((prev) => ({ ...prev, [approvalId]: false }));
    setExpandedId(null);
  };

  const handleReject = async (approvalId: string) => {
    const reason = rejectReason[approvalId] || 'No reason provided';
    setIsActing((prev) => ({ ...prev, [approvalId]: true }));
    await rejectAudit(approvalId, reason);
    setIsActing((prev) => ({ ...prev, [approvalId]: false }));
    setRejectReason((prev) => {
      const updated = { ...prev };
      delete updated[approvalId];
      return updated;
    });
    setExpandedId(null);
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
          Approval Queue
        </h3>
      </div>

      {/* Error */}
      {rtError && (
        <div className="text-xs text-red-400 bg-red-900/20 p-2 rounded border border-red-700">
          {rtError}
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
              ? 'Live Updates'
              : connectionStatus === 'reconnecting'
                ? 'Reconnecting…'
                : 'Offline'}
          </span>
        </div>
      </div>

      {/* Loading */}
      {rtLoading && pendingApprovals.length === 0 && (
        <div className="text-xs text-titanium-400 italic">
          Loading approvals...
        </div>
      )}

      {/* Pending Approvals */}
      {!rtLoading && pendingApprovals.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-titanium-300 font-mono">
            Pending ({pendingApprovals.length})
          </div>
          <div className="space-y-2">
            {pendingApprovals.map((approval) => (
              <div
                key={approval.id}
                className="space-y-2 px-3 py-2 bg-obsidian-800 rounded border border-yellow-700 bg-yellow-900/10"
              >
                <div className="flex items-start gap-2">
                  <div className="flex items-center gap-1 text-yellow-300 flex-shrink-0 mt-0.5">
                    {STATUS_ICONS.pending}
                    <span className="text-[10px] font-mono">pending</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-titanium-300">
                      Audit {approval.auditId.slice(0, 8)} from {approval.requestedByEmail}
                    </div>
                    <div className="text-[10px] text-titanium-600 mt-1">
                      Requested {new Date(approval.requestedAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                {expandedId === approval.id && (
                  <div className="space-y-2 border-t border-titanium-700 pt-2 mt-2">
                    <div className="text-[10px] text-titanium-500 bg-obsidian-700 p-2 rounded">
                      <div className="font-mono mb-1">Audit ID: {approval.auditId}</div>
                      <div className="font-mono">Command: {approval.commandId.slice(0, 12)}...</div>
                    </div>

                    <textarea
                      placeholder="Rejection reason (optional)"
                      value={rejectReason[approval.id] || ''}
                      onChange={(e) =>
                        setRejectReason((prev) => ({
                          ...prev,
                          [approval.id]: e.target.value,
                        }))
                      }
                      className="w-full px-2 py-1 bg-obsidian-800 border border-titanium-700 rounded text-xs text-titanium-300 placeholder-titanium-600 focus:outline-none focus:border-blue-500"
                      rows={2}
                    />

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(approval.id)}
                        disabled={isActing[approval.id]}
                        className="flex-1 px-2 py-1 bg-green-900 hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed text-green-300 font-mono text-xs rounded transition-colors flex items-center justify-center gap-1"
                      >
                        <Check size={12} />
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(approval.id)}
                        disabled={isActing[approval.id]}
                        className="flex-1 px-2 py-1 bg-red-900 hover:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed text-red-300 font-mono text-xs rounded transition-colors flex items-center justify-center gap-1"
                      >
                        <X size={12} />
                        Reject
                      </button>
                    </div>

                    <button
                      onClick={() => setExpandedId(null)}
                      className="w-full px-2 py-1 text-titanium-600 hover:text-titanium-400 font-mono text-xs rounded transition-colors"
                    >
                      Close
                    </button>
                  </div>
                )}

                {expandedId !== approval.id && (
                  <button
                    onClick={() => setExpandedId(approval.id)}
                    className="w-full px-2 py-1 text-titanium-600 hover:text-titanium-400 font-mono text-xs rounded transition-colors text-left"
                  >
                    Review →
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!rtLoading && pendingApprovals.length === 0 && (
        <div className="text-xs text-titanium-500 italic">
          No pending approvals
        </div>
      )}

      {/* Completed approvals */}
      {completedApprovals.length > 0 && (
        <div className="space-y-2 pt-4 border-t border-titanium-700">
          <div className="text-xs text-titanium-300 font-mono">
            History ({completedApprovals.length})
          </div>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {completedApprovals.map((approval) => (
              <div
                key={approval.id}
                className={`flex items-start gap-2 px-3 py-2 bg-obsidian-800 rounded border ${STATUS_COLORS[approval.status]}`}
              >
                <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                  {STATUS_ICONS[approval.status]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-titanium-300 truncate">
                    Audit {approval.auditId.slice(0, 8)}
                  </div>
                  <div className="text-[10px] text-titanium-600 mt-1">
                    {approval.status === 'approved' ? 'Approved' : 'Rejected'} by{' '}
                    {approval.approverEmail || 'unknown'} {approval.approvedAt && (
                      <>on {new Date(approval.approvedAt).toLocaleDateString()}</>
                    )}
                  </div>
                  {approval.reason && (
                    <div className="text-[10px] text-titanium-500 italic mt-1 truncate">
                      {approval.reason}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
