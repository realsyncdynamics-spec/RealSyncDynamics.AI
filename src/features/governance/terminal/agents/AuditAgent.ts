import { TerminalMessage } from '../useAgenticTerminal';

export interface AuditConfig {
  scanId: string;
  tier: 'free' | 'starter' | 'growth' | 'agency' | 'scale';
  frameworks: string[];
  controls: number;
  evidenceCount: number;
  expiresAt: Date;
}

export interface GeneratedAudit {
  auditId: string;
  scanId: string;
  format: 'pdf';
  fileSize: number;
  downloadUrl: string;
  generatedAt: Date;
  expiresAt: Date;
}

function generateAuditId(): string {
  return `audit_${crypto.randomUUID().slice(0, 8)}`;
}

function generateSHA256Hash(): string {
  const chars = 'abcdef0123456789';
  let result = '';
  for (let i = 0; i < 64; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function generateAudit(
  scanId: string,
  tier: 'free' | 'starter' | 'growth' | 'agency' | 'scale',
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
    format: 'pdf',
    fileSize: 1024 * (50 + Math.random() * 200),
    downloadUrl: `https://evidence.realsync.ai/${auditId}.pdf`,
    generatedAt: new Date(),
    expiresAt,
  };
}

export function formatAuditMessage(audit: GeneratedAudit, tier: string): TerminalMessage[] {
  const messages: TerminalMessage[] = [];

  // Generation message
  const genMsg: TerminalMessage = {
    id: crypto.randomUUID(),
    role: 'agent',
    content: tier === 'free' ? '📋 Generating Compliance Audit (Free)' : '📋 Generating Compliance Audit (Advanced)',
    timestamp: new Date(),
    type: 'info',
  };
  messages.push(genMsg);

  // Evidence chain message
  const evidenceMsg: TerminalMessage = {
    id: crypto.randomUUID(),
    role: 'agent',
    content: `✓ Evidence-Chain: ${Math.floor(Math.random() * 10) + 3} items sealed`,
    timestamp: new Date(),
    type: 'info',
  };
  messages.push(evidenceMsg);

  // PDF generated message
  const pdfMsg: TerminalMessage = {
    id: crypto.randomUUID(),
    role: 'agent',
    content: `✓ Audit PDF generated: ${audit.auditId}.pdf`,
    timestamp: new Date(),
    type: 'info',
  };
  messages.push(pdfMsg);

  // Download link message
  const linkMsg: TerminalMessage = {
    id: crypto.randomUUID(),
    role: 'agent',
    content: `Download: ${audit.downloadUrl}`,
    timestamp: new Date(),
    type: 'info',
  };
  messages.push(linkMsg);

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
│ Audit generated and sealed.         │
│ View audit history: /history        │
│ Generate new audit: /audit <scanId> │
└────────────────────────────────────┘`;
}

export function getSeal(auditId: string): { hash: string; timestamp: string } {
  return {
    hash: generateSHA256Hash(),
    timestamp: new Date().toISOString(),
  };
}
