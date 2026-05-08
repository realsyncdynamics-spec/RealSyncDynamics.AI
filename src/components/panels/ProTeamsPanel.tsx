import { Link } from 'react-router-dom';
import { ArrowRight, Cpu, Activity, Lock, FileSearch, Layers } from 'lucide-react';

/**
 * ProTeamsPanel — Modal-Content für „Für Profis & Teams".
 *
 * Verdichtet die Watchmaker-3-Pillars + AuditEngine-Tri-Layer-Summary
 * in eine Modal-taugliche Höhe (kein Three.js, keine Scroll-Reveals).
 * Wer mehr Tiefe will, klickt auf den Footer-Link zur API-Doku /
 * Methodik / Pilot.
 */
export function ProTeamsPanel() {
  return (
    <div className="space-y-7">
      <p className="text-sm text-silver-300 leading-relaxed">
        Unter der Haube ist RealSyncDynamics eine deterministische Audit-Engine mit Decision-Layer,
        API, Webhooks und C2PA-signierten Reports — Procurement-tauglich, ISO-anbindbar.
      </p>

      {/* Drei Zahnräder · Decision-Layer */}
      <div>
        <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-gold-400 mb-3">
          Drei Zahnräder · Ein Decision-Layer
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-silver-700">
          <Pillar icon={<Cpu className="h-4 w-4 text-ai-cyan-400" />} eyebrow="Mechanical Input" title="Audit-Engine">
            Reproduzierbare Scans nach festem Regelwerk. Jeder Befund mit Paragraph-Bezug, kein LLM-Halluzinieren.
          </Pillar>
          <Pillar icon={<Activity className="h-4 w-4 text-gold-400" />} eyebrow="AI Orchestration" title="Decision-Layer">
            Provider-Routing (EU-local + Cloud), Residency-Switch, Audit-Trail. Daten bleiben in der gewählten Region.
          </Pillar>
          <Pillar icon={<Lock className="h-4 w-4 text-security-400" />} eyebrow="Digital Output" title="Signed Reports">
            PDF mit C2PA-Provenance, REST-API, per-Tenant-Keys, Stripe-metered-Usage.
          </Pillar>
        </div>
      </div>

      {/* Audit-Engine Tri-Layer */}
      <div>
        <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-gold-400 mb-3">
          Audit-Engine · Tri-Layer
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-silver-700">
          <Pillar icon={<Activity className="h-4 w-4 text-ai-cyan-400" />} eyebrow="Tracking Layer" title="Detection">
            GA / Meta / LinkedIn / TikTok mit Consent-Status pro Tag, Pre/Post-Consent-Request-Map.
          </Pillar>
          <Pillar icon={<Lock className="h-4 w-4 text-gold-400" />} eyebrow="Security Layer" title="Headers & Hardening">
            CSP / HSTS / X-Frame-Options / Referrer-Policy + TLS-Version + HTTPS-Enforcement.
          </Pillar>
          <Pillar icon={<FileSearch className="h-4 w-4 text-security-400" />} eyebrow="Compliance Layer" title="Norm-Mapping">
            DSGVO Art. 5 / 6 / 28 / 32 / 35 · § 25 TTDSG · Drittlandtransfer (SCCs · Schrems-II · DPF).
          </Pillar>
        </div>
      </div>

      {/* Tech-Stichworte */}
      <div className="border border-silver-700 border-l-2 border-l-gold-400 p-4">
        <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-gold-400 mb-2 flex items-center gap-1.5">
          <Layers className="h-3 w-3" /> Stichworte
        </div>
        <div className="text-sm text-silver-200 leading-relaxed">
          API · Webhooks · Continuous Monitoring · Multi-Tenant für Agenturen · BYOK · C2PA-Provenance
          · Stripe-metered-Usage · CI/CD-Integration
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-silver-700">
        <Link to="/api" className="text-[11px] font-mono uppercase tracking-[0.18em] text-silver-400 hover:text-titanium-50">
          → API-Dokumentation
        </Link>
        <Link
          to="/pricing?tier=team"
          className="surface-gold inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-none"
        >
          Pilot starten <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

function Pillar({
  icon, eyebrow, title, children,
}: { icon: React.ReactNode; eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-obsidian-950 p-4 flex flex-col">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-silver-500">{eyebrow}</span>
      </div>
      <div className="font-display font-bold text-titanium-50 text-base tracking-tight mb-1.5">{title}</div>
      <div className="text-xs text-silver-300 leading-relaxed">{children}</div>
    </div>
  );
}
