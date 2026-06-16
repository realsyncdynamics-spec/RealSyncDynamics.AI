/**
 * DigitalSovereignty — eigenständige Seite zur strategischen Positionierung
 * „Digitale Souveränität als Betriebsmodell".
 *
 * Route: /digitale-souveraenitaet (Alias: /digital-sovereignty)
 *
 * Botschaft: RealSyncDynamics.AI macht digitale Souveränität auf
 * Unternehmensebene produktfähig — als laufende, nachweisbare Governance über
 * Software, Anbieter, KI-Systeme und Datenflüsse. Europäisch, seriös,
 * infrastrukturell. Keine leeren Superlative, keine falschen technischen
 * Behauptungen (SBOM-/Supply-Chain-Funktionen sind „vorbereitet").
 *
 * Design: „European Enterprise Trust" — Petrol/Teal-Akzente,
 * rounded-chip/card/panel, Monospace für Metadaten. CTA-Disziplin:
 * ausschließlich Self-Serve-Strings aus `CTA` (runtimeVocab).
 */
import { Link } from 'react-router-dom';
import {
  ArrowRight, Landmark, Network, ShieldCheck, Eye, Archive, Activity, Bot,
  Globe, Scale, Cpu, ClipboardCheck, Boxes, Package, ScanSearch, Server,
} from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { usePageMeta } from '../lib/usePageMeta';
import { CTA } from '../content/runtimeVocab';

// ─── Inhalt ───────────────────────────────────────────────────────────

const PILLARS = [
  { Icon: Network, title: 'Transparente Software- & Anbieterstruktur', body: 'Drittanbieter, Skripte, Tracker und KI-Dienste werden sichtbar gemacht — wer verarbeitet welche Daten, in welcher Region.' },
  { Icon: ShieldCheck, title: 'Nachweisbare DSGVO- & AI-Act-Governance', body: 'Gesetzliche Pflichten werden zu prüfbaren Kontrollen — klassifiziert nach DSGVO-Artikel und EU-AI-Act-Risikoklasse.' },
  { Icon: Eye, title: 'Kontrolle über Drittanbieter & Datenflüsse', body: 'Tracker, KI-Systeme, externe Schnittstellen und Datentransfers bleiben unter laufender Kontrolle statt im Verborgenen.' },
  { Icon: Archive, title: 'Evidence Vault für prüfbare Nachweise', body: 'Jeder Befund wird zu auditfähiger Evidence — versioniert, nachvollziehbar und exportierbar für Aufsicht und Audit.' },
  { Icon: Activity, title: 'Kontinuierliches Monitoring statt Einmal-Audit', body: 'Governance läuft als fortlaufender Prozess weiter — Drift, neue Tracker und Änderungen werden erkannt, sobald sie entstehen.' },
  { Icon: Bot, title: 'Governance Agents für Prüfungen & Maßnahmen', body: 'Spezialisierte Agents prüfen Befunde, schlagen Maßnahmen vor und schreiben Nachweise in den Prüfpfad.' },
] as const;

const SUPPLY_CHAIN = [
  { Icon: Network, label: 'Drittanbieter-Erkennung', ready: true },
  { Icon: ScanSearch, label: 'Tracker- & Script-Erkennung', ready: true },
  { Icon: Cpu, label: 'KI-System-Dokumentation', ready: true },
  { Icon: Globe, label: 'Anbieter- & Transferprüfung', ready: true },
  { Icon: Scale, label: 'Risikoklassifizierung', ready: true },
  { Icon: ClipboardCheck, label: 'Audit-Trail & Evidence', ready: true },
  { Icon: Boxes, label: 'SBOM- & Supply-Chain-Governance', ready: false },
  { Icon: Package, label: 'Open-Source-Komponenten-Inventar', ready: false },
] as const;

const PRINCIPLES = [
  { k: 'EU-Hosting', v: 'Daten und Verarbeitung in der EU (Frankfurt). EU-Modelle als Fallback.' },
  { k: 'Auditfähig', v: 'Jede Entscheidung, jeder Befund, jede Maßnahme im Prüfpfad nachvollziehbar.' },
  { k: 'Kontinuierlich', v: 'Governance als laufender Unternehmensprozess statt Momentaufnahme.' },
  { k: 'Self-Serve', v: 'Im Browser-Format startbar — ohne Beratungs- oder Implementierungszwang.' },
] as const;

// ─── Seite ────────────────────────────────────────────────────────────

