import { Link } from 'react-router-dom';
import { ArrowRight, Globe } from 'lucide-react';

type Props = {
  /** Optional audit_id, source-tag for attribution */
  source?: string;
};

export function AuditToWebsiteNote({ source = 'audit-pre' }: Props) {
  return (
    <div className="mt-8 p-5 sm:p-6 bg-obsidian-900 border border-titanium-900 rounded-none">
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-9 h-9 rounded-none bg-gradient-to-br from-fuchsia-600 to-amber-600 flex items-center justify-center mt-0.5">
          <Globe className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-amber-400 font-bold mb-1">
            Website-as-a-Service
          </div>
          <h3 className="font-display font-bold text-titanium-50 text-base sm:text-lg mb-2 tracking-tight">
            Aus Ihrem Audit wird auf Wunsch eine fertige Website.
          </h3>
          <p className="text-sm text-titanium-300 leading-relaxed mb-3">
            Sie möchten die Findings nicht nur lesen, sondern direkt gelöst haben? Mit unserem automatischen Neuaufbau verwandeln wir Ihre bestehende Site in eine moderne, DSGVO-konforme EU-Website — inklusive Hosting, Consent-Management und halbjährlichen Re-Audits. Sie behalten Ihre Inhalte, wir übernehmen Technik, Betrieb und Compliance-Layer.
          </p>
          <Link
            to={`/dsgvo-website?source=${source}`}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-security-400 hover:text-security-300 underline-offset-2 hover:underline"
          >
            Details zum automatischen Neuaufbau ansehen <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
