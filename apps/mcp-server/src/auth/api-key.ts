import { FastifyRequest, FastifyReply } from 'fastify';
import { MctAuthContext } from '../types/index.js';
import { validateApiKey, logKeyUsage } from '../services/api-keys-db.js';

const API_KEY_PREFIX = 'rsmcp_';

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

  // Validate against database (Phase 2.1)
  const validation = await validateApiKey(apiKey);
  if (!validation.valid || !validation.keyId || !validation.tenantId) {
    return null;
  }

  return {
    keyId: validation.keyId,
    tenantId: validation.tenantId,
    scopes: validation.scopes || [],
  };
}

/**
 * Log key usage after request completes.
 * Call this from route handlers.
 */
export async function logRequestUsage(
  request: FastifyRequest,
  statusCode: number,
  latencyMs: number,
): Promise<void> {
  const auth = (request as any).user as MctAuthContext | undefined;
  if (!auth) {
    return;
  }

  const clientIp =
    (request.headers['x-forwarded-for'] as string)?.split(',')[0] ||
    request.socket.remoteAddress ||
    'unknown';
  const userAgent = request.headers['user-agent'] as string | undefined;
  const action = `${request.method.toLowerCase()} ${request.url}`;

  await logKeyUsage(auth.keyId, action, statusCode, {
    ip: clientIp,
    userAgent,
    latencyMs,
  });
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
