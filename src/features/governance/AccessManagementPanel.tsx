import { useCallback, useEffect, useState } from 'react';
import { Building2, Users, ShieldCheck, Plus, Trash2, Loader2, AlertTriangle } from 'lucide-react';
import {
  GOVERNANCE_ROLES, ROLE_LABEL,
  createPrincipal, createUnit, deleteUnit, grantRole, loadAccessModel,
  renameUnit, revokeRole, updatePrincipal,
  type AccessModel, type OrgUnit, type Principal,
} from './gatesApi';

/**
 * Pflege des Zugriffsmodells (P1-1 + P1-3): Organisationseinheiten,
 * Principals und Rollenbindungen.
 *
 * Schreibt ausschließlich über die Edge Function `governance-access` —
 * jede Rollenvergabe landet damit im Prüfpfad. Nur owner/admin dürfen
 * ändern; die Function weist alles andere mit 403 ab.
 *
 * Eine Rollenbindung an einer Einheit gilt für deren gesamten Teilbaum —
 * das ist die Regel, die der Policy Decision Point auswertet.
 */
export function AccessManagementPanel({ tenantId, editable = true }: {
  tenantId: string;
  editable?: boolean;
}) {
  const [model, setModel] = useState<AccessModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [unitName, setUnitName] = useState('');
  const [unitKind, setUnitKind] = useState<OrgUnit['kind']>('department');
  const [unitParent, setUnitParent] = useState<string>('');

  const [pName, setPName] = useState('');
  const [pType, setPType] = useState<Principal['type']>('user');
  const [pUnit, setPUnit] = useState<string>('');

  const reload = useCallback(async () => {
    setError(null);
    const m = await loadAccessModel(tenantId);
    setModel(m);
    if (m.error) setError(m.error);
  }, [tenantId]);

  useEffect(() => { void reload(); }, [reload]);

  async function run(fn: () => Promise<{ ok: boolean; error?: { message: string } }>) {
    setBusy(true); setError(null);
    const res = await fn();
    setBusy(false);
    if (!res.ok) { setError(res.error?.message ?? 'Aktion fehlgeschlagen'); return false; }
    await reload();
    return true;
  }

  const indentOf = (u: OrgUnit) =>
    Math.max(0, u.org_path.split('/').filter(Boolean).length - 1) * 12;

  if (!model) {
    return (
      <div className="flex items-center gap-2 text-titanium-500 text-sm py-8 justify-center">
        <Loader2 className="h-4 w-4 animate-spin" /> Lade Zugriffsmodell…
      </div>
    );
  }

  return (
    <section>
      <h2 className="flex items-center gap-2 text-sm font-display font-bold tracking-tight text-titanium-50 mb-1">
        <ShieldCheck className="h-4 w-4" /> Zugriffsmodell
      </h2>
      <p className="text-[11px] text-titanium-500 mb-3">
        Rollen an einer Einheit gelten für deren gesamten Teilbaum. Änderungen werden im Prüfpfad protokolliert.
      </p>

      {error && (
        <div className="mb-3 flex items-start gap-2.5 text-sm text-red-300 bg-red-950/50 border border-red-900 rounded-none p-3">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* ── Einheiten ── */}
        <div className="border border-titanium-900 bg-obsidian-900/60 p-3">
          <div className="flex items-center gap-1.5 text-[12px] font-mono uppercase tracking-wider text-titanium-300 mb-2">
            <Building2 className="h-3.5 w-3.5" /> Einheiten ({model.units.length})
          </div>

          {model.units.length === 0 ? (
            <p className="text-[11px] text-titanium-500 mb-2">
              Noch keine Einheiten — Policies gelten tenantweit.
            </p>
          ) : (
            <ul className="space-y-1 mb-3">
              {model.units.map((u) => (
                <li key={u.id} className="flex items-center justify-between gap-2 group">
                  <span className="text-[11px] text-titanium-400 font-mono truncate"
                        style={{ paddingLeft: `${indentOf(u)}px` }}>
                    {u.name} <span className="text-titanium-600">· {u.kind}</span>
                  </span>
                  {editable && (
                    <span className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        title="Umbenennen"
                        disabled={busy}
                        onClick={() => {
                          const name = window.prompt('Neuer Name der Einheit:', u.name);
                          if (name?.trim()) void run(() => renameUnit(u.id, name.trim()));
                        }}
                        className="text-[10px] font-mono text-titanium-500 hover:text-amber-200 disabled:opacity-50"
                      >umbenennen</button>
                      <button
                        title="Löschen"
                        disabled={busy}
                        onClick={() => {
                          if (window.confirm(`Einheit „${u.name}" löschen?`)) void run(() => deleteUnit(u.id));
                        }}
                        className="text-titanium-500 hover:text-red-300 disabled:opacity-50"
                      ><Trash2 className="h-3 w-3" /></button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}

          {editable && (
            <div className="flex flex-wrap items-center gap-1.5 border-t border-titanium-900 pt-2">
              <input
                value={unitName}
                onChange={(e) => setUnitName(e.target.value)}
                placeholder="Name"
                className="flex-1 min-w-[100px] bg-obsidian-950 border border-titanium-900 text-titanium-200 text-xs rounded-none px-2 py-1.5 outline-none"
              />
              <select
                value={unitKind}
                onChange={(e) => setUnitKind(e.target.value as OrgUnit['kind'])}
                className="bg-obsidian-950 border border-titanium-900 text-titanium-200 text-xs rounded-none px-2 py-1.5 outline-none cursor-pointer"
              >
                <option value="location">Standort</option>
                <option value="department">Abteilung</option>
                <option value="team">Team</option>
                <option value="unit">Einheit</option>
              </select>
              <select
                value={unitParent}
                onChange={(e) => setUnitParent(e.target.value)}
                className="bg-obsidian-950 border border-titanium-900 text-titanium-200 text-xs rounded-none px-2 py-1.5 outline-none cursor-pointer max-w-[130px]"
              >
                <option value="">— oberste Ebene —</option>
                {model.units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              <button
                disabled={busy || !unitName.trim()}
                onClick={async () => {
                  const ok = await run(() => createUnit(tenantId, unitName.trim(), unitKind, unitParent || null));
                  if (ok) { setUnitName(''); setUnitParent(''); }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-titanium-900 hover:border-amber-500 text-titanium-200 hover:text-amber-200 text-sm font-semibold rounded-none transition-colors disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Einheit
              </button>
            </div>
          )}
        </div>

        {/* ── Principals + Rollen ── */}
        <div className="border border-titanium-900 bg-obsidian-900/60 p-3">
          <div className="flex items-center gap-1.5 text-[12px] font-mono uppercase tracking-wider text-titanium-300 mb-2">
            <Users className="h-3.5 w-3.5" /> Principals ({model.principals.length})
          </div>

          {model.principals.length === 0 ? (
            <p className="text-[11px] text-titanium-500 mb-2">
              Noch keine Principals — Freigaben dürfen bis dahin owner und admin erteilen.
            </p>
          ) : (
            <ul className="space-y-2 mb-3">
              {model.principals.map((p) => (
                <PrincipalRow
                  key={p.id}
                  principal={p}
                  model={model}
                  editable={editable}
                  busy={busy}
                  onRun={run}
                />
              ))}
            </ul>
          )}

          {editable && (
            <div className="flex flex-wrap items-center gap-1.5 border-t border-titanium-900 pt-2">
              <input
                value={pName}
                onChange={(e) => setPName(e.target.value)}
                placeholder="Anzeigename"
                className="flex-1 min-w-[100px] bg-obsidian-950 border border-titanium-900 text-titanium-200 text-xs rounded-none px-2 py-1.5 outline-none"
              />
              <select
                value={pType}
                onChange={(e) => setPType(e.target.value as Principal['type'])}
                className="bg-obsidian-950 border border-titanium-900 text-titanium-200 text-xs rounded-none px-2 py-1.5 outline-none cursor-pointer"
              >
                <option value="user">Person</option>
                <option value="service">Dienst</option>
                <option value="agent">Agent</option>
                <option value="device">Gerät</option>
              </select>
              <select
                value={pUnit}
                onChange={(e) => setPUnit(e.target.value)}
                className="bg-obsidian-950 border border-titanium-900 text-titanium-200 text-xs rounded-none px-2 py-1.5 outline-none cursor-pointer max-w-[130px]"
              >
                <option value="">— ohne Einheit —</option>
                {model.units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              <button
                disabled={busy || !pName.trim()}
                onClick={async () => {
                  const ok = await run(() => createPrincipal(tenantId, pType, pName.trim(), { org_unit_id: pUnit || null }));
                  if (ok) { setPName(''); setPUnit(''); }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-titanium-900 hover:border-amber-500 text-titanium-200 hover:text-amber-200 text-sm font-semibold rounded-none transition-colors disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Principal
              </button>
            </div>
          )}
        </div>
      </div>

      {editable && model.principals.length > 0 && (
        <p className="text-[11px] text-titanium-600 mt-2">
          Hinweis: Ein Principal vom Typ „Person" wirkt erst, wenn er mit einem Benutzerkonto
          des Tenants verknüpft ist — diese Verknüpfung ist heute noch nicht über die Oberfläche
          möglich und erfolgt beim Anlegen über die API.
        </p>
      )}
    </section>
  );
}

function PrincipalRow({ principal, model, editable, busy, onRun }: {
  principal: Principal;
  model: AccessModel;
  editable: boolean;
  busy: boolean;
  onRun: (fn: () => Promise<{ ok: boolean; error?: { message: string } }>) => Promise<boolean>;
}) {
  const [role, setRole] = useState<string>(GOVERNANCE_ROLES[0]);
  const [scopeUnit, setScopeUnit] = useState<string>('');
  const bindings = model.bindings.filter((b) => b.principal_id === principal.id);
  const unitName = (id: string | null) => model.units.find((u) => u.id === id)?.name ?? '—';

  return (
    <li className="border border-titanium-900/70 p-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <span className="font-mono text-[11px] text-titanium-200">{principal.display_name}</span>
          <span className="text-[11px] text-titanium-600"> · {principal.type}</span>
          {principal.org_unit_id && (
            <span className="text-[11px] text-titanium-500"> · {unitName(principal.org_unit_id)}</span>
          )}
          {principal.status === 'disabled' && (
            <span className="text-[11px] text-amber-300"> · deaktiviert</span>
          )}
        </div>
        {editable && (
          <button
            disabled={busy}
            onClick={() => void onRun(() => updatePrincipal(principal.id, {
              status: principal.status === 'active' ? 'disabled' : 'active',
            }))}
            className="text-[10px] font-mono text-titanium-500 hover:text-amber-200 shrink-0 disabled:opacity-50"
          >
            {principal.status === 'active' ? 'deaktivieren' : 'aktivieren'}
          </button>
        )}
      </div>

      {bindings.length > 0 && (
        <ul className="mt-1.5 space-y-0.5">
          {bindings.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-2 text-[11px]">
              <span className="text-titanium-400">
                <span className="font-mono text-titanium-300">{ROLE_LABEL[b.role] ?? b.role}</span>
                <span className="text-titanium-600">
                  {' · '}{b.scope_type === 'tenant' ? 'gesamter Mandant' : `${unitName(b.org_unit_id)} inkl. Teilbaum`}
                </span>
              </span>
              {editable && (
                <button
                  disabled={busy}
                  onClick={() => void onRun(() => revokeRole(b.id))}
                  className="text-titanium-600 hover:text-red-300 shrink-0 disabled:opacity-50"
                  title="Rolle entziehen"
                ><Trash2 className="h-3 w-3" /></button>
              )}
            </li>
          ))}
        </ul>
      )}

      {editable && (
        <div className="flex flex-wrap items-center gap-1 mt-1.5">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="bg-obsidian-950 border border-titanium-900 text-titanium-300 text-[11px] rounded-none px-1.5 py-1 outline-none cursor-pointer"
          >
            {GOVERNANCE_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
          <select
            value={scopeUnit}
            onChange={(e) => setScopeUnit(e.target.value)}
            className="bg-obsidian-950 border border-titanium-900 text-titanium-300 text-[11px] rounded-none px-1.5 py-1 outline-none cursor-pointer max-w-[120px]"
          >
            <option value="">gesamter Mandant</option>
            {model.units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <button
            disabled={busy}
            onClick={() => void onRun(() => grantRole(
              principal.id, role, scopeUnit ? 'org_unit' : 'tenant', scopeUnit || null,
            ))}
            className="text-[10px] font-mono text-titanium-500 hover:text-amber-200 disabled:opacity-50"
          >+ Rolle</button>
        </div>
      )}
    </li>
  );
}
