import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ShieldCheck,
  Lock,
  Database,
  UserCheck,
  Archive,
  FileCheck2,
  Server,
  Globe2,
  KeyRound,
  Eye,
} from 'lucide-react';
import { usePageMeta } from '../lib/usePageMeta';

export function Trust() {
  usePageMeta({
    title: 'Trust Center — RealSyncDynamics.AI',
    description:
      'Sicherheit, EU-Hosting, Encryption, Audit-Logs, RBAC, Retention und Immutable Evidence — die Trust-Grundlagen der Governance-Plattform.',
  });

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 text-titanium-300 hover:text-titanium-100 text-sm">
          <ArrowLeft className="h-4 w-4" /> Zurück zur Startseite
        </Link>
        <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-titanium-100">
          Trust Center
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        {/* Hero */}
        <section className="mb-12">
          <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-titanium-100 mb-3">
            Trust · Operational Readiness
          </div>
          <h1 className="font-display font-bold text-3xl sm:text-5xl text-titanium-50 tracking-tight leading-tight">
            Wo unsere Daten leben. Wer was sieht. Was wir versprechen.
          </h1>
          <p className="mt-4 text-silver-300 text-base sm:text-lg leading-relaxed max-w-3xl">
            Diese Seite beschreibt die technische und organisatorische Realität hinter der Plattform —
            keine Marketing-Aussagen, sondern überprüfbare Eigenschaften unseres Stacks.
            Auditoren bitten wir aktiv um den Penetrationstest.
          </p>
        </section>

        {/* Six trust pillars */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-12">
          {PILLARS.map((p) => {
            const Icon = p.icon;
            return (
              <article
                key={p.title}
                className="bg-obsidian-900/60 border border-silver-700/30 p-6"
              >
                <div className="flex items-start gap-4 mb-3">
                  <div className="h-10 w-10 flex items-center justify-center border border-titanium-100/30 bg-titanium-100/5 text-titanium-100 shrink-0">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-display font-bold text-xl text-titanium-50">{p.title}</h2>
                    <p className="mt-1 text-[11px] font-mono uppercase tracking-[0.18em] text-silver-400">
                      {p.spec}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-silver-300 leading-relaxed">{p.body}</p>
              </article>
            );
          })}
        </section>

        {/* Compliance Posture */}
        <section className="bg-obsidian-900/60 border border-silver-700/30 p-6 mb-12">
          <h2 className="font-display font-bold text-2xl text-titanium-50 mb-1">Compliance-Postur</h2>
          <p className="text-sm text-silver-400 mb-5">
            Status der wichtigsten Rahmenwerke. „Self-Assessment" bedeutet: technisch implementiert,
            externe Zertifizierung in Vorbereitung.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {FRAMEWORKS.map((f) => (
              <div
                key={f.name}
                className="flex items-start gap-3 border border-silver-700/30 bg-obsidian-950/60 p-4"
              >
                <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-titanium-100 shrink-0 w-24 pt-0.5">
                  {f.status}
                </div>
                <div>
                  <p className="text-sm font-semibold text-titanium-50">{f.name}</p>
                  <p className="text-xs text-silver-400 mt-0.5">{f.note}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Operational metrics */}
        <section className="bg-obsidian-900/60 border border-silver-700/30 p-6 mb-12">
          <h2 className="font-display font-bold text-2xl text-titanium-50 mb-1">SLOs & Operational Metrics</h2>
          <p className="text-sm text-silver-400 mb-5">
            Ziel-Werte aus dem Plattform-Blueprint. Live-Metriken folgen mit der Status-Page in Q3.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-silver-700/30">
                  <th className="text-left font-mono text-[11px] uppercase tracking-[0.18em] text-silver-400 pb-2 pr-4">
                    Service
                  </th>
                  <th className="text-left font-mono text-[11px] uppercase tracking-[0.18em] text-silver-400 pb-2 pr-4">
                    Availability
                  </th>
                  <th className="text-left font-mono text-[11px] uppercase tracking-[0.18em] text-silver-400 pb-2 pr-4">
                    p99 Latency
                  </th>
                  <th className="text-left font-mono text-[11px] uppercase tracking-[0.18em] text-silver-400 pb-2">
                    Error Rate
                  </th>
                </tr>
              </thead>
              <tbody className="text-silver-300">
                {SLOS.map((s) => (
                  <tr key={s.service} className="border-b border-silver-700/10">
                    <td className="py-2.5 pr-4">{s.service}</td>
                    <td className="py-2.5 pr-4 font-mono text-titanium-100">{s.availability}</td>
                    <td className="py-2.5 pr-4 font-mono text-titanium-100">{s.latency}</td>
                    <td className="py-2.5 font-mono text-titanium-100">{s.errors}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Sub-processors */}
        <section className="bg-obsidian-900/60 border border-silver-700/30 p-6 mb-12">
          <h2 className="font-display font-bold text-2xl text-titanium-50 mb-1">Sub-Processors</h2>
          <p className="text-sm text-silver-400 mb-5">
            Vollständige, transparente Liste. Änderungen werden mit 30 Tagen Vorlaufzeit angekündigt.
          </p>
          <div className="space-y-2">
            {SUB_PROCESSORS.map((p) => (
              <div
                key={p.name}
                className="flex items-center justify-between border border-silver-700/30 bg-obsidian-950/60 p-3"
              >
                <div>
                  <p className="text-sm font-semibold text-titanium-50">{p.name}</p>
                  <p className="text-xs text-silver-400">{p.purpose}</p>
                </div>
                <div className="text-right text-xs font-mono text-silver-400">
                  <div className="text-titanium-100">{p.region}</div>
                  <div>{p.transfer}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Disclosure */}
        <section className="border border-emerald-400/20 bg-emerald-400/5 p-6">
          <h2 className="font-display font-bold text-xl text-titanium-50 mb-2">Responsible Disclosure</h2>
          <p className="text-sm text-silver-300 leading-relaxed">
            Sicherheitslücken bitte vertraulich an{' '}
            <a href="mailto:security@realsyncdynamicsai.de" className="text-emerald-300 hover:underline">
              security@realsyncdynamicsai.de
            </a>
            . Wir antworten binnen 48h, koordinieren mit dem Reporter und veröffentlichen
            CVE-relevante Fixes mit Credit.
          </p>
        </section>
      </main>
    </div>
  );
}

const PILLARS = [
  {
    icon: Globe2,
    title: 'EU-Datenresidenz',
    spec: 'eu-central-1 · Frankfurt',
    body:
      'Datenbank, Object Storage, Telemetrie-Hot- und Cold-Path sowie LLM-Inferenz (Mistral La Plateforme / Azure OpenAI Sweden) liegen in der EU. US-Routing nur auf expliziten Per-Call-Opt-in.',
  },
  {
    icon: Lock,
    title: 'Encryption',
    spec: 'AES-256 at rest · TLS 1.3 in transit · per-tenant CMK',
    body:
      'Postgres-TDE auf Speicher-Ebene. Application-level Field-Encryption für PII via pgcrypto mit per-tenant Keys. Evidence-Vault nutzt Envelope-Encryption: Data-Key pro Record, gewrappt mit Tenant-CMK in KMS.',
  },
  {
    icon: Archive,
    title: 'Immutable Evidence',
    spec: 'Hash-Chain · Ed25519 · RFC 3161',
    body:
      'Jeder Evidence-Record verlinkt mit SHA-256-Hash zum Vorgänger und ist mit dem Tenant-Schlüssel signiert. High-Stakes-Records bekommen zusätzlich einen RFC-3161-Timestamp von zwei unabhängigen EU-TSAs.',
  },
  {
    icon: UserCheck,
    title: 'RBAC + ABAC',
    spec: 'Owner · Admin · DPO · Developer · Auditor',
    body:
      'Fünf Basis-Rollen aus einem Permission-Katalog. Attribute-basierte Zusatz-Bedingungen (z. B. „nur in production environment") gaten kritische Aktionen serverseitig. UI versteckt Controls, vertraut dem Hide aber nicht.',
  },
  {
    icon: Database,
    title: 'Tenant-Isolation',
    spec: 'Row-Level-Security · Service-Plane-Token · Storage-Prefix',
    body:
      'Drei Schichten: Postgres-RLS auf jeder Governance-Tabelle, tenant-scoped JWT zwischen Services, Object-Storage IAM auf `tenant/<id>/` Prefix. Cross-Tenant-Reads sind unmöglich, nicht nur „ungewollt".',
  },
  {
    icon: FileCheck2,
    title: 'Audit Log',
    spec: 'Append-only · 7y default retention',
    body:
      'Jede Mutation schreibt eine Zeile in `governance_admin_log` mit `actor_user_id`, `action`, `target_type`, `target_id`, `payload`, `at`. Unveränderbar nach Insert. UI-Tab in jeder List-View zeigt die letzten 50 Mutationen.',
  },
];

const FRAMEWORKS = [
  { name: 'GDPR / DSGVO', status: 'Implemented', note: 'Art. 30 ROPA, Art. 33 72h-Incident-Flow, Art. 35 DPIA-Generator, DSR-Tracker für Art. 15+17.' },
  { name: 'TDDDG §25', status: 'Implemented', note: 'Consent-vor-Tracking Detection in Browser-Extension + Server-SDK.' },
  { name: 'EU AI Act', status: 'In Progress', note: 'AI-Usecase-Classifier (Annex III), Obligation-Engine pro Risikoklasse, Annex-IV-Generator.' },
  { name: 'ISO 27001', status: 'Self-Assessment', note: 'Control-Mapping in Compliance-Matrix; externe Zertifizierung 2026 Q4.' },
  { name: 'SOC 2 Type II', status: 'Self-Assessment', note: 'Trust-Service-Criteria gemappt; Audit-Window 2027 Q1–Q2.' },
  { name: 'NIST AI RMF', status: 'Self-Assessment', note: 'Govern/Map/Measure/Manage gemappt auf existierende Controls.' },
  { name: 'BSI C5', status: 'Planned', note: 'Kriterienkatalog-Mapping geplant; Voraussetzung für Behörden-Beschaffung.' },
  { name: 'NIS2', status: 'Planned', note: 'Control-Set-Mapping geplant (Risiko-, Incident-, Lieferketten-Anforderungen).' },
];

const SLOS = [
  { service: 'Telemetry ingest', availability: '99.95%', latency: '<100ms', errors: '<0.1%' },
  { service: 'Policy decision (inline)', availability: '99.9%', latency: '<50ms', errors: '<0.05%' },
  { service: 'Graph query (UI)', availability: '99.9%', latency: '<500ms', errors: '<0.5%' },
  { service: 'Agent run start', availability: '99.5%', latency: '<30s', errors: '<2%' },
  { service: 'Evidence seal', availability: '99.99%', latency: '<2s', errors: '<0.01%' },
  { service: 'Reporting (Annex IV)', availability: '99.5%', latency: '<5min', errors: '<1%' },
];

const SUB_PROCESSORS = [
  { name: 'Supabase', purpose: 'Hosted Postgres, Auth, Edge Functions, Storage', region: 'eu-central-1', transfer: 'EU-only' },
  { name: 'Stripe', purpose: 'Billing — keine Governance-Daten', region: 'US (Stripe Inc.)', transfer: 'SCC + DPF' },
  { name: 'Resend', purpose: 'Transactional E-Mail', region: 'EU', transfer: 'EU-only' },
  { name: 'Cloudflare', purpose: 'CDN, DDoS-Schutz, DNS', region: 'EU-only PoPs', transfer: 'EU-only' },
  { name: 'GitHub', purpose: 'Source-Code-Hosting (kein Kunden-Datenfluss)', region: 'US (Microsoft)', transfer: 'SCC + DPF' },
];
