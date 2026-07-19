import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Bot, Info, MousePointerClick, Check } from 'lucide-react';
import { tierById, type TierId } from '../../config/pricing';

/**
 * Gemeinsames Kit für den Claude-Code-Optimizer-Flow.
 *
 * Jeder Schritt des Optimizers ist eine EIGENE Seite. Jede Seite erklärt
 * über den Intro-Banner, (a) was auf dieser Seite passiert und (b) wohin der
 * primäre Button als Nächstes führt. Info- und Aktions-Seiten sind über den
 * Banner-Typ klar unterscheidbar. Der Stepper zeigt jederzeit, an welcher
 * Stelle im Ablauf der Kunde steht — so bleibt der Weg zum Ziel übersichtlich.
 *
 * Design: Obsidian/Titanium Hard-Edge (rounded-none), Cyan als Akzent —
 * konsistent mit /audit und dem Governance-Onboarding.
 */

// ─── Flow-Definition ──────────────────────────────────────────────────────

export const OPTIMIZER_BASE = '/claude-code-optimizer';

export type OptimizerStepId = 'ueberblick' | 'scan' | 'ergebnis' | 'anmeldung' | 'bericht';

export interface OptimizerStep {
  id: OptimizerStepId;
  index: number;      // 1-basiert für die Anzeige
  label: string;
  path: string;
}

export const OPTIMIZER_STEPS: OptimizerStep[] = [
  { id: 'ueberblick', index: 1, label: 'Überblick',  path: `${OPTIMIZER_BASE}` },
  { id: 'scan',       index: 2, label: 'Scan',       path: `${OPTIMIZER_BASE}/scan` },
  { id: 'ergebnis',   index: 3, label: 'Ergebnis',   path: `${OPTIMIZER_BASE}/ergebnis` },
  { id: 'anmeldung',  index: 4, label: 'Anmeldung',  path: `${OPTIMIZER_BASE}/anmelden` },
  { id: 'bericht',    index: 5, label: 'Bericht',    path: `${OPTIMIZER_BASE}/bericht` },
];

export function stepById(id: OptimizerStepId): OptimizerStep {
  return OPTIMIZER_STEPS.find((s) => s.id === id)!;
}

// ─── Scan-Ergebnis-State (überlebt Reload + Magic-Link-Redirect) ──────────

export interface OptimizerFinding {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  detail: string;
  paragraph_ref?: string;
}

export interface OptimizerScanResult {
  auditId: string;
  domain: string;
  email?: string;
  score: number;
  severity: string;
  findings: OptimizerFinding[];
  createdAt?: string;
}

const SCAN_STORAGE_KEY = 'cco_scan_result';

export function saveScanResult(result: OptimizerScanResult): void {
  try {
    sessionStorage.setItem(SCAN_STORAGE_KEY, JSON.stringify(result));
  } catch {
    /* sessionStorage nicht verfügbar — kein Blocker, State kommt via Router */
  }
}

export function loadScanResult(): OptimizerScanResult | null {
  try {
    const raw = sessionStorage.getItem(SCAN_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as OptimizerScanResult) : null;
  } catch {
    return null;
  }
}

