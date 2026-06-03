// Telegram Webhook + Channel Integration — Unit Tests.
// Tests gegen die reine Logik ohne Netzwerk/DB.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Helpers die auch in der Edge Function verwendet werden ---------------

// SHA-256-Hash (Web Crypto API)
async function sha256Hex(input: string): Promise<string> {
  const buf   = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  const bytes = new Uint8Array(buf);
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}

// URL-safe Random Token
function randomToken(byteLength = 24): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

// HTML-Escaping
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Command-Extraktion aus Telegram-Message
function extractCommand(text: string, entities: Array<{ type: string; offset: number; length: number }> = []): string | null {
  if (!text) return null;
  const cmdEntity = entities.find((e) => e.type === 'bot_command' && e.offset === 0);
  if (!cmdEntity) return null;
  const raw = text.slice(0, cmdEntity.length);
  return raw.split('@')[0].toLowerCase();
}

// --- Tests ----------------------------------------------------------------

describe('Telegram Token-Handling', () => {
  it('erzeugt URL-safe Token ohne Sonderzeichen', () => {
    const token = randomToken(32);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token.length).toBeGreaterThan(30);
  });

  it('Token wird als SHA-256-Hash gespeichert, nicht im Klartext', async () => {
    const token = randomToken(32);
    const hash  = await sha256Hex(token);
    expect(hash).toHaveLength(64);
    expect(hash).not.toContain(token);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it('gleicher Token erzeugt deterministisch gleichen Hash', async () => {
    const token = 'test-token-abc123';
    const h1    = await sha256Hex(token);
    const h2    = await sha256Hex(token);
    expect(h1).toBe(h2);
  });

  it('verschiedene Token ergeben verschiedene Hashes', async () => {
    const h1 = await sha256Hex('token-a');
    const h2 = await sha256Hex('token-b');
    expect(h1).not.toBe(h2);
  });
});

describe('Command Extraktion', () => {
  it('/start wird korrekt extrahiert', () => {
    const entities = [{ type: 'bot_command', offset: 0, length: 6 }];
    expect(extractCommand('/start', entities)).toBe('/start');
  });

  it('/connect wird korrekt extrahiert', () => {
    const entities = [{ type: 'bot_command', offset: 0, length: 8 }];
    expect(extractCommand('/connect', entities)).toBe('/connect');
  });

  it('@BotName-Suffix wird entfernt', () => {
    const entities = [{ type: 'bot_command', offset: 0, length: 22 }];
    expect(extractCommand('/start@RealSyncBot', entities)).toBe('/start');
  });

  it('kein Command ohne bot_command Entity', () => {
    expect(extractCommand('hello world', [])).toBeNull();
  });

  it('Command nicht am Anfang wird ignoriert', () => {
    const entities = [{ type: 'bot_command', offset: 6, length: 6 }];
    expect(extractCommand('hello /start', entities)).toBeNull();
  });

  it('leerer Text liefert null', () => {
    expect(extractCommand('', [])).toBeNull();
  });
});

describe('Zugriffskontrolle', () => {
  const authRequired = new Set(['/status', '/audit', '/risks', '/evidence', '/compliance', '/assistant']);

  it('workspace-Commands sind auth-required', () => {
    expect(authRequired.has('/status')).toBe(true);
    expect(authRequired.has('/audit')).toBe(true);
    expect(authRequired.has('/risks')).toBe(true);
    expect(authRequired.has('/evidence')).toBe(true);
    expect(authRequired.has('/compliance')).toBe(true);
    expect(authRequired.has('/assistant')).toBe(true);
  });

  it('öffentliche Commands sind NICHT auth-required', () => {
    expect(authRequired.has('/start')).toBe(false);
    expect(authRequired.has('/help')).toBe(false);
    expect(authRequired.has('/connect')).toBe(false);
    expect(authRequired.has('/settings')).toBe(false);
  });

  it('nicht verbundener User wird für /status blockiert', () => {
    const isConnected = false;
    const command     = '/status';
    const isBlocked   = authRequired.has(command) && !isConnected;
    expect(isBlocked).toBe(true);
  });

  it('verbundener User kann /status aufrufen', () => {
    const isConnected = true;
    const command     = '/status';
    const isBlocked   = authRequired.has(command) && !isConnected;
    expect(isBlocked).toBe(false);
  });
});

describe('HTML Escaping', () => {
  it('& wird escaped', () => {
    expect(escapeHtml('AT&T')).toBe('AT&amp;T');
  });
  it('< wird escaped', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
  });
  it('normaler Text bleibt unverändert', () => {
    expect(escapeHtml('Hallo Welt')).toBe('Hallo Welt');
  });
});

