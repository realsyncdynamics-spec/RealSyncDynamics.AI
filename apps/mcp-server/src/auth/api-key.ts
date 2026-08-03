import crypto from 'crypto';
import { FastifyRequest, FastifyReply } from 'fastify';
import { MctAuthContext } from '../types/index.js';

const API_KEY_PREFIX = 'rsmcp_';

export function hashApiKey(key: string): string {
  return crypto
    .createHash('sha256')
    .update(key)
    .digest('hex');
}

export function validateApiKeyFormat(key: string): boolean {
  return key.startsWith(API_KEY_PREFIX) && key.length > API_KEY_PREFIX.length;
}

export async function authenticateRequest(
  request: FastifyRequest,
): Promise<MctAuthContext | null> {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const apiKey = authHeader.substring(7);
  if (!validateApiKeyFormat(apiKey)) {
    return null;
  }

  // In Phase 1: placeholder. Phase 2 wird echte DB-Queries implementiert.
  // Für jetzt: nur Struktur validieren.
  const keyHash = hashApiKey(apiKey);
  const keyId = apiKey.substring(0, 20); // Simplified for MVP

  return {
    keyId,
    tenantId: '', // würde aus DB kommen
    scopes: ['evidence.read', 'governance.read'],
  };
}

export function requireScope(scope: string) {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;

    descriptor.value = async function (request: FastifyRequest, reply: FastifyReply) {
      const auth = (request as any).user as MctAuthContext | undefined;
      if (!auth) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      if (!auth.scopes.includes(scope)) {
        return reply.code(403).send({ error: 'Forbidden: insufficient scope' });
      }

      return originalMethod.call(this, request, reply);
    };

    return descriptor;
  };
}
