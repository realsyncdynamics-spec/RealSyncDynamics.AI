/**
 * Second Brain: nur ein lesender GET auf eine Staging-URL.
 *
 * Erwartete Route (im anderen Projekt, nicht in diesem Repo):
 *   GET {SECOND_BRAIN_STAGING_URL}/api/public/company
 *   { "module": "time-manager", "facts": [{ "id": "timeManager.publicNote", "text": "…" }] }
 *
 * Kein Datenbankzugriff, kein Upload, kein Modellaufruf.
 * `SECOND_BRAIN_AI_ENABLED=true` wird nur zur Kenntnis genommen, wenn die
 * URL eine Staging-URL ist, und schaltet hier trotzdem keine KI frei.
 */
import { applyAllowlist } from './allowlist';
import { curatedFacts } from './facts';
import {
  COMPANY_VOICE_DISCLAIMER,
  type CompanyVoiceEnv,
  type CompanyVoicePayload,
  type PublicFact,
} from './types';

const PUBLIC_PATH = '/api/public/company';
const DEFAULT_TIMEOUT_MS = 2500;
const MAX_BODY = 20_000;

export type AiAccessState = 'disabled' | 'refused-not-staging' | 'staging-flag-ignored';

export function resolveStagingCompanyUrl(env: CompanyVoiceEnv): URL | null {
  if (env.SECOND_BRAIN_READ_ENABLED !== 'true') return null;
  const raw = env.SECOND_BRAIN_STAGING_URL?.trim();
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  const local = host === 'localhost' || host === '127.0.0.1';
  if (url.protocol !== 'https:' && !local) return null;
  if (local && url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (!local && !host.includes('staging')) return null;
  if (host === 'realsyncdynamics.ai' || host === 'www.realsyncdynamics.ai') return null;
  if (host === 'realsyncdynamicsai.de' || host === 'www.realsyncdynamicsai.de') return null;
  return new URL(PUBLIC_PATH, url.origin);
}

/** Der Schalter bleibt wirkungslos: dieser Build ruft kein Modell auf. */
export function resolveAiAccess(env: CompanyVoiceEnv, stagingUrl: URL | null): AiAccessState {
  if (env.SECOND_BRAIN_AI_ENABLED !== 'true') return 'disabled';
  if (!stagingUrl) return 'refused-not-staging';
  return 'staging-flag-ignored';
}

export function curatedPayload(): CompanyVoicePayload {
  return {
    ok: true,
    source: 'curated',
    ai: 'disabled',
    facts: curatedFacts(),
    disclaimer: COMPANY_VOICE_DISCLAIMER,
  };
}

function payloadFromFacts(facts: PublicFact[], source: CompanyVoicePayload['source']): CompanyVoicePayload {
  return { ok: true, source, ai: 'disabled', facts, disclaimer: COMPANY_VOICE_DISCLAIMER };
}

export async function loadCompanyFacts(
  env: CompanyVoiceEnv,
  deps?: { fetchImpl?: typeof fetch; timeoutMs?: number },
): Promise<CompanyVoicePayload> {
  const stagingUrl = resolveStagingCompanyUrl(env);
  // Aufruf, damit ein gesetztes KI-Flag den Lesepfad nicht verzweigt.
  resolveAiAccess(env, stagingUrl);
  if (!stagingUrl) return curatedPayload();

  const fetchImpl = deps?.fetchImpl ?? fetch;
  const timeoutMs = deps?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  try {
    const response = await fetchImpl(stagingUrl, {
      method: 'GET',
      redirect: 'error',
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return curatedPayload();
    const type = response.headers.get('content-type') ?? '';
    if (!type.includes('json')) return curatedPayload();
    const body = await response.text();
    if (body.length > MAX_BODY) return curatedPayload();
    const parsed: unknown = JSON.parse(body);
    const filtered = applyAllowlist(parsed);
    if (!filtered.acceptedRemote) return curatedPayload();
    return payloadFromFacts(filtered.facts, 'second-brain-staging');
  } catch {
    return curatedPayload();
  }
}
