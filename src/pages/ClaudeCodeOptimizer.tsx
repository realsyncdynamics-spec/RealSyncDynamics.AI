import { Link } from 'react-router-dom';
import { SEOHead } from '../components/SEOHead';
import {
  ArrowRight,
  Code2,
  ShieldCheck,
  GitBranch,
  Zap,
  Gauge,
  FileCheck2,
  Terminal,
  Check,
  Sparkles,
} from 'lucide-react';

/**
 * ClaudeCodeOptimizer — dedizierte Erklär-Landingpage für den
 * „Claude Code Optimizer" (Ziel der NEU-Pill auf der Startseite).
 *
 * Design: Obsidian-Hintergrund (rgb(3,7,18)), Cyan-Akzent, Plus Jakarta Sans
 * + JetBrains Mono für Metadaten — konsistent mit MainLanding, aber eigene,
 * eigenständige Route. Zweck: erklären, was der Optimizer leistet, und mit
 * klarem CTA zur Preisseite (/pricing) führen.
 */

const BG = 'rgb(3, 7, 18)';
const FONT_STACK = "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif";

const CAPABILITIES = [
  {
    icon: ShieldCheck,
    title: 'DSGVO- & AI-Act-Audit im Code',
    text: 'Claude Code prüft Ihr Repository auf Datenschutz- und Regelverstöße — Tracking ohne Consent, Drittland-Transfers, fehlende Rechtsgrundlagen — bevor sie in Produktion gehen.',
  },
  {
    icon: Code2,
    title: 'Konkrete Fix-Vorschläge',
    text: 'Nicht nur „hier ist das Problem", sondern der einfügbare Fix-Code: Script-Blocking, Consent-Injection, Font-Self-Hosting — auditiert und begründet.',
  },
  {
    icon: GitBranch,
    title: 'In Ihren Workflow integriert',
    text: 'Läuft im Pull-Request, kommentiert Findings direkt am Diff und liefert reproduzierbare Prüfpfade — statt manueller Review-Runden.',
  },
  {
    icon: FileCheck2,
    title: 'Auditfähige Evidenz',
    text: 'Jeder Lauf landet als kryptografisch nachvollziehbarer Nachweis im Evidence Vault — exportierbar für Aufsicht, Kunden und interne Compliance.',
  },
  {
    icon: Gauge,
    title: 'Kontinuierlich statt einmalig',
    text: 'Kein Projekt mit Enddatum: Der Optimizer überwacht jeden Merge und meldet neue Risiken, sobald sie entstehen.',
  },
  {
    icon: Zap,
    title: 'Schneller live, sicherer live',
    text: 'Weniger Nacharbeit, weniger Bußgeldrisiko, weniger Berater-Tagessätze — Compliance wird Teil der Entwicklung statt ein Blocker davor.',
  },
];

const STEPS = [
  { no: '01', title: 'Repository verbinden', text: 'GitHub-Repo in Minuten anbinden — ohne schwere Integration, ohne Umbau Ihrer Pipeline.' },
  { no: '02', title: 'Claude Code prüft', text: 'Der Optimizer analysiert Code und Datenflüsse, klassifiziert Risiken und schlägt konkrete Fixes vor.' },
  { no: '03', title: 'Nachweisen & mergen', text: 'Fixes übernehmen, Findings als Evidenz sichern — jeder Merge bleibt prüfbar und aufsichtskonform.' },
];

const OUTCOMES = [
  'Datenschutzverstöße vor dem Deploy erkennen',
  'Fix-Code statt vager Empfehlungen',
  'Findings direkt im Pull-Request',
  'Lückenloser, exportierbarer Prüfpfad',
  'EU-souverän gehostet',
  '14 Tage kostenlos testen',
];

