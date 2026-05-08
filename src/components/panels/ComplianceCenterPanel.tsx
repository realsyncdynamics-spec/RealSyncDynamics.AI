import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, AlertOctagon, Network, FileText } from 'lucide-react';

/**
 * ComplianceCenterPanel — Modal-Content für „Compliance-Center".
 *
 * Trust-Anchor-Section. Bündelt die Plattform-Governance-Dokumente an
 * einem Ort, sodass Datenschützer & Procurement nicht durch Footer-
 * Links jagen müssen. Jede Card linkt auf das vollständige Dokument.
 */
export function ComplianceCenterPanel() {
  return (
    <div className="space-y-6">
      <p className="text-sm text-silver-300 leading-relaxed">
        Was wir liefern, was bei Ihrem Datenschutz-Experten bleibt, und wo Sie unsere Methodik,
        Grenzen und Sub-Processors einsehen können — alles versioniert und ohne Account.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-silver-700">
        <Card
          icon={<BookOpen className="h-4 w-4 text-gold-400" />}
          title="Methodik 2026.05.0"
          body="Jede Regel unseres Scanners ist dokumentiert, versioniert und mit Norm-Bezug versehen. Ihre Rechtsabteilung kann alles prüfen."
          to="/legal/methodology"
          cta="Methodik ansehen"
        />
        <Card
          icon={<AlertOctagon className="h-4 w-4 text-silver-400" />}
          title="Grenzen des Tools"
          body="Standard-Risiken erkennen wir automatisiert. Spezialfälle und individuelle Ausnahmen müssen manuell geprüft werden — wir sind das Radar, nicht der Richter."
          to="/grenzen"
          cta="Grenzen ansehen"
        />
        <Card
          icon={<Network className="h-4 w-4 text-gold-400" />}
          title="Sub-Processors"
          body="Vollständige Liste mit Standort, Funktion und AVV-Status. 30-Tage-Vorab-Notice bei Änderungen."
          to="/legal/sub-processors"
          cta="Liste einsehen"
        />
        <Card
          icon={<FileText className="h-4 w-4 text-silver-400" />}
          title="AVV / DPA"
          body="Standard-AVV nach EU-Mustervertrag, automatisch vor Vertragsunterzeichnung. Compliance-Matrix für Procurement."
          to="/legal/avv"
          cta="AVV-Vorlage öffnen"
        />
      </div>

      {/* Haftungs-Disclaimer als Vertrauenssignal, nicht versteckt */}
      <div className="border border-silver-700 border-l-2 border-l-gold-400 p-4 bg-obsidian-900">
        <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-gold-400 mb-2">
          Haftungs-Hinweis
        </div>
        <p className="text-xs text-silver-300 leading-relaxed">
          Wir liefern strukturierte technische und rechtliche Einschätzungen. Die finale rechtliche
          Bewertung sollte Ihr Datenschutz-Experte oder Anwalt vornehmen. Kein Ersatz für individuelle
          Rechtsberatung.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-silver-700">
        <Link to="/security" className="text-[11px] font-mono uppercase tracking-[0.18em] text-silver-400 hover:text-titanium-50">
          → Security · Roadmap · Disclosure
        </Link>
        <Link to="/legal/compliance-matrix" className="text-[11px] font-mono uppercase tracking-[0.18em] text-silver-400 hover:text-titanium-50">
          → Compliance-Matrix
        </Link>
      </div>
    </div>
  );
}

function Card({
  icon, title, body, to, cta,
}: { icon: React.ReactNode; title: string; body: string; to: string; cta: string }) {
  return (
    <div className="flex flex-col bg-obsidian-950 p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-2">{icon}</div>
      <h3 className="font-display font-bold text-titanium-50 text-base tracking-tight mb-1.5">
        {title}
      </h3>
      <p className="text-xs text-silver-300 leading-relaxed flex-1 mb-4">{body}</p>
      <Link
        to={to}
        className="inline-flex items-center gap-1.5 self-start text-xs font-semibold text-gold-400 hover:text-gold-300"
      >
        {cta} <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}
