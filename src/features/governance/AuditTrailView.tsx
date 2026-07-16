import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Filter, Search, ChevronDown, Clock, User, FileText,
  Edit2, Plus, Trash2, CheckCircle2, AlertCircle, Download,
} from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { AuthGate } from '../kodee/connections/AuthGate';
import { withPerformanceMonitoring } from './withPerformanceMonitoring';

interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: string;
  resourceType: string;
  resourceId: string;
  resourceName: string;
  userId: string;
  userName: string;
  oldValue?: string;
  newValue?: string;
  status: 'success' | 'failed';
  details?: string;
}

function _AuditTrailView() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

export const AuditTrailView = withPerformanceMonitoring(
  _AuditTrailView,
  'AuditTrailView',
  { threshold: 1000, maxRenders: 5 }
);

function Inner() {
  const { activeTenantId } = useTenant();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState<string>('all');
  const [filterResource, setFilterResource] = useState<string>('all');
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  const [logs, setLogs] = useState<AuditLogEntry[]>([
    {
      id: 'log-001',
      timestamp: '2026-07-05T14:32:00Z',
      action: 'UPDATE',
      resourceType: 'Control',
      resourceId: 'ctrl-iso27001-a5-1-1',
      resourceName: 'A.5.1.1 - Access Control Policy',
      userId: 'user-001',
      userName: 'Alice Chen',
      oldValue: 'Not Implemented (0)',
      newValue: 'Implemented (3)',
      status: 'success',
      details: 'Control maturity level updated following audit findings',
    },
    {
      id: 'log-002',
      timestamp: '2026-07-05T10:15:00Z',
      action: 'CREATE',
      resourceType: 'Gap',
      resourceId: 'gap-nist-005',
      resourceName: 'Multi-Factor Authentication Gap',
      userId: 'user-002',
      userName: 'Bob Johnson',
      newValue: 'Open - High Priority',
      status: 'success',
      details: 'Gap created from vulnerability scan results',
    },
    {
      id: 'log-003',
      timestamp: '2026-07-04T16:45:00Z',
      action: 'UPDATE',
      resourceType: 'Evidence',
      resourceId: 'evid-002451',
      resourceName: 'ISO 27001 Certification Document',
      userId: 'user-001',
      userName: 'Alice Chen',
      oldValue: 'No tags',
      newValue: 'Tags: [iso27001, certification, valid]',
      status: 'success',
    },
    {
      id: 'log-004',
      timestamp: '2026-07-04T14:22:00Z',
      action: 'DELETE',
      resourceType: 'Gap',
      resourceId: 'gap-outdated-001',
      resourceName: 'Resolved Vulnerability Gap',
      userId: 'user-003',
      userName: 'Security Team',
      oldValue: 'Open - Medium Priority',
      newValue: 'DELETED',
      status: 'success',
      details: 'Gap closed following remediation completion',
    },
    {
      id: 'log-005',
      timestamp: '2026-07-03T11:00:00Z',
      action: 'EXPORT',
      resourceType: 'ComplianceReport',
      resourceId: 'report-q2-2026',
      resourceName: 'Q2 2026 Compliance Report',
      userId: 'user-001',
      userName: 'Alice Chen',
      newValue: 'PDF exported (2.4 MB)',
      status: 'success',
      details: 'Report exported for stakeholder review',
    },
    {
      id: 'log-006',
      timestamp: '2026-07-02T09:30:00Z',
      action: 'UPDATE',
      resourceType: 'RemediationPlan',
      resourceId: 'plan-iso42001-001',
      resourceName: 'AI Governance Implementation Plan',
      userId: 'user-002',
      userName: 'Bob Johnson',
      oldValue: 'In Progress (45%)',
      newValue: 'In Progress (62%)',
      status: 'success',
      details: 'Milestone progress updated',
    },
  ]);

  const actions = ['all', 'CREATE', 'UPDATE', 'DELETE', 'EXPORT'];
  const resources = ['all', 'Control', 'Gap', 'Evidence', 'ComplianceReport', 'RemediationPlan'];

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.resourceName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.resourceId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesAction = filterAction === 'all' || log.action === filterAction;
    const matchesResource = filterResource === 'all' || log.resourceType === filterResource;

    return matchesSearch && matchesAction && matchesResource;
  });

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'CREATE': return <Plus className="h-4 w-4 text-emerald-400" />;
      case 'UPDATE': return <Edit2 className="h-4 w-4 text-blue-400" />;
      case 'DELETE': return <Trash2 className="h-4 w-4 text-red-400" />;
      case 'EXPORT': return <Download className="h-4 w-4 text-cyan-400" />;
      default: return <AlertCircle className="h-4 w-4 text-titanium-500" />;
    }
  };

  const getActionColor = (action: string): string => {
    switch (action) {
      case 'CREATE': return 'bg-emerald-900/20 text-emerald-300';
      case 'UPDATE': return 'bg-blue-900/20 text-blue-300';
      case 'DELETE': return 'bg-red-900/20 text-red-300';
      case 'EXPORT': return 'bg-cyan-900/20 text-cyan-300';
      default: return 'bg-titanium-900/20 text-titanium-300';
    }
  };

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4 justify-between">
        <div className="flex items-center gap-3">
          <Link to="/app/governance" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="font-display font-bold text-sm text-titanium-50">Audit Trail</div>
            <div className="text-[11px] text-titanium-400">Complete governance change log</div>
          </div>
        </div>
        <button className="px-3 py-1.5 bg-obsidian-800 border border-titanium-700 hover:border-titanium-600 text-titanium-300 text-xs font-semibold rounded-none transition-colors flex items-center gap-2">
          <Download className="h-3 w-3" />
          Export
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Search and Filters */}
        <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-4 space-y-4">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-titanium-500" />
              <input
                type="text"
                placeholder="Search by resource, user, or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-obsidian-800 border border-titanium-800 text-titanium-100 text-sm rounded-none focus:outline-none focus:border-cyan-600"
              />
            </div>
            <button className="px-3 py-2 bg-obsidian-800 border border-titanium-700 hover:border-titanium-600 text-titanium-300 text-xs font-semibold rounded-none transition-colors flex items-center gap-2">
              <Filter className="h-4 w-4" />
              More Filters
            </button>
          </div>

          <div className="flex gap-3 flex-wrap">
            <div>
              <label className="text-xs font-semibold text-titanium-400 block mb-1">Action</label>
              <select
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                className="px-3 py-1.5 bg-obsidian-800 border border-titanium-800 text-titanium-100 text-xs rounded-none focus:outline-none focus:border-cyan-600"
              >
                {actions.map((action) => (
                  <option key={action} value={action}>
                    {action === 'all' ? 'All Actions' : action}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-titanium-400 block mb-1">Resource Type</label>
              <select
                value={filterResource}
                onChange={(e) => setFilterResource(e.target.value)}
                className="px-3 py-1.5 bg-obsidian-800 border border-titanium-800 text-titanium-100 text-xs rounded-none focus:outline-none focus:border-cyan-600"
              >
                {resources.map((resource) => (
                  <option key={resource} value={resource}>
                    {resource === 'all' ? 'All Resources' : resource}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Audit Log Entries */}
        <div className="space-y-3">
          {filteredLogs.length === 0 ? (
            <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-8 text-center">
              <AlertCircle className="h-8 w-8 text-titanium-600 mx-auto mb-3" />
              <p className="text-titanium-400">No audit log entries found</p>
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div key={log.id} className="bg-obsidian-900 border border-titanium-900 rounded-none">
                <button
                  onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                  className="w-full px-4 py-4 flex items-start justify-between hover:bg-obsidian-800/50 transition-colors"
                >
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-3 mb-2">
                      {getActionIcon(log.action)}
                      <div className="flex-1">
                        <h3 className="font-semibold text-titanium-50 text-sm">{log.resourceName}</h3>
                        <div className="text-xs text-titanium-500 mt-0.5">
                          {log.resourceType} · ID: <span className="font-mono">{log.resourceId}</span>
                        </div>
                      </div>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-none ${getActionColor(log.action)}`}>
                        {log.action}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-titanium-500">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(log.timestamp).toLocaleString('de-DE')}
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {log.userName}
                      </span>
                      {log.status === 'success' ? (
                        <span className="flex items-center gap-1 text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" />
                          Success
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-400">
                          <AlertCircle className="h-3 w-3" />
                          Failed
                        </span>
                      )}
                    </div>
                  </div>

                  <ChevronDown
                    className={`h-4 w-4 text-titanium-500 mt-1 transition-transform shrink-0 ${
                      expandedLog === log.id ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {expandedLog === log.id && (
                  <div className="px-4 py-4 bg-obsidian-950/50 border-t border-titanium-800 space-y-4">
                    {log.oldValue && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-red-900/10 border border-red-800/30 rounded-none p-3">
                          <div className="text-xs font-semibold text-red-400 mb-1">Previous Value</div>
                          <div className="text-sm text-titanium-300 font-mono">{log.oldValue}</div>
                        </div>
                        <div className="bg-emerald-900/10 border border-emerald-800/30 rounded-none p-3">
                          <div className="text-xs font-semibold text-emerald-400 mb-1">New Value</div>
                          <div className="text-sm text-titanium-300 font-mono">{log.newValue}</div>
                        </div>
                      </div>
                    )}

                    {log.details && (
                      <div className="bg-obsidian-800 border border-titanium-800 rounded-none p-3">
                        <div className="text-xs font-semibold text-titanium-400 mb-1">Details</div>
                        <div className="text-sm text-titanium-300">{log.details}</div>
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-3 text-xs">
                      <div className="bg-obsidian-800 border border-titanium-800 rounded-none p-2">
                        <div className="font-semibold text-titanium-400">User ID</div>
                        <div className="text-titanium-300 font-mono mt-0.5">{log.userId}</div>
                      </div>
                      <div className="bg-obsidian-800 border border-titanium-800 rounded-none p-2">
                        <div className="font-semibold text-titanium-400">Resource ID</div>
                        <div className="text-titanium-300 font-mono mt-0.5">{log.resourceId}</div>
                      </div>
                      <div className="bg-obsidian-800 border border-titanium-800 rounded-none p-2">
                        <div className="font-semibold text-titanium-400">Entry ID</div>
                        <div className="text-titanium-300 font-mono mt-0.5">{log.id}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Pagination Hint */}
        <div className="text-center text-xs text-titanium-500">
          Showing {filteredLogs.length} of {logs.length} entries
        </div>
      </main>
    </div>
  );
}
