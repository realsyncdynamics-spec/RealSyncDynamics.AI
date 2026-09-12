import { useEffect, useState } from 'react';
import { GOVERNANCE_MODULES } from '../governance-os/governanceModules';
import { COMPLIANCE_NODES } from './governance-nodes';
import { prefersReducedMotion } from './prefers-reduced-motion';
import {
  GA_DISPLAY,
  GA_GOLD,
  GA_GOLD_LITE,
  GA_GREEN,
  GA_LINE,
  GA_LINE_SOFT,
  GA_MONO,
  GA_MUTED,
  GA_SILVER,
  GA_TEXT,
  GA_TITAN,
} from './governance-ai-theme';
import { SectionEyebrow, SectionHeading, SectionIndex } from './GovernanceSectionChrome';

/**
 * Workspace-Vorschau — „Das bekommen Sie" als Browser-Rahmen.
 *
 * ## Beispieldaten, und zwar sichtbar
 *
 * Score, Findings, Reifegrade und Chain-Höhe sind **erfunden**. Ein anonymer
 * Besucher hat keinen Mandanten; alles andere wäre eine Live-Behauptung über
 * Daten, die es nicht gibt. Deshalb trägt der Rahmen die nicht entfernbare
 * Kennzeichnung „DEMO · BEISPIELDATEN" (Truth Layer,
 * `LANDING_FORBIDDEN_LIVE_CLAIMS`).
 *
 * Echt ist die **Struktur**: Die Seitennavigation kommt aus
 * `governanceModules.ts` — dieselbe Quelle, aus der der eingeloggte Workspace
 * sein Menü baut, inklusive BETA-/ROADMAP-Status. Der Besucher sieht damit
 * die tatsächliche Modullandschaft, nicht eine geschönte Auswahl.
 */

/** Beispielwerte des Command Centers. */
const TILES: readonly (readonly [string, string, string])[] = [
  ['78', '/100', 'GOVERNANCE SCORE'],
  ['12', '', 'OFFENE FINDINGS'],
  ['1.284', '', 'EVIDENCE-EINTRÄGE'],
  ['3', '', 'KI-SYSTEME IM REGISTER'],
];

/** Reifegrade je Policy Pack. TISAX/DORA sind Roadmap — daher ohne Balken. */
const FRAMEWORKS: readonly (readonly [string, number, string])[] = [
  ['DSGVO', 82, '82 %'],
  ['EU AI ACT', 64, '64 %'],
  ['ISO 27001', 55, '55 %'],
  ['NIS2', 28, '28 %'],
  ['TISAX', 0, 'NEXT'],
  ['DORA', 0, 'NEXT'],
];

type Severity = 'high' | 'mid' | 'low';

const SEVERITY_STYLE: Record<Severity, { color: string; background: string; borderColor: string }> = {
  high: { color: '#ffd7c2', background: 'rgba(214,96,60,.22)', borderColor: 'rgba(214,96,60,.5)' },
  mid: { color: '#f3ddba', background: 'rgba(201,139,82,.18)', borderColor: 'rgba(201,162,74,.42)' },
  low: { color: '#cfe8dd', background: 'rgba(32,214,154,.14)', borderColor: 'rgba(32,214,154,.4)' },
};

const FINDINGS: readonly (readonly [string, Severity, string, string])[] = [
  ['HOCH', 'high', 'Tracker vor Einwilligung geladen', 'Art. 6 · TTDSG §25'],
  ['HOCH', 'high', 'KI-Endpoint ohne Transparenzhinweis', 'AI Act Art. 50'],
  ['MITTEL', 'mid', 'Auftragsverarbeiter ohne AVV-Nachweis', 'Art. 28'],
  ['MITTEL', 'mid', 'Drift: neuer Third-Party-Request', 'Runtime · Deploy'],
  ['NIEDRIG', 'low', 'Security-Header unvollständig', 'ISO 27001 A.8'],
];

const INTENT_CHIPS: readonly string[] = [
  'AI-Act-Klassifikation prüfen',
  '§13-Update draften',
  'Evidence exportieren',
  'Drift erklären',
];

const MODULE_STATUS_CHIP: Record<string, string> = { beta: 'BETA', roadmap: 'ROADMAP' };

