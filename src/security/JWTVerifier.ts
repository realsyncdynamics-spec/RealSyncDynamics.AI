/**
 * JWT Verifier — Validates JWTs with caching for performance.
 * Supports multiple signing algorithms and key rotation.
 */

import { createHmac, createVerify } from 'crypto';

export interface JWTPayload {
  sub: string;
  iat: number;
  exp: number;
  aud?: string | string[];
  iss?: string;
  [key: string]: unknown;
}

export interface JWTVerifyOptions {
  algorithms?: string[];
  audience?: string;
  issuer?: string;
  ignoreExpiration?: boolean;
  clockTolerance?: number;
}

interface CachedToken {
  payload: JWTPayload;
  timestamp: number;
}

/**
 * JWT Verifier with LRU cache for performance.
 */
export class JWTVerifier {
  private keyMap: Map<string, string | Buffer> = new Map();
  private cache: Map<string, CachedToken> = new Map();
  private readonly cacheMaxSize = 1000;
  private readonly cacheTTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    // Initialize with default keys
  }

  /**
   * Add a signing key.
   */
  addKey(kid: string, key: string | Buffer): void {
    this.keyMap.set(kid, key);
    // Invalidate cache when keys change
    this.cache.clear();
  }

  /**
   * Remove a signing key.
   */
  removeKey(kid: string): void {
    this.keyMap.delete(kid);
    this.cache.clear();
  }

  /**
   * Verify and decode a JWT token.
   */
  verify(
    token: string,
    options: JWTVerifyOptions = {}
  ): JWTPayload {
    // Check cache first
    const cached = this.cache.get(token);
    if (cached) {
      const age = Date.now() - cached.timestamp;
      if (age < this.cacheTTL) {
        return cached.payload;
      }
      this.cache.delete(token);
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format');
    }

    const [headerB64, payloadB64, signatureB64] = parts;

    // Decode header
    let header: Record<string, unknown>;
    try {
      header = JSON.parse(Buffer.from(headerB64, 'base64').toString());
    } catch {
      throw new Error('Invalid JWT header');
    }

    // Decode payload
    let payload: JWTPayload;
    try {
      payload = JSON.parse(Buffer.from(payloadB64, 'base64').toString());
    } catch {
      throw new Error('Invalid JWT payload');
    }

    // Verify signature
    const kid = String(header.kid || 'default');
    const key = this.keyMap.get(kid);
    if (!key) {
      throw new Error(`Unknown key ID: ${kid}`);
    }

    const algorithm = String(header.alg || 'HS256');
    this.verifySignature(headerB64, payloadB64, signatureB64, algorithm, key);

    // Verify claims
    this.verifyClaims(payload, options);

    // Cache the result
    this.cacheToken(token, payload);

    return payload;
  }

  /**
   * Verify signature.
   */
  private verifySignature(
    headerB64: string,
    payloadB64: string,
    signatureB64: string,
    algorithm: string,
    key: string | Buffer
  ): void {
    const message = `${headerB64}.${payloadB64}`;
    const signature = Buffer.from(signatureB64, 'base64');

    if (algorithm === 'HS256') {
      const computed = createHmac('sha256', key).update(message).digest();
      if (!computed.equals(signature)) {
        throw new Error('Invalid JWT signature');
      }
    } else if (algorithm === 'HS512') {
      const computed = createHmac('sha512', key).update(message).digest();
      if (!computed.equals(signature)) {
        throw new Error('Invalid JWT signature');
      }
    } else if (algorithm === 'RS256') {
      const verifier = createVerify('RSA-SHA256');
      verifier.update(message);
      if (!verifier.verify(key, signature)) {
        throw new Error('Invalid JWT signature');
      }
    } else if (algorithm === 'RS512') {
      const verifier = createVerify('RSA-SHA512');
      verifier.update(message);
      if (!verifier.verify(key, signature)) {
        throw new Error('Invalid JWT signature');
      }
    } else {
      throw new Error(`Unsupported algorithm: ${algorithm}`);
    }
  }

  /**
   * Verify JWT claims.
   */
  private verifyClaims(
    payload: JWTPayload,
    options: JWTVerifyOptions
  ): void {
    const now = Math.floor(Date.now() / 1000);
    const clockTolerance = options.clockTolerance || 0;

    // Check expiration
    if (!options.ignoreExpiration) {
      if (payload.exp && now > payload.exp + clockTolerance) {
        throw new Error('Token expired');
      }
    }

    // Check issuer
    if (options.issuer && payload.iss !== options.issuer) {
      throw new Error(`Invalid issuer: ${payload.iss}`);
    }

    // Check audience
    if (options.audience) {
      const aud = payload.aud;
      if (!aud) {
        throw new Error('Audience claim missing');
      }
      const audiences = Array.isArray(aud) ? aud : [aud];
      if (!audiences.includes(options.audience)) {
        throw new Error(`Invalid audience: ${aud}`);
      }
    }

    // Check subject exists
    if (!payload.sub) {
      throw new Error('Subject claim missing');
    }
  }

  /**
   * Cache a verified token (LRU).
   */
  private cacheToken(token: string, payload: JWTPayload): void {
    // Simple LRU: clear if cache is full
    if (this.cache.size >= this.cacheMaxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(token, { payload, timestamp: Date.now() });
  }

  /**
   * Clear the cache.
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics.
   */
  getCacheStats(): { size: number; maxSize: number } {
    return { size: this.cache.size, maxSize: this.cacheMaxSize };
  }
}

/**
 * Global JWT verifier instance.
 */
export const jwtVerifier = new JWTVerifier();
