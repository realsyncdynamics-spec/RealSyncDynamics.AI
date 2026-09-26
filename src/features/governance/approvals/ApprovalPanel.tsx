/**
 * ApprovalPanel – Slide-in decision interface for approval gates.
 * Integrated into GovernanceInspectorPanel for seamless workflow.
 *
 * Shows:
 * - Gate details (action, reason, risk level)
 * - Timeline (created, decision window)
 * - Action buttons (APPROVE / DENY)
 * - Decision audit trail
 */

import React, { useState } from 'react';
import type { ApprovalGateRecord } from '../../../core/runtime/approvals';
import { PostgresApprovalGateService } from '../../../core/runtime/approvals/postgres-implementation';
import { createSupabaseClient } from '../../../lib/supabase';

interface ApprovalPanelProps {
  gate: ApprovalGateRecord;
  onClose: () => void;
  onChange: () => void; // Trigger parent refresh after decision
}

export function ApprovalPanel({ gate, onClose, onChange }: ApprovalPanelProps) {
  const [isDeciding, setIsDeciding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const riskColors: Record<string, string> = {
    low: 'bg-blue-100 text-blue-800',
    medium: 'bg-yellow-100 text-yellow-800',
    high: 'bg-orange-100 text-orange-800',
    critical: 'bg-red-100 text-red-800',
  };

  const statusBadges: Record<ApprovalGateRecord['status'], { label: string; color: string }> = {
    pending: { label: 'Waiting', color: 'bg-gray-100 text-gray-800' },
    granted: { label: 'Approved', color: 'bg-green-100 text-green-800' },
    denied: { label: 'Rejected', color: 'bg-red-100 text-red-800' },
    expired: { label: 'Expired', color: 'bg-gray-200 text-gray-800' },
  };

  const handleApprove = async () => {
    setIsDeciding(true);
    setError(null);

    try {
      const supabase = createSupabaseClient();
      const service = new PostgresApprovalGateService(supabase);

      // Get current user ID (from auth session)
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      await service.decide({
        id: gate.id,
        status: 'granted',
        decided_by: user.id,
      });

      onChange(); // Refresh parent
      // In a real app, this might trigger automatic re-execution
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve');
    } finally {
      setIsDeciding(false);
    }
  };

  const handleDeny = async () => {
    setIsDeciding(true);
    setError(null);

    try {
      const supabase = createSupabaseClient();
      const service = new PostgresApprovalGateService(supabase);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      await service.decide({
        id: gate.id,
        status: 'denied',
        decided_by: user.id,
      });

      onChange();
      onClose(); // Close panel after denial
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deny');
    } finally {
      setIsDeciding(false);
    }
  };

  const formattedCreatedAt = new Date(gate.created_at).toLocaleString('de-DE', {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  const formattedDecidedAt = gate.decided_at
    ? new Date(gate.decided_at).toLocaleString('de-DE', {
        year: '2-digit',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  const isDecided = gate.status !== 'pending';
  const isExpired = gate.status === 'expired';

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Approval Required
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              {gate.requested_action}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
        {/* Status Badge */}
        <div>
          <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${statusBadges[gate.status].color}`}>
            {statusBadges[gate.status].label}
          </div>
        </div>

        {/* Reason */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            Reason
          </label>
          <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{gate.reason}</p>
        </div>

        {/* Risk Level */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            Risk Level
          </label>
          <div className="mt-2">
            <span className={`inline-block px-3 py-1 rounded text-sm font-medium ${riskColors[gate.risk_level]}`}>
              {gate.risk_level.charAt(0).toUpperCase() + gate.risk_level.slice(1)}
            </span>
          </div>
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Requested
            </label>
            <p className="mt-1 text-sm font-mono text-slate-700 dark:text-slate-300">{formattedCreatedAt}</p>
          </div>

          {formattedDecidedAt && (
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Decided
              </label>
              <p className="mt-1 text-sm font-mono text-slate-700 dark:text-slate-300">{formattedDecidedAt}</p>
            </div>
          )}

          {gate.decided_by && (
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Decided By
              </label>
              <p className="mt-1 text-sm font-mono text-slate-700 dark:text-slate-300">{gate.decided_by}</p>
            </div>
          )}
        </div>

        {/* Execution ID (for evidence linking) */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            Execution ID
          </label>
          <p className="mt-1 text-xs font-mono text-slate-600 dark:text-slate-400 break-all">{gate.execution_id}</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 rounded-lg">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}
      </div>

      {/* Footer: Action Buttons */}
      {!isDecided && !isExpired && (
        <div className="border-t border-slate-200 dark:border-slate-700 px-6 py-4 bg-slate-50 dark:bg-slate-800/50 flex gap-3">
          <button
            onClick={handleDeny}
            disabled={isDeciding}
            className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-medium rounded-lg transition"
          >
            {isDeciding ? 'Processing...' : 'Deny'}
          </button>
          <button
            onClick={handleApprove}
            disabled={isDeciding}
            className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium rounded-lg transition"
          >
            {isDeciding ? 'Processing...' : 'Approve'}
          </button>
        </div>
      )}

      {isExpired && (
        <div className="border-t border-slate-200 dark:border-slate-700 px-6 py-4 bg-slate-50 dark:bg-slate-800/50">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            ⏱ This approval request has expired and can no longer be decided.
          </p>
        </div>
      )}

      {isDecided && !isExpired && (
        <div className="border-t border-slate-200 dark:border-slate-700 px-6 py-4 bg-slate-50 dark:bg-slate-800/50">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-900 dark:text-white font-medium rounded-lg transition"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}

export default ApprovalPanel;
