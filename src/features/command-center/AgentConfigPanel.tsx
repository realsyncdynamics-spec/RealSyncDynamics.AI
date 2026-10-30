import { useMemo, useState } from 'react';
import { getSupabase } from '../../lib/supabase';
import { useTenant } from '../../core/access/TenantProvider';
import {
  diffConfig, FIELD_LABEL, formatValue, SECTION_FIELDS, SECTIONS, sectionView, validateConfig, type ConfigSection,
} from './agentConfig';
import { useAgentConfig } from './useAgentConfig';

function useOptionalTenantId(): string | null {
  try {
    const t = useTenant();
    return t.activeTenantId ?? null;
  } catch {
    return null;
  }
}

/** M5: Details / Bibliothek / Computer — versionierte Soll-Konfiguration eines Agenten. */
export function AgentConfigPanel({ agentRef, agentName, onClose }: { agentRef: string; agentName: string; onClose: () => void }) {
  const tenantId = useOptionalTenantId();
  const { rows, loading, sourceError, reload } = useAgentConfig(agentRef);
  const [section, setSection] = useState<ConfigSection>('details');
  const [draftText, setDraftText] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const view = useMemo(() => sectionView(rows, agentRef, section), [rows, agentRef, section]);

  async function saveDraft() {
    let parsed: unknown;
    try { parsed = JSON.parse(draftText); } catch { setErrors(['Kein gültiges JSON']); return; }
    const v = validateConfig(section, parsed);
    if (!v.ok) { setErrors(v.errors); return; }
    if (!tenantId) { setErrors(['Kein aktiver Mandant — Entwurf nicht möglich']); return; }
    setBusy(true);
    const { error } = await getSupabase().from('agent_config_versions')
      .insert({ tenant_id: tenantId, agent_ref: agentRef, section, config: v.config, change_note: note || null });
    setBusy(false);
    if (error) { setErrors([`Abgelehnt: ${error.message}`]); return; }
    setErrors([]); setDraftText(''); setNote(''); reload();
  }

  async function activate(id: string) {
    setBusy(true);
    const { error } = await getSupabase().rpc('activate_agent_config_version', { p_id: id, p_confirm: confirm[id] === true });
    setBusy(false);
    if (error) { setErrors([`Aktivierung abgelehnt: ${error.message}`]); return; }
    setErrors([]); reload();
  }

  return (
    <section aria-label={`Soll-Konfiguration ${agentName}`} data-testid="agent-config-panel"
      className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Soll-Konfiguration: {agentName}</h2>
        <button type="button" onClick={onClose} className="text-xs text-zinc-400 underline">Schließen</button>
      </div>
      <p className="mt-1 text-xs text-zinc-400">
        Soll ≠ Ist. Abgleich mit externen Diensten erfolgt manuell bzw. unterstützt — keine Änderung fremder Admin-Oberflächen.
      </p>
      <div role="tablist" aria-label="Bereiche" className="mt-3 flex gap-1">
        {SECTIONS.map((s) => (
          <button key={s.key} role="tab" type="button" aria-selected={section === s.key}
            onClick={() => { setSection(s.key); setErrors([]); }}
            className={`rounded px-3 py-1 text-sm ${section === s.key ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-400'}`}>
            {s.label}
          </button>
        ))}
      </div>

      {sourceError && <p role="status" className="mt-3 text-sm text-amber-200">{sourceError}</p>}
      {loading && <p className="mt-3 text-sm text-zinc-400">Lade …</p>}

      <div role="tabpanel" className="mt-3">
        <h3 className="text-sm font-medium text-zinc-200">
          Aktive Version: {view.active ? `v${view.active.version}` : 'keine (Soll nicht hinterlegt)'}
        </h3>
        <dl data-testid="config-fields" className="mt-2 grid grid-cols-[10rem_1fr] gap-x-3 gap-y-1 text-xs">
          {Object.keys(SECTION_FIELDS[section]).map((k) => (
            <div key={k} className="contents">
              <dt className="text-zinc-400">{FIELD_LABEL[k] ?? k}</dt>
              <dd className="break-words text-zinc-200">{view.active ? formatValue(view.active.config[k]) : 'UNBEKANNT'}</dd>
            </div>
          ))}
        </dl>
        {section === 'computer' && (
          <p className="mt-2 text-xs text-zinc-500">Ist-Status Terminal/Browser: UNBEKANNT (keine Live-Quelle angebunden).</p>
        )}

        {view.drafts.map((d) => (
          <div key={d.id} data-testid="config-draft" className="mt-3 rounded border border-zinc-700 p-2 text-xs">
            <p className="text-zinc-200">Entwurf v{d.version}{d.change_note ? ` — ${d.change_note}` : ''}</p>
            <p className="text-zinc-400">Geänderte Felder: {diffConfig(view.active?.config ?? null, d.config).map((k) => FIELD_LABEL[k] ?? k).join(', ') || 'keine'}</p>
            <label className="mt-1 flex items-center gap-1.5 text-zinc-300">
              <input type="checkbox" checked={confirm[d.id] === true}
                onChange={(e) => setConfirm((c) => ({ ...c, [d.id]: e.target.checked }))} />
              Ich aktiviere Entwurf v{d.version} ausdrücklich.
            </label>
            <button type="button" disabled={busy || confirm[d.id] !== true} onClick={() => void activate(d.id)}
              className="mt-1 rounded border border-emerald-700 px-2 py-0.5 text-emerald-200 disabled:opacity-40">
              Entwurf v{d.version} aktivieren
            </button>
          </div>
        ))}

        {view.history.length > 0 && (
          <details className="mt-3 text-xs text-zinc-400">
            <summary>Versionsverlauf ({view.history.length})</summary>
            <ul>{view.history.map((h) => <li key={h.id}>v{h.version} · ersetzt{h.activated_at ? ` · aktiv seit ${new Date(h.activated_at).toLocaleString('de-DE')}` : ''}</li>)}</ul>
          </details>
        )}

        <div className="mt-4 border-t border-zinc-800 pt-3">
          <label className="block text-xs text-zinc-400">
            Neuer Entwurf (JSON; Felder: {Object.keys(SECTION_FIELDS[section]).join(', ')}). Keine Secrets.
            <textarea aria-label="Entwurf JSON" value={draftText} onChange={(e) => setDraftText(e.target.value)} rows={4}
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 p-2 font-mono text-xs text-zinc-100" />
          </label>
          <label className="mt-1 block text-xs text-zinc-400">
            Änderungsnotiz
            <input aria-label="Änderungsnotiz" value={note} onChange={(e) => setNote(e.target.value)}
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-100" />
          </label>
          <button type="button" disabled={busy || !draftText.trim()} onClick={() => void saveDraft()}
            className="mt-2 rounded border border-zinc-600 px-2 py-0.5 text-xs text-zinc-200 disabled:opacity-40">
            Als Entwurf speichern
          </button>
        </div>
        {errors.length > 0 && (
          <ul role="alert" className="mt-2 list-disc pl-4 text-xs text-red-300">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
        )}
      </div>
    </section>
  );
}
