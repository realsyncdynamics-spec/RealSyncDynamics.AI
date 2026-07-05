import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Plus, User, Users, MessageSquare, Clock, AlertCircle,
  CheckCircle2, Trash2, Edit2, ChevronDown, Mail, Phone, Shield,
} from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { AuthGate } from '../kodee/connections/AuthGate';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'editor' | 'viewer';
  joinedAt: string;
  avatar?: string;
  assignments: {
    frameworks: number;
    gaps: number;
    plans: number;
  };
}

interface TaskAssignment {
  id: string;
  type: 'gap' | 'control' | 'plan';
  name: string;
  assignedTo: string;
  dueDate: string;
  status: 'open' | 'in-progress' | 'completed';
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export function GovernanceTeamView() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

function Inner() {
  const { activeTenantId } = useTenant();
  const [view, setView] = useState<'members' | 'assignments' | 'workload'>('members');
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [expandedMember, setExpandedMember] = useState<string | null>(null);

  const [members, setMembers] = useState<TeamMember[]>([
    {
      id: 'user-001',
      name: 'Alice Chen',
      email: 'alice@company.com',
      role: 'owner',
      joinedAt: '2025-01-15',
      assignments: { frameworks: 5, gaps: 12, plans: 3 },
    },
    {
      id: 'user-002',
      name: 'Bob Johnson',
      email: 'bob@company.com',
      role: 'editor',
      joinedAt: '2025-02-20',
      assignments: { frameworks: 3, gaps: 8, plans: 2 },
    },
    {
      id: 'user-003',
      name: 'Security Team',
      email: 'security@company.com',
      role: 'editor',
      joinedAt: '2025-03-10',
      assignments: { frameworks: 2, gaps: 15, plans: 1 },
    },
    {
      id: 'user-004',
      name: 'External Auditor',
      email: 'auditor@external.com',
      role: 'viewer',
      joinedAt: '2026-06-01',
      assignments: { frameworks: 0, gaps: 0, plans: 0 },
    },
  ]);

  const [assignments, setAssignments] = useState<TaskAssignment[]>([
    {
      id: 'assign-001',
      type: 'gap',
      name: 'Multi-Factor Authentication Implementation',
      assignedTo: 'user-002',
      dueDate: '2026-08-15',
      status: 'in-progress',
      priority: 'high',
    },
    {
      id: 'assign-002',
      type: 'control',
      name: 'ISO 27001 A.5.1.1 - Access Control Policy',
      assignedTo: 'user-001',
      dueDate: '2026-07-31',
      status: 'in-progress',
      priority: 'medium',
    },
    {
      id: 'assign-003',
      type: 'plan',
      name: 'AI Governance Implementation Plan',
      assignedTo: 'user-003',
      dueDate: '2026-09-30',
      status: 'open',
      priority: 'high',
    },
    {
      id: 'assign-004',
      type: 'gap',
      name: 'Data Encryption Gap Remediation',
      assignedTo: 'user-002',
      dueDate: '2026-08-01',
      status: 'completed',
      priority: 'critical',
    },
  ]);

  const getMemberName = (userId: string) => {
    return members.find(m => m.id === userId)?.name || 'Unknown';
  };

  const getPriorityColor = (priority: string): string => {
    switch (priority) {
      case 'critical': return 'text-red-400 bg-red-900/20';
      case 'high': return 'text-amber-400 bg-amber-900/20';
      case 'medium': return 'text-cyan-400 bg-cyan-900/20';
      case 'low': return 'text-emerald-400 bg-emerald-900/20';
      default: return 'text-titanium-400 bg-titanium-900/20';
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'completed': return 'text-emerald-400 bg-emerald-900/20';
      case 'in-progress': return 'text-blue-400 bg-blue-900/20';
      case 'open': return 'text-amber-400 bg-amber-900/20';
      default: return 'text-titanium-400 bg-titanium-900/20';
    }
  };

  const userAssignments = selectedMember
    ? assignments.filter(a => a.assignedTo === selectedMember)
    : [];

  const myAssignments = assignments.filter(a => a.status !== 'completed');

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4 justify-between">
        <div className="flex items-center gap-3">
          <Link to="/app/governance" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="font-display font-bold text-sm text-titanium-50">Team Collaboration</div>
            <div className="text-[11px] text-titanium-400">Team members, assignments, and workload</div>
          </div>
        </div>
        <button className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-none transition-colors flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Invite Member
        </button>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* View Tabs */}
        <div className="flex gap-3 border-b border-titanium-900 pb-4">
          <button
            onClick={() => setView('members')}
            className={`px-4 py-2 font-semibold text-xs rounded-none transition-colors ${
              view === 'members'
                ? 'bg-cyan-600 text-white'
                : 'text-titanium-400 hover:text-titanium-200'
            }`}
          >
            Team Members
          </button>
          <button
            onClick={() => setView('assignments')}
            className={`px-4 py-2 font-semibold text-xs rounded-none transition-colors ${
              view === 'assignments'
                ? 'bg-cyan-600 text-white'
                : 'text-titanium-400 hover:text-titanium-200'
            }`}
          >
            Assignments
          </button>
          <button
            onClick={() => setView('workload')}
            className={`px-4 py-2 font-semibold text-xs rounded-none transition-colors ${
              view === 'workload'
                ? 'bg-cyan-600 text-white'
                : 'text-titanium-400 hover:text-titanium-200'
            }`}
          >
            My Workload
          </button>
        </div>

