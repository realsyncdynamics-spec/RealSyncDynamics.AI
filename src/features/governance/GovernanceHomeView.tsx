import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Compass, Loader2, Gavel, FileCheck2, UserCheck, ShieldAlert,
  ScrollText, Plug, KeyRound, FileDown, ShieldCheck, Users,
} from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { AuthGate } from '../kodee/connections/AuthGate';
import { withPerformanceMonitoring } from './withPerformanceMonitoring';
import { countPendingGates, myGovernanceRoles, ROLE_LABEL } from './gatesApi';
import { countPendingApprovals } from './approvalsApi';

/**
 * /app/governance/start — rollenspezifischer Einstieg (P1-3).
 *
 * Kein neues UI-System: Die Seite ist ein FILTER über den bereits
 * vorhandenen Governance-Modulen (§10.1 — das Design bleibt eingefroren).
 * Sie beantwortet die Frage, die das volle Dashboard nicht beantwortet:
 * „Was geht mich in meiner Rolle an?"
 *
 * Rollen kommen aus `role_bindings` (P1-1). Wer dort keine Bindung hat,
 * sieht die Mitarbeitenden-Sicht — das ist die engste, nicht die weiteste.
 */
function _GovernanceHomeView() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

export const GovernanceHomeView = withPerformanceMonitoring(
  _GovernanceHomeView,
  'GovernanceHomeView',
  { threshold: 500, maxRenders: 10 }
);

interface Entry {
  to: string;
  label: string;
  hint: string;
  icon: React.ReactNode;
  badge?: number;
}

/**
 * Was jede Rolle als Erstes sehen soll. Bewusst kurz gehalten: Eine
 * Einstiegsseite, die alles zeigt, ist keine Einstiegsseite. Das
 * vollständige Dashboard bleibt einen Klick entfernt.
 */
function entriesFor(roles: string[], counts: { gates: number; approvals: number }): Entry[] {
  const has = (r: string) => roles.includes(r);
  const gate: Entry = {
    to: '/app/governance/gates', label: 'Freigaben', badge: counts.gates,
    hint: 'Vom Policy Decision Point angehaltene Aktionen', icon: <ShieldCheck className="h-4 w-4" />,
  };
  const approvals: Entry = {
    to: '/app/approvals', label: 'Approvals', badge: counts.approvals,
    hint: 'Policy-Entscheidungen mit Prüfpfad', icon: <Gavel className="h-4 w-4" />,
  };

  // Datenschutz
  if (has('dpo')) return [
    { to: '/app/dpia', label: 'DSFA', hint: 'Datenschutz-Folgenabschätzungen', icon: <FileCheck2 className="h-4 w-4" /> },
    { to: '/app/dsr', label: 'Betroffenenrechte', hint: 'Auskunft, Löschung, Widerspruch', icon: <UserCheck className="h-4 w-4" /> },
    gate,
    { to: '/app/incidents', label: 'Vorfälle', hint: 'Meldepflichten und Fristen', icon: <ShieldAlert className="h-4 w-4" /> },
    { to: '/app/compliance', label: 'Bericht', hint: 'Nachweise für Prüfungen exportieren', icon: <FileDown className="h-4 w-4" /> },
  ];

  // IT-Administration
  if (has('it_admin')) return [
    { to: '/app/connectors', label: 'Integrationen', hint: 'Verbundene Systeme und Status', icon: <Plug className="h-4 w-4" /> },
    { to: '/app/keys', label: 'Schlüssel', hint: 'Ingest-Keys verwalten', icon: <KeyRound className="h-4 w-4" /> },
    { to: '/app/governance/gates', label: 'Zugriffsmodell', hint: 'Einheiten, Principals, Rollen', icon: <Users className="h-4 w-4" /> },
    { to: '/app/admin-log', label: 'Prüfpfad', hint: 'Wer hat wann was geändert', icon: <ScrollText className="h-4 w-4" /> },
  ];

  // Compliance
  if (has('compliance_officer')) return [
    { to: '/app/compliance', label: 'Bericht', hint: 'Nachweise für Prüfungen exportieren', icon: <FileDown className="h-4 w-4" /> },
    approvals,
    gate,
    { to: '/app/admin-log', label: 'Prüfpfad', hint: 'Wer hat wann was geändert', icon: <ScrollText className="h-4 w-4" /> },
  ];

  // Freigeber:in — genau eine Aufgabe
  if (has('approver')) return [gate, approvals];

  // Mitarbeitende und alle ohne Bindung: nur das eigene Umfeld
  return [
    { ...gate, hint: 'Ihre angehaltenen Aktionen und deren Begründung' },
  ];
}

