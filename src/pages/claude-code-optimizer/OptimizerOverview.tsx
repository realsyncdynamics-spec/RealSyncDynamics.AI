import { useNavigate } from 'react-router-dom';
import { ArrowRight, Search, Wrench, Activity, ShieldCheck, Check, Sparkles } from 'lucide-react';
import { usePageMeta } from '../../lib/usePageMeta';
import {
  OptimizerShell,
  IntroBanner,
  PrimaryButton,
  SecondaryLink,
  OPTIMIZER_PACKAGES,
  stepById,
} from './OptimizerKit';

/**
 * Schritt 1 — Überblick (Infoseite).
 *
 * Erklärt, was der Claude Code Optimizer kann, macht und tut, welche Optionen
 * es gibt, was er kostet und in welchen Paketen er enthalten ist. Der primäre
 * Button führt zur Scan-Seite (Schritt 2).
 */

const WHAT_IT_DOES = [
  {
    icon: Search,
    title: 'Scannen',
    text: 'Analysiert deine Website auf DSGVO-, TTDSG-, Tracking- und Code-Compliance-Risiken — in unter 30 Sekunden.',
  },
  {
    icon: Wrench,
    title: 'Beheben',
    text: 'Priorisiert jeden Fehler, erklärt die Rechtslage und liefert konkrete Fixes — bis hin zu Code-Vorschlägen.',
  },
  {
    icon: Activity,
    title: 'Überwachen',
    text: 'Prüft kontinuierlich auf neue Risiken (Drift) und schreibt jeden Nachweis in die Evidence-Chain.',
  },
];

export function OptimizerOverview() {
  const navigate = useNavigate();
  usePageMeta({
    title: 'Claude Code Optimizer — Website scannen, Fehler beheben, überwachen',
    description:
      'Der Claude Code Optimizer scannt deine Website auf DSGVO-, Tracking- und Code-Compliance-Fehler, erklärt jeden Befund und optimiert Schritt für Schritt.',
    url: 'https://RealSyncDynamicsAI.de/claude-code-optimizer',
  });

  const scanPath = stepById('scan').path;

  return (
    <OptimizerShell step="ueberblick" backTo="/">
      <IntroBanner
        kind="info"
        eyebrow="Was ist das?"
        title="Claude Code Optimizer"
        nextActionLabel="Der Button »Website scannen« führt dich zur Scan-Seite — dort gibst du deine URL ein und erhältst deine Fehlerliste."
      >
        <p>
          Der Claude Code Optimizer ist dein geführter Weg von „Ich weiß nicht, wo meine Website
          steht" bis „meine Compliance ist auditfähig". Jeder Schritt ist eine eigene, erklärte Seite
          — du wirst nie im Unklaren gelassen, was als Nächstes passiert.
        </p>
        <p className="text-titanium-400">
          So läuft es ab: <span className="text-titanium-200">Überblick → Website scannen →
          Fehler ansehen → anmelden → ausführlicher Bericht &amp; passendes Paket buchen.</span>
        </p>
      </IntroBanner>

      {/* Was er kann / macht / tut */}
      <section className="mb-10">
        <h2 className="text-xs font-bold text-titanium-500 uppercase tracking-[0.2em] mb-4">
          Was der Optimizer tut
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {WHAT_IT_DOES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="border border-titanium-800 bg-obsidian-900 p-5 rounded-none">
              <Icon className="h-5 w-5 text-cyan-300 mb-3" strokeWidth={1.75} />
              <div className="font-display font-bold text-titanium-50 text-base mb-1">{title}</div>
              <p className="text-xs text-titanium-400 leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Optionen & Pakete / Kosten */}
      <section className="mb-10">
        <h2 className="text-xs font-bold text-titanium-500 uppercase tracking-[0.2em] mb-1">
          Optionen, Kosten &amp; Pakete
        </h2>
        <p className="text-sm text-titanium-400 mb-4 leading-relaxed">
          Der Scan ist kostenlos und ohne Account. Zum Beheben und Überwachen ist der Optimizer in
          diesen Paketen enthalten:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {OPTIMIZER_PACKAGES.map((pkg) => (
            <div
              key={pkg.key}
              className={`border rounded-none p-5 ${
                pkg.highlighted ? 'border-cyan-700 bg-cyan-950/20' : 'border-titanium-800 bg-obsidian-900'
              }`}
            >
              <div className="flex items-baseline justify-between gap-2 mb-1">
                <div className="font-display font-bold text-titanium-50 text-lg">{pkg.name}</div>
                <div className="font-mono text-sm text-cyan-300">{pkg.price}</div>
              </div>
              <div className="text-xs text-titanium-400 mb-3">{pkg.tagline}</div>
              <ul className="space-y-1.5">
                {pkg.does.map((d) => (
                  <li key={d} className="flex items-start gap-2 text-xs text-titanium-300 leading-relaxed">
                    <Check className="h-3.5 w-3.5 text-cyan-400 shrink-0 mt-0.5" />
                    {d}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-titanium-500 flex items-center gap-1.5">
          <Sparkles className="h-3 w-3 text-titanium-500" />
          Preise dienen der Orientierung — die verbindliche Paket-Auswahl siehst du am Ende des Flows.
        </p>
      </section>

      {/* CTA */}
      <div className="flex flex-col sm:flex-row gap-3">
        <PrimaryButton onClick={() => navigate(scanPath)}>
          <Search className="h-4 w-4" /> Website scannen <ArrowRight className="h-4 w-4" />
        </PrimaryButton>
        <SecondaryLink to="/pricing?source=cco_overview">
          <ShieldCheck className="h-4 w-4" /> Preise ansehen
        </SecondaryLink>
      </div>
      <p className="mt-3 text-[11px] text-titanium-500">
        Kostenlos · Kein Account für den Scan · Ergebnis in ~30 Sekunden.
      </p>
    </OptimizerShell>
  );
}
