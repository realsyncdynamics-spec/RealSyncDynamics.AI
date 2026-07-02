import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, FileText, Wrench, ShieldCheck, Search } from 'lucide-react';
import { usePageMeta } from '../../lib/usePageMeta';
import {
  OptimizerShell,
  IntroBanner,
  PrimaryButton,
  SecondaryLink,
  stepById,
  loadScanResult,
  OPTIMIZER_PACKAGES,
  type OptimizerScanResult,
} from './OptimizerKit';

/**
 * Schritt 5 — Ausführlicher Bericht & Paket (Info + Aktion).
 *
 * Sichtbar nach der Anmeldung (Magic-Link-Redirect landet hier). Fasst den
 * Scan zusammen, erklärt, was der Optimizer je Paket konkret behebt, und führt
 * mit der Paket-Auswahl zur verbindlichen Buchung (/pricing → Checkout).
 */

export function OptimizerReport() {
  const navigate = useNavigate();
  usePageMeta({
    title: 'Dein Bericht & Paket — Claude Code Optimizer',
    description: 'Ausführlicher Optimierungs-Bericht und Paket-Auswahl für deine Website.',
    url: 'https://RealSyncDynamicsAI.de/claude-code-optimizer/bericht',
  });

  const [scan, setScan] = useState<OptimizerScanResult | null>(null);
  useEffect(() => {
    setScan(loadScanResult());
  }, []);

  const critCount = scan?.findings.filter((f) => f.severity === 'critical').length ?? 0;
  const highCount = scan?.findings.filter((f) => f.severity === 'high').length ?? 0;
  // Empfehlung: bei kritischen/hohen Befunden Growth, sonst Starter.
  const recommendedKey = critCount > 0 || highCount > 1 ? 'growth' : 'starter';

  function bookPackage(planKey: string) {
    const params = new URLSearchParams({ source: 'claude_code_optimizer' });
    if (planKey !== 'free') params.set('plan', planKey);
    if (scan?.auditId) params.set('audit_id', scan.auditId);
    navigate(`/pricing?${params.toString()}`);
  }

  return (
    <OptimizerShell step="bericht" backTo={stepById('ergebnis').path}>
      <IntroBanner
        kind="info"
        eyebrow="Schritt 5 von 5"
        title="Dein ausführlicher Bericht"
        nextActionLabel="Wähle ein Paket — du landest auf der Preis-/Buchungsseite, wo du den Optimizer verbindlich aktivierst."
      >
        <p>
          Willkommen! Du bist angemeldet. Auf Basis deines Scans
          {scan ? (
            <>
              {' '}von <span className="font-mono text-titanium-100">{scan.domain}</span>
            </>
          ) : null}{' '}
          zeigen wir dir hier, was der Claude Code Optimizer je Paket für dich behebt und überwacht.
        </p>
      </IntroBanner>

      {!scan && (
        <div className="border border-titanium-800 bg-obsidian-900 p-5 rounded-none mb-8 flex items-start gap-3">
          <Search className="h-5 w-5 text-cyan-300 shrink-0 mt-0.5" />
          <div className="text-sm text-titanium-300">
            Wir konnten keinen aktiven Scan finden. Du kannst dennoch ein Paket wählen — oder{' '}
            <button
              type="button"
              onClick={() => navigate(stepById('scan').path)}
              className="text-cyan-300 underline hover:text-cyan-200"
            >
              zuerst deine Website scannen
            </button>
            .
          </div>
        </div>
      )}

      {scan && (
        <section className="mb-10">
          <h2 className="text-xs font-bold text-titanium-500 uppercase tracking-[0.2em] mb-3">
            Zusammenfassung deines Scans
          </h2>
          <div className="border border-titanium-900 bg-obsidian-900 rounded-none divide-y divide-titanium-900">
            <Row label="Website" value={scan.domain} mono />
            <Row label="Compliance-Score" value={`${scan.score} / 100`} />
            <Row label="Erkannte Befunde" value={String(scan.findings.length)} />
            <Row label="Kritisch / Hoch" value={`${critCount} / ${highCount}`} />
          </div>
        </section>
      )}

      {/* Paket-Auswahl */}
      <section className="mb-8">
        <h2 className="text-xs font-bold text-titanium-500 uppercase tracking-[0.2em] mb-1">
          Paket wählen
        </h2>
        <p className="text-sm text-titanium-400 mb-4 leading-relaxed">
          Was der Optimizer für dich behebt, hängt vom Paket ab. Klick auf ein Paket, um es zu buchen —
          du wirst zur Buchungsseite weitergeleitet.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {OPTIMIZER_PACKAGES.filter((p) => p.key !== 'free').map((pkg) => {
            const recommended = pkg.key === recommendedKey;
            return (
              <div
                key={pkg.key}
                className={`border rounded-none p-5 flex flex-col ${
                  recommended ? 'border-cyan-600 bg-cyan-950/20' : 'border-titanium-800 bg-obsidian-900'
                }`}
              >
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <div className="font-display font-bold text-titanium-50 text-lg">{pkg.name}</div>
                  <div className="font-mono text-sm text-cyan-300">{pkg.price}</div>
                </div>
                {recommended && (
                  <div className="font-mono text-[9px] uppercase tracking-widest text-cyan-300 mb-2">
                    Für deinen Befund empfohlen
                  </div>
                )}
                <div className="text-xs text-titanium-400 mb-3">{pkg.tagline}</div>
                <ul className="space-y-1.5 mb-5 flex-1">
                  {pkg.does.map((d) => (
                    <li key={d} className="flex items-start gap-2 text-xs text-titanium-300 leading-relaxed">
                      <Check className="h-3.5 w-3.5 text-cyan-400 shrink-0 mt-0.5" />
                      {d}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => bookPackage(pkg.key)}
                  className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-bold rounded-none transition-colors ${
                    recommended
                      ? 'bg-cyan-400 text-obsidian-950 hover:bg-cyan-300'
                      : 'border border-titanium-700 text-titanium-100 hover:border-titanium-400 hover:bg-obsidian-800'
                  }`}
                >
                  <Wrench className="h-4 w-4" /> {pkg.name} buchen <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <div className="flex flex-col sm:flex-row gap-3">
        <PrimaryButton onClick={() => bookPackage(recommendedKey)}>
          <ShieldCheck className="h-4 w-4" /> Empfohlenes Paket buchen <ArrowRight className="h-4 w-4" />
        </PrimaryButton>
        <SecondaryLink to="/pricing?source=cco_report_all">
          <FileText className="h-4 w-4" /> Alle Preise vergleichen
        </SecondaryLink>
      </div>
    </OptimizerShell>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="px-4 py-2.5 flex items-center justify-between gap-3">
      <span className="text-xs text-titanium-400">{label}</span>
      <span className={`text-sm font-semibold text-titanium-50 truncate max-w-[60%] ${mono ? 'font-mono' : ''}`}>
        {value}
      </span>
    </div>
  );
}
