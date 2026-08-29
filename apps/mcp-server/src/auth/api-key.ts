import crypto from 'crypto';
import { FastifyRequest, FastifyReply } from 'fastify';
import { MctAuthContext } from '../types/index.js';

const API_KEY_PREFIX = 'rsmcp_';

export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

export function validateApiKeyFormat(key: string): boolean {
  return key.startsWith(API_KEY_PREFIX) && key.length > API_KEY_PREFIX.length;
}

/**
 * Authentifizierung — derzeit nicht verfügbar, weil es keinen Key-Speicher gibt.
 *
 * Vorher gab diese Funktion für JEDE Zeichenkette, die mit `rsmcp_` beginnt,
 * einen gültigen Kontext zurück — mit festen Scopes und leerer `tenantId`.
 * Es gab keine Prüfung gegen eine Datenbank, keinen Widerruf, keinen Ablauf.
 * Ein solcher Platzhalter darf in einer Zugriffsschicht auf Compliance-
 * Nachweise nicht gewähren, sondern muss verweigern: ohne Key-Speicher gibt es
 * niemanden, dessen Berechtigung sich feststellen ließe.
 *
 * Der Dienst antwortet daher durchgehend mit 401, bis die Key-Verwaltung
 * (Tabelle, Ausstellung, Widerruf) nachgezogen ist. Das ist die einzige
 * Aussage, die die vorhandene Datenlage deckt.
 */
export async function authenticateRequest(
  request: FastifyRequest,
): Promise<MctAuthContext | null> {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  if (!validateApiKeyFormat(authHeader.substring(7))) {
    return null;
  }

  request.log.warn(
    { scope: 'mcp_auth_unavailable' },
    'MCP-Key vorgelegt, aber es existiert kein Key-Speicher — Zugriff verweigert.',
  );
  return null;
}

/**
 * preHandler, der einen Scope erzwingt.
 *
 * War zuvor ein TypeScript-Decorator und damit zu Fastify-Routen gar nicht
 * kompatibel — er wurde an keiner Route angewandt. Als preHandler ist er
 * einsetzbar, sobald es echte Scopes aus einem Key-Speicher gibt.
 */
export function requireScope(scope: string) {
  return async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const auth = (request as any).user as MctAuthContext | undefined;
    if (!auth) {
      return reply.code(401).send({ error: 'UNAUTHORIZED' });
    }
    if (!auth.scopes.includes(scope)) {
      return reply.code(403).send({
        error: 'FORBIDDEN',
        message: `Dieser Key hat den Scope "${scope}" nicht.`,
      });
    }
  };
}