export function ClaudeCodeOptimizer() {
  return (
    <div className="min-h-screen text-white antialiased" style={{ backgroundColor: BG, fontFamily: FONT_STACK }}>
      <SEOHead
        title="Claude Code Optimizer — DSGVO- & AI-Act-Audit direkt im Code"
        description="Der Claude Code Optimizer prüft Ihr Repository auf Datenschutz- und AI-Act-Verstöße, liefert einfügbaren Fix-Code und sichert jeden Merge als auditfähige Evidenz. 14 Tage kostenlos testen."
        canonical="/claude-code-optimizer"
      />

      {/* ── NAV ─────────────────────────────────────────────── */}
      <header className="relative z-20">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-mono text-xs tracking-widest text-white/80 hover:text-white transition-colors">
            <ArrowRight className="w-3.5 h-3.5 rotate-180" />ZURÜCK
          </Link>
          <Link
            to="/pricing?source=optimizer-nav"
            className="inline-flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold text-[rgb(3,7,18)] bg-cyan-400 hover:bg-cyan-300 transition-colors rounded-lg"
          >
            Preise ansehen<ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* ── HERO ────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 z-0 bg-gradient-to-b from-cyan-500/[0.06] via-transparent to-transparent" />
        <div className="relative z-10 max-w-4xl mx-auto px-6 lg:px-10 pt-16 pb-14 sm:pt-24 sm:pb-20 text-center">
          <div className="inline-flex items-center gap-2 sm:gap-2.5 px-2.5 sm:px-3 py-1 sm:py-1.5 mb-6 sm:mb-8 border border-cyan-500/40 bg-cyan-500/5 rounded-full">
            <span className="px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-bold tracking-wider text-[rgb(3,7,18)] bg-cyan-400 rounded">NEU</span>
            <span className="font-mono text-[10px] sm:text-xs tracking-widest text-cyan-300 flex items-center gap-1">
              CLAUDE CODE OPTIMIZER
            </span>
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold leading-[1.1] sm:leading-[1.05] tracking-tight mb-5 sm:mb-6">
            Compliance-Fehler finden.<br /><span className="text-cyan-400">Fix-Code bekommen.</span>
          </h1>

          <p className="text-sm sm:text-lg text-white/70 max-w-2xl mx-auto leading-relaxed mb-8 sm:mb-10">
            Der Claude Code Optimizer prüft Ihr Repository auf DSGVO- und
            EU-AI-Act-Verstöße, liefert den einfügbaren Fix-Code und sichert jeden
            Merge als auditfähige Evidenz — direkt in Ihrem Pull-Request.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
            <Link
              to="/pricing?source=optimizer-hero"
              className="inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3 sm:py-3.5 text-xs sm:text-sm font-semibold text-[rgb(3,7,18)] bg-cyan-400 hover:bg-cyan-300 transition-colors rounded-lg"
            >
              Preise ansehen · 14 Tage testen<ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/flow/start-scan?source=optimizer-hero"
              className="inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3 sm:py-3.5 text-xs sm:text-sm font-semibold text-white border border-white/20 hover:border-white/40 hover:bg-white/5 transition-colors rounded-lg"
            >
              <Terminal className="w-4 h-4" />Kostenlos starten
            </Link>
          </div>
        </div>
      </section>

      {/* ── WAS ES LEISTET ──────────────────────────────────── */}
      <section className="relative z-10 py-14 sm:py-20 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="max-w-2xl mb-10 md:mb-12">
            <p className="font-mono text-[10px] sm:text-xs tracking-[0.25em] text-cyan-400/90 mb-3 sm:mb-4">WAS ES LEISTET</p>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight mb-3 sm:mb-4">Von der Warnung zum eingefügten Fix</h2>
            <p className="text-sm sm:text-base text-white/60 leading-relaxed">
              Kein LLM-generiertes „schreib eine Datenschutzerklärung", sondern
              strukturierte Prüfung mit konkretem, begründetem Code — auditfähig
              und reproduzierbar.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-white/10">
            {CAPABILITIES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex gap-4 p-6 sm:p-8" style={{ backgroundColor: BG }}>
                <Icon className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" strokeWidth={1.75} />
                <div>
                  <h3 className="text-sm sm:text-base font-bold mb-1.5">{title}</h3>
                  <p className="text-xs sm:text-sm text-white/55 leading-relaxed">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SO FUNKTIONIERT ES ──────────────────────────────── */}
      <section className="relative z-10 py-14 sm:py-20 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="max-w-2xl mb-10 md:mb-12">
            <p className="font-mono text-[10px] sm:text-xs tracking-[0.25em] text-cyan-400/90 mb-3 sm:mb-4">SO FUNKTIONIERT ES</p>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight mb-3 sm:mb-4">In drei Schritten prüfbar</h2>
            <p className="text-sm sm:text-base text-white/60 leading-relaxed">Ab dem ersten Merge — ohne Monate-Projekt, ohne statische PDFs.</p>
          </div>

          <div className="grid sm:grid-cols-3 gap-6 sm:gap-8">
            {STEPS.map(({ no, title, text }) => (
              <div key={no}>
                <span className="font-mono text-2xl sm:text-3xl font-bold text-cyan-400/80">{no}</span>
                <h3 className="text-sm sm:text-base font-bold mt-3 mb-1.5">{title}</h3>
                <p className="text-xs sm:text-sm text-white/55 leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ───────────────────────────────────────── */}
      <section className="relative z-10 py-16 sm:py-24 border-t border-white/10">
        <div className="max-w-4xl mx-auto px-6 lg:px-10">
          <div className="border border-cyan-500/30 bg-cyan-500/[0.04] rounded-2xl p-8 sm:p-12 text-center">
            <Sparkles className="w-6 h-6 text-cyan-400 mx-auto mb-5" strokeWidth={1.75} />
            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight mb-4">
              Compliance in die Entwicklung holen — statt davor
            </h2>
            <p className="text-sm sm:text-base text-white/65 leading-relaxed max-w-xl mx-auto mb-8">
              Starten Sie den Claude Code Optimizer im Rahmen jedes Pakets.
              Transparent, metered, jederzeit kündbar — 14 Tage kostenlos.
            </p>

            <ul className="grid sm:grid-cols-2 gap-x-8 gap-y-2.5 max-w-xl mx-auto text-left mb-9">
              {OUTCOMES.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-xs sm:text-sm text-white/75">
                  <Check className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
              <Link
                to="/pricing?source=optimizer-final"
                className="inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3 sm:py-4 text-xs sm:text-sm font-semibold text-[rgb(3,7,18)] bg-cyan-400 hover:bg-cyan-300 transition-colors rounded-lg"
              >
                Preise ansehen<ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/flow/start-scan?source=optimizer-final"
                className="inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3 sm:py-4 text-xs sm:text-sm font-semibold text-white border border-white/20 hover:border-white/40 hover:bg-white/5 transition-colors rounded-lg"
              >
                Kostenlos starten
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
