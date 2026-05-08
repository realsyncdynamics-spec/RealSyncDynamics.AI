import { Link } from 'react-router-dom';
import { ArrowRight, Building2, ShieldCheck, GitBranch, Clock } from 'lucide-react';

/**
 * EnterprisePanel — Modal-Content für „Enterprise".
 *
 * Procurement-tauglichkeit auf einer Seite. Wer hier landet, ist meist
 * IT-Buyer / Datenschutzbeauftragter eines mittleren bis großen
 * Unternehmens und braucht: SLA-Klarheit, DPA-Status, Roadmap,
 * Sales-Kontakt. Tech-Detail-Listen bleiben in /security und /api.
 */
export function EnterprisePanel() {
  return (
    <div className="space-y-6">
      <p className="text-sm text-silver-300 leading-relaxed">
        Für Konzerne, Behörden, Versicherer und regulierte Industrien. Multi-Tenant-Workspace,
        BYOK, dedizierte SLA, AVV nach EU-Mustervertrag und versionierte Methodik.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-silver-700">
        <Tile
          icon={<Building2 className="h-4 w-4 text-gold-400" />}
          title="Multi-Tenant + SSO/SAML"
          body="Workspace-Isolation per Postgres-RLS, SSO/SAML-Anbindung, Org-Governance, Public-Sector-Mode."
        />
        <Tile
          icon={<ShieldCheck className="h-4 w-4 text-gold-400" />}
          title="DPA + AVV inklusive"
          body="Standard-AVV nach EU-Mustervertrag automatisch beim Onboarding. Sub-Processor-Liste mit 30-Tage-Notice."
        />
        <Tile
          icon={<GitBranch className="h-4 w-4 text-gold-400" />}
          title="API · Webhooks · BYOK"
          body="REST-API, Webhooks für CI/CD-Integration, Bring-Your-Own-Key für AI-Provider, Stripe-metered-Usage."
        />
        <Tile
          icon={<Clock className="h-4 w-4 text-gold-400" />}
          title="SLA + Compliance-Roadmap"
          body="SLA verhandelbar pro Vertrag. SOC-2-Type-1-Audit geplant 2026 Q4. ISO 27001 Vorbereitung läuft."
        />
      </div>

      <div className="border border-silver-700 p-4">
        <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-gold-400 mb-2">
          On-Premise / Sovereign-Hosting
        </div>
        <p className="text-xs text-silver-300 leading-relaxed">
          Für Banken, Behörden und kritische Infrastruktur ist On-Premise-Mode in Vorbereitung —
          gesamter Stack im eigenen Tenant, EU-local-AI via Ollama, ohne Cloud-Provider-Pfade.
          Kontakt zur frühen Bewertung empfohlen.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-silver-700">
        <Link to="/security" className="text-[11px] font-mono uppercase tracking-[0.18em] text-silver-400 hover:text-titanium-50">
          → Security-Posture & Roadmap
        </Link>
        <Link
          to="/contact-sales?intent=enterprise"
          className="surface-gold inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-none"
        >
          Sales kontaktieren <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

function Tile({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="bg-obsidian-950 p-4 sm:p-5 flex flex-col">
      <div className="flex items-center gap-2 mb-2">
        {icon}
      </div>
      <h3 className="font-display font-bold text-titanium-50 text-base tracking-tight mb-1.5">
        {title}
      </h3>
      <p className="text-xs text-silver-300 leading-relaxed">{body}</p>
    </div>
  );
}
