import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronDown, TrendingDown, ShieldCheck, AlertTriangle } from 'lucide-react';
import {
  CONTROL_ROOM_METRICS,
  CONTROL_STATUS,
  RISK_BREAKDOWN,
  RISK_REASONS,
  COMPLIANCE_DRIFT,
  DEMO_BADGE,
  DEMO_EXPLAINER,
} from './complianceDemoData';

/**
 * ComplianceControlRoom — Produktvorschau der Governance-Oberfläche auf der
 * Startseite: Kennzahlen, Control-Status, Risk-Drilldown und Drift.
 *
 * ⚠️ Alle Zahlen sind Beispielwerte aus `complianceDemoData` und als DEMO
 * gekennzeichnet. Der Abschnitt stellt bewusst KEINE Live-Telemetrie dar —
 * echte Werte gäbe es nur tenant-bezogen hinter der Auth-Schicht (RLS).
 *
 * Design: bewusst in der Sprache der Startseite (weiße Hairlines auf Obsidian,
 * Cyan-Akzent, Mono für Metadaten) statt der Obsidian/Titanium-Tokens des
 * Dashboards — sonst bricht der Abschnitt aus der Landing-Optik aus.
 */
export function ComplianceControlRoom() {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className="border border-white/10 rounded-2xl bg-white/[0.02] overflow-hidden">
      <PanelHeader />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-white/10">
        {CONTROL_ROOM_METRICS.map((m, i) =>
          m.label === 'RISK SCORE'
            ? <RiskScoreCell key={m.label} open={open} panelId={panelId} onToggle={() => setOpen((v) => !v)} />
            : (
              // Der Risk Score belegt auf Mobile beide Spalten; damit bleiben
              // drei Kennzahlen für ein 2er-Raster übrig. Die letzte spannt
              // deshalb ebenfalls über beide Spalten — sonst bleibt eine leere
              // Rasterzelle als grauer Block stehen.
              <div
                key={m.label}
                className={`p-4 sm:p-5 bg-[rgb(3,7,18)] ${i === CONTROL_ROOM_METRICS.length - 1 ? 'col-span-2 lg:col-span-1' : ''}`}
              >
                <p className="font-mono text-[9px] sm:text-[10px] tracking-widest text-white/50 mb-2">{m.label}</p>
                <p className="flex items-baseline gap-1.5 flex-wrap">
                  <span className="font-mono font-bold text-white text-xl sm:text-2xl">{m.value}</span>
                  {m.suffix && <span className="font-mono text-xs text-white/40">{m.suffix}</span>}
                </p>
                <p className="mt-1.5 text-[11px] text-white/50 leading-relaxed">{m.note}</p>
              </div>
            ),
        )}
      </div>

      {/* Der Drilldown liegt bewusst außerhalb des Kennzahlen-Rasters: läge er in
          der Zelle, würde die gesamte Rasterzeile mitwachsen und neben den drei
          übrigen Kennzahlen eine große Leerfläche entstehen. */}
      {open && <RiskBreakdown id={panelId} />}

      <div className="grid md:grid-cols-2 gap-px bg-white/10 border-t border-white/10">
        <ControlStatus />
        <ComplianceDrift />
      </div>
    </div>
  );
}

/* ── Panel-Kopf ─────────────────────────────────────────────────────────── */
function PanelHeader() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-3 border-b border-white/10 bg-white/[0.03]">
      <p className="font-mono text-[10px] sm:text-xs tracking-widest text-white/70 uppercase">
        Compliance Control Room
      </p>
      {/* Kennzeichnung als Demo — Text, nicht nur Farbe, damit die Einordnung
          auch ohne Farbwahrnehmung ankommt. */}
      <p
        className="inline-flex items-center gap-1.5 font-mono text-[9px] sm:text-[10px] tracking-widest uppercase text-amber-300 border border-amber-300/30 bg-amber-300/10 rounded px-2 py-0.5"
        title={DEMO_EXPLAINER}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-amber-300" aria-hidden="true" />
        {DEMO_BADGE}
        <span className="sr-only"> — {DEMO_EXPLAINER}</span>
      </p>
    </div>
  );
}

