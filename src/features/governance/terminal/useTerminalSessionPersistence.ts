import { useEffect, useCallback } from 'react';
import { TerminalMessage, TerminalContext } from './useAgenticTerminal';

const STORAGE_KEY = 'realsync_terminal_session';
const SESSION_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

interface TerminalSessionState {
  sessionId: string;
  messages: TerminalMessage[];
  context: TerminalContext;
  timestamp: number;
}

export function useTerminalSessionPersistence(
  sessionId: string | null,
  messages: TerminalMessage[],
  context: TerminalContext
) {
  const saveSession = useCallback(() => {
    if (!sessionId || messages.length === 0) {
      return;
    }

    try {
      const state: TerminalSessionState = {
        sessionId,
        messages,
        context,
        timestamp: Date.now(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.error('Failed to save terminal session:', err);
    }
  }, [sessionId, messages, context]);

  const restoreSession = useCallback((): TerminalSessionState | null => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;

      const state: TerminalSessionState = JSON.parse(stored);

      // Check if session has expired
      if (Date.now() - state.timestamp > SESSION_EXPIRY_MS) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }

      // Restore Date objects for messages
      state.messages = state.messages.map((msg) => ({
        ...msg,
        timestamp: new Date(msg.timestamp),
      }));

      return state;
    } catch (err) {
      console.error('Failed to restore terminal session:', err);
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
  }, []);

  const clearSession = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.error('Failed to clear terminal session:', err);
    }
  }, []);

  // Auto-save session whenever messages or context changes
  useEffect(() => {
    const timer = setTimeout(saveSession, 500);
    return () => clearTimeout(timer);
  }, [messages, context, saveSession]);

  return {
    saveSession,
    restoreSession,
    clearSession,
  };
}
