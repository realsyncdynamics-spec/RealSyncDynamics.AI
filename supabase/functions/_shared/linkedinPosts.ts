/**
 * LinkedIn Posts API — Text-Post fuer den social-publisher-worker.
 *
 * Vertrag (gelesen 2026-11-13):
 * - Posts API: POST https://api.linkedin.com/rest/posts
 *   https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api?view=li-lms-2026-10
 * - Versionierung: Header LinkedIn-Version im Format YYYYMM.
 *   Die Versioning-Seite nennt als neueste Version October 2026 = 202610.
 *   https://learn.microsoft.com/en-us/linkedin/marketing/versioning?view=li-lms-2026-10
 *   Unsicher: ein Release 202611 ist dort nicht gelistet. 202511 wird laut
 *   derselben Seite am 2026-11-16 abgeschaltet und wird hier nicht verwendet.
 *   Microsoft-Beispiele schreiben den Header "Linkedin-Version". HTTP-Headernamen
 *   sind case-insensitive; wir senden "LinkedIn-Version".
 * - X-Restli-Protocol-Version: 2.0.0
 * - Die Post-ID steht im Antwort-Header x-restli-id, nicht im JSON-Body.
 * - commentary ist little-Text. Reservierte Zeichen muessen escaped werden:
 *   https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/little-text-format?view=li-lms-2026-10
 *
 * Bilder: der Queue-Job hat keine Bild-Bytes und keine Image-URN. Dieser
 * Adapter ruft die Images API deshalb nicht auf. Dokumentierter Weg, sobald
 * ein Job ein Bild traegt:
 * POST https://api.linkedin.com/rest/images?action=initializeUpload
 * https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/images-api?view=li-lms-2026-10
 * Der binaere Upload auf die zurueckgegebene uploadUrl ist auf der gelesenen
 * Seite nicht als vollstaendiger Request ausformuliert ("see Upload the Image").
 * Der Schritt wird hier nicht geraten.
 *
 * Der Access-Token wird weder geloggt noch in Fehlermeldungen geschrieben.
 */

import {
  LINKEDIN_PUBLISHING_FLAG,
  linkedInPublishingEnabled,
  resolveSocialAccessToken,
  type SocialChannelAdmin,
} from './socialChannelCredentials.ts';

/** Neueste auf der Versioning-Seite genannte Version. Siehe Dateikopf. */
export const LINKEDIN_API_VERSION = '202610';

export const LINKEDIN_RESTLI_PROTOCOL = '2.0.0';

export const LINKEDIN_POSTS_URL = 'https://api.linkedin.com/rest/posts';

const AUTHOR_URN = /^urn:li:(?:person|organization):[A-Za-z0-9_-]{1,120}$/;

/** little-Text, Abschnitt Text. Reihenfolge ist egal; Backslash zuerst. */
const LITTLE_RESERVED = new Set([
  '\\', '|', '{', '}', '@', '[', ']', '(', ')', '<', '>', '#', '*', '_', '~',
]);

export function parseLinkedInAuthorUrn(value: string): string | null {
  const trimmed = value.trim();
  if (!AUTHOR_URN.test(trimmed)) return null;
  return trimmed;
}

export function escapeLinkedInCommentary(text: string): string {
  let out = '';
  for (const ch of text) {
    if (LITTLE_RESERVED.has(ch)) out += '\\';
    out += ch;
  }
  return out;
}

export function buildLinkedInTextPost(authorUrn: string, commentary: string): Record<string, unknown> {
  return {
    author: authorUrn,
    commentary,
    visibility: 'PUBLIC',
    distribution: {
      feedDistribution: 'MAIN_FEED',
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: 'PUBLISHED',
    isReshareDisabledByAuthor: false,
  };
}

export interface LinkedInTextPostInput {
  accessToken: string;
  authorUrn: string;
  commentary: string;
  fetchImpl?: typeof fetch;
}

export async function publishLinkedInTextPost(
  input: LinkedInTextPostInput,
): Promise<{ ok: true; externalId: string } | { ok: false; error: string }> {
  const author = parseLinkedInAuthorUrn(input.authorUrn);
  if (!author) {
    return { ok: false, error: 'linkedin author urn is not a person or organization urn' };
  }
  const commentary = input.commentary.trim();
  if (!commentary) {
    return { ok: false, error: 'linkedin commentary is empty' };
  }
  const fetchImpl = input.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(LINKEDIN_POSTS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        'Content-Type': 'application/json',
        'LinkedIn-Version': LINKEDIN_API_VERSION,
        'X-Restli-Protocol-Version': LINKEDIN_RESTLI_PROTOCOL,
      },
      body: JSON.stringify(buildLinkedInTextPost(author, escapeLinkedInCommentary(commentary))),
    });
  } catch (err) {
    return { ok: false, error: redact(String(err), input.accessToken) };
  }

  if (response.status !== 201) {
    const body = await response.text().catch(() => '');
    return { ok: false, error: linkedInHttpError(response.status, body, input.accessToken) };
  }
  const externalId = response.headers.get('x-restli-id')?.trim() ?? '';
  if (!externalId.startsWith('urn:li:')) {
    return { ok: false, error: 'LinkedIn 201 without x-restli-id' };
  }
  return { ok: true, externalId };
}

/**
 * Token aus der Mandanten-Verbindung, Autor-URN aus derselben Zeile.
 * Kein LINKEDIN_ACCESS_TOKEN, auch wenn das Legacy-Flag gesetzt ist.
 */
export async function publishLinkedInQueueJob(
  admin: SocialChannelAdmin,
  input: {
    tenantId: string;
    queueChannel: string;
    body: string;
    accountExternalId: string | null;
    now?: Date;
    readEnv?: (name: string) => string | undefined;
    fetchImpl?: typeof fetch;
  },
): Promise<{ ok: boolean; externalId?: string; error?: string }> {
  if (!linkedInPublishingEnabled(input.readEnv?.(LINKEDIN_PUBLISHING_FLAG))) {
    return { ok: false, error: 'linkedin publishing is disabled' };
  }
  const resolved = await resolveSocialAccessToken(admin, {
    tenantId: input.tenantId,
    queueChannel: input.queueChannel,
    accountExternalId: input.accountExternalId,
    now: input.now,
    readEnv: input.readEnv,
    allowLegacyEnv: false,
  });
  if (!resolved.ok) return { ok: false, error: resolved.message };
  if (resolved.source !== 'connection' || !resolved.accountExternalId) {
    return { ok: false, error: 'linkedin author urn missing' };
  }
  return publishLinkedInTextPost({
    accessToken: resolved.accessToken,
    authorUrn: resolved.accountExternalId,
    commentary: input.body,
    fetchImpl: input.fetchImpl,
  });
}

function redact(text: string, secret: string): string {
  if (!secret) return text;
  return text.split(secret).join('[redacted]');
}

function linkedInHttpError(status: number, body: string, secret: string): string {
  const clipped = redact(body, secret).replace(/\s+/g, ' ').trim().slice(0, 400);
  return clipped ? `LinkedIn ${status}: ${clipped}` : `LinkedIn ${status}`;
}
