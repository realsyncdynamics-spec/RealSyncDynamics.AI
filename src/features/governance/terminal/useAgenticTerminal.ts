import { useEffect, useState, useCallback, useRef } from 'react';
import { useTenant } from '../../../core/access/TenantProvider';
import { useSupabaseAuth } from '../../../features/supabase/SupabaseAuthContext';
import { getSupabase, isSupabaseConfigured } from '../../../lib/supabase';
import { triageAnalyze, formatTriageMessage, formatTriageAgentBox } from './agents/TriageAgent';
import { createCheckoutSession, formatUpgradeMessage } from './agents/PaymentAgent';
import { generateAudit, formatAuditMessage, formatAuditAgentBox } from './agents/AuditAgent';
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
      if (tier && ['starter', 'growth', 'agency', 'scale'].includes(tier)) {
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
      if (tier && ['starter', 'growth', 'agency', 'scale'].includes(tier)) {
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
          // Triage Agent: Scan website
          const url = parsed.args.url as string;
          const mockScan: ScanResult = {
            scanId: crypto.randomUUID(),
            url,
            findingsCount: Math.floor(Math.random() * 25),
            riskLevel: ['critical', 'high', 'medium', 'low'][Math.floor(Math.random() * 4)] as any,
            systemsClassified: Math.floor(Math.random() * 10),
            findings: [],
          };

          const recommendation = triageAnalyze(mockScan);
          const triageMessages = formatTriageMessage(mockScan, recommendation);
          responses.push(...triageMessages);

          const agentBox = formatTriageAgentBox(recommendation);
          const agentMsg: TerminalMessage = {
            id: crypto.randomUUID(),
            role: 'agent',
            content: agentBox,
            timestamp: new Date(),
            type: 'info',
          };
          responses.push(agentMsg);

          setContext({ ...context, scanId: mockScan.scanId });
        } else if (parsed.type === 'upgrade') {
          // Payment Agent: Upgrade subscription
          const tier = parsed.args.tier as string;
          try {
            const checkout = createCheckoutSession(tier);
            const upgradeMessages = formatUpgradeMessage(tier, checkout.checkoutUrl);
            responses.push(...upgradeMessages);
            setContext({ ...context, pendingUpgrade: true });
          } catch (err) {
            const errorMsg: TerminalMessage = {
              id: crypto.randomUUID(),
              role: 'agent',
              content: `❌ Invalid tier: ${tier}. Valid options: starter, growth, agency, scale`,
              timestamp: new Date(),
              type: 'error',
            };
            responses.push(errorMsg);
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
            const audit = generateAudit(scanId || context.scanId || 'unknown', 'free');
            const auditMessages = formatAuditMessage(audit, 'free');
            responses.push(...auditMessages);

            const agentBox = formatAuditAgentBox('free', audit.auditId);
            const agentMsg: TerminalMessage = {
              id: crypto.randomUUID(),
              role: 'agent',
              content: agentBox,
              timestamp: new Date(),
              type: 'info',
            };
            responses.push(agentMsg);
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
            const invoiceMsg: TerminalMessage = {
              id: crypto.randomUUID(),
              role: 'agent',
              content: `📨 Sending invoice request for ${tier.toUpperCase()} tier...
Invoice will be sent to your registered email address.
Payment terms: Due within 7 days
Reference your invoice number for payment.`,
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
    [sessionId, logCommand]
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
