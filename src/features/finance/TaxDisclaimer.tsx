import { Info } from 'lucide-react';

/**
 * Hard-coded liability disclaimer for the Tax Evidence Runtime.
 *
 * Copy MUST stay in line with the module's positioning:
 *   "RealSync prepares tax-relevant documents — it does NOT
 *    provide tax advice and does NOT file tax returns."
 *
 * Render this on every Finance surface that touches tax artefacts.
 * Do not paraphrase without legal review.
 */
export function TaxDisclaimer({ variant = 'default' }: { variant?: 'default' | 'compact' }) {
  if (variant === 'compact') {
    return (
      <p className="text-[11px] text-titanium-500 leading-relaxed">
        Technische Vorbereitung. Keine Steuerberatung. Finale Prüfung durch Geschäftsführung oder Steuerberater.
      </p>
    );
  }

  return (
    <div className="flex items-start gap-2 p-3 bg-amber-950/20 border border-amber-900 text-xs leading-relaxed">
      <Info className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
      <div className="text-amber-100">
        <strong className="text-amber-50">Technische Vorbereitung — keine Steuerberatung.</strong>{' '}
        RealSyncDynamicsAI bereitet steuerrelevante Dokumente technisch auf, klassifiziert Belege
        und erzeugt Exportpakete. Die finale steuerliche Prüfung, Bewertung und Einreichung
        erfolgt durch Geschäftsführung oder Steuerberater.
      </div>
    </div>
  );
}
