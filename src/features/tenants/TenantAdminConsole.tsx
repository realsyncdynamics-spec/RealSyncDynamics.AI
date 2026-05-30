// Tenant-Admin-Konsole (P0b) — kundenorientierte Verwaltung von Identitaet,
// Sicherheit und Governance eines Tenants. owner/admin schreiben; dpo/
// viewer_auditor lesen. Genuin neue UI ist Team + Rollen (inline); die
// uebrigen Bereiche verlinken auf bestehende Voll-Seiten (Reuse statt
// Header-Nesting). SSO + Identitaet/Domains sind Vorschau (P1). Kein SSO/
// SCIM-Build, AAL2 nur observe (ADR 0006/0007/0008).
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Users, ShieldCheck, KeyRound, Globe, ScrollText,
  Server, CreditCard, Loader2, AlertTriangle, Trash2, ChevronRight, Lock,
} from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { AuthGate } from '../kodee/connections/AuthGate';
import { listMembers, setMemberRole, removeMember, type Member } from './membersApi';
import { TENANT_ROLES, type TenantMemberRole } from './memberGuards';

type TabId = 'team' | 'roles' | 'security' | 'sso' | 'domains' | 'audit' | 'residency' | 'billing';

const TABS: { id: TabId; label: string; icon: typeof Users }[] = [
  { id: 'team',      label: 'Team',                  icon: Users },
  { id: 'roles',     label: 'Rollen & Berechtigungen', icon: KeyRound },
  { id: 'security',  label: 'Sicherheit',            icon: ShieldCheck },
  { id: 'sso',       label: 'Single Sign-On',        icon: Lock },
  { id: 'domains',   label: 'Identität & Domains',    icon: Globe },
  { id: 'audit',     label: 'Prüfprotokoll',         icon: ScrollText },
  { id: 'residency', label: 'Datenresidenz',         icon: Server },
  { id: 'billing',   label: 'Abrechnung',            icon: CreditCard },
];

export function TenantAdminConsole() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

