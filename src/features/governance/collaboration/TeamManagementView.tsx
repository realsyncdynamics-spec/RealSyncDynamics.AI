import React, { useState } from 'react';
import {
  Users, Plus, UserCheck, UserX, Shield, Mail, LoaderCircle, AlertTriangle,
} from 'lucide-react';
import { useTeamMembers, type TeamMember } from './useTeamMembers';
import { AuthGate } from '../../kodee/connections/AuthGate';
import { withPerformanceMonitoring } from '../withPerformanceMonitoring';

const ROLE_INFO: Record<TeamMember['role'], { label: string; description: string; color: string }> = {
  owner: {
    label: 'Owner',
    description: 'Full access, can manage members and billing',
    color: 'amber',
  },
  admin: {
    label: 'Admin',
    description: 'Full access to all compliance features',
    color: 'blue',
  },
  reviewer: {
    label: 'Reviewer',
    description: 'Can review and approve compliance items',
    color: 'emerald',
  },
  contributor: {
    label: 'Contributor',
    description: 'Can create and edit compliance items',
    color: 'cyan',
  },
  viewer: {
    label: 'Viewer',
    description: 'Read-only access to compliance data',
    color: 'titanium',
  },
};

export function TeamManagementView() {
  const { members, loading, error, inviteMember, updateMemberRole, removeMember } =
    useTeamMembers();

  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<TeamMember['role']>('contributor');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      setInviteError('Email is required');
      return;
    }

    setInviting(true);
    setInviteError(null);

    try {
      const success = await inviteMember(inviteEmail, inviteRole);
      if (success) {
        setInviteEmail('');
        setInviteRole('contributor');
        setShowInviteForm(false);
      } else {
        setInviteError('Failed to send invitation');
      }
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setInviting(false);
    }
  };

  return (
    <div className="min-h-screen bg-obsidian-950 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-titanium-50 mb-2 flex items-center gap-2">
              <Users className="w-8 h-8" />
              Team Management
            </h1>
            <p className="text-titanium-400">
              Manage workspace members and their compliance access.
            </p>
          </div>

          <button
            onClick={() => setShowInviteForm(!showInviteForm)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-ai-cyan-500 hover:bg-ai-cyan-600 text-obsidian-950 font-semibold rounded-none transition-colors"
          >
            <Plus className="w-4 h-4" />
            Invite Member
          </button>
        </div>

        {/* Invite Form */}
        {showInviteForm && (
          <div className="bg-obsidian-900 border border-titanium-800 p-6 rounded-none space-y-4">
            <h2 className="text-lg font-semibold text-titanium-50">Invite Team Member</h2>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-titanium-300 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full px-3 py-2 bg-obsidian-950 border border-titanium-700 rounded-none text-titanium-50 placeholder-titanium-500 focus:border-ai-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-titanium-300 mb-2">
                  Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as TeamMember['role'])}
                  className="w-full px-3 py-2 bg-obsidian-950 border border-titanium-700 rounded-none text-titanium-50 focus:border-ai-cyan-500 focus:outline-none"
                >
                  {(Object.keys(ROLE_INFO) as TeamMember['role'][]).map((role) => (
                    <option key={role} value={role}>
                      {ROLE_INFO[role].label} - {ROLE_INFO[role].description}
                    </option>
                  ))}
                </select>
              </div>

              {inviteError && (
                <div className="flex items-start gap-2 p-3 bg-rose-950/30 border border-rose-500/30 rounded-none">
                  <AlertTriangle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
                  <p className="text-sm text-rose-300">{inviteError}</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleInvite}
                  disabled={inviting || !inviteEmail.trim()}
                  className="flex-1 px-4 py-2.5 bg-ai-cyan-500 hover:bg-ai-cyan-600 disabled:opacity-50 text-obsidian-950 font-semibold rounded-none transition-colors"
                >
                  {inviting ? 'Sending...' : 'Send Invitation'}
                </button>
                <button
                  onClick={() => setShowInviteForm(false)}
                  className="flex-1 px-4 py-2.5 border border-titanium-700 text-titanium-300 hover:text-titanium-50 rounded-none transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Members List */}
        <div className="bg-obsidian-900 border border-titanium-800 rounded-none p-6">
          <h2 className="text-lg font-semibold text-titanium-50 mb-4">
            Members ({members.length})
          </h2>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <LoaderCircle className="w-5 h-5 animate-spin text-titanium-400" />
            </div>
          ) : error ? (
            <div className="flex items-start gap-2 p-4 bg-rose-950/30 border border-rose-500/30 rounded-none">
              <AlertTriangle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
              <p className="text-sm text-rose-300">{error}</p>
            </div>
          ) : members.length === 0 ? (
            <p className="text-titanium-400 text-center py-8">No team members yet.</p>
          ) : (
            <div className="space-y-2">
              {members.map((member) => {
                const roleInfo = ROLE_INFO[member.role];

                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-4 bg-obsidian-950 border border-titanium-800 rounded-none hover:border-titanium-700 transition-colors"
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={`w-10 h-10 rounded-none bg-${roleInfo.color}-500/10 border border-${roleInfo.color}-500/30 flex items-center justify-center shrink-0`}>
                        <Shield className={`w-5 h-5 text-${roleInfo.color}-400`} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-sm text-titanium-50 truncate">
                            {member.name}
                          </p>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-none bg-${
                              member.status === 'active' ? 'emerald' : 'titanium'
                            }-500/10 text-${member.status === 'active' ? 'emerald' : 'titanium'}-400`}
                          >
                            {member.status === 'active' ? 'Active' : member.status === 'pending' ? 'Pending' : 'Inactive'}
                          </span>
                        </div>

                        <p className="text-xs text-titanium-400 flex items-center gap-1 mb-1">
                          <Mail className="w-3 h-3" />
                          {member.email}
                        </p>

                        <p className="text-xs text-titanium-500">
                          {roleInfo.label} - {roleInfo.description}
                        </p>

                        {member.lastActivity && (
                          <p className="text-xs text-titanium-600 mt-1">
                            Last active:{' '}
                            {member.lastActivity.toLocaleDateString('de-DE', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => removeMember(member.id)}
                        className="p-2 text-titanium-400 hover:text-rose-400 hover:bg-rose-950/20 rounded-none transition-colors"
                        title="Remove member"
                      >
                        <UserX className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Role Reference */}
        <div className="bg-obsidian-900 border border-titanium-800 p-6 rounded-none">
          <h3 className="text-lg font-semibold text-titanium-50 mb-4">Role Permissions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(Object.entries(ROLE_INFO) as Array<[TeamMember['role'], typeof ROLE_INFO[TeamMember['role']]]>).map(
              ([role, info]) => (
                <div key={role} className={`p-3 bg-${info.color}-500/5 border border-${info.color}-500/20 rounded-none`}>
                  <p className={`text-sm font-semibold text-${info.color}-300`}>{info.label}</p>
                  <p className="text-xs text-titanium-400 mt-1">{info.description}</p>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
