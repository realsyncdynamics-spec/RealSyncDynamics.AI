import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, AlertTriangle, Trash2, UserPlus } from 'lucide-react';
import { SovereignButton } from '../../../components/ui/SovereignButton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { useTenant } from '../../../core/access/TenantProvider';
import { AdminLayout } from '../layouts/AdminLayout';
import { listMembers, removeMember, setMemberRole, type Member } from '../../tenants/membersApi';
import { TENANT_ROLES, type TenantMemberRole } from '../../tenants/memberGuards';

const ROLE_COLORS: Record<TenantMemberRole, 'default' | 'success' | 'warning' | 'error' | 'info' | 'secondary'> = {
  owner: 'success',
  admin: 'info',
  dpo: 'warning',
  editor: 'default',
  viewer_auditor: 'secondary',
};

const ROLE_DESC: Record<TenantMemberRole, string> = {
  owner: 'Voller Zugriff inkl. Abrechnung und Compliance',
  admin: 'Identität & Sicherheit, keine Freigaben',
  dpo: 'Compliance-Hoheit: Freigaben und Audit',
  editor: 'Operativ: Scans und Dokumente',
  viewer_auditor: 'Nur Lesen + Evidence-Export',
};

export function AdminMembersPage() {
  const { activeTenantId, tenants } = useTenant();
  const [members, setMembers] = useState<Member[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const activeTenant = useMemo(
    () => tenants.find(t => t.tenantId === activeTenantId),
    [tenants, activeTenantId]
  );

  const isAdmin = activeTenant?.role === 'owner' || activeTenant?.role === 'admin';
  const ownerCount = useMemo(() => (members ?? []).filter(m => m.role === 'owner').length, [members]);

  const reload = async () => {
    if (!activeTenantId) return;
    setError(null);
    setMembers(null);
    const r = await listMembers(activeTenantId);
    if (!r.ok) setError(r.error?.message ?? 'Laden fehlgeschlagen');
    else setMembers(r.members);
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTenantId]);

  const handleRemove = async (m: Member) => {
    if (!activeTenantId || !isAdmin) return;
    setBusy(m.user_id);
    setError(null);
    const r = await removeMember(activeTenantId, m.user_id);
    if (!r.ok) setError(r.error?.message ?? 'Entfernen fehlgeschlagen');
    setBusy(null);
    await reload();
  };

  const handleChangeRole = async (m: Member, newRole: TenantMemberRole) => {
    if (!activeTenantId || !isAdmin) return;
    setBusy(m.user_id);
    setError(null);
    const r = await setMemberRole(activeTenantId, m.user_id, newRole);
    if (!r.ok) setError(r.error?.message ?? 'Rollenänderung fehlgeschlagen');
    setBusy(null);
    await reload();
  };

  return (
    <AdminLayout>
      <div className="max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display font-bold text-2xl text-titanium-50 mb-2">Team-Verwaltung</h1>
            <p className="text-titanium-400">
              Laden Sie Mitglieder ein, verwalten Sie ihre Rollen und Berechtigungen.
            </p>
          </div>
          <Link to="/tenant/invites">
            <SovereignButton variant="primary" size="md" leftIcon={<UserPlus className="h-4 w-4" />}>
              Mitglied einladen
            </SovereignButton>
          </Link>
        </div>

        {/* Error Alert */}
        {error && (
          <Card variant="default" className="border-rose-900/50 bg-rose-950/20">
            <CardContent className="pt-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-rose-300">{error}</p>
              </div>
              <SovereignButton variant="outline" size="sm" onClick={() => void reload()}>
                Neu laden
              </SovereignButton>
            </CardContent>
          </Card>
        )}

        {/* Members List */}
        <Card variant="default">
          <CardHeader>
            <CardTitle>Mitglieder ({members?.length ?? 0})</CardTitle>
            <CardDescription>Alle Benutzer und ihre Rollen in diesem Workspace</CardDescription>
          </CardHeader>
          <CardContent>
            {members === null ? (
              <div className="flex items-center gap-2 text-titanium-400 py-8">
                <Loader2 className="h-4 w-4 animate-spin" />
                Lade Mitglieder…
              </div>
            ) : members.length === 0 ? (
              <p className="text-sm text-titanium-400 py-8 text-center">Noch keine Mitglieder</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-titanium/10">
                      <th className="text-left py-3 px-4 font-mono text-xs text-titanium-400 font-semibold">E-Mail</th>
                      <th className="text-left py-3 px-4 font-mono text-xs text-titanium-400 font-semibold">Rolle</th>
                      <th className="text-right py-3 px-4 font-mono text-xs text-titanium-400 font-semibold">Aktion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map(m => {
                      const lastOwner = m.role === 'owner' && ownerCount <= 1;
                      return (
                        <tr key={m.user_id} className="border-b border-titanium/10 hover:bg-obsidian-900/50">
                          <td className="py-3 px-4">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-titanium-100">
                                {m.email ?? m.user_id}
                                {m.is_self && <span className="text-titanium-400 ml-2">· Sie</span>}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {isAdmin && !m.is_self && !lastOwner ? (
                              <select
                                value={m.role}
                                disabled={busy === m.user_id}
                                onChange={(e) => void handleChangeRole(m, e.target.value as TenantMemberRole)}
                                className="bg-obsidian border border-titanium/20 text-titanium-100 text-xs rounded-sm px-2 py-1 outline-none focus:border-security-blue focus:ring-1 focus:ring-security-blue/30 disabled:opacity-50"
                              >
                                {TENANT_ROLES.map(r => (
                                  <option key={r} value={r}>{r}</option>
                                ))}
                              </select>
                            ) : (
                              <Badge variant={ROLE_COLORS[m.role]} size="sm">
                                {m.role}
                              </Badge>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {isAdmin && !lastOwner && !m.is_self && (
                              <SovereignButton
                                variant="danger"
                                size="xs"
                                disabled={busy === m.user_id}
                                onClick={() => void handleRemove(m)}
                                leftIcon={busy === m.user_id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                              >
                                Entfernen
                              </SovereignButton>
                            )}
                            {lastOwner && (
                              <span className="font-mono text-xs text-titanium-500">Letzer Owner</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Roles Reference */}
        <Card variant="default">
          <CardHeader>
            <CardTitle>Rollen & Berechtigungen</CardTitle>
            <CardDescription>Beschreibung der verfügbaren Rollen</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {TENANT_ROLES.map(role => (
                <div key={role} className="p-4 border border-titanium/10 rounded-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={ROLE_COLORS[role]} size="sm">{role}</Badge>
                  </div>
                  <p className="text-sm text-titanium-300">{ROLE_DESC[role]}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