function Inner() {
  const { tenants, activeTenantId, setActiveTenant } = useTenant();
  const [tab, setTab] = useState<TabId>('team');
  const activeTenant = tenants.find((t) => t.tenantId === activeTenantId) ?? null;
  const role = activeTenant?.role ?? null;
  const isAdmin = role === 'owner' || role === 'admin';

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link to="/dashboard" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-none bg-gradient-to-br from-security-500 to-indigo-700 flex items-center justify-center">
              <Users className="h-4 w-4 text-white" />
            </div>
            <div className="leading-tight">
              <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Team & Zugriff</div>
              <div className="text-[11px] text-titanium-400 font-medium">Tenant-Verwaltung</div>
            </div>
          </div>
        </div>
        {tenants.length > 1 && (
          <select
            value={activeTenantId ?? ''}
            onChange={(e) => setActiveTenant(e.target.value)}
            className="bg-obsidian-950 border border-titanium-900 text-titanium-200 text-xs rounded-none px-2 py-1.5 outline-none cursor-pointer max-w-[200px]"
          >
            {tenants.map((t) => <option key={t.tenantId} value={t.tenantId}>{t.name}</option>)}
          </select>
        )}
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {/* Tab-Leiste */}
        <nav className="flex flex-wrap gap-1 border-b border-titanium-900 mb-6">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === id
                  ? 'border-cyan-400 text-titanium-50'
                  : 'border-transparent text-titanium-400 hover:text-titanium-100'
              }`}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </nav>

        {!activeTenantId ? (
          <Empty>Kein aktiver Tenant. Erstellen Sie zuerst einen Workspace.</Empty>
        ) : (
          <>
            {tab === 'team'      && <TeamTab tenantId={activeTenantId} isAdmin={isAdmin} />}
            {tab === 'roles'     && <RolesTab tenantId={activeTenantId} isAdmin={isAdmin} />}
            {tab === 'security'  && <LaunchTab to="/settings/security" title="Sicherheit & MFA" body="Zwei-Faktor (TOTP), Recovery-Codes und MFA-Erzwingung verwalten." />}
            {tab === 'sso'       && <PreviewTab title="Single Sign-On" body="Anmeldung mit dem Firmen-Konto (Entra ID, Google Workspace, SAML). In Vorbereitung — folgt in einem späteren Release." />}
            {tab === 'domains'   && <PreviewTab title="Identität & Domains" body="Verifizierte Unternehmens-Domains bestimmen, wer dem Tenant automatisch zugeordnet wird. Domain-Verifizierung folgt mit Single Sign-On." />}
            {tab === 'audit'     && <LaunchTab to="/governance/admin-log" title="Prüfprotokoll" body="Wer hat wann was geändert — vollständiges, manipulationssicheres Admin-Log." />}
            {tab === 'residency' && <LaunchTab to="/settings/ai-residency" title="Datenresidenz" body="Cloud vs. EU-lokal (Ollama, Frankfurt) pro Tenant festlegen." />}
            {tab === 'billing'   && <LaunchTab to="/billing/usage" title="Abrechnung" body="Tarif, Verbrauch und Rechnungen verwalten." />}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Team ────────────────────────────────────────────────────────────

function TeamTab({ tenantId, isAdmin }: { tenantId: string; isAdmin: boolean }) {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const reload = async () => {
    setError(null); setMembers(null);
    const r = await listMembers(tenantId);
    if (!r.ok) setError(r.error?.message ?? 'Laden fehlgeschlagen');
    else setMembers(r.members);
  };
  useEffect(() => { void reload(); /* eslint-disable-next-line */ }, [tenantId]);

  const ownerCount = useMemo(() => (members ?? []).filter((m) => m.role === 'owner').length, [members]);

  async function doRemove(m: Member) {
    if (!isAdmin) return;
    setBusy(m.user_id); setError(null);
    const r = await removeMember(tenantId, m.user_id);
    if (!r.ok) setError(r.error?.message ?? 'Entfernen fehlgeschlagen');
    setBusy(null);
    await reload();
  }

  if (members === null && !error) return <LoadingRow />;
  if (error) return <ErrorRow msg={error} onRetry={reload} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-bold text-lg text-titanium-50">Mitglieder ({members?.length ?? 0})</h2>
        <Link to="/tenant/invites" className="inline-flex items-center gap-2 bg-cyan-400 text-obsidian-950 px-3 py-1.5 text-sm font-semibold hover:bg-cyan-300">
          <Users className="h-4 w-4" /> Einladen
        </Link>
      </div>
      <div className="border border-titanium-800 bg-obsidian-900 divide-y divide-titanium-900">
        {(members ?? []).map((m) => {
          const lastOwner = m.role === 'owner' && ownerCount <= 1;
          return (
            <div key={m.user_id} className="flex items-center justify-between p-3 gap-3">
              <div className="min-w-0">
                <div className="text-sm text-titanium-100 truncate">{m.email ?? m.user_id}{m.is_self && <span className="text-titanium-500"> · Sie</span>}</div>
                <div className="font-mono text-[11px] text-titanium-500">{m.role}</div>
              </div>
              {isAdmin && !lastOwner && (
                <button
                  onClick={() => doRemove(m)}
                  disabled={busy === m.user_id}
                  className="inline-flex items-center gap-1.5 text-rose-300 hover:text-rose-200 text-xs disabled:opacity-40"
                  title="Mitglied entfernen"
                >
                  {busy === m.user_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  Entfernen
                </button>
              )}
              {lastOwner && <span className="font-mono text-[10px] text-titanium-600">letzter Owner</span>}
            </div>
          );
        })}
      </div>
      {!isAdmin && <p className="text-[11px] text-titanium-500">Nur owner/admin können Mitglieder verwalten.</p>}
    </div>
  );
}

// ─── Rollen ──────────────────────────────────────────────────────────

const ROLE_DESC: Record<TenantMemberRole, string> = {
  owner:          'Voller Zugriff inkl. Abrechnung, Tenant-Lifecycle und Compliance-Freigabe.',
  admin:          'Identität & Sicherheit (Mitglieder, MFA, SSO) — keine Compliance-Freigabe, kein Tenant-Delete.',
  dpo:            'Compliance-Hoheit: DSFA/Register freigeben, alles lesen, Evidence exportieren.',
  editor:         'Operativ: Scans, Findings, Dokument-Entwürfe — keine Freigaben/Verwaltung.',
  viewer_auditor: 'Nur Lesen + Evidence/Audit-Export.',
};

function RolesTab({ tenantId, isAdmin }: { tenantId: string; isAdmin: boolean }) {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const reload = async () => {
    setError(null); setMembers(null);
    const r = await listMembers(tenantId);
    if (!r.ok) setError(r.error?.message ?? 'Laden fehlgeschlagen');
    else setMembers(r.members);
  };
  useEffect(() => { void reload(); /* eslint-disable-next-line */ }, [tenantId]);

  async function changeRole(m: Member, role: TenantMemberRole) {
    setBusy(m.user_id); setError(null);
    const r = await setMemberRole(tenantId, m.user_id, role);
    if (!r.ok) setError(r.error?.message ?? 'Rollenänderung fehlgeschlagen');
    setBusy(null);
    await reload();
  }

  return (
    <div className="space-y-6">
      {/* Berechtigungs-Matrix (read-only Erklaerung) */}
      <div>
        <h2 className="font-display font-bold text-lg text-titanium-50 mb-3">Rollen</h2>
        <div className="border border-titanium-800 bg-obsidian-900 divide-y divide-titanium-900">
          {TENANT_ROLES.map((r) => (
            <div key={r} className="p-3">
              <div className="font-mono text-xs text-cyan-300">{r}</div>
              <div className="text-sm text-titanium-300 mt-0.5">{ROLE_DESC[r]}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Rollen-Zuweisung */}
      <div>
        <h3 className="font-display font-semibold text-titanium-50 mb-3">Mitglieder-Rollen</h3>
        {error && <div className="mb-3"><ErrorRow msg={error} onRetry={reload} /></div>}
        {members === null ? <LoadingRow /> : (
          <div className="border border-titanium-800 bg-obsidian-900 divide-y divide-titanium-900">
            {members.map((m) => (
              <div key={m.user_id} className="flex items-center justify-between p-3 gap-3">
                <div className="min-w-0 text-sm text-titanium-100 truncate">
                  {m.email ?? m.user_id}{m.is_self && <span className="text-titanium-500"> · Sie</span>}
                </div>
                {isAdmin ? (
                  <select
                    value={m.role}
                    disabled={busy === m.user_id}
                    onChange={(e) => changeRole(m, e.target.value as TenantMemberRole)}
                    className="bg-obsidian-950 border border-titanium-700 text-titanium-100 text-xs rounded-none px-2 py-1.5 outline-none focus:border-cyan-400 disabled:opacity-40"
                  >
                    {TENANT_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                ) : (
                  <span className="font-mono text-[11px] text-titanium-500">{m.role}</span>
                )}
              </div>
            ))}
          </div>
        )}
        {!isAdmin && <p className="text-[11px] text-titanium-500 mt-2">Nur owner/admin können Rollen ändern. Owner-Rolle nur durch einen Owner.</p>}
      </div>
    </div>
  );
}

// ─── Reuse-Launch + Vorschau + Helpers ───────────────────────────────

function LaunchTab({ to, title, body }: { to: string; title: string; body: string }) {
  return (
    <Link to={to} className="block border border-titanium-800 bg-obsidian-900 p-5 hover:border-cyan-400/50 transition-colors">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-bold text-titanium-50">{title}</h2>
        <ChevronRight className="h-5 w-5 text-cyan-300" />
      </div>
      <p className="text-sm text-titanium-400 mt-1">{body}</p>
    </Link>
  );
}

function PreviewTab({ title, body }: { title: string; body: string }) {
  return (
    <div className="border border-titanium-800 bg-obsidian-900 p-5">
      <div className="flex items-center gap-2">
        <h2 className="font-display font-bold text-titanium-50">{title}</h2>
        <span className="font-mono text-[10px] uppercase tracking-wider text-amber-300 border border-amber-500/40 bg-amber-500/10 px-2 py-0.5">
          In Vorbereitung
        </span>
      </div>
      <p className="text-sm text-titanium-400 mt-2">{body}</p>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="border border-titanium-800 bg-obsidian-900 p-6 text-sm text-titanium-400">{children}</div>;
}
function LoadingRow() {
  return <div className="flex items-center gap-2 text-titanium-500 text-sm py-6"><Loader2 className="h-4 w-4 animate-spin" /> Lade…</div>;
}
function ErrorRow({ msg, onRetry }: { msg: string; onRetry: () => void }) {
  return (
    <div className="flex items-start gap-2 text-sm text-rose-300 bg-rose-950/40 border border-rose-900 p-3">
      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
      <span className="flex-1">{msg}</span>
      <button onClick={onRetry} className="text-rose-200 underline underline-offset-2">Neu laden</button>
    </div>
  );
}
