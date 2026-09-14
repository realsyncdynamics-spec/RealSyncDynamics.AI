import { TerminalMessage } from '../useAgenticTerminal';

export interface AuditConfig {
  scanId: string;
  tier: 'free' | 'starter' | 'growth' | 'agency' | 'partner';
  frameworks: string[];
  controls: number;
  evidenceCount: number;
  expiresAt: Date;
}

export interface GeneratedAudit {
  auditId: string;
  scanId: string;
  generatedAt: Date;
  expiresAt: Date;
}

/** Echte Kennzahlen eines Scan-Laufs, aus `getScanReport()`. `null`, wenn der
 *  Lauf nicht gelesen werden konnte — dann nennt das Terminal keine Zahlen. */
export interface AuditFactSheet {
  scanRunId: string;
  findingCount: number;
  severityCounts: Record<string, number>;
  evidenceCount: number;
}

function generateAuditId(): string {
  return `audit_${crypto.randomUUID().slice(0, 8)}`;
}

export function generateAudit(
  scanId: string,
  tier: 'free' | 'starter' | 'growth' | 'agency' | 'partner',
  frameworks: string[] = [],
  controls: number = 0,
  evidenceCount: number = 0
): GeneratedAudit {
  const expiresAt = new Date();
  const auditId = generateAuditId();

  if (tier === 'free') {
    expiresAt.setDate(expiresAt.getDate() + 30);
  } else {
    expiresAt.setFullYear(expiresAt.getFullYear() + 2);
  }

  return {
    auditId,
    scanId,
    generatedAt: new Date(),
    expiresAt,
  };
}

/**
 * Meldungen zu einem Audit — ausschliesslich aus gemessenen Werten.
 *
 * Bis 2026-09-14 stand hier `✓ Evidence-Chain: N items sealed` mit N aus
 * `Math.random()`, dazu eine erfundene Dateigrösse und ein Download-Link auf
 * `evidence.realsync.ai`, der nichts ausliefert. In einem Produkt, dessen
 * Evidence-Modell `confidence_score`, `evidence_level` und
 * `verification_status` mitführt, um genau nicht zu überclaimen, war das der
 * Widerspruch in sich: eine versiegelte Beweiskette zu behaupten, die es
 * nicht gab.
 *
 * `facts` kommt aus `getScanReport()`. Ist es `null`, nennt das Terminal
 * keine Zahlen — statt Nullen zu zeigen, die wie ein Messergebnis aussehen.
 */
export function formatAuditMessage(
  audit: GeneratedAudit,
  tier: string,
  facts: AuditFactSheet | null,
): TerminalMessage[] {
  const messages: TerminalMessage[] = [];

  const genMsg: TerminalMessage = {
    id: crypto.randomUUID(),
    role: 'agent',
    content: tier === 'free' ? '📋 Compliance-Audit (Free)' : '📋 Compliance-Audit (Advanced)',
    timestamp: new Date(),
    type: 'info',
  };
  messages.push(genMsg);

  if (!facts) {
    messages.push({
      id: crypto.randomUUID(),
      role: 'agent',
      content: 'Zu diesem Scan-Lauf liess sich kein Report lesen. Keine Kennzahlen.',
      timestamp: new Date(),
      type: 'error',
    });
    return messages;
  }

  const severityLine = Object.entries(facts.severityCounts)
    .filter(([, count]) => count > 0)
    .map(([severity, count]) => `${severity}: ${count}`)
    .join(', ');

  messages.push({
    id: crypto.randomUUID(),
    role: 'agent',
    content: [
      `Scan-Lauf: ${facts.scanRunId}`,
      `Findings: ${facts.findingCount}${severityLine ? ` (${severityLine})` : ''}`,
      `Evidence-Einträge: ${facts.evidenceCount}`,
    ].join('\n'),
    timestamp: new Date(),
    type: 'info',
  });

  // Das Terminal erzeugt kein PDF. Der signierte Export läuft über das
  // Audit Center — dort wird auch der Hash gebildet, der Bestand hat.
  messages.push({
    id: crypto.randomUUID(),
    role: 'agent',
    content: 'Signierter Export: /app/audit',
    timestamp: new Date(),
    type: 'info',
  });

  return messages;
}

export function formatAuditAgentBox(tier: string, auditId: string): string {
  if (tier === 'free') {
    return `┌─ AUDIT AGENT ──────────────────────┐
│ Your free audit expires in 7 days.  │
│ Upgrade to STARTER to get yearly    │
│ compliance reports automatically.   │
│ Type /upgrade starter               │
└────────────────────────────────────┘`;
  }

  return `┌─ AUDIT AGENT ──────────────────────┐
│ Kennzahlen aus dem Scan-Lauf.       │
│ Signierter Export: /app/audit       │
│ Weiterer Lauf: /audit <scanId>      │
└────────────────────────────────────┘`;
}