const HEX = '0123456789abcdef';
const randomHash = () =>
  `0x${Array.from({ length: 6 }, () => HEX[Math.floor(Math.random() * 16)]).join('')}`;

/** Die vier Knoten der Evidence-Chain — dieselben wie die Pins der Karte. */
const CHAIN_NODES = COMPLIANCE_NODES.slice(0, 4);

function Panel({ title, meta, children }: { title: string; meta: string; children: React.ReactNode }) {
  return (
    <div
      className="overflow-hidden rounded-md border"
      style={{ borderColor: GA_LINE_SOFT, backgroundColor: 'rgba(22,24,27,.7)' }}
    >
      <div
        className="flex items-center gap-2 border-b px-4 py-3 text-[11px] tracking-[.18em]"
        style={{ borderColor: GA_LINE_SOFT, fontFamily: GA_MONO, color: GA_TITAN }}
      >
        {title}
        <b className="ml-auto font-medium tracking-[.12em]" style={{ color: GA_GOLD_LITE }}>
          {meta}
        </b>
      </div>
      {children}
    </div>
  );
}

/** Rotierende Hashes — die Chain wächst weiter, auch während man hinsieht. */
function useRotatingHashes(count: number) {
  const [hashes, setHashes] = useState<string[]>(() => Array.from({ length: count }, randomHash));
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    if (prefersReducedMotion()) return;

    let turn = 0;
    let highlightTimer = 0;
    const interval = window.setInterval(() => {
      const index = turn % count;
      turn += 1;
      setHashes((current) => current.map((value, i) => (i === index ? randomHash() : value)));
      setActiveIndex(index);
      window.clearTimeout(highlightTimer);
      highlightTimer = window.setTimeout(() => setActiveIndex(-1), 900);
    }, 2200);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(highlightTimer);
    };
  }, [count]);

  return { hashes, activeIndex };
}

