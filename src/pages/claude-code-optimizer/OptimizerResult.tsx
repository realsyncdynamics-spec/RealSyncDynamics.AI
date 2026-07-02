import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight, AlertTriangle, CheckCircle2, Globe, Wrench, Search, Clock, Sparkles,
} from 'lucide-react';
import { usePageMeta } from '../../lib/usePageMeta';
import {
  OptimizerShell,
  IntroBanner,
  PrimaryButton,
  SecondaryLink,
  stepById,
  loadScanResult,
  saveScanResult,
  type OptimizerScanResult,
  type OptimizerFinding,
} from './OptimizerKit';

/**
 * Schritt 3 — Ergebnis (Info + Aktion).
 *
 * „Das sind deine Fehler." Zeigt Score + Befundliste und — je Zeitachse —
 * was der Optimizer JETZT tut, was er BEHEBEN würde und was er in Zukunft
 * DAUERHAFT übernimmt. Der primäre Button führt zur Anmeldung (Schritt 4).
 */

const SEV_META: Record<OptimizerFinding['severity'], { label: string; cls: string }> = {
  critical: { label: 'KRITISCH', cls: 'text-red-300 border-red-900 bg-red-950/30' },
  high: { label: 'HOCH', cls: 'text-titanium-50 border-titanium-600 bg-obsidian-900' },
  medium: { label: 'MITTEL', cls: 'text-titanium-100 border-titanium-700 bg-obsidian-900' },
  low: { label: 'NIEDRIG', cls: 'text-titanium-300 border-titanium-800 bg-obsidian-900' },
  info: { label: 'INFO', cls: 'text-titanium-200 border-titanium-800 bg-obsidian-900' },
};

const TIMELINE = [
  {
    icon: Search,
    phase: 'Jetzt',
    title: 'Was der Optimizer bereits getan hat',
    text: 'Deine Website ist gescannt. Alle Befunde unten sind erkannt, nach Schweregrad sortiert und mit Rechtsbezug versehen.',
  },
  {
    icon: Wrench,
    phase: 'Nach der Anmeldung',
    title: 'Was der Optimizer beheben würde',
    text: 'Zu jedem Befund liefert er einen priorisierten Fix-Plan, konkrete Handlungsschritte und — ab Growth — Fix-Vorschläge als Code.',
  },
  {
    icon: Clock,
    phase: 'Dauerhaft',
    title: 'Was der Optimizer künftig übernimmt',
    text: 'Kontinuierliches Monitoring erkennt neue Risiken (Drift), alarmiert dich und dokumentiert jeden Nachweis in der Evidence-Chain.',
  },
];

