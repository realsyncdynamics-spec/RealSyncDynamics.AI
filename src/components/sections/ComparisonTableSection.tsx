import { Check, X, Minus } from 'lucide-react';

// ComparisonTableSection — Burggraben sichtbar machen.
// RealSync vs. klassischer Cookie-Banner vs. klassische AI-Compliance-Tools.
// Adressiert: „Vergleichstabelle" aus dem Analyse-Punkt 6.
// Bewusst NICHT mit Wettbewerber-Namen — die Tabelle vergleicht KATEGORIEN.

type Cell =
  | { kind: 'yes'; note?: string }
  | { kind: 'no' }
  | { kind: 'partial'; note?: string };

interface Row {
  dimension:  string;
  detail:     string;
  realsync:   Cell;
  banner:     Cell;
  aiTool:     Cell;
}

const ROWS: readonly Row[] = [
  {
    dimension: 'Kontinuität',
    detail:    'Läuft die Compliance-Prüfung dauerhaft oder nur einmal pro Audit?',
    realsync:  { kind: 'yes',     note: 'Runtime-Stream' },
    banner:    { kind: 'no' },
    aiTool:    { kind: 'partial', note: 'tägl. Re-Scan' },
  },
  {
    dimension: 'Granularität',
    detail:    'Wird auf Browser-, Network- und KI-Layer gleichzeitig erkannt?',
    realsync:  { kind: 'yes',     note: '3 Layer + Graph' },
    banner:    { kind: 'partial', note: 'nur Browser' },
    aiTool:    { kind: 'partial', note: 'nur KI-Layer' },
  },
  {
    dimension: 'AI-Act-Scope',
    detail:    'Klassifikation nach Annex III, Risk-Profile, Human-Oversight-Pfade?',
    realsync:  { kind: 'yes',     note: 'agent-gestützt' },
    banner:    { kind: 'no' },
    aiTool:    { kind: 'partial', note: 'Policy-Templates' },
  },
  {
    dimension: 'Evidence-Chain',
    detail:    'Fälschungssichere Beweissicherung (SHA-256, Ed25519, RFC-3161)?',
    realsync:  { kind: 'yes',     note: 'kryptogr. versiegelt' },
    banner:    { kind: 'no' },
    aiTool:    { kind: 'partial', note: 'PDF-Export' },
  },
  {
    dimension: 'Remediation',
    detail:    'Code-Snippets, AVV-Deltas, Policy-Diffs als konkreter Output?',
    realsync:  { kind: 'yes',     note: 'per Agent + PR-Draft' },
    banner:    { kind: 'no' },
    aiTool:    { kind: 'partial', note: 'Vorlagen' },
  },
  {
    dimension: 'CI/CD-Integration',
    detail:    'Compliance als Build-Gate via API + Webhook?',
    realsync:  { kind: 'yes',     note: 'ab Growth' },
    banner:    { kind: 'no' },
    aiTool:    { kind: 'partial', note: 'manuell' },
  },
];

function CellIcon({ cell }: { cell: Cell }) {
  if (cell.kind === 'yes') {
    return (
      <div className="flex flex-col items-start gap-1">
        <Check className="h-4 w-4 text-emerald-400 shrink-0" />
        {cell.note && (
          <span className="font-mono text-[10px] text-emerald-300/80">{cell.note}</span>
        )}
      </div>
    );
  }
  if (cell.kind === 'no') {
    return <X className="h-4 w-4 text-titanium-700" />;
  }
  return (
    <div className="flex flex-col items-start gap-1">
      <Minus className="h-4 w-4 text-amber-400 shrink-0" />
      {cell.note && (
        <span className="font-mono text-[10px] text-amber-300/80">{cell.note}</span>
      )}
    </div>
  );
}

export function ComparisonTableSection() {
  return (
    <section
      aria-label="Vergleich"
      className="bg-obsidian-950 border-b border-titanium-900 py-20 sm:py-24 px-4 sm:px-6"
    >
      <div className="max-w-7xl mx-auto">
        <div className="max-w-3xl mb-12">
          <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-titanium-500 mb-3">
            03 · wo der Unterschied sitzt
          </div>
          <h2 className="text-3xl sm:text-4xl font-display font-semibold tracking-tight text-titanium-50 mb-3">
            Runtime ≠ Banner ≠ Policy-Templates.
          </h2>
          <p className="text-titanium-300 text-base sm:text-lg leading-relaxed max-w-2xl">
            Sechs Dimensionen, in denen sich eine Governance-Runtime von klassischen
            Cookie-Bannern und reinen AI-Compliance-Tools unterscheidet.
          </p>
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-hidden border border-titanium-900">
          <table className="w-full">
            <thead>
              <tr className="bg-obsidian-900 border-b border-titanium-900">
                <th className="text-left p-4 font-mono text-[10px] uppercase tracking-wider text-titanium-500 w-1/3">
                  Dimension
                </th>
                <th className="text-left p-4 font-mono text-[10px] uppercase tracking-wider text-cyan-300">
                  RealSyncDynamics
                </th>
                <th className="text-left p-4 font-mono text-[10px] uppercase tracking-wider text-titanium-500">
                  Cookie-Banner-Tool
                </th>
                <th className="text-left p-4 font-mono text-[10px] uppercase tracking-wider text-titanium-500">
                  Klassisches AI-Compliance-Tool
                </th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.dimension} className="border-b border-titanium-900/60 last:border-b-0">
                  <td className="p-4 align-top">
                    <div className="font-display font-semibold text-titanium-50 text-sm mb-1">
                      {r.dimension}
                    </div>
                    <div className="text-titanium-400 text-xs leading-relaxed">
                      {r.detail}
                    </div>
                  </td>
                  <td className="p-4 align-top bg-obsidian-900/40">
                    <CellIcon cell={r.realsync} />
                  </td>
                  <td className="p-4 align-top">
                    <CellIcon cell={r.banner} />
                  </td>
                  <td className="p-4 align-top">
                    <CellIcon cell={r.aiTool} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile: per-dimension cards */}
        <div className="md:hidden space-y-3">
          {ROWS.map((r) => (
            <article key={r.dimension} className="bg-obsidian-900 border border-titanium-900 p-5">
              <div className="font-display font-semibold text-titanium-50 mb-1">{r.dimension}</div>
              <div className="text-titanium-400 text-xs leading-relaxed mb-4">{r.detail}</div>
              <dl className="grid grid-cols-3 gap-3 text-xs">
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-wider text-cyan-300 mb-1.5">RealSync</dt>
                  <dd><CellIcon cell={r.realsync} /></dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-wider text-titanium-500 mb-1.5">Banner</dt>
                  <dd><CellIcon cell={r.banner} /></dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-wider text-titanium-500 mb-1.5">AI-Tool</dt>
                  <dd><CellIcon cell={r.aiTool} /></dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
