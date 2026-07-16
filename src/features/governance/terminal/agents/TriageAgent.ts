import { TerminalMessage } from '../useAgenticTerminal';

export interface ScanFinding {
  id: string;
  type: 'ai-system' | 'tracker' | 'third-party';
  description: string;
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
}

export interface ScanResult {
  scanId: string;
  url: string;
  findingsCount: number;
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  systemsClassified: number;
  findings: ScanFinding[];
}

export interface TriageRecommendation {
  tier: 'free_tier' | 'starter' | 'growth' | 'agency' | 'scale';
  message: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
}

function determineTier(findingsCount: number, riskLevel: string): TriageRecommendation {
  if (riskLevel === 'critical') {
    return {
      tier: 'agency',
      message: '⚠️ CRITICAL: Compliance breach detected. Immediate action needed.',
      urgency: 'critical',
    };
  }

  if (findingsCount < 5) {
    return {
      tier: 'starter',
      message: '✓ Small compliance footprint. STARTER tier recommended for basic audit & framework setup.',
      urgency: 'low',
    };
  }

  if (findingsCount <= 10) {
    return {
      tier: 'growth',
      message: '📈 Moderate findings. GROWTH tier recommended for AI classification & custom frameworks.',
      urgency: 'medium',
    };
  }

  if (findingsCount <= 20) {
    return {
      tier: 'growth',
      message: '⚠️ Many findings (10-20). GROWTH tier + Custom Frameworks recommended.',
      urgency: 'high',
    };
  }

  return {
    tier: 'agency',
    message: '🔴 Complex compliance profile (20+ findings). AGENCY tier + dedicated support recommended.',
    urgency: 'critical',
  };
}

export function triageAnalyze(scan: ScanResult): TriageRecommendation {
  return determineTier(scan.findingsCount, scan.riskLevel);
}

export function formatTriageMessage(scan: ScanResult, recommendation: TriageRecommendation): TerminalMessage[] {
  const messages: TerminalMessage[] = [];

  // Summary message
  const summaryMsg: TerminalMessage = {
    id: crypto.randomUUID(),
    role: 'agent',
    content: `📋 Scan Summary
URL: ${scan.url}
Findings: ${scan.findingsCount}
Risk Level: ${scan.riskLevel.toUpperCase()}
AI Systems: ${scan.systemsClassified}`,
    timestamp: new Date(),
    type: 'info',
  };
  messages.push(summaryMsg);

  // Findings breakdown
  if (scan.findings.length > 0) {
    const findingsMsg: TerminalMessage = {
      id: crypto.randomUUID(),
      role: 'agent',
      content: `Findings Breakdown:
${scan.findings.map((f) => `- ${f.type}: ${f.description} [${f.riskLevel}]`).join('\n')}`,
      timestamp: new Date(),
      type: 'info',
    };
    messages.push(findingsMsg);
  }

  // Recommendation with urgency
  const urgencyIcon =
    recommendation.urgency === 'critical'
      ? '🔴'
      : recommendation.urgency === 'high'
        ? '🟠'
        : recommendation.urgency === 'medium'
          ? '🟡'
          : '🟢';

  const recommendationMsg: TerminalMessage = {
    id: crypto.randomUUID(),
    role: 'agent',
    content: `${urgencyIcon} Recommendation
${recommendation.message}
Type: /upgrade ${recommendation.tier}`,
    timestamp: new Date(),
    type: 'info',
  };
  messages.push(recommendationMsg);

  return messages;
}

export function formatTriageAgentBox(recommendation: TriageRecommendation): string {
  const lines = [
    '┌─ TRIAGE AGENT ─────────────────────┐',
    `│ Tier recommendation: ${recommendation.tier.toUpperCase().padEnd(24)} │`,
    `│ Urgency: ${recommendation.urgency.toUpperCase().padEnd(28)} │`,
    `│ ${recommendation.message.substring(0, 33).padEnd(35)} │`,
    '│ Type /upgrade <tier> to continue.   │',
    '└────────────────────────────────────┘',
  ];
  return lines.join('\n');
}