export function OptimizerResult() {
  const navigate = useNavigate();
  const { state } = useLocation();
  usePageMeta({
    title: 'Deine Fehler — Claude Code Optimizer',
    description: 'Deine Scan-Befunde und was der Claude Code Optimizer je Paket damit tut.',
    url: 'https://RealSyncDynamicsAI.de/claude-code-optimizer/ergebnis',
  });

  const [result, setResult] = useState<OptimizerScanResult | null>((state as OptimizerScanResult) ?? null);

  useEffect(() => {
    if (!result) {
      const stored = loadScanResult();
      if (stored) setResult(stored);
    } else {
      // State aus Router in sessionStorage spiegeln (Reload-fest).
      saveScanResult(result);
    }
  }, [result]);

  // Kein Scan vorhanden → zurück zum Scan.
  if (!result) {
    return (
      <OptimizerShell step="ergebnis" backTo={stepById('scan').path}>
        <div className="text-center py-12">
          <AlertTriangle className="h-12 w-12 text-amber-400 mx-auto mb-4" />
          <h1 className="text-2xl font-display font-bold text-titanium-50 mb-2">Noch kein Scan vorhanden</h1>
          <p className="text-sm text-titanium-300 mb-6 max-w-md mx-auto">
            Um deine Fehler zu sehen, führe zuerst den kostenlosen Website-Scan durch.
          </p>
          <PrimaryButton onClick={() => navigate(stepById('scan').path)}>
            <Search className="h-4 w-4" /> Zum Scan <ArrowRight className="h-4 w-4" />
          </PrimaryButton>
        </div>
      </OptimizerShell>
    );
  }

  const critCount = result.findings.filter((f) => f.severity === 'critical').length;
  const highCount = result.findings.filter((f) => f.severity === 'high').length;
  const scoreCls = result.score >= 75 ? 'text-emerald-300' : result.score >= 50 ? 'text-amber-300' : 'text-red-300';

  const anmeldung = stepById('anmeldung');

  return (
    <OptimizerShell step="ergebnis" backTo={stepById('scan').path}>
      <IntroBanner
        kind="info"
        eyebrow="Schritt 3 von 5"
        title="Das sind deine Fehler"
        nextActionLabel="Mit »Jetzt optimieren« meldest du dich an und schaltest den ausführlichen Bericht samt Behebung frei."
      >
        <p>
          Der Scan von <span className="font-mono text-titanium-100">{result.domain}</span> ist
          abgeschlossen. Unten siehst du jeden erkannten Fehler. Darunter erklären wir transparent,
          was der Optimizer damit <span className="text-titanium-200">jetzt, nach der Anmeldung und
          dauerhaft</span> tun würde.
        </p>
      </IntroBanner>

      {/* Score-Zusammenfassung */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <SummaryTile label="Website" value={result.domain} mono />
        <SummaryTile label="Score" value={`${result.score}/100`} valueClass={scoreCls} />
        <SummaryTile label="Kritisch" value={String(critCount)} valueClass={critCount > 0 ? 'text-red-300' : 'text-emerald-300'} />
        <SummaryTile label="Hoch" value={String(highCount)} valueClass={highCount > 0 ? 'text-amber-300' : 'text-emerald-300'} />
      </div>

      {/* Befundliste */}
      <section className="mb-10">
        <h2 className="text-xs font-bold text-titanium-500 uppercase tracking-[0.2em] mb-3">
          {result.findings.length} {result.findings.length === 1 ? 'Befund' : 'Befunde'}
        </h2>
        {result.findings.length === 0 ? (
          <div className="p-5 bg-obsidian-900 border border-titanium-700 rounded-none flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 mt-0.5 shrink-0" />
            <div>
              <div className="font-display font-bold text-titanium-50 mb-0.5">Keine Fehler erkannt</div>
              <div className="text-sm text-titanium-300">
                Unsere Standard-Checks haben nichts gefunden. Mit Monitoring bleibt das auch so.
              </div>
            </div>
          </div>
        ) : (
          <ul className="space-y-3">
            {result.findings.map((f) => {
              const meta = SEV_META[f.severity];
              return (
                <li key={f.id} className={`p-4 border rounded-none ${meta.cls}`}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider">{meta.label}</span>
                    {f.paragraph_ref && (
                      <span className="text-[10px] text-titanium-500 font-mono">{f.paragraph_ref}</span>
                    )}
                  </div>
                  <div className="font-display font-bold text-titanium-50 mb-1">{f.title}</div>
                  <div className="text-sm text-titanium-300 leading-relaxed">{f.detail}</div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Jetzt / würde / wird */}
      <section className="mb-10">
        <h2 className="text-xs font-bold text-titanium-500 uppercase tracking-[0.2em] mb-4">
          Was der Optimizer damit macht
        </h2>
        <div className="space-y-3">
          {TIMELINE.map(({ icon: Icon, phase, title, text }) => (
            <div
              key={phase}
              className="border border-titanium-800 bg-obsidian-900 border-l-2 border-l-cyan-700 p-4 rounded-none flex items-start gap-3"
            >
              <Icon className="h-5 w-5 text-cyan-300 shrink-0 mt-0.5" strokeWidth={1.75} />
              <div>
                <div className="font-mono text-[9px] uppercase tracking-widest text-cyan-400 mb-0.5">{phase}</div>
                <div className="font-display font-bold text-titanium-50 text-sm mb-0.5">{title}</div>
                <p className="text-xs text-titanium-400 leading-relaxed">{text}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-titanium-500 flex items-center gap-1.5">
          <Sparkles className="h-3 w-3" />
          Der genaue Umfang der Behebung hängt vom gewählten Paket ab — die Auswahl siehst du im nächsten Schritt.
        </p>
      </section>

      {/* CTA */}
      <div className="flex flex-col sm:flex-row gap-3">
        <PrimaryButton onClick={() => navigate(anmeldung.path, { state: result })}>
          <Wrench className="h-4 w-4" /> Jetzt optimieren <ArrowRight className="h-4 w-4" />
        </PrimaryButton>
        <SecondaryLink to={stepById('scan').path}>
          <Search className="h-4 w-4" /> Andere URL scannen
        </SecondaryLink>
      </div>
      <p className="mt-3 text-[11px] text-titanium-500">
        Der Scan ersetzt keine Rechtsberatung und keine vollständige technische Prüfung.
      </p>
    </OptimizerShell>
  );
}

function SummaryTile({
  label,
  value,
  valueClass,
  mono,
}: {
  label: string;
  value: string;
  valueClass?: string;
  mono?: boolean;
}) {
  return (
    <div className="border border-titanium-800 bg-obsidian-900 p-3 rounded-none">
      <div className="flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-widest text-titanium-600 mb-1">
        {label === 'Website' && <Globe className="h-3 w-3" />}
        {label}
      </div>
      <div className={`font-display font-bold text-titanium-50 text-base truncate ${mono ? 'font-mono text-sm' : ''} ${valueClass ?? ''}`}>
        {value}
      </div>
    </div>
  );
}
