/**
 * OS-Kachelreihe auf `/app/dashboard` (WP4).
 *
 * Macht die Kontrollschicht an fünf Stellen sichtbar: KI-Inventar,
 * Bots/Agenten des Mandanten, Residualrisiko, wartende Freigaben,
 * Evidence-Status. Kein zweites Dashboard — die Reihe sitzt zwischen
 * Übersicht und Browser-Runtime auf derselben Fläche.
 *
 * Regeln, die hier sichtbar bleiben müssen:
 *   - Jede Zahl trägt ihre Quelle als Fusszeile. Fehlt die Quelle, steht da
 *     ein Empty State oder ein Fehler — nie eine geschätzte Zahl.
 *   - Fehler sind von Leere getrennt: „nicht lesbar" sagt nicht „nichts da".
 *   - Eine fehlgeschlagene Quelle leert die anderen vier Kacheln nicht.
 *   - Residualrisiko ist ein Index 0–100, keine Anzahl. Die Beschriftung sagt
 *     das ausdrücklich, damit niemand 34 als „34 Risiken" liest.
 *   - Der globale Agenten-Katalog (WP5) ist keine Mandantenzahl. Er erscheint
 *     nur als eigener Link „Verfügbare Agenten".
 *   - Nichts wird hier ausgeführt. Maßnahmen bleiben menschlich ausgelöst
 *     (NextBestActionCard).
 */

import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, ArrowRight, Bot, Boxes, FileCheck2, Gauge, Loader2, Stamp,
} from 'lucide-react';
import {
  evidenceTileFrom, highRiskAssetsCountable, loadOsControlStripData, riskTileFrom,
  TILE_LOADING, type OsControlStripData, type TileState,
} from './osControlStripData';
import type { CockpitData } from '../cockpit/cockpitData';

interface Props {
  activeTenantId: string | null;
  /** Bereits geladene Cockpit-Daten — Risiko und Evidence kommen von dort. */
  data: CockpitData | null;
  loading: boolean;
  error: string | null;
  /** Erhöht sich bei „Erneut laden“. */
  reloadKey: number;
  /**
   * Zählt Mandanten-Datenereignisse (`useTenantDataVersion`). Muss als eigene
   * Abhängigkeit mitlaufen: ohne sie bliebe z. B. „Wartende Freigaben" auf der
   * alten Zahl stehen, nachdem eine Freigabe anderswo aufgelöst wurde — die
   * Cockpit-Daten lädt das Dashboard dann neu, diese drei Zähler aber nicht.
   */
  dataVersion: number;
}

const EMPTY_SOURCES: OsControlStripData = {
  aiSystems: TILE_LOADING,
  tenantAgents: TILE_LOADING,
  pendingApprovals: TILE_LOADING,
};