export function WorkspacePreviewSection() {
  const { hashes, activeIndex } = useRotatingHashes(CHAIN_NODES.length);

  return (
    <section
      id="dashboard"
      className="ga-band relative z-[1] border-t px-[4vw] py-[clamp(60px,6vw,92px)]"
      style={{ borderColor: GA_LINE_SOFT }}
    >
      <div className="mx-auto w-full max-w-[1500px]">
        <SectionIndex number="01" label="WORKSPACE" />
        <SectionEyebrow>IHR WORKSPACE</SectionEyebrow>
        <SectionHeading accent="Ihr Governance-Dashboard.">Das bekommen Sie:</SectionHeading>
        <p className="mt-4 max-w-[660px] text-[14px] leading-[1.7] text-pretty" style={{ color: GA_MUTED }}>
          Nach dem Free Audit läuft Ihre Runtime im Command Center weiter — Rahmenwerk-Reifegrade,
          offene Findings, Evidence-Chain und der Agent-Intent auf einer Fläche.
        </p>

        <div
          className="mt-[38px] overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-[14px]"
          style={{ borderColor: GA_LINE, backgroundColor: 'rgba(20,22,25,.88)' }}
        >
          {/* Browserleiste */}
          <div
            className="flex items-center gap-3 border-b px-4 py-3"
            style={{ borderColor: GA_LINE_SOFT, backgroundColor: 'rgba(12,13,15,.92)' }}
          >
            <div className="flex gap-1.5" aria-hidden="true">
              {[0, 1, 2].map((dot) => (
                <i key={dot} className="h-[9px] w-[9px] rounded-full bg-[rgba(214,220,228,.2)]" />
              ))}
            </div>
            <div
              className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap rounded border px-3 py-1.5 text-[11px] tracking-[.06em]"
              style={{
                borderColor: GA_LINE_SOFT,
                backgroundColor: 'rgba(18,28,38,.8)',
                fontFamily: GA_MONO,
                color: GA_TITAN,
              }}
            >
              realsyncdynamics.ai/app/dashboard
            </div>
            <span
              className="whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] tracking-[.14em]"
              style={{
                fontFamily: GA_MONO,
                borderColor: 'rgba(201,162,74,.42)',
                color: GA_GOLD_LITE,
              }}
            >
              DEMO · BEISPIELDATEN
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[216px_minmax(0,1fr)]">
            {/* Modulnavigation aus governanceModules.ts */}
            <nav
              className="hidden border-r py-4 md:block"
              style={{ borderColor: GA_LINE_SOFT, backgroundColor: 'rgba(15,16,19,.75)' }}
              aria-label="Governance-OS-Module (Vorschau)"
            >
              <p
                className="px-4 pb-2 text-[11px] tracking-[.18em]"
                style={{ fontFamily: GA_MONO, color: 'rgba(139,147,157,.75)' }}
              >
                GOVERNANCE OS
              </p>
              {GOVERNANCE_MODULES.slice(0, 15).map((module, index) => {
                const active = index === 0;
                return (
                  <div
                    key={module.id}
                    className="flex items-center gap-2 border-l-2 px-4 py-[9px] text-[13px] font-medium tracking-[-.005em]"
                    style={{
                      color: active ? GA_TEXT : GA_MUTED,
                      borderLeftColor: active ? GA_GOLD : 'transparent',
                      background: active
                        ? 'linear-gradient(90deg, rgba(201,139,82,.16), transparent)'
                        : undefined,
                    }}
                  >
                    <span>{module.label}</span>
                    {MODULE_STATUS_CHIP[module.status] && (
                      <b
                        className="ml-auto text-[10px] font-medium tracking-[.1em]"
                        style={{ fontFamily: GA_MONO, color: 'rgba(230,201,138,.8)' }}
                      >
                        {MODULE_STATUS_CHIP[module.status]}
                      </b>
                    )}
                  </div>
                );
              })}
            </nav>

            <div className="flex flex-col gap-5 p-5">
              <div className="flex flex-wrap items-baseline gap-3">
                <h3
                  className="m-0 text-[22px] tracking-[-.02em]"
                  style={{ fontFamily: GA_DISPLAY, fontWeight: 600, color: GA_TEXT }}
                >
                  Compliance Command Center
                </h3>
                <span
                  className="text-[11px] tracking-[.14em]"
                  style={{ fontFamily: GA_MONO, color: GA_TITAN }}
                >
                  PLAN GROWTH · EU-CENTRAL
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {TILES.map(([value, suffix, label]) => (
                  <div
                    key={label}
                    className="ga-card rounded-md border p-4"
                    style={{
                      borderColor: GA_LINE_SOFT,
                      background: 'linear-gradient(150deg, rgba(40,43,48,.7), rgba(20,22,25,.8))',
                    }}
                  >
                    <b
                      className="block text-[30px] tracking-[-.02em]"
                      style={{ fontFamily: GA_DISPLAY, fontWeight: 600, color: GA_SILVER }}
                    >
                      {value}
                      {suffix && (
                        <i className="not-italic text-[14px]" style={{ color: GA_TITAN }}>
                          {suffix}
                        </i>
                      )}
                    </b>
                    <span
                      className="text-[11px] tracking-[.12em]"
                      style={{ fontFamily: GA_MONO, color: GA_TITAN }}
                    >
                      {label}
                    </span>
                  </div>
                ))}
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <Panel title="RAHMENWERK-REIFEGRAD" meta="6 POLICY PACKS">
                  {FRAMEWORKS.map(([name, percent, label], index) => (
                    <div
                      key={name}
                      className="grid grid-cols-[minmax(96px,auto)_minmax(0,1fr)_56px] items-center gap-3 px-4 py-[11px] text-[12px]"
                      style={{
                        color: GA_MUTED,
                        borderTop: index === 0 ? undefined : '1px solid rgba(214,220,228,.06)',
                      }}
                    >
                      <s className="whitespace-nowrap no-underline tracking-[.1em]" style={{ fontFamily: GA_MONO, color: GA_SILVER }}>
                        {name}
                      </s>
                      <div className="h-[5px] overflow-hidden rounded-full bg-[rgba(214,220,228,.12)]">
                        <u
                          className="block h-full no-underline"
                          style={{
                            width: `${percent}%`,
                            background: 'linear-gradient(90deg, #8a6a24, #e6c98a)',
                          }}
                        />
                      </div>
                      <em
                        className="text-right text-[11px] not-italic"
                        style={{ fontFamily: GA_MONO, color: GA_TITAN }}
                      >
                        {label}
                      </em>
                    </div>
                  ))}
                </Panel>

                <Panel title="OFFENE FINDINGS" meta="PRIORISIERT">
                  {FINDINGS.map(([severity, tone, text, reference], index) => (
                    <div
                      key={text}
                      className="grid grid-cols-[74px_minmax(0,1fr)_minmax(0,auto)] items-center gap-3 px-4 py-[11px] text-[12px]"
                      style={{
                        color: GA_MUTED,
                        borderTop: index === 0 ? undefined : '1px solid rgba(214,220,228,.06)',
                      }}
                    >
                      <span
                        className="rounded border py-[3px] text-center text-[10px] tracking-[.1em]"
                        style={{ fontFamily: GA_MONO, ...SEVERITY_STYLE[tone] }}
                      >
                        {severity}
                      </span>
                      <em
                        className="overflow-hidden text-ellipsis whitespace-nowrap not-italic"
                        style={{ color: GA_SILVER }}
                      >
                        {text}
                      </em>
                      <u
                        className="whitespace-nowrap text-[11px] no-underline"
                        style={{ fontFamily: GA_MONO, color: 'rgba(230,201,138,.8)' }}
                      >
                        {reference}
                      </u>
                    </div>
                  ))}
                </Panel>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <Panel title="EVIDENCE-CHAIN" meta="ANCHORED">
                  {CHAIN_NODES.map((node, index) => (
                    <div
                      key={node.city}
                      className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)_auto] items-center gap-3.5 px-4 py-[11px] text-[11px]"
                      style={{
                        fontFamily: GA_MONO,
                        color: GA_MUTED,
                        borderTop: index === 0 ? undefined : '1px solid rgba(214,220,228,.06)',
                      }}
                    >
                      <s
                        className="whitespace-nowrap no-underline tracking-[.1em]"
                        style={{ color: GA_GOLD_LITE }}
                      >
                        {node.city}
                      </s>
                      <em
                        className="overflow-hidden text-ellipsis whitespace-nowrap not-italic"
                        style={{ color: GA_SILVER }}
                      >
                        {node.role}
                      </em>
                      <u
                        className="no-underline transition-colors"
                        style={{ color: index === activeIndex ? GA_GOLD_LITE : GA_TITAN }}
                      >
                        {hashes[index]}
                      </u>
                    </div>
                  ))}
                </Panel>

                <Panel title="AGENT OS · INTENT" meta="REVIEW-PFLICHTIG">
                  <div className="flex flex-wrap items-center gap-3 p-4">
                    <div
                      className="min-w-0 flex-1 basis-[220px] rounded-full border px-4 py-3 text-[13px]"
                      style={{
                        borderColor: GA_LINE_SOFT,
                        backgroundColor: 'rgba(10,17,24,.8)',
                        color: GA_TITAN,
                      }}
                    >
                      Was möchtest du erledigen?
                    </div>
                    <span
                      className="rounded-full px-[18px] py-[11px] text-[13px] font-semibold"
                      style={{
                        color: '#14100b',
                        background:
                          'linear-gradient(135deg, #f0d6b6 0%, #c98b52 48%, #a06a36 74%, #e5bd93 100%)',
                      }}
                    >
                      Session starten
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 px-4 pb-4">
                    {INTENT_CHIPS.map((chip) => (
                      <span
                        key={chip}
                        className="rounded-full border px-3 py-1.5 text-[11px] tracking-[.08em]"
                        style={{ fontFamily: GA_MONO, borderColor: GA_LINE_SOFT, color: GA_MUTED }}
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                </Panel>
              </div>

              <p
                className="flex items-center gap-2 text-[11px] tracking-[.1em]"
                style={{ fontFamily: GA_MONO, color: GA_TITAN }}
              >
                <i
                  className="ga-blink h-[5px] w-[5px] rounded-full not-italic"
                  style={{ backgroundColor: GA_GREEN }}
                  aria-hidden="true"
                />
                BEISPIELANSICHT — Ihre echten Werte erscheinen nach dem ersten Scan.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
