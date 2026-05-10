import { Link } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, ShieldCheck, Activity, FileCheck2, Brain, Code2,
  Users, Building2, Cog, AlertTriangle, CheckCircle2, Globe, Database,
  GitBranch, Bell, FileText,
} from 'lucide-react';
import { LiveFindingsSection } from '../components/sections/LiveFindingsSection';
import { ReportPreviewSection } from '../components/sections/ReportPreviewSection';
import { ScannerTechStackSection } from '../components/sections/ScannerTechStackSection';
import { AiGovernanceDashboard } from '../features/ai-governance/AiGovernanceDashboard';

/**
 * /features — echte Plattform-Story.
 *
 * Adressiert das Hauptkritik-Feedback: "Seite wirkt wie Compliance-Microsite,
 * nicht wie SaaS-Produkt." Strukturiert in 5 Capability-Blöcken + 3
 * Zielgruppen-Karten + Tech-Trust-Footer.
 */
export function Features() {
  return (
    <div className="bg-hero-only min-h-screen flex flex-col text-titanium-50">
      {/* Top bar */}
      <header className="px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between border-b border-silver-700/30">
        <Link to="/" className="inline-flex items-center gap-2 text-xs sm:text-sm text-silver-300 hover:text-titanium-50">
          <ArrowLeft className="h-3.5 w-3.5" />
          <span className="font-display font-bold tracking-tight text-titanium-50">RealSyncDynamics.AI</span>
        </Link>
        <Link
          to="/audit?source=features-top"
          className="surface-mono inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-none"
        >
          Audit starten <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </header>

      {/* Hero */}
      <section className="px-4 sm:px-6 lg:px-8 pt-12 pb-12 sm:pt-16 sm:pb-16">
        <div className="max-w-3xl mx-auto text-center">
          <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-titanium-100 mb-3">
            Funktionen · Plattform-Capabilities
          </div>
          <h1 className="font-display font-bold text-3xl sm:text-5xl text-titanium-50 tracking-tight leading-[1.05] mb-4">
            Eine Plattform — DSGVO, AI-Act, Vendor-Stack.
          </h1>
          <p className="text-base sm:text-lg text-silver-300 leading-relaxed max-w-2xl mx-auto">
            RealSyncDynamics.AI überwacht Ihre Website, Vendor-Stacks und KI-Workflows kontinuierlich auf
            DSGVO- und AI-Act-Risiken — und liefert prüffertige Dokumentation automatisch.
          </p>
        </div>
      </section>

      {/* Feature-Blöcke 5er-Grid */}
      <section className="px-4 sm:px-6 lg:px-8 pb-16 sm:pb-20">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-px bg-silver-700/30">
          <FeatureBlock
            icon={<Globe className="h-5 w-5 text-ai-cyan-400" />}
            title="Website & Vendor-Scan"
            bullets={[
              'Regelmäßige Scans von Domains, Subdomains und eingebundenen Drittanbietern',
              'Mapping von Cookies, Skripten, CDNs, Tracking-Pixeln',
              'Erkennung von Drittland-Transfers inkl. SCC-Hinweisen',
              'Unterstützte Tracker: 17 (GA4, GTM, Meta, TikTok, LinkedIn, Hotjar, Clarity, …)',
            ]}
          />
          <FeatureBlock
            icon={<FileCheck2 className="h-5 w-5 text-emerald-400" />}
            title="Automatisierte Dokumente"
            bullets={[
              'Generierung von DSE, AVV, VVT und TOM aus dem laufenden Monitoring',
              'Versionierung mit Zeitstempel, Export als signierte PDFs',
              '"Geprüft durch Partnerkanzlei" — Standard-Templates, kein Einzelberatungs-Ersatz',
              'Sub-Processor-Liste automatisch gepflegt (Art. 28 DSGVO)',
            ]}
          />
          <FeatureBlock
            icon={<Activity className="h-5 w-5 text-amber-400" />}
            title="Kontinuierliche Überwachung"
            bullets={[
              'Wöchentliche Re-Audits + Alerts bei neuen Verstößen oder Vendor-Wechseln',
              'Dashboards für DSB, IT, HR — Ampel-Logik (grün/gelb/rot) plus Risk-Score',
              'Change-Historie: wer hat wann welche Änderung an Compliance-Konfig gemacht',
              'Realtime-Status der Rebuild- und Audit-Jobs',
            ]}
          />
          <FeatureBlock
            icon={<Brain className="h-5 w-5 text-fuchsia-400" />}
            title="AI-Act Inventar & Workflows"
            bullets={[
              'Klassifikator nach Annex III (8 Kategorien · 14 Use-Cases)',
              'Automatische Pflichtenmatrix (Art. 9-15, 27, 43, 50, 53)',
              'Verknüpfung mit DSGVO-Artefakten (VVT-Einträge, DSFA, Subprocessor-Liste)',
              'BAIT/MaRisk/VAIT/AGG/BetrVG-Overlays für regulierte Branchen',
            ]}
          />
          <div className="md:col-span-2">
            <FeatureBlock
              icon={<Code2 className="h-5 w-5 text-titanium-100" />}
              title="Dev- & Ops-Integration"
              wide
              bullets={[
                'API + Webhooks für CI/CD (GitHub Actions, GitLab CI, Vercel, Netlify)',
                'CLI-Agent (OpenClaw) zur Verknüpfung mit bestehenden Monitoring/Infra-Stacks',
                'Status-Endpoint und Security-Doku für GRC/InfoSec',
                'Headless-Mode: Compliance-Checks in der Pipeline statt Excel-Listen',
              ]}
            />
          </div>
        </div>
      </section>

      {/* Live-Findings + Report-Preview + Tech-Stack — Produktrealitaet zeigen */}
      <LiveFindingsSection />
      <ReportPreviewSection />
      <ScannerTechStackSection />

      {/* AI Governance OS — Inventar / Policies / Evidence Vault Preview */}
      <AiGovernanceDashboard />

      {/* Zielgruppen */}
      <section className="border-t border-silver-700/30 px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10 sm:mb-12">
            <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-titanium-100 mb-3">
              Zielgruppen
            </div>
            <h2 className="font-display font-bold text-2xl sm:text-4xl text-titanium-50 tracking-tight leading-tight">
              Drei Rollen, eine Plattform
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
            <RoleCard
              icon={<ShieldCheck className="h-5 w-5 text-emerald-400" />}
              role="Datenschutzbeauftragte"
              body="Endlich kontinuierliche Sicht auf alle Domains und KI-Systeme — dokumentenfertig, ohne Excel-Tracking. Audit-Trail, Versionierung, signierte Exporte für Aufsichtsbehörden."
              cta={{ to: '/audit?source=features-dsb', label: 'Domain auditieren' }}
            />
            <RoleCard
              icon={<Users className="h-5 w-5 text-amber-400" />}
              role="HR & Betriebsrat"
              body="Sicherheit, dass Monitoring/Tracking (Productivity-Tools, AI-Assistenten, Performance-KPIs) Mitbestimmungsrechte respektieren. BetrVG § 87 + AGG-Bias-Auditing eingebaut."
              cta={{ to: '/contact-sales?intent=hr&source=features', label: 'Beratung anfragen' }}
            />
            <RoleCard
              icon={<Cog className="h-5 w-5 text-ai-cyan-400" />}
              role="Tech & DevOps"
              body="API/CI-Integration, keine Excel-Listen. Compliance in der Pipeline statt im Lastenheft. CLI, Webhooks, GitHub-Action — alles was ein Eng-Team braucht."
              cta={{ to: '/api-docs', label: 'API-Docs ansehen' }}
            />
          </div>
        </div>
      </section>

      {/* Tech-Trust */}
      <section className="border-t border-silver-700/30 px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-titanium-100 mb-3">
              Architecture & Trust
            </div>
            <h2 className="font-display font-bold text-2xl sm:text-4xl text-titanium-50 tracking-tight leading-tight">
              Stack ohne Marketing-Glanz
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <TechCard
              icon={<Database className="h-4 w-4" />}
              title="EU-Datenresidenz"
              body="Supabase / PostgreSQL in Frankfurt (eu-central-1). Kein US-Cloud-Default. AVV nach Art. 28 DSGVO unterschrieben."
            />
            <TechCard
              icon={<GitBranch className="h-4 w-4" />}
              title="Append-only Audit-Trail"
              body="Jeder Compliance-Event wird unveränderlich geloggt. Hash-Chain für Beweismittel-Integrität. Für AI-Act High-Risk Pflicht."
            />
            <TechCard
              icon={<Bell className="h-4 w-4" />}
              title="Vollständiges Logging"
              body="KI-Calls, Edge-Function-Invocations, Storage-Uploads — alles mit User-Context, Timestamp, IP-Hash. SOC-2-grade visibility."
            />
            <TechCard
              icon={<AlertTriangle className="h-4 w-4" />}
              title="Realtime-Alerts"
              body="Webhooks bei Drift-Detection, neue Tracker, geänderte Sub-Processors, Score-Verschlechterung."
            />
            <TechCard
              icon={<FileText className="h-4 w-4" />}
              title="Methodik öffentlich"
              body="Alle 17 Tracker mit consent_required, risk, third_country_transfer, legal_basis, auto_fix-Type dokumentiert. Versioniert."
              link={{ to: '/legal/methodology', label: 'Methodik öffnen' }}
            />
            <TechCard
              icon={<Building2 className="h-4 w-4" />}
              title="Made in Germany"
              body="Schwarzburger Str. 31, Neuhaus am Rennweg. Aufsichtsbehörde TLfDI Thüringen. Keine US-Subprocessor-Kette."
              link={{ to: '/impressum', label: 'Impressum' }}
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-silver-700/30 px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-display font-bold text-2xl sm:text-3xl text-titanium-50 tracking-tight mb-4">
            Bereit zum Start?
          </h2>
          <p className="text-base text-silver-300 leading-relaxed mb-7">
            Free-Tier: Domain eingeben, Risk-Score in 30 Sekunden. Kein Account, kein Setup.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/audit?source=features-cta"
              className="surface-mono inline-flex items-center justify-center gap-2 px-6 py-3.5 text-base font-bold rounded-none"
            >
              Audit starten <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/pricing"
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 border border-silver-500 hover:border-titanium-200 text-silver-100 hover:text-titanium-50 text-base font-semibold rounded-none transition-colors"
            >
              Preise vergleichen
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-silver-700/40 px-4 sm:px-6 lg:px-8 py-4 mt-auto">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[10px] font-mono uppercase tracking-wider text-silver-500">
          <div>© 2026 RealSync Dynamics · Made in Germany · EU-Hosted (Frankfurt)</div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <Link to="/cookie-scanner"        className="hover:text-titanium-50 text-titanium-100">Cookie-Scanner · Free</Link>
            <Link to="/ai-act-workflows"      className="hover:text-titanium-50 text-titanium-100">AI-Act Inventar · Beta</Link>
            <Link to="/legal/privacy"         className="hover:text-titanium-50">Datenschutz</Link>
            <Link to="/impressum"             className="hover:text-titanium-50">Impressum</Link>
            <Link to="/legal/sub-processors"  className="hover:text-titanium-50">Sub-Processors</Link>
            <Link to="/legal/methodology"     className="hover:text-titanium-50">Methodik</Link>
            <Link to="/security"              className="hover:text-titanium-50">Security</Link>
            <Link to="/status"                className="hover:text-titanium-50">Status</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

interface FeatureBlockProps {
  icon: React.ReactNode;
  title: string;
  bullets: string[];
  wide?: boolean;
}

function FeatureBlock({ icon, title, bullets, wide }: FeatureBlockProps) {
  return (
    <div className={`p-6 sm:p-7 bg-obsidian-900/80 ${wide ? '' : ''}`}>
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h3 className="font-display font-bold text-titanium-50 text-lg sm:text-xl tracking-tight">
          {title}
        </h3>
      </div>
      <ul className="space-y-2">
        {bullets.map((b) => (
          <li key={b} className="flex items-start gap-2 text-sm text-silver-200 leading-relaxed">
            <CheckCircle2 className="h-3.5 w-3.5 text-titanium-100 shrink-0 mt-0.5" />
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface RoleCardProps {
  icon: React.ReactNode;
  role: string;
  body: string;
  cta: { to: string; label: string };
}

function RoleCard({ icon, role, body, cta }: RoleCardProps) {
  return (
    <div className="p-6 bg-obsidian-900/60 border border-silver-700/30 hover:border-titanium-200/60 rounded-none transition-colors flex flex-col">
      <div className="flex items-center gap-2 mb-3">{icon}</div>
      <div className="font-display font-bold text-titanium-50 text-lg mb-2">{role}</div>
      <p className="text-sm text-silver-300 leading-relaxed flex-1 mb-4">{body}</p>
      <Link
        to={cta.to}
        className="inline-flex items-center gap-1.5 text-sm font-bold text-titanium-100 hover:text-titanium-50"
      >
        {cta.label} <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

interface TechCardProps {
  icon: React.ReactNode;
  title: string;
  body: string;
  link?: { to: string; label: string };
}

function TechCard({ icon, title, body, link }: TechCardProps) {
  return (
    <div className="p-5 bg-obsidian-900/40 border border-silver-700/20 rounded-none">
      <div className="flex items-center gap-2 text-titanium-100 mb-2">
        {icon}
        <div className="font-display font-bold text-titanium-50 text-sm">{title}</div>
      </div>
      <p className="text-xs text-silver-300 leading-relaxed">{body}</p>
      {link && (
        <Link
          to={link.to}
          className="inline-flex items-center gap-1 mt-2 text-[11px] font-mono uppercase tracking-wider text-titanium-100 hover:text-titanium-50"
        >
          {link.label} →
        </Link>
      )}
    </div>
  );
}
