import { ShieldAlert } from 'lucide-react';

// Mandatory banner shown on every remediation surface. Communicates
// the agent's review-bounded contract to the user before they take any
// action. The text is normative — do not rewrite it casually.

export function RemediationReviewBanner() {
  return (
    <div className="flex items-start gap-3 border border-amber-400/40 bg-amber-400/5 px-4 py-3 text-amber-100">
      <ShieldAlert className="h-5 w-5 shrink-0 text-amber-400" />
      <div className="text-sm leading-relaxed">
        <p className="font-semibold text-amber-50">Review erforderlich</p>
        <p className="mt-1 text-amber-200/90">
          Der Developer Remediation Agent erzeugt <strong>nur Vorschläge</strong> —
          Snippets, Pläne, GitHub-Issue-Entwürfe und PR-Kommentar-Entwürfe.
          Er <strong>merged nicht</strong>, <strong>deployed nicht</strong>,
          <strong> verändert keine Secrets</strong> und übermittelt keine
          rechtlichen Einreichungen. Jeder Vorschlag muss von einem
          Reviewer (Owner / Admin / Entwickler) geprüft und manuell angewendet werden.
        </p>
      </div>
    </div>
  );
}
