/**
 * REA — Runtime Evidence Agent (Client-Seite).
 *
 * Aufgabe: Für jeden KI-Aufruf aus dem Governance-Workspace den
 * Herkunftsnachweis belegen, den der `ai-gateway` serverseitig schreibt
 * (`ai_evidence_events`, append-only, Hash-Kette per Trigger).
 *
 * Grundsatz Claims-vs-Runtime: Der REA behauptet nichts selbst. Er
 *   1. hasht den gesendeten `input` lokal (SHA-256, identisch zu
 *      `supabase/functions/_shared/hash.ts`),
 *   2. sucht den Evidence-Eintrag mit `evidence.request_id = trace_id`
 *      (RLS: nur Mitglieder des Mandanten),
 *   3. vergleicht `input_sha256` mit dem lokalen Hash,
 *   4. prüft den Kettenabschnitt über `ai_evidence_verify_chain`.
 * Fehlt ein Schritt, ist der Status ehrlich `ausstehend` oder
 * `nicht_verfuegbar` — nie `belegt`.
 *
 * Kein Schreibpfad, keine Service-Role, Mandant nur aus dem verifizierten
 * Tenant-Kontext des Aufrufers (nie aus URL oder Body).
 *
 * Bewusst ohne Imports, damit das Modul ohne Bundler testbar bleibt.
 */

export type ReaStatus =
  /** Eintrag gefunden, Prüfsumme stimmt, Kette am Eintrag intakt. */
  | 'belegt'
  /** Eintrag (noch) nicht sichtbar — Schreiben ist serverseitig best effort. */
  | 'ausstehend'
  /** Eintrag gefunden, aber Prüfsumme oder Kette weicht ab. */
  | 'abweichung'
  /**
   * Lauf ist im Mandanten-Protokoll (`agent_runs`) gefunden und die
   * Prüfsumme stimmt, aber der Eintrag steht in keiner Hash-Kette.
   * Ehrliche Zwischenstufe: protokolliert ≠ kettengesichert.
   */
  | 'protokolliert'
  /** Abfrage nicht möglich (kein Mandant, kein Trace, Datenbankfehler). */
  | 'nicht_verfuegbar';

export interface ReaChainCheck {
  hashOk: boolean;
  /** null beim ersten Eintrag eines Ausschnitts. */
  linkOk: boolean | null;
}

export interface ReaReceipt {
  status: ReaStatus;
  traceId: string | null;
  /** Lokal berechneter SHA-256 über den gesendeten `input`. */
  localInputSha256: string;
  inputLength: number;
  checkedAt: string;
  /** Kurzer deutscher Grund für den Status. */
  reason: string;
  eventId?: string;
  eventType?: string;
  createdAt?: string;
  chainIndex?: number;
  eventHashHex?: string;
  serverInputSha256?: string | null;
  inputHashMatches?: boolean;
  chain?: ReaChainCheck;
  verdict?: string;
  residency?: string;
  providerRegion?: string;
  provider?: string | null;
  model?: string | null;
  feature?: string;
  totalTokens?: number;
  latencyMs?: number | null;
}

/** Minimale Abfrageschnittstelle — wird im Browser vom Supabase-Client erfüllt. */
export interface ReaQueryResult<T> {
  data: T | null;
  error: { message: string } | null;
}

export interface ReaEvidenceRow {
  id: string;
  event_type: string;
  created_at: string;
  chain_index: number | null;
  event_hash: string | null;
  evidence: Record<string, unknown> | null;
}

export interface ReaChainRow {
  chain_index: number;
  event_id: string;
  hash_ok: boolean;
  link_ok: boolean | null;
}

export interface ReaDataSource {
  findEvidenceByTrace(tenantId: string, traceId: string): Promise<ReaQueryResult<ReaEvidenceRow[]>>;
  verifyChain(tenantId: string, from: number, to: number): Promise<ReaQueryResult<ReaChainRow[]>>;
}

export interface ReaOptions {
  /** Anzahl Versuche, bis der Eintrag sichtbar ist. */
  attempts?: number;
  /** Pause zwischen Versuchen in ms. */
  delayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => Date;
}

export async function sha256HexOf(input: string): Promise<string> {
  const buf = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  let out = '';
  for (const b of new Uint8Array(buf)) out += b.toString(16).padStart(2, '0');
  return out;
}

