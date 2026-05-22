import { useLocation, useParams } from 'react-router-dom';
import { AuditResultView, type AuditResultFinding } from '../features/audit/AuditResultView';

// AuditResultPage — sharable permalink for an audit result with the
// audit-copilot right-panel mounted.
//
// Hostinger-Pattern Phase 4: the AuditResultView surface already exists
// in main; this page is the thin route wrapper at /audit/result/:auditId
// that turns it into a real shareable URL.
//
// Data strategy (intentional):
//   The view accepts findings as props. There is no server-side
//   endpoint that returns findings by audit_id alone today — the only
//   place the findings shape lives is the gdpr-audit response, which
//   the chat hero handles in memory. So Phase 4 supports two modes:
//
//     1. Navigation from /audit chat: AuditChatHero passes the full
//        report through `navigate(..., { state })`; we re-hydrate from
//        location.state.
//     2. Cold deep-link (no state): we render the auditId header + the
//        copilot panel, with an empty findings list. The copilot can
//        still answer questions about the audit (the LLM doesn't
//        depend on the per-finding payload to be in props).
//
// A follow-up PR adds a `getAuditById` Edge endpoint and removes the
// state-pass dependency.

interface AuditReportState {
  domain?:   string;
  score?:    number;
  findings?: AuditResultFinding[];
}

export function AuditResultPage() {
  const { auditId = '' } = useParams<{ auditId: string }>();
  const { state } = useLocation();
  const report = (state ?? {}) as AuditReportState;

  return (
    <AuditResultView
      auditId={auditId}
      domain={report.domain}
      score={report.score}
      findings={report.findings ?? []}
    />
  );
}