export function clearScanResult(): void {
  try {
    sessionStorage.removeItem(SCAN_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

// ─── Shell (Header + Stepper + Content) ───────────────────────────────────

export function OptimizerShell({
  step,
  backTo,
  children,
}: {
  step: OptimizerStepId;
  /** Ziel des Zurück-Buttons; ohne Angabe: Browser-Historie (navigate(-1)). */
  backTo?: string;
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  const current = stepById(step);

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100 flex flex-col">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4 sm:px-6">
        <button
          type="button"
          onClick={() => (backTo ? navigate(backTo) : navigate(-1))}
          aria-label="Zurück"
          className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <Link to={OPTIMIZER_BASE} className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-none bg-obsidian-950 border border-cyan-700 flex items-center justify-center shrink-0">
            <Bot className="h-4 w-4 text-cyan-300" />
          </div>
          <div className="leading-tight min-w-0">
            <div className="font-display font-bold text-sm tracking-tight text-titanium-50 truncate">
              Claude Code Optimizer
            </div>
            <div className="text-[11px] text-titanium-400 font-medium">
              Schritt {current.index} von {OPTIMIZER_STEPS.length}: {current.label}
            </div>
          </div>
        </Link>
      </header>

      <Stepper current={step} />

      <main className="flex-1 px-4 sm:px-6 py-8 sm:py-12">
        <div className="max-w-3xl mx-auto">{children}</div>
      </main>
    </div>
  );
}

function Stepper({ current }: { current: OptimizerStepId }) {
  const currentIndex = stepById(current).index;
  return (
    <nav
      aria-label="Fortschritt"
      className="border-b border-titanium-900 bg-obsidian-950 px-4 sm:px-6 py-3 overflow-x-auto scrollbar-none"
    >
      <ol className="flex items-center gap-0 max-w-3xl mx-auto min-w-max">
        {OPTIMIZER_STEPS.map((s, i) => {
          const done = s.index < currentIndex;
          const active = s.index === currentIndex;
          return (
            <li key={s.id} className="flex items-center shrink-0">
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1 border text-[10px] font-mono uppercase tracking-wider rounded-none ${
                  active
                    ? 'border-cyan-600 text-cyan-200 bg-cyan-950'
                    : done
                      ? 'border-titanium-700 text-titanium-200 bg-obsidian-900'
                      : 'border-titanium-900 text-titanium-600 bg-obsidian-950'
                }`}
              >
                <span
                  className={`inline-flex items-center justify-center w-4 h-4 border rounded-none text-[9px] ${
                    active ? 'border-cyan-500 text-cyan-200' : done ? 'border-titanium-600 text-titanium-200' : 'border-titanium-800 text-titanium-600'
                  }`}
                >
                  {done ? <Check className="h-2.5 w-2.5" /> : s.index}
                </span>
                {s.label}
              </div>
              {i < OPTIMIZER_STEPS.length - 1 && <span className="text-titanium-700 px-1">→</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// ─── Intro-Banner: erklärt jede Seite + kündigt die nächste Aktion an ─────

export function IntroBanner({
  kind,
  eyebrow,
  title,
  children,
  nextActionLabel,
}: {
  kind: 'info' | 'aktion';
  eyebrow?: string;
  title: string;
  children: React.ReactNode;
  /** Kurzer Hinweis, was der primäre Button dieser Seite auslöst. */
  nextActionLabel?: string;
}) {
  const isAktion = kind === 'aktion';
  return (
    <div
      className={`border rounded-none p-5 sm:p-6 mb-8 ${
        isAktion ? 'border-cyan-800 bg-cyan-950/20' : 'border-titanium-800 bg-obsidian-900'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`shrink-0 w-9 h-9 rounded-none border flex items-center justify-center ${
            isAktion ? 'border-cyan-700 bg-obsidian-950' : 'border-titanium-700 bg-obsidian-950'
          }`}
        >
          {isAktion ? (
            <MousePointerClick className="h-4 w-4 text-cyan-300" />
          ) : (
            <Info className="h-4 w-4 text-titanium-200" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span
              className={`font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 border rounded-none ${
                isAktion
                  ? 'border-cyan-700 text-cyan-300 bg-obsidian-950'
                  : 'border-titanium-700 text-titanium-300 bg-obsidian-950'
              }`}
            >
              {isAktion ? 'Aktionsseite' : 'Infoseite'}
            </span>
            {eyebrow && (
              <span className="font-mono text-[10px] uppercase tracking-wider text-titanium-500">{eyebrow}</span>
            )}
          </div>
          <h1 className="font-display font-bold text-2xl sm:text-3xl text-titanium-50 leading-tight tracking-tight mb-2">
            {title}
          </h1>
          <div className="text-sm text-titanium-300 leading-relaxed space-y-2">{children}</div>
          {nextActionLabel && (
            <p className="mt-3 flex items-start gap-2 text-[12px] text-cyan-300/90 leading-relaxed">
              <ArrowRight className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>
                <span className="font-semibold">Nächster Schritt:</span> {nextActionLabel}
              </span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Buttons ──────────────────────────────────────────────────────────────

export function PrimaryButton({
  children,
  className = '',
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-2 bg-cyan-400 text-obsidian-950 px-6 py-3 text-sm font-bold rounded-none hover:bg-cyan-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${className}`}
    >
      {children}
    </button>
  );
}

export function SecondaryLink({
  to,
  children,
  className = '',
}: {
  to: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      to={to}
      className={`inline-flex items-center justify-center gap-2 px-5 py-3 border border-titanium-700 text-titanium-100 text-sm font-semibold rounded-none hover:border-titanium-400 hover:bg-obsidian-800 transition-colors ${className}`}
    >
      {children}
    </Link>
  );
}

// ─── Paket-Definitionen (was der Optimizer je Paket leistet) ──────────────
//
// Preise kommen ausschließlich aus src/config/pricing.ts (Single Source of
// Truth) — hier niemals hardcoden, sonst zeigen /pricing und diese Seite
// unterschiedliche Preise.

export interface OptimizerPackage {
  key: string;             // Stripe/Pricing-Plan-Key
  name: string;
  price: string;
  tagline: string;
  /** Was der Optimizer in diesem Paket JETZT konkret tut. */
  does: string[];
  highlighted?: boolean;
}

/** Anzeige-Preis aus der kanonischen Pricing-Config. */
function canonicalPrice(planKey: TierId): string {
  const tier = tierById(planKey);
  if (!tier) return 'individuell';
  if (tier.priceEur === 0) return planKey === 'free' ? '0 €' : 'individuell';
  return `${tier.priceString} €/Mo.`;
}

export const OPTIMIZER_PACKAGES: OptimizerPackage[] = [
  {
    key: 'free',
    name: 'Free-Scan',
    price: canonicalPrice('free'),
    tagline: 'Einmalige Analyse ohne Account',
    does: [
      'Einmaliger Website-Scan',
      'Liste der erkannten Fehler & Risiken',
      'Compliance-Score (0–100)',
    ],
  },
  {
    key: 'starter',
    name: 'Starter',
    price: canonicalPrice('starter'),
    tagline: 'Fehler verstehen & priorisieren',
    does: [
      'Priorisierter Fix-Plan pro Befund',
      'Konkrete Handlungsempfehlungen & Aufwandsschätzung',
      'Wöchentliches Re-Scan-Monitoring',
      'DSGVO-Dokumente aus den Befunden',
    ],
    highlighted: true,
  },
  {
    key: 'growth',
    name: 'Growth',
    price: canonicalPrice('growth'),
    tagline: 'Fehler automatisch beheben lassen',
    does: [
      'Automatische Fix-Vorschläge als Code (Claude Code)',
      'Kontinuierliche Optimierung & Drift-Alerts',
      'Evidence-Chain für jeden Fix',
      'Alles aus Starter',
    ],
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    price: canonicalPrice('enterprise'),
    tagline: 'Vollautomatisiert & auditfähig',
    does: [
      'Eigene Regelwerke & Policy-Packs',
      'SLA, dediziertes Onboarding & Support',
      'API-Zugriff & CI/CD-Integration',
      'Alles aus Growth',
    ],
  },
];
