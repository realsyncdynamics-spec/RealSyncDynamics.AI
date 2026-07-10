import { useState } from 'react';
import { Plus, Trash2, Shield, Eye, Check } from 'lucide-react';
import { useCollaborativeTerminal, type TerminalRole, type SessionMember } from './useCollaborativeTerminal';

interface TeamCollaborationPanelProps {
  sessionId: string | null;
}

const ROLE_COLORS: Record<TerminalRole, string> = {
  owner: 'bg-blue-900 text-blue-100',
  editor: 'bg-cyan-900 text-cyan-100',
  viewer: 'bg-slate-700 text-slate-100',
  approver: 'bg-purple-900 text-purple-100',
};

const ROLE_ICONS: Record<TerminalRole, React.ReactNode> = {
  owner: <Shield size={14} />,
  editor: <Plus size={14} />,
  viewer: <Eye size={14} />,
  approver: <Check size={14} />,
};

const ROLE_DESCRIPTIONS: Record<TerminalRole, string> = {
  owner: 'Full control. Can invite, remove, and approve.',
  editor: 'Can run commands, invite members.',
  viewer: 'Read-only access to session history.',
  approver: 'Can approve audits and compliance actions.',
};

export function TeamCollaborationPanel({ sessionId }: TeamCollaborationPanelProps) {
  const { sessionState, loading, error, inviteMember, removeMember, updateMemberRole, canPerformAction } =
    useCollaborativeTerminal(sessionId);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<TerminalRole>('editor');
  const [expandedMember, setExpandedMember] = useState<string | null>(null);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;

    const success = await inviteMember(inviteEmail, inviteRole);
    if (success) {
      setInviteEmail('');
      setInviteRole('editor');
    }
  };

  const handleRemove = async (memberId: string) => {
    if (confirm('Remove this member from the session?')) {
      await removeMember(memberId);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: TerminalRole) => {
    await updateMemberRole(memberId, newRole);
  };

  if (!sessionState) {
    return (
      <div className="p-4 text-titanium-400 text-sm">
        {loading ? 'Loading team members...' : 'No session data'}
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 bg-obsidian-900 border-l border-titanium-700 max-w-sm">
      {/* Header */}
      <div>
        <h3 className="font-mono text-xs uppercase tracking-wider text-titanium-400 mb-3">
          Team Collaboration
        </h3>
      </div>

      {/* Error */}
      {error && (
        <div className="text-xs text-red-400 bg-red-900/20 p-2 rounded border border-red-700">
          {error}
        </div>
      )}

      {/* Current User */}
      <div className="space-y-2">
        <div className="text-xs text-titanium-300 font-mono">You ({sessionState.currentUserRole})</div>
        <div className="flex items-center gap-2 px-3 py-2 bg-obsidian-800 rounded border border-titanium-700">
          <div className={`px-2 py-1 rounded text-xs font-mono flex items-center gap-1 ${ROLE_COLORS[sessionState.currentUserRole]}`}>
            {ROLE_ICONS[sessionState.currentUserRole]}
            {sessionState.currentUserRole}
          </div>
          <div className="text-xs text-titanium-500 flex-1">You own this session</div>
        </div>
      </div>

      {/* Members List */}
      {sessionState.members.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-titanium-300 font-mono">
            Members ({sessionState.members.filter((m) => m.isActive).length})
          </div>
          <div className="space-y-1">
            {sessionState.members
              .filter((m) => m.isActive)
              .map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-2 px-3 py-2 bg-obsidian-800 rounded border border-titanium-700 hover:border-titanium-500 transition-colors"
                >
                  <div
                    className={`px-2 py-1 rounded text-xs font-mono flex items-center gap-1 ${ROLE_COLORS[member.role]}`}
                  >
                    {ROLE_ICONS[member.role]}
                    {member.role}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-titanium-300 truncate">{member.displayName}</div>
                  </div>
                  {canPerformAction('remove') && sessionState.currentUserRole === 'owner' && (
                    <button
                      onClick={() => handleRemove(member.id)}
                      className="p-1 hover:bg-red-900/30 rounded transition-colors"
                      title="Remove member"
                    >
                      <Trash2 size={12} className="text-red-400" />
                    </button>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Pending Invitations */}
      {sessionState.invitations.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-titanium-300 font-mono">
            Pending Invites ({sessionState.invitations.length})
          </div>
          <div className="space-y-1">
            {sessionState.invitations.map((invitation) => (
              <div
                key={invitation.id}
                className="flex items-center gap-2 px-3 py-2 bg-obsidian-800 rounded border border-titanium-600 opacity-75"
              >
                <div className="px-2 py-1 rounded text-xs font-mono bg-yellow-900/50 text-yellow-300">
                  ⏳ pending
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-titanium-300 truncate">{invitation.invitedEmail}</div>
                  <div className="text-[10px] text-titanium-600">
                    {invitation.role} • expires in{' '}
                    {Math.ceil((invitation.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60))}h
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite Form */}
      {canPerformAction('invite') && (
        <div className="space-y-2 pt-4 border-t border-titanium-700">
          <div className="text-xs text-titanium-300 font-mono">Invite Team Member</div>
          <div className="space-y-2">
            <input
              type="email"
              placeholder="email@company.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="w-full px-3 py-2 bg-obsidian-800 border border-titanium-700 rounded text-xs text-titanium-300 placeholder-titanium-600 focus:outline-none focus:border-blue-500"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as TerminalRole)}
              className="w-full px-3 py-2 bg-obsidian-800 border border-titanium-700 rounded text-xs text-titanium-300 focus:outline-none focus:border-blue-500"
            >
              <option value="editor">Editor (run commands, invite)</option>
              <option value="approver">Approver (approve audits)</option>
              <option value="viewer">Viewer (read-only)</option>
            </select>
            <button
              onClick={handleInvite}
              disabled={!inviteEmail.trim()}
              className="w-full px-3 py-2 bg-blue-900 hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-titanium-300 font-mono text-xs rounded transition-colors"
            >
              Send Invite
            </button>
          </div>
          <div className="text-[10px] text-titanium-600 italic">
            {ROLE_DESCRIPTIONS[inviteRole]}
          </div>
        </div>
      )}
    </div>
  );
}