function roleHeadline(roles: string[]): string {
  if (roles.includes('dpo')) return 'Datenschutz';
  if (roles.includes('it_admin')) return 'IT-Administration';
  if (roles.includes('compliance_officer')) return 'Compliance';
  if (roles.includes('approver')) return 'Freigaben';
  return 'Ihr Governance-Einstieg';
}

function Inner() {
  const { tenants, activeTenantId, setActiveTenant } = useTenant();
  const [roles, setRoles] = useState<string[] | null>(null);
  const [counts, setCounts] = useState({ gates: 0, approvals: 0 });

  const reload = useCallback(async () => {
    if (!activeTenantId) { setRoles([]); return; }
    setRoles(null);
    const [r, g, a] = await Promise.all([
      myGovernanceRoles(activeTenantId),
      countPendingGates(activeTenantId),
      countPendingApprovals(activeTenantId),
    ]);
    setRoles(r);
    setCounts({ gates: g, approvals: a });
  }, [activeTenantId]);

  useEffect(() => { void reload(); }, [reload]);

  const entries = roles ? entriesFor(roles, counts) : [];

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link to="/app/governance" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-none bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center shadow-sm">
              <Compass className="h-4 w-4 text-white" />
            </div>
            <div className="leading-tight">
              <div className="font-display font-bold text-sm tracking-tight text-titanium-50">
                {roles ? roleHeadline(roles) : 'Governance-Einstieg'}
              </div>
              <div className="text-[11px] text-titanium-400 font-medium">Was Sie in Ihrer Rolle betrifft</div>
            </div>
          </div>
        </div>
        {tenants.length > 1 && (
          <select
            value={activeTenantId ?? ''}
            onChange={(e) => setActiveTenant(e.target.value)}
            className="bg-obsidian-950 border border-titanium-900 text-titanium-200 text-xs rounded-none px-2 py-1.5 outline-none cursor-pointer font-medium hover:bg-obsidian-800 max-w-[200px]"
          >
            {tenants.map((t) => <option key={t.tenantId} value={t.tenantId}>{t.name}</option>)}
          </select>
        )}
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {!activeTenantId ? (
          <div className="text-titanium-500 text-sm">Wähle einen Tenant aus.</div>
        ) : roles === null ? (
          <div className="flex items-center gap-2 text-titanium-500 text-sm py-12 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Lade Ihre Rollen…
          </div>
        ) : (
          <>
            <div className="mb-4 text-[11px] text-titanium-500">
              {roles.length > 0 ? (
                <>Ihre Rollen: <span className="font-mono text-titanium-300">
                  {roles.map((r) => ROLE_LABEL[r] ?? r).join(', ')}
                </span></>
              ) : (
                <>Für Sie ist noch keine Governance-Rolle hinterlegt — Sie sehen die Mitarbeitenden-Sicht.</>
              )}
            </div>

            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {entries.map((e) => (
                <li key={`${e.to}-${e.label}`}>
                  <Link
                    to={e.to}
                    className="flex items-start gap-3 border border-titanium-900 bg-obsidian-900/60 p-3 hover:border-amber-500 transition-colors"
                  >
                    <span className="text-titanium-300 mt-0.5">{e.icon}</span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 font-display font-bold text-sm text-titanium-50">
                        {e.label}
                        {e.badge !== undefined && e.badge > 0 && (
                          <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-amber-500 text-obsidian-950 text-[10px] font-bold rounded-none">
                            {e.badge}
                          </span>
                        )}
                      </span>
                      <span className="block text-[11px] text-titanium-400 mt-0.5">{e.hint}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>

            <div className="mt-6 text-[11px] text-titanium-600">
              <Link to="/app/governance" className="hover:text-amber-200">Alle Governance-Module ansehen →</Link>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
