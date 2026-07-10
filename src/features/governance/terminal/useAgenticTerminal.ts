import { useEffect, useState, useCallback, useRef } from 'react';
import { useTenant } from '../../../core/access/TenantProvider';
import { useSupabaseAuth } from '../../../features/supabase/SupabaseAuthContext';
import { getSupabase, isSupabaseConfigured } from '../../../lib/supabase';

export interface TerminalMessage {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  timestamp: Date;
  type?: 'command' | 'response' | 'error' | 'info';
  metadata?: Record<string, unknown>;
}

export interface ParsedCommand {
  type: 'scan' | 'upgrade' | 'audit' | 'register' | 'pay' | 'help' | 'status' | 'history' | 'unknown';
  args: Record<string, string | string[] | undefined>;
}

export interface TerminalContext {
  scanId?: string;
  pendingUpgrade?: boolean;
  registrationEmail?: string;
  lastAuditId?: string;
}

const WHITELISTED_COMMANDS = ['scan', 'upgrade', 'audit', 'register', 'pay', 'help', 'status', 'history'];

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
  const commandHistoryRef = useRef<string[]>([]);

  const createSession = useCallback(async () => {
    if (!activeTenantId || !user || !isSupabaseConfigured()) {
      return;
    }

    try {
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
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to create session';
      setError(errorMsg);
      console.error('Session creation error:', err);
    }
  }, [activeTenantId, user]);

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
/scan <URL>           - Scan website for AI systems & compliance gaps
/upgrade <TIER>       - Upgrade subscription (starter|growth|agency|scale)
/audit <SCANID>       - Generate compliance audit report
/register [EMAIL]     - Create new account
/pay <TIER>           - Request invoice payment
/help                 - Show this help message
/status               - Show account status & scan quota
/history              - Show last 5 scans & audits`,
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
        } else {
          const agentMsg: TerminalMessage = {
            id: crypto.randomUUID(),
            role: 'agent',
            content: `🤖 Processing ${parsed.type} command... (Agent implementation coming in Phase 6 Week 2)`,
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
    error,
    context,
    executeCommand,
    setContext,
    setError,
    getCommandHistory: () => [...commandHistoryRef.current],
  };
}
