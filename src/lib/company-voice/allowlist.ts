/**
 * Allowlist für die Second-Brain-Antwort.
 * Unbekannte IDs, Dokumente, Bucket-Pfade und Telefonnummern fallen weg.
 * Preise und Identität bleiben am kuratierten Text.
 */
import { catalogEuroAmounts, curatedFacts } from './facts';
import {
  PUBLIC_FACT_IDS,
  REMOTE_ADDABLE_FACT_ID,
  type PublicFact,
  type PublicFactId,
} from './types';

const MAX_NOTE = 280;

const PRIVATE_MARKERS =
  /@|https?:|www\.|\.pdf\b|\.docx?\b|bucket|supabase|storage\/v1|service_role|api[_-]?key|secret|password|bearer|vertraulich|personenbezogen|s3:\/\//i;

const PHONE = /(?:\+\d|\b0\d[\d\s./()-]{6,})/;

function isPublicFactId(value: string): value is PublicFactId {
  return (PUBLIC_FACT_IDS as readonly string[]).includes(value);
}

export function sanitizePublicNote(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.replace(/\s+/g, ' ').trim();
  if (text.length < 8 || text.length > MAX_NOTE) return null;
  if (PRIVATE_MARKERS.test(text) || PHONE.test(text)) return null;
  if (/garantiert\s+konform/i.test(text)) return null;
  const amounts = catalogEuroAmounts();
  for (const match of text.matchAll(/(\d{1,6})\s*(?:€|eur(?:o)?)/gi)) {
    const amount = Number(match[1]);
    if (!amounts.has(amount)) return null;
  }
  return text;
}

interface RemoteFact {
  id: PublicFactId;
  text: string;
}

function readRemoteFacts(raw: unknown): RemoteFact[] | null {
  if (!raw || typeof raw !== 'object') return null;
  const body = raw as { facts?: unknown; timeManager?: unknown };
  if (!Array.isArray(body.facts) && body.timeManager == null) return null;
  const remote: RemoteFact[] = [];
  if (Array.isArray(body.facts)) {
    for (const entry of body.facts) {
      if (!entry || typeof entry !== 'object') continue;
      const id = (entry as { id?: unknown }).id;
      const text = (entry as { text?: unknown }).text;
      if (typeof id !== 'string' || !isPublicFactId(id) || typeof text !== 'string') continue;
      remote.push({ id, text: text.replace(/\s+/g, ' ').trim() });
    }
  }
  const note =
    body.timeManager && typeof body.timeManager === 'object'
      ? (body.timeManager as { publicNote?: unknown }).publicNote
      : undefined;
  if (typeof note === 'string') remote.push({ id: REMOTE_ADDABLE_FACT_ID, text: note });
  return remote;
}

/** Prüft die JSON-Antwort des eigenen Endpunkts, bevor der Browser sie spricht. */
export function acceptClientFacts(value: unknown): PublicFact[] | null {
  if (!Array.isArray(value)) return null;
  const facts = curatedFacts().map((fact) => ({ ...fact }));
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const id = (entry as { id?: unknown }).id;
    const text = (entry as { text?: unknown }).text;
    if (id !== REMOTE_ADDABLE_FACT_ID) continue;
    const note = sanitizePublicNote(text);
    if (!note || facts.some((fact) => fact.id === REMOTE_ADDABLE_FACT_ID)) continue;
    facts.push({ id: REMOTE_ADDABLE_FACT_ID, text: note, origin: 'second-brain' });
  }
  return facts;
}

export interface AllowlistResult {
  facts: PublicFact[];
  acceptedRemote: boolean;
}

/**
 * Kuratierte Fakten bleiben führend. Ein Second-Brain-Text ersetzt sie nur,
 * wenn er zeichengleich ist. `timeManager.publicNote` darf ergänzt werden.
 */
export function applyAllowlist(raw: unknown, curated: readonly PublicFact[] = curatedFacts()): AllowlistResult {
  const remote = readRemoteFacts(raw);
  if (!remote) return { facts: curated.map((fact) => ({ ...fact })), acceptedRemote: false };

  const byId = new Map<PublicFactId, string>();
  for (const fact of remote) {
    if (!byId.has(fact.id)) byId.set(fact.id, fact.text);
  }

  let acceptedRemote = false;
  const facts: PublicFact[] = curated.map((fact) => {
    const incoming = byId.get(fact.id);
    if (incoming && incoming === fact.text) {
      acceptedRemote = true;
      return { ...fact, origin: 'second-brain' as const };
    }
    return { ...fact };
  });

  const note = sanitizePublicNote(byId.get(REMOTE_ADDABLE_FACT_ID));
  if (note) {
    acceptedRemote = true;
    facts.push({ id: REMOTE_ADDABLE_FACT_ID, text: note, origin: 'second-brain' });
  }

  return { facts, acceptedRemote };
}