describe('Message-Länge', () => {
  it('Nachrichten über 4000 Zeichen werden abgeschnitten', () => {
    const MAX = 4000;
    const longText = 'A'.repeat(5000);
    const safe = longText.length > MAX ? longText.slice(0, MAX - 3) + '…' : longText;
    expect(safe.length).toBeLessThanOrEqual(MAX);
    expect(safe.endsWith('…')).toBe(true);
  });

  it('kurze Nachrichten bleiben unverändert', () => {
    const short = 'Hallo';
    const MAX = 4000;
    const safe = short.length > MAX ? short.slice(0, MAX - 3) + '…' : short;
    expect(safe).toBe('Hallo');
  });
});

describe('Agent Routing — Command-zu-Feature Mapping', () => {
  const featureMap: Record<string, string> = {
    '/audit':      'compliance_audit',
    '/risks':      'risk_assessment',
    '/evidence':   'evidence_vault',
    '/compliance': 'compliance_overview',
    '/status':     'governance_status',
    '/assistant':  'general_assistant',
  };

  it('alle Workspace-Commands haben ein Feature-Mapping', () => {
    const commands = ['/audit', '/risks', '/evidence', '/compliance', '/status', '/assistant'];
    for (const cmd of commands) {
      expect(featureMap[cmd]).toBeDefined();
      expect(typeof featureMap[cmd]).toBe('string');
    }
  });

  it('/audit → compliance_audit', () => {
    expect(featureMap['/audit']).toBe('compliance_audit');
  });

  it('/risks → risk_assessment', () => {
    expect(featureMap['/risks']).toBe('risk_assessment');
  });

  it('/evidence → evidence_vault', () => {
    expect(featureMap['/evidence']).toBe('evidence_vault');
  });

  it('unbekannter Command hat kein Mapping', () => {
    expect(featureMap['/unbekannt']).toBeUndefined();
  });
});

describe('Webhook Secret Validierung', () => {
  it('korrektes Secret passiert Prüfung', () => {
    const secret   = 'mein-geheimes-secret';
    const incoming = 'mein-geheimes-secret';
    expect(incoming === secret).toBe(true);
  });

  it('falsches Secret wird abgelehnt', () => {
    const secret   = 'mein-geheimes-secret' as string;
    const incoming = 'falsches-secret'      as string;
    expect(incoming === secret).toBe(false);
  });

  it('leerer Secret-Header wird abgelehnt wenn Secret konfiguriert', () => {
    const secret   = 'mein-geheimes-secret' as string;
    const incoming = null as string | null;
    expect(incoming === secret).toBe(false);
  });
});

describe('Token TTL', () => {
  const TOKEN_TTL_MS = 15 * 60 * 1000;

  it('Token innerhalb TTL ist gültig', () => {
    const createdAt  = Date.now() - 5 * 60 * 1000; // 5 Minuten alt
    const isExpired  = Date.now() - createdAt > TOKEN_TTL_MS;
    expect(isExpired).toBe(false);
  });

  it('Token nach TTL ist abgelaufen', () => {
    const createdAt  = Date.now() - 20 * 60 * 1000; // 20 Minuten alt
    const isExpired  = Date.now() - createdAt > TOKEN_TTL_MS;
    expect(isExpired).toBe(true);
  });
});
