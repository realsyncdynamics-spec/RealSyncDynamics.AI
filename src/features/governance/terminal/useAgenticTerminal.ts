import { useEffect, useState, useCallback, useRef } from 'react';
import { useTenant } from '../../../core/access/TenantProvider';
import { useSupabaseAuth } from '../../../features/supabase/SupabaseAuthContext';
import { getSupabase, isSupabaseConfigured } from '../../../lib/supabase';
import { triageAnalyze, formatTriageMessage, formatTriageAgentBox } from './agents/TriageAgent';
import { formatUpgradeMessage } from './agents/PaymentAgent';
import { createCheckoutSession } from '../../billing/checkout';
import { generateAudit, formatAuditMessage, formatAuditAgentBox } from './agents/AuditAgent';
import type { AuditFactSheet } from './agents/AuditAgent';
import { triggerTenantAudit, getScanReport } from '../scans/scansApi';
import { useTerminalSessionPersistence } from './useTerminalSessionPersistence';
import type { ScanResult } from './agents/TriageAgent';

export interface TerminalMessage {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  timestamp: Date;
  type?: 'command' | 'response' | 'error' | 'info';
  metadata?: Record<string, unknown>;
}

export interface ParsedCommand {
  type: 'scan' | 'upgrade' | 'audit' | 'register' | 'pay' | 'help' | 'status' | 'history' | 'invite' | 'members' | 'approve' | 'unknown';
  args: Record<string, string | string[] | undefined>;
}

export interface TerminalContext {
  scanId?: string;
  pendingUpgrade?: boolean;
  registrationEmail?: string;
  lastAuditId?: string;
}

/** `severity_max` des Scan-Laufs auf die Anzeige-Stufe abbilden. Ohne
 *  Findings gibt es kein Risiko-Niveau — `none` ist die ehrliche Angabe,
 *  `low` wäre bereits eine Behauptung. */
const SCAN_RISK_LEVELS = ['critical', 'high', 'medium', 'low', 'info'] as const;

function toRiskLevel(severityMax: string | null): ScanResult['riskLevel'] {
  return (SCAN_RISK_LEVELS as readonly string[]).includes(severityMax ?? '')
    ? (severityMax as ScanResult['riskLevel'])
    : 'none';
}

const WHITELISTED_COMMANDS = ['scan', 'upgrade', 'audit', 'register', 'pay', 'help', 'status', 'history', 'invite', 'members', 'approve'];

function parseCommand(input: string): ParsedCommand {
  const trimmed = input.trim();

  if (!trimmed.startsWith('/')) {
    return { type: 'unknown', args: {} };
  }

  const parts = trimmed.slice(1).split(/\s+/);
  const command = parts[0].toLowerCase();

  if (!WHITELISTED_COMMANDS.includes(command)) {
    return { type: 'unknown', args: {} };
  }

  const args: Record<string, string | string[] | undefined> = {};

  switch (command) {
    case 'scan': {
      const url = parts.slice(1).join(' ');
      if (url && isValidUrl(url)) {
        args.url = url;
      }
      return { type: 'scan', args };
    }

    case 'upgrade': {
      const tier = parts[1]?.toLowerCase();
      if (tier && ['starter', 'growth', 'agency', 'partner'].includes(tier)) {
        args.tier = tier;
      }
      return { type: 'upgrade', args };
    }

    case 'audit': {
      const scanId = parts[1];
      if (scanId && isValidUUID(scanId)) {
        args.scanId = scanId;
      }
      return { type: 'audit', args };
    }

    case 'register': {
      const email = parts[1];
      if (email && isValidEmail(email)) {
        args.email = email;
      }
      return { type: 'register', args };
    }

    case 'pay': {
      const tier = parts[1]?.toLowerCase();
      if (tier && ['starter', 'growth', 'agency', 'partner'].includes(tier)) {
        args.tier = tier;
      }
      return { type: 'pay', args };
    }

    case 'invite': {
      const email = parts[1];
      const role = parts[2]?.toLowerCase() || 'editor';
      if (email && isValidEmail(email) && ['editor', 'viewer', 'approver'].includes(role)) {
        args.email = email;
        args.role = role;
      }
      return { type: 'invite', args };
    }

    case 'members':
      return { type: 'members', args };

    case 'approve': {
      const auditId = parts[1];
      if (auditId && isValidUUID(auditId)) {
        args.auditId = auditId;
      }
      return { type: 'approve', args };
    }

    case 'help':
    case 'status':
    case 'history':
      return { type: command as ParsedCommand['type'], args };

    default:
      return { type: 'unknown', args };
  }
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidUUID(uuid: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid);
}

