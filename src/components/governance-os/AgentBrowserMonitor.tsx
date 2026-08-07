import React, { useState, useEffect } from 'react';
import {
  Globe, Lock, AlertTriangle, CheckCircle2, Clock, Zap,
  Shield, Activity, BarChart3,
} from 'lucide-react';
import { useAgentBrowser } from '../../hooks/useAgentBrowser';
import type { AgentBrowserSessionWithContext } from '../../types/agent-browser';

export function AgentBrowserMonitor() {
  const [sessions, setSessions] = useState<AgentBrowserSessionWithContext[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<string | undefined>();
  const { listSessions, error } = useAgentBrowser();

  useEffect(() => {
    const loadSessions = async () => {
      setLoading(true);
      const data = await listSessions(selectedAgent);
      if (data) {
        setSessions(data);
      }
      setLoading(false);
    };

    loadSessions();
    const interval = setInterval(loadSessions, 5000); // Refresh every 5s
    return () => clearInterval(interval);
  }, [selectedAgent, listSessions]);

  const activeSessions = sessions.filter(s => s.status === 'active');
  const blockedSessions = sessions.filter(s => s.status === 'blocked');
  const completedSessions = sessions.filter(s => s.status === 'completed');

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <Activity className="h-4 w-4 text-cyan-400 animate-pulse" />;
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
      case 'blocked':
        return <Lock className="h-4 w-4 text-amber-500" />;
      case 'failed':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default:
        return <Globe className="h-4 w-4 text-titanium-500" />;
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'active':
        return 'bg-cyan-950 border-cyan-800';
      case 'completed':
        return 'bg-emerald-950 border-emerald-800';
      case 'blocked':
        return 'bg-amber-950 border-amber-800';
      case 'failed':
        return 'bg-red-950 border-red-800';
      default:
        return 'bg-obsidian-800 border-titanium-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-titanium-50 flex items-center gap-2 mb-2">
          <Shield className="h-5 w-5 text-cyan-400" />
          Agent Browser Monitor
        </h2>
        <p className="text-sm text-titanium-500">
          Real-time tracking of AI agent browsing sessions with policy enforcement and evidence collection.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="bg-obsidian-800 border border-titanium-800 rounded p-4">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="h-4 w-4 text-cyan-400" />
            <span className="text-xs uppercase tracking-widest text-titanium-600">Active</span>
          </div>
          <p className="text-2xl font-bold text-titanium-50">{activeSessions.length}</p>
        </div>

        <div className="bg-obsidian-800 border border-titanium-800 rounded p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span className="text-xs uppercase tracking-widest text-titanium-600">Completed</span>
          </div>
          <p className="text-2xl font-bold text-titanium-50">{completedSessions.length}</p>
        </div>

        <div className="bg-obsidian-800 border border-titanium-800 rounded p-4">
          <div className="flex items-center gap-2 mb-1">
            <Lock className="h-4 w-4 text-amber-500" />
            <span className="text-xs uppercase tracking-widest text-titanium-600">Blocked</span>
          </div>
          <p className="text-2xl font-bold text-titanium-50">{blockedSessions.length}</p>
        </div>

        <div className="bg-obsidian-800 border border-titanium-800 rounded p-4">
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="h-4 w-4 text-emerald-400" />
            <span className="text-xs uppercase tracking-widest text-titanium-600">Evidence Items</span>
          </div>
          <p className="text-2xl font-bold text-titanium-50">
            {sessions.reduce((sum, s) => sum + s.evidence_items, 0)}
          </p>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-950 border border-red-800 rounded p-3 text-sm text-red-200">
          Error: {error}
        </div>
      )}

      {/* Active Sessions */}
      {activeSessions.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-titanium-100 flex items-center gap-2">
            <Zap className="h-4 w-4 text-cyan-400" />
            Active Sessions ({activeSessions.length})
          </h3>
          <div className="space-y-2">
            {activeSessions.map(session => (
              <div
                key={session.id}
                className={`border rounded p-4 bg-obsidian-900 space-y-2 ${getStatusColor(session.status)}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {getStatusIcon(session.status)}
                      <span className="font-mono text-sm font-semibold text-titanium-100">
                        {session.agent_id}
                      </span>
                      <span className="text-xs bg-obsidian-800 text-titanium-400 px-2 py-1 rounded">
                        {session.session_key.slice(0, 8)}
                      </span>
                    </div>
                    <a
                      href={session.initial_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-cyan-400 hover:text-cyan-300 truncate block"
                    >
                      {session.initial_url}
                    </a>
                  </div>
                </div>

                {/* Progress */}
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-titanium-600">Actions:</span>
                    <span className="font-mono ml-1 text-emerald-400">
                      {session.action_count}
                    </span>
                  </div>
                  <div>
                    <span className="text-titanium-600">Blocked:</span>
                    <span className={`font-mono ml-1 ${session.blocked_actions > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {session.blocked_actions}
                    </span>
                  </div>
                  <div>
                    <span className="text-titanium-600">Evidence:</span>
                    <span className="font-mono ml-1 text-cyan-400">
                      {session.evidence_items}
                    </span>
                  </div>
                </div>

                {/* Duration */}
                <div className="text-xs text-titanium-500 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Running {session.duration_ms ? `${Math.round(session.duration_ms / 1000)}s` : 'since ' + new Date(session.started_at).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Blocked Sessions (Policy Violations) */}
      {blockedSessions.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-titanium-100 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Policy Violations ({blockedSessions.length})
          </h3>
          <div className="space-y-2">
            {blockedSessions.map(session => (
              <div
                key={session.id}
                className={`border rounded p-4 bg-obsidian-900 ${getStatusColor(session.status)}`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      {getStatusIcon(session.status)}
                      <span className="font-mono text-sm font-semibold text-titanium-100">
                        {session.agent_id}
                      </span>
                    </div>
                    <p className="text-sm text-amber-300 mb-1">
                      {session.policy_violation_reason || 'Policy check failed'}
                    </p>
                    {session.policy_name && (
                      <p className="text-xs text-titanium-500">
                        Policy: <span className="text-titanium-400">{session.policy_name}</span>
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-titanium-600 whitespace-nowrap ml-2">
                    {new Date(session.started_at).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="text-center py-8 text-titanium-500">
          <Zap className="h-5 w-5 inline-block animate-pulse mr-2" />
          Loading sessions...
        </div>
      )}

      {/* Empty State */}
      {!loading && sessions.length === 0 && (
        <div className="text-center py-12 border border-dashed border-titanium-800 rounded">
          <Globe className="h-8 w-8 text-titanium-700 mx-auto mb-3" />
          <p className="text-titanium-500">No browser sessions yet.</p>
          <p className="text-xs text-titanium-600">Agent-initiated browsing sessions will appear here.</p>
        </div>
      )}
    </div>
  );
}