export function DigitalSovereignty() {
  usePageMeta({
    title: 'Digitale Souveränität als Betriebsmodell | RealSyncDynamics.AI',
    description:
      'Digitale Souveränität praktisch umsetzen: transparente Anbieterstruktur, nachweisbare ' +
      'DSGVO- & AI-Act-Governance, Kontrolle über Drittanbieter und Datenflüsse, Evidence Vault ' +
      'und kontinuierliches Monitoring — das Governance OS im Browser-Format.',
    url: 'https://RealSyncDynamicsAI.de/digitale-souveraenitaet',
  });

  return (
    <>
      <Navbar />
      <main className="bg-obsidian-950 text-titanium-100 pt-14">
        {/* Hero */}
        <section className="border-b border-titanium-900 px-4 sm:px-6 py-16 sm:py-24">
          <div className="max-w-4xl mx-auto">
            <p className="inline-flex items-center gap-2 rounded-chip border border-petrol-500/40 bg-petrol-500/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.22em] text-petrol-300 mb-5">
              <Landmark className="h-3.5 w-3.5" /> Digitale Souveränität
            </p>
            <h1 className="font-display font-bold tracking-tight text-titanium-50 text-3xl sm:text-5xl leading-[1.08]">
              Digitale Souveränität als Betriebsmodell.
            </h1>
            <p className="mt-6 text-base sm:text-lg text-titanium-300 max-w-2xl leading-relaxed">
              Europa entwickelt Open Source, sichere Softwarelieferketten und
              souveräne Cloud- und KI-Infrastruktur strategisch weiter.
              RealSyncDynamics.AI macht diese Entwicklung auf Unternehmensebene
              produktfähig — als laufende, nachweisbare Kontrolle über Software,
              Anbieter, KI-Systeme und Datenflüsse.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-3">
              <Link
                to="/app"
                className="inline-flex items-center justify-center gap-2 rounded-chip bg-petrol-400 text-obsidian-950 px-6 py-3 text-sm font-semibold hover:bg-petrol-300 transition-colors"
              >
                {CTA.startTrial} <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/audit?source=sovereignty"
                className="inline-flex items-center justify-center gap-2 rounded-chip border border-titanium-700 text-titanium-200 px-6 py-3 text-sm font-semibold hover:border-titanium-500 transition-colors"
              >
                {CTA.startGovernanceAudit}
              </Link>
            </div>
          </div>
        </section>

        {/* Säulen */}
        <section className="border-b border-titanium-900 px-4 sm:px-6 py-16 sm:py-20">
          <div className="max-w-5xl mx-auto">
            <h2 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-titanium-50 mb-3 max-w-2xl">
              Souveränität, die im Betrieb nachweisbar bleibt.
            </h2>
            <p className="text-sm text-titanium-400 max-w-2xl mb-10 leading-relaxed">
              Souveränität ist kein Slogan, sondern ein Betriebszustand. Diese
              sechs Bausteine machen sie auf Unternehmensebene umsetzbar und
              prüfbar.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {PILLARS.map(({ Icon, title, body }) => (
                <div key={title} className="rounded-card border border-titanium-800 bg-obsidian-900 p-5">
                  <Icon className="h-5 w-5 text-petrol-300 mb-3" />
                  <h3 className="font-display font-semibold text-titanium-50 mb-2 text-[15px] leading-snug">{title}</h3>
                  <p className="text-sm text-titanium-400 leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Software Supply Chain */}
        <section className="border-b border-titanium-900 px-4 sm:px-6 py-16 sm:py-20">
          <div className="max-w-5xl mx-auto">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-titanium-500 mb-3 inline-flex items-center gap-2">
              <Server className="h-3.5 w-3.5 text-petrol-300" /> Software Supply Chain
            </p>
            <h2 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-titanium-50 mb-3 max-w-2xl">
              Governance für Software, Anbieter und Open-Source-Komponenten.
            </h2>
            <p className="text-sm text-titanium-400 max-w-2xl mb-10 leading-relaxed">
              Wer Software einsetzt, verantwortet auch deren Lieferkette.
              RealSyncDynamics.AI macht Drittanbieter, Skripte und KI-Dienste
              sichtbar, bewertet sie evidenzbasiert und ist vorbereitet für SBOM-,
              Anbieter- und Software-Supply-Chain-Governance.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {SUPPLY_CHAIN.map(({ Icon, label, ready }) => (
                <div key={label} className="flex items-center gap-3 rounded-card border border-titanium-800 bg-obsidian-900 p-4">
                  <Icon className="h-4 w-4 shrink-0 text-petrol-300" />
                  <span className="flex-1 text-sm text-titanium-200">{label}</span>
                  <span
                    className={`inline-flex items-center rounded-chip border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider ${
                      ready
                        ? 'border-petrol-500/40 bg-petrol-500/10 text-petrol-300'
                        : 'border-titanium-700 bg-obsidian-950 text-titanium-500'
                    }`}
                  >
                    {ready ? 'Aktiv' : 'Vorbereitet'}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-6 font-mono text-[10px] uppercase tracking-wider text-titanium-600">
              „Vorbereitet" — Roadmap-Funktionen für SBOM- & Software-Supply-Chain-Governance.
            </p>
          </div>
        </section>

        {/* Prinzipien */}
        <section className="border-b border-titanium-900 px-4 sm:px-6 py-16 sm:py-20">
          <div className="max-w-5xl mx-auto">
            <h2 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-titanium-50 mb-10">
              Europäisch. Auditfähig. Souverän.
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {PRINCIPLES.map(({ k, v }) => (
                <div key={k} className="rounded-card border border-titanium-800 bg-obsidian-900 p-5">
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-petrol-300 mb-2">{k}</p>
                  <p className="text-sm text-titanium-400 leading-relaxed">{v}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Querverweise */}
        <section className="border-b border-titanium-900 px-4 sm:px-6 py-12">
          <div className="max-w-5xl mx-auto flex flex-wrap gap-x-6 gap-y-3 font-mono text-[11px] uppercase tracking-wider text-titanium-500">
            <Link to="/ai-act" className="hover:text-petrol-300 inline-flex items-center gap-1.5"><Scale className="h-3.5 w-3.5" /> AI-Act-Governance</Link>
            <Link to="/audit" className="hover:text-petrol-300 inline-flex items-center gap-1.5"><ScanSearch className="h-3.5 w-3.5" /> DSGVO-Audit</Link>
            <Link to="/evidence" className="hover:text-petrol-300 inline-flex items-center gap-1.5"><Archive className="h-3.5 w-3.5" /> Evidence Vault</Link>
            <Link to="/pricing" className="hover:text-petrol-300 inline-flex items-center gap-1.5"><ClipboardCheck className="h-3.5 w-3.5" /> Preise</Link>
          </div>
        </section>

        {/* Final CTA */}
        <section className="border-b border-titanium-900 px-4 sm:px-6 py-16 sm:py-20">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-titanium-50 mb-3">
              Souveräne Compliance-Infrastruktur — im Browser-Format.
            </h2>
            <p className="text-sm text-titanium-400 max-w-xl mx-auto mb-8">
              Starten Sie kontinuierliche, nachweisbare Governance über Websites,
              KI-Systeme und Anbieter — ohne Setup, mit EU-Hosting.
            </p>
            <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-3">
              <Link
                to="/app"
                className="inline-flex items-center justify-center gap-2 rounded-chip bg-petrol-400 text-obsidian-950 px-6 py-3 text-sm font-semibold hover:bg-petrol-300 transition-colors"
              >
                {CTA.startTrial} <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/audit?source=sovereignty-cta"
                className="inline-flex items-center justify-center gap-2 rounded-chip border border-titanium-700 text-titanium-100 px-6 py-3 text-sm font-semibold hover:border-titanium-500 transition-colors"
              >
                {CTA.startGovernanceAudit}
              </Link>
            </div>
            <p className="text-xs text-titanium-500 mt-6 font-mono uppercase tracking-wider">
              Keine Kreditkarte erforderlich · EU-Hosting · DSGVO-konform
            </p>
          </div>
        </section>

        {/* Footer */}
        <footer className="px-4 sm:px-6 py-10 text-titanium-500">
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-[12px]">
            <div className="font-mono uppercase tracking-[0.2em]">
              RealSyncDynamics.AI · EU-Frankfurt
            </div>
            <nav className="flex flex-wrap gap-x-5 gap-y-2">
              <Link to="/impressum" className="hover:text-titanium-200">Impressum</Link>
              <Link to="/datenschutz" className="hover:text-titanium-200">Datenschutz</Link>
              <Link to="/agb" className="hover:text-titanium-200">AGB</Link>
              <span className="text-titanium-700">© {new Date().getFullYear()}</span>
            </nav>
          </div>
        </footer>
      </main>
    </>
  );
}