/** Die Kachelreihe. Lädt ihre drei eigenen Quellen, Risiko und Evidence kommen als Prop. */
export function OsControlStrip(
  { activeTenantId, data, loading, error, reloadKey, dataVersion }: Props,
) {
  const [sources, setSources] = useState<OsControlStripData>(EMPTY_SOURCES);

  useEffect(() => {
    let cancelled = false;
    if (!activeTenantId) {
      setSources(EMPTY_SOURCES);
      return;
    }
    setSources(EMPTY_SOURCES);
    // loadOsControlStripData fängt jeden Teilfehler selbst ab (allSettled) und
    // wirft nicht — deshalb braucht es hier kein .catch, das alle fünf Kacheln
    // auf einmal leeren würde.
    void loadOsControlStripData(activeTenantId).then((next) => {
      if (!cancelled) setSources(next);
    });
    return () => { cancelled = true; };
  }, [activeTenantId, reloadKey, dataVersion]);

  if (!activeTenantId) return null;

  const risk = riskTileFrom(data, loading, error);
  const evidence = evidenceTileFrom(data, loading, error);

  return (
    <section
      data-testid="os-control-strip"
      aria-label="Kontrollschicht"
      className="max-w-7xl mx-auto px-4 sm:px-6 pb-6"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        <Tile
          icon={<Boxes className="h-3 w-3" aria-hidden />}
          label="KI-Inventar"
          source="ai_systems (RLS)"
          testId="os-tile-ai-systems"
        >
          {tileBody(sources.aiSystems, (count) => count === 0
            ? <Empty text="Noch kein KI-System erfasst" to="/app/activation" cta="Setup öffnen" />
            : (
              <>
                <Figure value={count} unit={count === 1 ? 'System' : 'Systeme'} />
                <TileLink to="/app/ai-systems" label="Inventar öffnen" />
              </>
            ))}
        </Tile>

        <Tile
          icon={<Bot className="h-3 w-3" aria-hidden />}
          label="Bots & Agenten"
          source="governance_activations.organization.aiSetup"
          testId="os-tile-agents"
        >
          {tileBody(sources.tenantAgents, (agents) => (
            <>
              {!agents.configured
                ? <Empty text="AI-OS-Setup noch nicht gespeichert" to="/app/activation" cta="Setup öffnen" />
                : agents.count === 0
                  ? (
                    <p className="text-sm text-titanium-300">
                      {agents.declaredNone
                        ? 'Keine Bots oder Agenten geplant — ausdrücklich angegeben.'
                        : 'Keine Bots oder Agenten erfasst.'}
                    </p>
                  )
                  : <Figure value={agents.count} unit="erfasst" />}
              {/* Der Plattform-Katalog ist bewusst getrennt beschriftet: er zählt
                  nicht zum Mandanten, er zeigt nur, was verfügbar ist. */}
              <TileLink to="/app/ai-systems/agents" label="Verfügbare Agenten" />
            </>
          ))}
        </Tile>

        <Tile
          icon={<Gauge className="h-3 w-3" aria-hidden />}
          label="Residualrisiko (Index 0–100)"
          source="cockpitData.riskIndex"
          testId="os-tile-risk"
        >
          {tileBody(risk, (index) => index.score === null
            // Wortlaut kommt aus computeRiskIndex ("Kein Residualrisiko
            // erfasst"), nicht aus dieser Komponente — eine Quelle für den Text.
            ? <p className="text-sm text-titanium-300">{index.label}</p>
            : (
              <>
                <Figure value={index.score} unit={`von 100 · ${index.label}`} />
                {highRiskAssetsCountable(data) && index.highRiskAssets > 0 && (
                  <p className="mt-1 text-[11px] text-titanium-400">
                    {index.highRiskAssets} Assets mit hohem Risiko
                  </p>
                )}
              </>
            ))}
        </Tile>

        <Tile
          icon={<Stamp className="h-3 w-3" aria-hidden />}
          label="Wartende Freigaben"
          source="governance_approvals (status = pending)"
          testId="os-tile-approvals"
        >
          {tileBody(sources.pendingApprovals, (count) => count === 0
            ? <p className="text-sm text-titanium-300">Keine Freigaben offen.</p>
            : (
              <>
                <Figure value={count} unit="offen" />
                <TileLink to="/app/approvals" label="Freigaben öffnen" />
              </>
            ))}
        </Tile>

        <Tile
          icon={<FileCheck2 className="h-3 w-3" aria-hidden />}
          label="Evidence-Status"
          source="cockpitData.evidenceHealth"
          testId="os-tile-evidence"
        >
          {tileBody(evidence, (health) => health.totalCount === 0
            ? <Empty text="Noch keine Nachweise" to="/app/activation" cta="Setup öffnen" />
            : (
              <>
                {health.percent === null
                  ? <p className="text-sm text-titanium-300">Abdeckung nicht gemessen.</p>
                  : <Figure value={health.percent} unit={`% Abdeckung · ${health.label}`} />}
                <p className="mt-1 text-[11px] text-titanium-400">
                  {health.hashedCount} von {health.totalCount} Nachweisen gehasht
                </p>
              </>
            ))}
        </Tile>
      </div>
    </section>
  );
}

/**
 * Zustandswechsel einer Kachel. Bewusst eine generische **Funktion** und kein
 * generisches JSX-Element: so wird `T` aus dem ersten Argument abgeleitet, ohne
 * von der Inferenz über JSX-Attribute abzuhängen.
 *
 * `render` wird ausschliesslich im Fall `value` aufgerufen — damit kann keine
 * Kachel einen Fehler oder einen Ladezustand versehentlich als Zahl zeichnen.
 */
function tileBody<T>(state: TileState<T>, render: (value: T) => ReactNode): ReactNode {
  if (state.kind === 'loading') {
    return (
      <p className="flex items-center gap-1.5 text-sm text-titanium-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Laden…
      </p>
    );
  }
  if (state.kind === 'error') {
    return (
      <p className="flex items-start gap-1.5 text-[12px] text-amber-300" role="status">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden />
        <span>Quelle nicht lesbar — keine Aussage möglich.</span>
      </p>
    );
  }
  return render(state.value);
}

/** Kachelrahmen: Beschriftung, Inhalt, Quellenzeile. */
function Tile({ icon, label, source, testId, children }: {
  icon: ReactNode;
  label: string;
  source: string;
  testId: string;
  children: ReactNode;
}) {
  return (
    <div
      data-testid={testId}
      className="flex flex-col justify-between border border-titanium-900 bg-obsidian-900 px-4 py-3 min-h-[116px]"
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--brand-champ)] flex items-center gap-1.5">
        {icon}
        {label}
      </p>
      <div className="mt-2 grow">{children}</div>
      <p className="mt-2 font-mono text-[9px] uppercase tracking-wider text-titanium-600">
        Quelle: {source}
      </p>
    </div>
  );
}

/** Eine Zahl mit Einheit. Nur für gemessene Werte. */
function Figure({ value, unit }: { value: number; unit: string }) {
  return (
    <p className="text-titanium-50">
      <span className="font-display text-2xl font-bold tabular-nums">{value}</span>
      <span className="ml-1.5 text-[11px] text-titanium-400">{unit}</span>
    </p>
  );
}

/** Empty State: Grund plus Weg, wie der Mandant die Quelle füllt. */
function Empty({ text, to, cta }: { text: string; to: string; cta: string }) {
  return (
    <>
      <p className="text-sm text-titanium-300">{text}</p>
      <TileLink to={to} label={cta} />
    </>
  );
}

/** Verweis aus einer Kachel heraus. Navigiert nur, führt nichts aus. */
function TileLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--brand-champ)] hover:underline"
    >
      {label} <ArrowRight className="h-3 w-3" aria-hidden />
    </Link>
  );
}