/* ── Risk Score mit Drilldown ───────────────────────────────────────────── */
function RiskScoreCell({ open, panelId, onToggle }: { open: boolean; panelId: string; onToggle: () => void }) {
  return (
    <div className="bg-[rgb(3,7,18)] col-span-2 lg:col-span-1">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="w-full h-full text-left p-4 sm:p-5 min-h-[44px] hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-inset transition-colors"
      >
        <span className="flex items-center justify-between gap-2 mb-2">
          <span className="font-mono text-[9px] sm:text-[10px] tracking-widest text-white/50">RISK SCORE</span>
          <ChevronDown
            className={`w-3.5 h-3.5 text-cyan-400 transition-transform ${open ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </span>
        <span className="flex items-baseline gap-1.5">
          <span className="font-mono font-bold text-white text-2xl sm:text-3xl">87</span>
          <span className="font-mono text-xs text-white/40">/100</span>
        </span>
        <span className="mt-2 block h-1 w-full rounded-full bg-white/10 overflow-hidden" aria-hidden="true">
          <span className="block h-full w-[87%] rounded-full bg-cyan-400" />
        </span>
        <span className="mt-1.5 block text-[11px] text-white/50">
          {open ? 'Aufschlüsselung ausblenden' : 'Aufschlüsselung ansehen'}
        </span>
      </button>
    </div>
  );
}

/* ── Risk-Drilldown (eigene Zeile) ──────────────────────────────────────── */
function RiskBreakdown({ id }: { id: string }) {
  return (
    <div id={id} className="grid md:grid-cols-2 gap-x-8 gap-y-6 p-4 sm:p-6 border-t border-white/10 bg-white/[0.02] animate-fade-in">
      <div>
        <p className="font-mono text-[9px] tracking-widest text-white/40 uppercase mb-3">Aufschlüsselung</p>
        <ul className="space-y-2.5">
          {RISK_BREAKDOWN.map(({ domain, score }) => (
            <li key={domain}>
              <span className="flex items-baseline justify-between gap-2 mb-1">
                <span className="text-xs text-white/70">{domain}</span>
                <span className="font-mono text-xs font-bold text-white tabular-nums">{score}</span>
              </span>
              <span className="block h-1 w-full rounded-full bg-white/10 overflow-hidden" aria-hidden="true">
                <span className="block h-full rounded-full bg-cyan-400/70" style={{ width: `${score}%` }} />
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="font-mono text-[9px] tracking-widest text-white/40 uppercase mb-3">Warum dieser Score?</p>
        <ul className="space-y-2 mb-5">
          {RISK_REASONS.map((r) => (
            <li key={r} className="flex items-start gap-2 text-xs text-white/60 leading-relaxed">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-300 shrink-0 mt-px" strokeWidth={2} aria-hidden="true" />
              {r}
            </li>
          ))}
        </ul>

        <Link
          to="/flow/start-scan?source=home-controlroom-risk"
          className="inline-flex items-center gap-1.5 min-h-[44px] font-mono text-[10px] uppercase tracking-wider text-cyan-300 hover:text-cyan-200 transition-colors"
        >
          Eigenen Score ermitteln<ArrowRight className="w-3 h-3" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}

/* ── Control-Status ─────────────────────────────────────────────────────── */
function ControlStatus() {
  const passPct = Math.round((CONTROL_STATUS.pass / CONTROL_STATUS.total) * 100);

  return (
    <div className="p-4 sm:p-6 bg-[rgb(3,7,18)]">
      <p className="font-mono text-[9px] sm:text-[10px] tracking-widest text-white/50 mb-3">CONTROL-STATUS</p>

      {/* Der Balken ist Dekoration — die Zahlen darunter tragen die Aussage. */}
      <div className="flex h-2 w-full rounded-full overflow-hidden bg-white/10 mb-3" aria-hidden="true">
        <div className="h-full bg-emerald-400" style={{ width: `${passPct}%` }} />
        <div className="h-full bg-amber-300 flex-1" />
      </div>

      <dl className="flex flex-wrap gap-x-6 gap-y-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          <dt className="sr-only">Bestanden</dt>
          <dd className="font-mono text-sm font-bold text-white">
            {CONTROL_STATUS.pass} <span className="font-normal text-[11px] text-white/50">bestanden</span>
          </dd>
        </div>
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          <dt className="sr-only">In Prüfung</dt>
          <dd className="font-mono text-sm font-bold text-white">
            {CONTROL_STATUS.review} <span className="font-normal text-[11px] text-white/50">in Prüfung</span>
          </dd>
        </div>
      </dl>
    </div>
  );
}

/* ── Compliance Drift ───────────────────────────────────────────────────── */
function ComplianceDrift() {
  const delta = COMPLIANCE_DRIFT.current - COMPLIANCE_DRIFT.previous;

  return (
    <div className="p-4 sm:p-6 bg-[rgb(3,7,18)]">
      <p className="font-mono text-[9px] sm:text-[10px] tracking-widest text-white/50 mb-3">COMPLIANCE-DRIFT</p>

      <div className="flex items-center gap-3 sm:gap-4 mb-3 flex-wrap">
        <div>
          <p className="font-mono text-[9px] tracking-widest text-white/40 uppercase">Vorher</p>
          <p className="font-mono text-lg text-white/50 line-through">{COMPLIANCE_DRIFT.previous}</p>
        </div>
        <ArrowRight className="w-4 h-4 text-white/30 shrink-0" aria-hidden="true" />
        <div>
          <p className="font-mono text-[9px] tracking-widest text-white/40 uppercase">Aktuell</p>
          <p className="font-mono text-lg font-bold text-white">{COMPLIANCE_DRIFT.current}</p>
        </div>
        {/* Richtung zusätzlich als Vorzeichen im Text — nicht nur über Farbe. */}
        <p className="inline-flex items-center gap-1 font-mono text-xs font-bold text-amber-300">
          <TrendingDown className="w-3.5 h-3.5" strokeWidth={2} aria-hidden="true" />
          {delta}
        </p>
      </div>

      <p className="text-[11px] text-white/60 leading-relaxed mb-1">
        <span className="text-white/40">Auslöser: </span>{COMPLIANCE_DRIFT.reason}
      </p>
      <p className="text-[11px] text-amber-300/90 leading-relaxed">{COMPLIANCE_DRIFT.status}</p>
    </div>
  );
}