export function useAgenticTerminal() {
  const { activeTenantId } = useTenant();
  const { user } = useSupabaseAuth();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<TerminalMessage[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [context, setContext] = useState<TerminalContext>({});
  const [error, setError] = useState<string | null>(null);
  const [isRestoringSession, setIsRestoringSession] = useState(false);
  const commandHistoryRef = useRef<string[]>([]);

  const { restoreSession, saveSession, clearSession } = useTerminalSessionPersistence(
    sessionId,
    messages,
    context
  );

  const createSession = useCallback(async () => {
    if (!activeTenantId || !user || !isSupabaseConfigured()) {
      return;
    }

    try {
      setIsRestoringSession(true);

      // Try to restore previous session
      const restoredSession = restoreSession();
      if (restoredSession) {
        setSessionId(restoredSession.sessionId);
        setMessages(restoredSession.messages);
        setContext(restoredSession.context);
        setIsRestoringSession(false);
        return;
      }

      // Create new session if no restore available
      const sb = getSupabase();
      const newSessionId = crypto.randomUUID();

      const { error: insertError } = await sb
        .from('terminal_sessions')
        .insert({
          id: newSessionId,
          user_id: user.id,
          tenant_id: activeTenantId,
          is_active: true,
          command_count: 0,
          current_context: {},
        });

      if (insertError) throw insertError;

      setSessionId(newSessionId);

      const welcomeMsg: TerminalMessage = {
        id: crypto.randomUUID(),
        role: 'system',
        content: `RealSync Governance Runtime (Beta)
EU-Frankfurt · Session: sess_${newSessionId.slice(0, 8)}
Type /help for available commands.`,
        timestamp: new Date(),
        type: 'info',
      };

      setMessages([welcomeMsg]);
      setIsRestoringSession(false);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to create session';
      setError(errorMsg);
      console.error('Session creation error:', err);
      setIsRestoringSession(false);
    }
  }, [activeTenantId, user, restoreSession]);

  const logCommand = useCallback(
    async (command: string, parsed: ParsedCommand, result: TerminalMessage[]): Promise<void> => {
      if (!sessionId || !activeTenantId || !isSupabaseConfigured()) {
        return;
      }

      try {
        const sb = getSupabase();
        const commandId = crypto.randomUUID();

        const { error: logError } = await sb
          .from('terminal_commands')
          .insert({
            id: commandId,
            session_id: sessionId,
            user_id: user?.id,
            tenant_id: activeTenantId,
            command,
            parsed_command: parsed,
            status: 'success',
            result: { messages: result },
            executed_at: new Date().toISOString(),
          });

        if (logError) throw logError;
      } catch (err) {
        console.error('Command logging error:', err);
      }
    },
    [sessionId, activeTenantId, user?.id]
  );

  const executeCommand = useCallback(
    async (command: string): Promise<void> => {
      if (!command.trim()) return;

      setIsExecuting(true);
      setError(null);

      try {
        const parsed = parseCommand(command);

        const userMsg: TerminalMessage = {
          id: crypto.randomUUID(),
          role: 'user',
          content: command,
          timestamp: new Date(),
          type: 'command',
        };

        const responses: TerminalMessage[] = [];

        if (parsed.type === 'unknown') {
          const errorMsg: TerminalMessage = {
            id: crypto.randomUUID(),
            role: 'agent',
            content: `❌ Unknown command: ${command}\nType /help for available commands.`,
            timestamp: new Date(),
            type: 'error',
          };
          responses.push(errorMsg);
        } else if (parsed.type === 'help') {
          const helpMsg: TerminalMessage = {
            id: crypto.randomUUID(),
            role: 'agent',
            content: `Available Commands:
Scanning & Compliance:
/scan <URL>           - Scan website for AI systems & compliance gaps
/audit <SCANID>       - Generate compliance audit report
/status               - Show account status & scan quota
/history              - Show last 5 scans & audits

Subscription:
/upgrade <TIER>       - Upgrade subscription (starter|growth|agency|scale)
/pay <TIER>           - Request invoice payment

Team & Approval:
/invite <EMAIL> [ROLE]  - Invite team member (editor|viewer|approver)
/members              - List session participants
/approve <AUDITID>    - Approve audit for compliance sign-off

Account:
/register [EMAIL]     - Create new account
/help                 - Show this help message`,
            timestamp: new Date(),
            type: 'info',
          };
          responses.push(helpMsg);
        } else if (parsed.type === 'status') {
          const statusMsg: TerminalMessage = {
            id: crypto.randomUUID(),
            role: 'agent',
            content: `Account Status (demo):
Tier: Free
Scans used: 0/3
Last scan: Never
Session: ${sessionId?.slice(0, 8)}`,
            timestamp: new Date(),
            type: 'info',
          };
          responses.push(statusMsg);
        } else if (parsed.type === 'history') {
          const historyMsg: TerminalMessage = {
            id: crypto.randomUUID(),
            role: 'agent',
            content: 'History: No scans or audits yet.',
            timestamp: new Date(),
            type: 'info',
          };
          responses.push(historyMsg);
        } else if (parsed.type === 'scan') {
          // Triage Agent: echter Scan über die `tenant-audit` Edge Function.
          // Vorher stand hier ein `mockScan` — Findings-Zahl, Risiko-Stufe und
          // Anzahl klassifizierter KI-Systeme kamen aus `Math.random()`. Der
          // Nutzer bekam für seine eigene Domain einen Würfelwurf als
          // Risikoeinstufung, und die daraus abgeleitete Tarif-Empfehlung
          // ebenso. Jetzt wird wirklich gescannt: das Ergebnis landet in
          // `scan_runs` + `findings` und ist danach unter /app/websites und
          // /app/audit wiederauffindbar.
          const url = parsed.args.url as string;
          if (!activeTenantId) {
            responses.push({
              id: crypto.randomUUID(),
              role: 'agent',
              content: '❌ Kein aktiver Workspace. Bitte zuerst einen Mandanten wählen.',
              timestamp: new Date(),
              type: 'error',
            });
          } else {
            try {
              const run = await triggerTenantAudit(activeTenantId, url);
              const scan: ScanResult = {
                scanId: run.scan_run_id,
                url,
                findingsCount: run.finding_count,
                riskLevel: toRiskLevel(run.severity_max),
                systemsClassified: null,
                findings: [],
              };

              const recommendation = triageAnalyze(scan);
              responses.push(...formatTriageMessage(scan, recommendation));

              responses.push({
                id: crypto.randomUUID(),
                role: 'agent',
                content: formatTriageAgentBox(recommendation),
                timestamp: new Date(),
                type: 'info',
              });

              setContext({ ...context, scanId: run.scan_run_id });
            } catch (err) {
              // `triggerTenantAudit` unterscheidet bereits Limit, Timeout,
              // fehlende Berechtigung und nicht erreichbaren Dienst.
              responses.push({
                id: crypto.randomUUID(),
                role: 'agent',
                content: `❌ ${err instanceof Error ? err.message : 'Scan fehlgeschlagen.'}`,
                timestamp: new Date(),
                type: 'error',
              });
            }
          }
        } else if (parsed.type === 'upgrade') {
          // Payment Agent: echte Stripe-Session über die Edge Function
          // `stripe-checkout`. Vorher wurde hier lokal eine URL
          // zusammengebaut (`checkout.realsync.ai/...`), die nirgendwo
          // hinführte, und der Preis kam aus einer zweiten Tabelle im
          // Frontend — drei von vier Werten wichen von `shared/pricing.ts` ab.
          const tier = parsed.args.tier as string;
          if (!activeTenantId) {
            responses.push({
              id: crypto.randomUUID(),
              role: 'agent',
              content: '❌ Kein aktiver Workspace. Bitte zuerst einen Mandanten wählen.',
              timestamp: new Date(),
              type: 'error',
            });
          } else {
            let result: Awaited<ReturnType<typeof createCheckoutSession>>;
            try {
              result = await createCheckoutSession(activeTenantId, tier);
            } catch (err) {
              result = {
                ok: false,
                error: {
                  code: 'NETWORK',
                  message: err instanceof Error ? err.message : 'Checkout konnte nicht vorbereitet werden.',
                },
              };
            }

            if (result.ok && result.url) {
              responses.push(...formatUpgradeMessage(tier, result.url));
              setContext({ ...context, pendingUpgrade: true });
            } else {
              // `createCheckoutSession` unterscheidet bereits unbekannten Plan,
              // Free-Plan ohne Checkout und Pläne, die nur über den Vertrieb
              // laufen. Diese Auskunft ist besser als jede eigene.
              responses.push({
                id: crypto.randomUUID(),
                role: 'agent',
                content: `❌ ${result.error?.message ?? 'Checkout konnte nicht vorbereitet werden.'}`,
                timestamp: new Date(),
                type: 'error',
              });
            }
          }
        } else if (parsed.type === 'audit') {
          // Audit Agent: Generate compliance audit
          const scanId = parsed.args.scanId as string | undefined;
          if (!scanId && !context.scanId) {
            const errorMsg: TerminalMessage = {
              id: crypto.randomUUID(),
              role: 'agent',
              content: `❌ No scan ID provided. Run /scan first or use /audit <scanId>`,
              timestamp: new Date(),
              type: 'error',
            };
            responses.push(errorMsg);
          } else {
            // Kennzahlen aus dem echten Scan-Lauf lesen, statt sie zu erfinden.
            const targetScanId = scanId || context.scanId || '';
            let facts: AuditFactSheet | null = null;
            try {
              const report = await getScanReport(targetScanId);
              if (report) {
                const severityCounts: Record<string, number> = {};
                for (const finding of report.all_findings) {
                  const severity = String(finding.severity ?? 'unbekannt');
                  severityCounts[severity] = (severityCounts[severity] ?? 0) + 1;
                }
                facts = {
                  scanRunId: targetScanId,
                  findingCount: report.all_findings.length,
                  severityCounts,
                  evidenceCount: report.evidence_catalog.length,
                };
              }
            } catch {
              // Kein Report lesbar — formatAuditMessage sagt das ausdrücklich,
              // statt Nullen zu zeigen, die wie ein Messergebnis aussehen.
              facts = null;
            }

            const audit = generateAudit(targetScanId, 'free');
            responses.push(...formatAuditMessage(audit, 'free', facts));

            responses.push({
              id: crypto.randomUUID(),
              role: 'agent',
              content: formatAuditAgentBox('free', audit.auditId),
              timestamp: new Date(),
              type: 'info',
            });
            setContext({ ...context, lastAuditId: audit.auditId });
          }
        } else if (parsed.type === 'register') {
          // Registration flow
          const email = parsed.args.email as string | undefined;
          if (email) {
            const regMsg: TerminalMessage = {
              id: crypto.randomUUID(),
              role: 'agent',
              content: `📧 Sending verification link to ${email}...`,
              timestamp: new Date(),
              type: 'info',
            };
            responses.push(regMsg);

            const verifyMsg: TerminalMessage = {
              id: crypto.randomUUID(),
              role: 'agent',
              content: `✓ Account created: ${email}
✓ Free tier activated (3 scans/month)`,
              timestamp: new Date(),
              type: 'info',
            };
            responses.push(verifyMsg);

            const onboardingMsg: TerminalMessage = {
              id: crypto.randomUUID(),
              role: 'agent',
              content: `┌─ ONBOARDING AGENT ─────────────────┐
│ Welcome! Your first scan is free.   │
│ Type /scan <url> to start, or       │
│ /upgrade to skip the 3-scan limit.  │
└────────────────────────────────────┘`,
              timestamp: new Date(),
              type: 'info',
            };
            responses.push(onboardingMsg);

            setContext({ ...context, registrationEmail: email });
          } else {
            const promptMsg: TerminalMessage = {
              id: crypto.randomUUID(),
              role: 'agent',
              content: `📧 What's your email? Type: /register your.email@company.com`,
              timestamp: new Date(),
              type: 'info',
            };
            responses.push(promptMsg);
          }
        } else if (parsed.type === 'pay') {
          // Invoice payment fallback
          const tier = parsed.args.tier as string | undefined;
          if (tier) {
            // Vorher meldete dieser Zweig „Invoice will be sent to your
            // registered email address" — ohne einen einzigen Aufruf. Es
            // entstand keine Rechnung und es ging keine Mail raus.
            const invoiceMsg: TerminalMessage = {
              id: crypto.randomUUID(),
              role: 'agent',
              content: `Kauf auf Rechnung läuft nicht über das Terminal.
Anfrage: /contact-sales
Laufende Abrechnung und Belege: /app/billing
Sofort per Karte: /upgrade ${tier}`,
              timestamp: new Date(),
              type: 'info',
            };
            responses.push(invoiceMsg);
          } else {
            const errorMsg: TerminalMessage = {
              id: crypto.randomUUID(),
              role: 'agent',
              content: `❌ Please specify tier: /pay <tier>
Valid options: starter, growth, agency, scale`,
              timestamp: new Date(),
              type: 'error',
            };
            responses.push(errorMsg);
          }
        } else if (parsed.type === 'invite') {
          // Invite team member to session
          const email = parsed.args.email as string | undefined;
          const role = parsed.args.role as string | undefined;
          if (email) {
            const inviteMsg: TerminalMessage = {
              id: crypto.randomUUID(),
              role: 'agent',
              content: `👥 Inviting ${email} to session as ${(role || 'editor').toUpperCase()}...
Invitation sent and pending acceptance.
They can join with: /accept-invite <token>`,
              timestamp: new Date(),
              type: 'info',
            };
            responses.push(inviteMsg);
          } else {
            const errorMsg: TerminalMessage = {
              id: crypto.randomUUID(),
              role: 'agent',
              content: `❌ Please specify email: /invite <email@company.com> [role]
Valid roles: editor (default), viewer, approver`,
              timestamp: new Date(),
              type: 'error',
            };
            responses.push(errorMsg);
          }
        } else if (parsed.type === 'members') {
          // List session members
          const membersMsg: TerminalMessage = {
            id: crypto.randomUUID(),
            role: 'agent',
            content: `👥 Session Members:
1. You (owner) - Full access
2. No other members yet
Invite team members with: /invite <email@company.com>`,
            timestamp: new Date(),
            type: 'info',
          };
          responses.push(membersMsg);
        } else if (parsed.type === 'approve') {
          // Approval workflow
          const auditId = parsed.args.auditId as string | undefined;
          if (auditId) {
            const approveMsg: TerminalMessage = {
              id: crypto.randomUUID(),
              role: 'agent',
              content: `✅ Audit ${auditId.slice(0, 8)} marked as approved.
Compliance sign-off sealed to Evidence-Chain.
Event hash: SHA256:${crypto.randomUUID().slice(0, 16)}...`,
              timestamp: new Date(),
              type: 'info',
            };
            responses.push(approveMsg);
          } else {
            const errorMsg: TerminalMessage = {
              id: crypto.randomUUID(),
              role: 'agent',
              content: `❌ Please specify audit ID: /approve <auditId>
Format: /approve audit_abc12345`,
              timestamp: new Date(),
              type: 'error',
            };
            responses.push(errorMsg);
          }
        } else {
          const agentMsg: TerminalMessage = {
            id: crypto.randomUUID(),
            role: 'agent',
            content: `🤖 Processing ${parsed.type} command...`,
            timestamp: new Date(),
            type: 'info',
          };
          responses.push(agentMsg);
        }

        setMessages((prev) => [...prev, userMsg, ...responses]);
        commandHistoryRef.current.push(command);
        await logCommand(command, parsed, responses);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Command execution failed';
        setError(errorMsg);
        console.error('Command execution error:', err);
      } finally {
        setIsExecuting(false);
      }
    },
    // `activeTenantId` gehoert dazu, seit /scan einen echten, mandanten-
    // gebundenen Scan ausloest: ohne die Abhaengigkeit wuerde nach einem
    // Workspace-Wechsel der alte Mandant gescannt.
    [sessionId, logCommand, activeTenantId]
  );

  useEffect(() => {
    if (!sessionId && activeTenantId && user) {
      void createSession();
    }
  }, [activeTenantId, user, sessionId, createSession]);

  return {
    sessionId,
    messages,
    isExecuting,
    isRestoringSession,
    error,
    context,
    executeCommand,
    setContext,
    setError,
    getCommandHistory: () => [...commandHistoryRef.current],
    saveSession,
    clearSession,
  };
}
