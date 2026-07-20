// Shared utilities for social publishers.

import type { PublishResult, SocialPost, SocialChannel } from './types';

/**
 * Load secret from Supabase Vault.
 * In production, call the edge function that has access to SERVICE_ROLE_KEY.
 * In test/dev, returns empty string (publishers handle gracefully).
 */
export async function loadSecretFromVault(secretName: string): Promise<string> {
  if (typeof window !== 'undefined') {
    // Browser context: cannot access vault directly.
    // In a real app, call an edge function that has SERVICE_ROLE_KEY.
    console.warn(`[Vault] ${secretName} not available in browser context`);
    return '';
  }

  // Server/Edge Function context: call Supabase directly.
  try {
    const supabaseUrl = process.env.SUPABASE_URL ?? '';
    const anonKey = process.env.SUPABASE_ANON_KEY ?? '';
    const response = await fetch(
      `${supabaseUrl}/functions/v1/vault-get-secret`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`,
        },
        body: JSON.stringify({ secretName }),
      }
    );
    if (!response.ok) return '';
    const result = await response.json() as Record<string, unknown>;
    return (result.secret as string) || '';
  } catch {
    return '';
  }
}

/**
 * Standard error result when a required configuration is missing.
 */
export function missingConfigError(
  channel: SocialChannel,
  configName: string
): PublishResult {
  return {
    ok: false,
    channel,
    error: {
      code: 'MISSING_CONFIG',
      message: `${configName} not configured for ${channel}`,
    },
  };
}

/**
 * Extract text summary from a SocialPost body.
 * For blog posts, truncate to first sentence or 500 chars.
 */
export function extractBlogExcerpt(body: string, maxLength: number = 500): string {
  const trimmed = body.trim();
  const sentences = trimmed.split(/[.!?]+/);
  const firstSentence = sentences[0]?.trim() || trimmed;

  if (firstSentence.length > maxLength) {
    return firstSentence.substring(0, maxLength) + '...';
  }

  return firstSentence;
}

/**
 * Escape HTML entities for safe XML/RSS generation.
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Generate a slug from title (for URLs).
 */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}
