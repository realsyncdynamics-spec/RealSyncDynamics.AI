import React, { useState, useEffect } from 'react';
import {
  Users, Plus, UserCheck, UserX, Shield, Mail, Loader2, AlertTriangle, X, Clock,
} from 'lucide-react';
import { useTenant } from '../../../core/access/TenantProvider';
import { useTeamMembers, type TeamMember } from './useTeamMembers';
import { AuthGate } from '../../kodee/connections/AuthGate';
import { withPerformanceMonitoring } from '../../../lib/hoc';

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

function _TeamManagementView() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

export const TeamManagementView = withPerformanceMonitoring(
  _TeamManagementView,
  'TeamManagementView',
  { threshold: 500, maxRenders: 10 }
);

function Inner() {
  const { activeTenantId } = useTenant();
  const { members, loading, error, inviteMember, removeMember, refetch } = useTeamMembers();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<TeamMember['role']>('contributor');
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'ok' | 'error' } | null>(null);

  const handleSendInvite = async () => {
    if (!inviteEmail.trim()) return;
    try {
      setSendingInvite(true);
      const success = await inviteMember(inviteEmail, inviteRole);
      if (success) {
        setToast({ message: `Einladung an ${inviteEmail} gesendet`, type: 'ok' });
        setInviteEmail('');
        setInviteRole('contributor');
        setShowInviteForm(false);
        await refetch();
      } else {
        setToast({ message: 'Fehler beim Senden der Einladung', type: 'error' });
      }
    } catch (err) {
      console.error('Failed to send invite:', err);
      setToast({ message: 'Fehler beim Senden der Einladung', type: 'error' });
    } finally {
      setSendingInvite(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      const success = await removeMember(memberId);
      if (success) {
        setToast({ message: 'Mitglied entfernt', type: 'ok' });
        await refetch();
      } else {
        setToast({ message: 'Fehler beim Entfernen des Mitglieds', type: 'error' });
      }
    } catch (err) {
      console.error('Failed to remove member:', err);
      setToast({ message: 'Fehler beim Entfernen des Mitglieds', type: 'error' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 text-teal-400 animate-spin mx-auto mb-3" />
          <p className="text-[12px] text-titanium-400">Team-Mitglieder werden geladen...</p>
        </div>
      </div>
    );
  }

  const stats = {
    total: members.length,
    active: members.filter((m) => m.status === 'active').length,
    pending: members.filter((m) => m.status === 'pending').length,
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-titanium-50">Team-Verwaltung</h1>
          <p className="text-sm text-titanium-400 mt-1">Verwalten Sie Ihr Governance-Team</p>
        </div>
        <button
          onClick={() => setShowInviteForm(!showInviteForm)}
          className="flex items-center gap-2 px-4 py-2 bg-teal-900/40 border border-teal-700 text-teal-200 font-mono text-[11px] uppercase tracking-wider hover:bg-teal-800/60 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Einladung senden
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-obsidian-900 border border-titanium-800 p-3">
          <p className="font-mono text-[10px] uppercase text-titanium-600">Gesamt</p>
          <p className="text-2xl font-bold text-titanium-50 mt-1">{stats.total}</p>
        </div>
        <div className="bg-obsidian-900 border border-titanium-800 p-3">
          <p className="font-mono text-[10px] uppercase text-teal-600">Aktiv</p>
          <p className="text-2xl font-bold text-teal-400 mt-1">{stats.active}</p>
        </div>
        <div className="bg-obsidian-900 border border-titanium-800 p-3">
          <p className="font-mono text-[10px] uppercase text-amber-600">Ausstehend</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">{stats.pending}</p>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-950/40 border border-red-800/50 p-3">
          <p className="font-mono text-[11px] text-red-300">{error}</p>
        </div>
      )}

      {/* Invite Form */}
      {showInviteForm && (
        <div className="bg-obsidian-900 border border-teal-700/30 p-4 space-y-3">
          <div className="flex items-start justify-between">
            <h3 className="text-sm font-semibold text-titanium-100">Neues Team-Mitglied einladen</h3>
            <button onClick={() => setShowInviteForm(false)} className="text-titanium-500 hover:text-titanium-200">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <input
              type="email"
              placeholder="E-Mail-Adresse"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="col-span-2 px-3 py-2 bg-obsidian-800 border border-titanium-800 text-titanium-100 font-mono text-[11px] focus:border-teal-600 focus:outline-none"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as TeamMember['role'])}
              className="px-3 py-2 bg-obsidian-800 border border-titanium-800 text-titanium-100 font-mono text-[11px] focus:border-teal-600 focus:outline-none"
            >
              {(Object.keys(ROLE_INFO) as TeamMember['role'][]).map((role) => (
                <option key={role} value={role}>
                  {ROLE_INFO[role].label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSendInvite}
              disabled={sendingInvite || !inviteEmail.trim()}
              className="px-3 py-1.5 border border-teal-700 bg-teal-900/40 text-teal-200 font-mono text-[10px] uppercase tracking-wider hover:bg-teal-800/60 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {sendingInvite ? 'Wird gesendet...' : 'Einladung senden'}
            </button>
            <button onClick={() => setShowInviteForm(false)} className="px-3 py-1.5 border border-titanium-800 text-titanium-400 font-mono text-[10px] uppercase tracking-wider hover:border-titanium-700">
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {/* Members List */}
      {members.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Users className="h-12 w-12 text-titanium-600 mb-4" />
          <h2 className="text-lg font-semibold text-titanium-300">Keine Team-Mitglieder</h2>
          <p className="text-sm text-titanium-500 mt-1">Laden Sie Ihr erstes Team-Mitglied ein</p>
        </div>
      ) : (
        <div className="space-y-2">
          {members.map((member) => (
            <div key={member.id} className="flex items-center gap-3 p-4 bg-obsidian-900 border border-titanium-800 hover:border-titanium-700 transition-colors">
              <div className="h-9 w-9 rounded-full bg-teal-900/40 border border-teal-700 flex items-center justify-center text-sm font-mono text-teal-400">
                {member.email.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-mono text-sm text-titanium-100">{member.email}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 border rounded font-mono text-[10px] ${
                    ROLE_INFO[member.role].color === 'amber'
                      ? 'bg-amber-900/30 border-amber-700/50 text-amber-400'
                      : ROLE_INFO[member.role].color === 'blue'
                      ? 'bg-blue-900/30 border-blue-700/50 text-blue-400'
                      : ROLE_INFO[member.role].color === 'emerald'
                      ? 'bg-emerald-900/30 border-emerald-700/50 text-emerald-400'
                      : ROLE_INFO[member.role].color === 'cyan'
                      ? 'bg-cyan-900/30 border-cyan-700/50 text-cyan-400'
                      : 'bg-titanium-900/30 border-titanium-700/50 text-titanium-400'
                  }`}>
                    {ROLE_INFO[member.role].label}
                  </span>
                  {member.status === 'pending' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 border border-amber-700/50 bg-amber-900/30 rounded font-mono text-[10px] text-amber-400">
                      <Clock className="h-3 w-3" />
                      Ausstehend
                    </span>
                  )}
                  {member.status === 'active' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 border border-teal-700/50 bg-teal-900/30 rounded font-mono text-[10px] text-teal-400">
                      <UserCheck className="h-3 w-3" />
                      Aktiv
                    </span>
                  )}
                </div>
              </div>
              <button onClick={() => handleRemoveMember(member.id)} className="p-1.5 text-titanium-500 hover:text-red-400 hover:bg-red-900/20 rounded" title="Mitglied entfernen">
                <UserX className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 border font-mono text-xs shadow-lg ${toast.type === 'error' ? 'bg-red-950 border-red-800 text-red-200' : 'bg-obsidian-800 border-teal-700 text-teal-300'}`}>
          {toast.type === 'error' ? <AlertTriangle className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
          {toast.message}
        </div>
      )}
    </div>
  );
}
