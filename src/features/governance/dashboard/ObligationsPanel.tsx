/**
 * „Ihre Pflichten heute" — erster spürbarer Nutzen im Command Center.
 *
 * Ein frischer Mandant sieht oben im Dashboard sonst nur leere Zähler. Dieser
 * Block macht aus drei Klicks (welche KI, welche Bots, welche Daten) eine
 * konkrete Pflichtenliste mit Rechtsgrundlage und Weg ins passende Modul.
 *
 * Quelle: `governance_activations.organization.aiSetup` (Selbstauskunft, WP3),
 * gelesen und geschrieben über activationApi — dieselbe Quelle wie
 * /app/activation und die Kachel „Bots & Agenten". Keine neue Tabelle, keine
 * Migration, kein Score. Ableitung: obligationsFromSetup.ts (regelbasiert).
 *
 * Zustände:
 *   - Laden · Fehler („nicht lesbar", nie eine leere Liste)
 *   - Keine Angaben → Schnellauswahl mit Live-Vorschau, Speichern auf Klick
 *   - „Keine KI im Einsatz" → ehrlicher Hinweis, Link zum Ändern
 *   - Angaben vorhanden → Pflichtenliste mit Fortschritt (ObligationTracker)
 *
 * Nichts wird ausgeführt. Jede Zeile navigiert nur ins zuständige Modul.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Check, ListChecks, Loader2 } from 'lucide-react';
import {
  EMPTY_ORGANIZATION,
  loadGovernanceActivation,
  saveGovernanceActivation,
  type GovernanceActivationRecord,
} from '../../activation/activationApi';
import {
  AI_SYSTEM_OPTIONS,
  BOT_AGENT_OPTIONS,
  DATA_CLASS_OPTIONS,
  createEmptyAiSetup,
  toggleExclusiveOption,
  toggleOption,
} from '../../activation/aiSetupCatalog';
import { notifyTenantDataChanged } from '../tenantDataEvents';
import {
  deriveObligations, usesAnyAi, type Obligation, type ObligationInput,
} from './obligationsFromSetup';
import { ObligationTracker } from './ObligationTracker';

interface Props {
  activeTenantId: string | null;
  reloadKey: number;
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; record: GovernanceActivationRecord | null };

const EMPTY_PICK: ObligationInput = { aiSystems: [], botsAgents: [], dataClasses: [] };

export function ObligationsPanel({ activeTenantId, reloadKey }: Props) {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [pick, setPick] = useState<ObligationInput>(EMPTY_PICK);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!activeTenantId) return;
    setState({ kind: 'loading' });
    setPick(EMPTY_PICK);
    setSaveError(null);
    loadGovernanceActivation(activeTenantId)
      .then((record) => { if (!cancelled) setState({ kind: 'ready', record }); })
      .catch(() => { if (!cancelled) setState({ kind: 'error' }); });
    return () => { cancelled = true; };
  }, [activeTenantId, reloadKey]);

  const saved = state.kind === 'ready' ? state.record?.organization.aiSetup : undefined;
  const preview = useMemo(() => deriveObligations(pick), [pick]);

  if (!activeTenantId) return null;

  async function save() {
    if (!activeTenantId || state.kind !== 'ready') return;
    const record = state.record;
    setSaving(true);
    setSaveError(null);
    const aiSetup = {
      ...createEmptyAiSetup(),
      aiSystems: pick.aiSystems,
      botsAgents: pick.botsAgents,
      dataClasses: pick.dataClasses,
    };
    try {
      await saveGovernanceActivation({
        tenantId: activeTenantId,
        organization: { ...(record?.organization ?? EMPTY_ORGANIZATION), aiSetup },
        scopes: record?.scopes ?? [],
        status: record?.status,
      });
      setState({
        kind: 'ready',
        record: {
          tenantId: activeTenantId,
          organization: { ...(record?.organization ?? EMPTY_ORGANIZATION), aiSetup },
          scopes: record?.scopes ?? [],
          status: record?.status ?? 'draft',
          updatedAt: new Date().toISOString(),
        },
      });
      // Kachel „Bots & Agenten" liest dieselbe Quelle — neu laden lassen.
      notifyTenantDataChanged(activeTenantId);
    } catch (err) {
      setSaveError((err as Error)?.message ?? String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      aria-labelledby="obligations-eyebrow"
      data-testid="obligations-panel"
      className="max-w-7xl mx-auto px-4 sm:px-6 pb-6"
    >
      <div className="border border-titanium-900 bg-obsidian-900 px-5 py-4">
        <p id="obligations-eyebrow" className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--brand-champ)] flex items-center gap-1.5">
          <ListChecks className="h-3 w-3" aria-hidden />
          Ihre Pflichten heute
        </p>

        {state.kind === 'loading' && (
          <p className="mt-3 flex items-center gap-1.5 text-sm text-titanium-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Laden…
          </p>
        )}

        {state.kind === 'error' && (
          <p className="mt-3 flex items-start gap-1.5 text-[13px] text-amber-300" role="status">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden />
            <span>Ihre Angaben sind gerade nicht lesbar. Keine Aussage möglich.</span>
          </p>
        )}

        {state.kind === 'ready' && !saved && (
          <QuickPick
            pick={pick}
            onChange={setPick}
            preview={preview}
            saving={saving}
            saveError={saveError}
            onSave={() => { void save(); }}
          />
        )}

        {state.kind === 'ready' && saved && !usesAnyAi(saved) && (
          <div className="mt-3">
            <p className="text-sm text-titanium-300">
              Laut Ihrer Angabe ist derzeit keine KI im Einsatz. Daraus folgen keine KI-Pflichten.
            </p>
            <RowLink to="/app/activation" label="Angaben ändern" />
          </div>
        )}

        {state.kind === 'ready' && saved && usesAnyAi(saved) && (
          <ObligationTracker
            tenantId={activeTenantId}
            setup={saved}
            company={state.record?.organization.company ?? ''}
            reloadKey={reloadKey}
          />
        )}
      </div>
    </section>
  );
}

/** Schnellauswahl für Mandanten ohne Selbstauskunft. Speichert erst auf Klick. */
function QuickPick({ pick, onChange, preview, saving, saveError, onSave }: {
  pick: ObligationInput;
  onChange: (next: ObligationInput) => void;
  preview: Obligation[];
  saving: boolean;
  saveError: string | null;
  onSave: () => void;
}) {
  const canSave = pick.aiSystems.length > 0 || pick.botsAgents.length > 0;
  return (
    <div className="mt-2">
      <h2 className="font-display text-lg font-semibold text-titanium-50">
        Drei Klicks, und Sie sehen, was für Ihr Unternehmen gilt.
      </h2>
      <p className="mt-1 text-sm text-titanium-400">
        Wählen Sie, welche KI Sie nutzen. Die Pflichten erscheinen sofort darunter.
      </p>

      <ChipGroup
        legend="1 · Welche KI nutzen Sie?"
        options={AI_SYSTEM_OPTIONS}
        selected={pick.aiSystems}
        onToggle={(id) => onChange({ ...pick, aiSystems: toggleExclusiveOption(pick.aiSystems, id) })}
      />
      <ChipGroup
        legend="2 · Welche Bots oder Agenten setzen Sie ein oder planen Sie?"
        options={BOT_AGENT_OPTIONS}
        selected={pick.botsAgents}
        onToggle={(id) => onChange({ ...pick, botsAgents: toggleExclusiveOption(pick.botsAgents, id) })}
      />
      <ChipGroup
        legend="3 · Mit welchen Daten kommt die KI in Berührung?"
        options={DATA_CLASS_OPTIONS}
        selected={pick.dataClasses}
        onToggle={(id) => onChange({ ...pick, dataClasses: toggleOption(pick.dataClasses, id) })}
      />

      {preview.length > 0 && (
        <div className="mt-4 border-t border-titanium-900 pt-3">
          <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-500">
            Vorschau · noch nicht gespeichert
          </p>
          <ObligationList list={preview} />
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave || saving}
          className="inline-flex items-center gap-1.5 bg-[var(--brand-champ)] px-4 py-2 text-sm font-semibold text-obsidian-950 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            : <Check className="h-3.5 w-3.5" aria-hidden />}
          Angaben speichern
        </button>
        <span className="text-[11px] text-titanium-500">
          Gespeichert wird nur Ihre Auswahl. Alles Weitere bleibt unter Activation änderbar.
        </span>
      </div>
      {saveError && (
        <p className="mt-2 flex items-start gap-1.5 text-[12px] text-amber-300" role="alert">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden />
          <span>Speichern fehlgeschlagen: {saveError}</span>
        </p>
      )}
    </div>
  );
}

function ChipGroup({ legend, options, selected, onToggle }: {
  legend: string;
  options: readonly { id: string; label: string }[];
  selected: readonly string[];
  onToggle: (id: string) => void;
}) {
  return (
    <fieldset className="mt-4">
      <legend className="text-[12px] font-semibold text-titanium-200">{legend}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((o) => {
          const on = selected.includes(o.id);
          return (
            <button
              key={o.id}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(o.id)}
              className={
                'border px-2.5 py-1 text-[12px] transition-colors '
                + (on
                  ? 'border-[var(--brand-champ)] bg-[var(--brand-champ)]/10 text-titanium-50'
                  : 'border-titanium-800 text-titanium-400 hover:border-titanium-600 hover:text-titanium-200')
              }
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Vorschau-Liste in der Schnellauswahl (noch nicht gespeichert). */
function ObligationList({ list }: { list: Obligation[] }) {
  return (
    <div className="mt-2" data-testid="obligations-preview">
      <ul className="mt-2 divide-y divide-titanium-900">
        {list.map((o) => (
          <li key={o.id} className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <p className="text-sm text-titanium-50">
                <span
                  className={
                    'mr-2 inline-block border px-1.5 py-px font-mono text-[9px] uppercase tracking-wider align-middle '
                    + (o.kind === 'duty'
                      ? 'border-[var(--brand-champ)] text-[var(--brand-champ)]'
                      : 'border-titanium-700 text-titanium-400')
                  }
                >
                  {o.kind === 'duty' ? 'Pflicht' : 'Prüfen'}
                </span>
                {o.title}
              </p>
              <p className="mt-0.5 text-[12px] text-titanium-400">
                {o.basis}{o.since && <> · {o.since}</>} · {o.because}
              </p>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-titanium-600">
        Regelbasiert aus Ihrer Auswahl abgeleitet. Startpunkt, keine Rechtsberatung, kein Score.
      </p>
    </div>
  );
}

function RowLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="mt-1.5 inline-flex shrink-0 items-center gap-1 text-[12px] font-semibold text-[var(--brand-champ)] hover:underline sm:mt-0"
    >
      {label} <ArrowRight className="h-3 w-3" aria-hidden />
    </Link>
  );
}
