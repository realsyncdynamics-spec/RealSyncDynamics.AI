import { useState, useEffect } from 'react';

const SESSION_ID_KEY = 'realsync.browserSessionId';
const SESSION_TIMEOUT_MS = 12 * 60 * 60 * 1000; // 12 hours

function generateSessionId(): string {
  return `bs_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 15)}`;
}

function getOrCreateSessionId(): string {
  try {
    const stored = localStorage.getItem(SESSION_ID_KEY);
    const storedTime = localStorage.getItem(`${SESSION_ID_KEY}.time`);

    // Check if stored session is still valid
    if (stored && storedTime) {
      const age = Date.now() - parseInt(storedTime, 10);
      if (age < SESSION_TIMEOUT_MS) {
        return stored;
      }
    }
  } catch {
    // Ignore localStorage errors (e.g., in private mode)
  }

  const newId = generateSessionId();
  try {
    localStorage.setItem(SESSION_ID_KEY, newId);
    localStorage.setItem(`${SESSION_ID_KEY}.time`, Date.now().toString());
  } catch {
    // Ignore localStorage errors
  }

  return newId;
}

export function useBrowserSession(): string {
  const [sessionId, setSessionId] = useState<string>('');

  useEffect(() => {
    setSessionId(getOrCreateSessionId());
  }, []);

  return sessionId;
}