/** PostgREST liefert bytea als `\x…`-Hex. */
export function byteaToHex(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  return value.startsWith('\\x') ? value.slice(2) : value;
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Belegt einen KI-Aufruf. Wirft nie — jeder Fehler endet in einem
 * ehrlichen Status.
 */
export async function attestCall(
  source: ReaDataSource,
  args: { tenantId: string | null; traceId: string | null | undefined; input: string },
  options: ReaOptions = {},
): Promise<ReaReceipt> {
  const now = options.now ?? (() => new Date());
  const sleep = options.sleep ?? defaultSleep;
  const attempts = Math.max(1, options.attempts ?? 4);
  const delayMs = options.delayMs ?? 750;

  const localInputSha256 = await sha256HexOf(args.input);
  const base = {
    traceId: args.traceId ?? null,
    localInputSha256,
    inputLength: args.input.length,
  };
  const done = (status: ReaStatus, reason: string, extra: Partial<ReaReceipt> = {}): ReaReceipt => ({
    ...base,
    status,
    reason,
    checkedAt: now().toISOString(),
    ...extra,
  });

  if (!args.tenantId) return done('nicht_verfuegbar', 'Kein verifizierter Mandant.');
  if (!args.traceId) return done('nicht_verfuegbar', 'Gateway lieferte keine Trace-ID.');

  let row: ReaEvidenceRow | undefined;
  for (let i = 0; i < attempts; i++) {
    let res: ReaQueryResult<ReaEvidenceRow[]>;
    try {
      res = await source.findEvidenceByTrace(args.tenantId, args.traceId);
    } catch {
      return done('nicht_verfuegbar', 'Evidence-Abfrage fehlgeschlagen.');
    }
    if (res.error) return done('nicht_verfuegbar', 'Evidence-Abfrage fehlgeschlagen.');
    const rows = res.data ?? [];
    if (rows.length > 1) {
      return done('abweichung', 'Mehrere Einträge zur selben Trace-ID.');
    }
    if (rows.length === 1) {
      row = rows[0];
      break;
    }
    if (i < attempts - 1) await sleep(delayMs);
  }
  if (!row) {
    return done('ausstehend', 'Noch kein Evidence-Eintrag sichtbar. Der Gateway schreibt ihn nachgelagert.');
  }

  const ev = row.evidence ?? {};
  const tokens = (ev.tokens ?? {}) as Record<string, unknown>;
  const serverInputSha256 = str(ev.input_sha256) ?? null;
  const inputHashMatches = serverInputSha256 !== null && serverInputSha256 === localInputSha256;
  const details: Partial<ReaReceipt> = {
    eventId: row.id,
    eventType: row.event_type,
    createdAt: row.created_at,
    chainIndex: row.chain_index ?? undefined,
    eventHashHex: byteaToHex(row.event_hash),
    serverInputSha256,
    inputHashMatches,
    verdict: str(ev.verdict),
    residency: str(ev.residency),
    providerRegion: str(ev.provider_region),
    provider: str(ev.provider) ?? null,
    model: str(ev.model) ?? null,
    feature: str(ev.feature),
    totalTokens: num(tokens.total) ?? num(ev.total_tokens),
    latencyMs: num(ev.latency_ms) ?? null,
  };

  if (!inputHashMatches) {
    return done('abweichung', 'Prüfsumme des Eingabetexts stimmt nicht mit dem Eintrag überein.', details);
  }
  if (row.chain_index == null || !row.event_hash) {
    return done('ausstehend', 'Eintrag gefunden, aber noch nicht in der Hash-Kette verankert.', details);
  }

  // Vorgänger mitprüfen, damit link_ok aussagekräftig ist.
  const from = Math.max(1, row.chain_index - 1);
  let chainRes: ReaQueryResult<ReaChainRow[]>;
  try {
    chainRes = await source.verifyChain(args.tenantId, from, row.chain_index);
  } catch {
    return done('nicht_verfuegbar', 'Kettenprüfung nicht erreichbar.', details);
  }
  if (chainRes.error) return done('nicht_verfuegbar', 'Kettenprüfung nicht erreichbar.', details);
  const own = (chainRes.data ?? []).find((c) => c.chain_index === row!.chain_index);
  if (!own) return done('nicht_verfuegbar', 'Kettenprüfung lieferte den Eintrag nicht.', details);

  // Kettenanfang (chain_index 1): kein Vorgänger, link_ok bleibt null.
  // Sonst muss die Verknüpfung zum Vorgänger ausdrücklich bestätigt sein.
  const isChainStart = from === row.chain_index;
  const chain: ReaChainCheck = {
    hashOk: own.hash_ok === true,
    linkOk: isChainStart ? null : own.link_ok,
  };
  if (!chain.hashOk || chain.linkOk === false) {
    return done('abweichung', 'Hash-Kette am Eintrag weicht ab.', { ...details, chain });
  }
  if (!isChainStart && chain.linkOk !== true) {
    return done('nicht_verfuegbar', 'Verknüpfung zum Vorgänger konnte nicht geprüft werden.', { ...details, chain });
  }
  return done('belegt', 'Eintrag gefunden, Prüfsumme stimmt, Kette intakt.', { ...details, chain });
}

export const REA_STATUS_LABEL: Readonly<Record<ReaStatus, string>> = {
  belegt: 'Belegt',
  protokolliert: 'Protokolliert',
  ausstehend: 'Ausstehend',
  abweichung: 'Abweichung',
  nicht_verfuegbar: 'Nicht verfügbar',
};

// ── Assistent der Shell (`governance-agent`, Tabelle `agent_runs`) ──────────

export interface ReaAgentRunRow {
  id: string;
  created_at: string;
  user_message: string;
  llm_provider: string | null;
  llm_model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  outcome: string;
}

export interface ReaAgentRunSource {
  /** Neueste Läufe einer Sitzung ab `sinceIso` (RLS: nur Mitglieder). */
  findAgentRuns(tenantId: string, sessionId: string, sinceIso: string): Promise<ReaQueryResult<ReaAgentRunRow[]>>;
}

/** `governance-agent` speichert `user_message` auf 4.000 Zeichen gekürzt. */
export const AGENT_RUN_MESSAGE_LIMIT = 4000;

/**
 * Belegt einen Assistenten-Lauf gegen `agent_runs`. Höchster erreichbarer
 * Status ist `protokolliert`: `agent_runs` hat keine Hash-Kette, deshalb
 * gibt es hier nie `belegt`.
 */
export async function attestAgentRun(
  source: ReaAgentRunSource,
  args: { tenantId: string | null; sessionId: string | null | undefined; message: string; sentAt: Date },
  options: ReaOptions = {},
): Promise<ReaReceipt> {
  const now = options.now ?? (() => new Date());
  const sleep = options.sleep ?? defaultSleep;
  const attempts = Math.max(1, options.attempts ?? 4);
  const delayMs = options.delayMs ?? 750;
  const stored = args.message.slice(0, AGENT_RUN_MESSAGE_LIMIT);
  const localInputSha256 = await sha256HexOf(stored);
  const done = (status: ReaStatus, reason: string, extra: Partial<ReaReceipt> = {}): ReaReceipt => ({
    traceId: args.sessionId ?? null,
    localInputSha256,
    inputLength: stored.length,
    status,
    reason,
    checkedAt: now().toISOString(),
    ...extra,
  });

  if (!args.tenantId) return done('nicht_verfuegbar', 'Kein verifizierter Mandant.');
  if (!args.sessionId) return done('nicht_verfuegbar', 'Assistent lieferte keine Sitzungs-ID.');

  // Etwas Spielraum für Uhrabweichung zwischen Browser und Datenbank.
  const sinceIso = new Date(args.sentAt.getTime() - 120_000).toISOString();
  for (let i = 0; i < attempts; i++) {
    let res: ReaQueryResult<ReaAgentRunRow[]>;
    try {
      res = await source.findAgentRuns(args.tenantId, args.sessionId, sinceIso);
    } catch {
      return done('nicht_verfuegbar', 'Protokoll-Abfrage fehlgeschlagen.');
    }
    if (res.error) return done('nicht_verfuegbar', 'Protokoll-Abfrage fehlgeschlagen.');
    const rows = res.data ?? [];
    for (const row of rows) {
      const serverSha = await sha256HexOf(row.user_message ?? '');
      if (serverSha !== localInputSha256) continue;
      const details: Partial<ReaReceipt> = {
        eventId: row.id,
        eventType: 'agent.chat',
        createdAt: row.created_at,
        serverInputSha256: serverSha,
        inputHashMatches: true,
        provider: row.llm_provider,
        model: row.llm_model,
        totalTokens: (row.input_tokens ?? 0) + (row.output_tokens ?? 0),
      };
      return done(
        'protokolliert',
        'Lauf im Mandanten-Protokoll gefunden, Prüfsumme stimmt. Keine Hash-Kette für Assistenten-Läufe.',
        details,
      );
    }
    if (i < attempts - 1) await sleep(delayMs);
  }
  return done('ausstehend', 'Noch kein passender Lauf im Protokoll sichtbar.');
}