        {/* Members View */}
        {view === 'members' && (
          <div className="space-y-4">
            {members.map((member) => (
              <div key={member.id} className="bg-obsidian-900 border border-titanium-900 rounded-none">
                <button
                  onClick={() => setExpandedMember(expandedMember === member.id ? null : member.id)}
                  className="w-full px-4 py-4 flex items-start justify-between hover:bg-obsidian-800/50 transition-colors"
                >
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-600 to-cyan-400 flex items-center justify-center">
                        <User className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-titanium-50">{member.name}</h3>
                        <p className="text-xs text-titanium-400">{member.email}</p>
                      </div>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-none ml-auto ${
                        member.role === 'owner' ? 'bg-red-900/30 text-red-300' :
                        member.role === 'editor' ? 'bg-blue-900/30 text-blue-300' :
                        'bg-titanium-900/30 text-titanium-300'
                      }`}>
                        {member.role.toUpperCase()}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-titanium-500">
                      <span>Joined: {new Date(member.joinedAt).toLocaleDateString()}</span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {member.assignments.frameworks} frameworks
                      </span>
                      <span className="flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {member.assignments.gaps} gaps
                      </span>
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        {member.assignments.plans} plans
                      </span>
                    </div>
                  </div>

                  <ChevronDown
                    className={`h-4 w-4 text-titanium-500 mt-1 transition-transform shrink-0 ${
                      expandedMember === member.id ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {expandedMember === member.id && (
                  <div className="px-4 py-4 bg-obsidian-950/50 border-t border-titanium-800 space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-obsidian-800 border border-titanium-800 rounded-none p-3">
                        <div className="text-xs font-semibold text-titanium-400 mb-1">Email</div>
                        <div className="text-sm text-titanium-300 flex items-center gap-2">
                          <Mail className="h-3 w-3" />
                          {member.email}
                        </div>
                      </div>
                      <div className="bg-obsidian-800 border border-titanium-800 rounded-none p-3">
                        <div className="text-xs font-semibold text-titanium-400 mb-1">Role</div>
                        <div className="text-sm text-titanium-300 flex items-center gap-2">
                          <Shield className="h-3 w-3" />
                          {member.role}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button className="px-3 py-2 bg-cyan-900/30 border border-cyan-700 hover:bg-cyan-900/50 text-cyan-300 text-xs font-semibold rounded-none transition-colors flex items-center gap-2">
                        <MessageSquare className="h-3 w-3" />
                        Message
                      </button>
                      <button className="px-3 py-2 border border-titanium-700 hover:border-titanium-600 text-titanium-300 text-xs font-semibold rounded-none transition-colors flex items-center gap-2">
                        <Edit2 className="h-3 w-3" />
                        Edit Permissions
                      </button>
                      {member.role !== 'owner' && (
                        <button className="ml-auto px-3 py-2 border border-red-700/50 hover:border-red-600 text-red-400 text-xs font-semibold rounded-none transition-colors flex items-center gap-2">
                          <Trash2 className="h-3 w-3" />
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Assignments View */}
        {view === 'assignments' && (
          <div className="space-y-3">
            {assignments.map((assignment) => (
              <div key={assignment.id} className="bg-obsidian-900 border border-titanium-900 rounded-none p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-titanium-50">{assignment.name}</h3>
                      <span className="text-[10px] px-2 py-1 rounded-none bg-titanium-800/50 text-titanium-300 font-mono">
                        {assignment.type.toUpperCase()}
                      </span>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-none ${getPriorityColor(assignment.priority)}`}>
                        {assignment.priority.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-titanium-500">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {getMemberName(assignment.assignedTo)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Due: {new Date(assignment.dueDate).toLocaleDateString('de-DE')}
                      </span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-none ${getStatusColor(assignment.status)}`}>
                        {assignment.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="px-3 py-2 border border-titanium-700 hover:border-titanium-600 text-titanium-300 text-xs font-semibold rounded-none transition-colors flex items-center gap-2">
                      <Edit2 className="h-3 w-3" />
                      Edit
                    </button>
                    <button className="px-3 py-2 border border-red-700/50 hover:border-red-600 text-red-400 text-xs font-semibold rounded-none transition-colors flex items-center gap-2">
                      <Trash2 className="h-3 w-3" />
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Workload View */}
        {view === 'workload' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-blue-900 to-blue-800 border border-titanium-800 rounded-none p-4">
                <div className="text-xs font-semibold text-blue-300 mb-1">Open Tasks</div>
                <div className="text-3xl font-bold text-white">{myAssignments.filter(a => a.status === 'open').length}</div>
              </div>
              <div className="bg-gradient-to-br from-cyan-900 to-cyan-800 border border-titanium-800 rounded-none p-4">
                <div className="text-xs font-semibold text-cyan-300 mb-1">In Progress</div>
                <div className="text-3xl font-bold text-white">{myAssignments.filter(a => a.status === 'in-progress').length}</div>
              </div>
              <div className="bg-gradient-to-br from-emerald-900 to-emerald-800 border border-titanium-800 rounded-none p-4">
                <div className="text-xs font-semibold text-emerald-300 mb-1">Completed</div>
                <div className="text-3xl font-bold text-white">{assignments.filter(a => a.status === 'completed').length}</div>
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="font-semibold text-titanium-50 px-1">My Tasks</h2>
              {myAssignments.map((assignment) => (
                <div key={assignment.id} className="bg-obsidian-900 border border-titanium-900 rounded-none p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-titanium-50 mb-1">{assignment.name}</h3>
                      <div className="flex items-center gap-3 text-xs text-titanium-500">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Due: {new Date(assignment.dueDate).toLocaleDateString('de-DE')}
                        </span>
                        <span className={`font-semibold ${getPriorityColor(assignment.priority)}`}>
                          {assignment.priority.toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-none ${getStatusColor(assignment.status)}`}>
                      {assignment.status.toUpperCase()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
