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
    text: 'Führt einen Website-Audit zu ausgewählten DSGVO-, Tracking- und Einwilligungsthemen aus. Die Dauer hängt von der Website ab.',
  },
  {
    icon: Wrench,
    title: 'Auswerten',
    text: 'Zeigt die erkannten Befunde und ihren Schweregrad. Die automatische Analyse von GitHub-Repositories und Code-Fixes ist noch in Vorbereitung.',
  },
  {
    icon: Activity,
    title: 'Überwachen (Coming Soon)',
    text: 'Soll neue Risiken (Drift) erkennen und jeden Nachweis in die Evidence-Chain schreiben — dauerhafte Überwachung ist Coming Soon, kein laufender Dauerbetrieb.',
  },
];

export function OptimizerOverview() {
  const navigate = useNavigate();
  usePageMeta({
    title: 'Claude Code Optimizer — Website scannen, Fehler beheben, überwachen',
    description:
      'Website-Audit mit Befundübersicht. Repository-Analyse, automatische Code-Fixes und Pull Requests sind noch nicht verfügbar.',
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
          Der Claude Code Optimizer bietet derzeit einen geführten Website-Audit mit Befundübersicht.
          Ein Scan ist keine vollständige Code- oder Rechtsprüfung. Die automatische Repository-
          Analyse mit Code-Änderungen ist als eigenständiger Ausbauschritt geplant.
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
          Der Website-Scan ist kostenlos und ohne Account. Die folgenden Tarife sind Plattformpakete.
          Ein höherer Tarif schaltet derzeit keine automatische Repository-Reparatur in diesem Ablauf frei:
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
        Kostenloser Website-Audit ohne Konto · Keine automatische GitHub-Analyse.
      </p>
    </OptimizerShell>
  );
}
