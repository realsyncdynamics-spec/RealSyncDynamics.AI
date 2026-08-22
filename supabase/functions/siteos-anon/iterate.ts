// siteos-anon/iterate — den Entwurf ändern, ohne ihn neu zu erzeugen.
//
// POST /functions/v1/siteos-anon/iterate
// Auth: keine. Der Zugang ist der Entwurfsschlüssel.
// Body: { draft_key: string, instruction: string }
//
// ── Die eine Regel, an der dieser Endpunkt hängt ────────────────────────
//
// Es wird **nicht neu gebaut**. Weder ganz noch teilweise. Der vorhandene
// Blueprint wird geladen, eine begrenzte Änderung darauf abgebildet, das
// Ergebnis abgelegt.
//
// Der Grund steht ausführlich in `packages/siteos-core/src/blueprint/edit.ts`
// und ist der Kern des Project Claim: Was der Besucher am Ende übernimmt,
// muss die Fassung sein, die er gesehen hat. Ein Neuaufbau an dieser Stelle
// würde den Claim formal bestehen lassen und inhaltlich aushebeln.
//
// Deshalb importiert dieses Modul `parseBrief` und `synthesizeBlueprint`
// **nicht** — dieselbe Trennung wie im Claim-Handler. Was nicht importiert
// ist, kann nicht versehentlich aufgerufen werden.
//
// ── Was hier geprüft wird ────────────────────────────────────────────────
//
// Der Schlüssel ist der einzige Zugangsschutz; er ist unratbar, aber wer ihn
// hat, darf ändern. Alles Weitere ist Zustandsprüfung: übernommen, abgelaufen,
// Fassungsdeckel erreicht, gleichzeitige Änderung.
//
// Die Integrität wird vor der Änderung nachgerechnet. Weicht der Hash des
// geladenen Blueprints von dem ab, der zu ihm gespeichert ist, wird nicht
// geändert. Auf einem Entwurf weiterzuarbeiten, dessen Zustand nicht mehr
// belegbar ist, würde den Schaden in die übernommene Fassung tragen.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { jsonResponse, jsonError } from '../_shared/gateway.ts';
import { reserveAnonAudit, completeAnonAudit, extractPayloadKeys } from '../_shared/anonAudit.ts';
import {
  ANON_ITERATE_BURST,
  ANON_DRAFT_MAX_REVISIONS,
  consumeRateLimit,
  pruneRateWindows,
  type RateWindow,
} from '../_shared/anonRateLimit.ts';
import {
  applyEdit,
  canonicalHash,
  EDIT_CAPABILITIES,
  parseEditIntent,
  renderSite,
  sha256Hex,
  type SiteBlueprint,
} from '../../../packages/siteos-core/src/index.ts';

const BURST = new Map<string, RateWindow>();

const DRAFT_KEY_PATTERN = /^[0-9a-f]{32}$/;
const MAX_INSTRUCTION_LENGTH = 500;

interface DraftRow {
  id: string;
  blueprint: SiteBlueprint;
  content_sha256: string;
  preview_id: string | null;
  revision: number;
  expires_at: string;
  claimed_at: string | null;
}

export async function handleIterate(req: Request): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'invalid json');
  }

  const draftKey = String(body.draft_key ?? '').trim();
  if (!DRAFT_KEY_PATTERN.test(draftKey)) {
    return jsonError(400, 'BAD_REQUEST', 'draft_key required');
  }

  const instruction = String(body.instruction ?? '').trim();
  if (!instruction) return jsonError(400, 'BAD_REQUEST', 'instruction required');
  if (instruction.length > MAX_INSTRUCTION_LENGTH) {
    return jsonError(400, 'BAD_REQUEST', `instruction exceeds ${MAX_INSTRUCTION_LENGTH} characters`);
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const ua = req.headers.get('user-agent') ?? '';
  const ipHash = await sha256Hex(ip);
  const uaHash = ua ? await sha256Hex(ua) : undefined;
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  // Sicherheits-Gate: Ohne Prüfpfad-Eintrag keine Arbeit — dieselbe Regel
  // wie im Bauen.
  try {
    await reserveAnonAudit(admin, {
      request_id: requestId,
      op: 'anon_site_iterate',
      ip_hash: ipHash,
      user_agent_hash: uaHash,
      payload_keys: extractPayloadKeys(body),
    });
  } catch (e) {
    return jsonError(503, 'AUDIT_UNAVAILABLE',
      `anon path refused: audit log not writable (${(e as Error).message})`);
  }

  const done = (outcome: 'success' | 'error' | 'rate_limited', errorCode?: string) =>
    completeAnonAudit(admin, requestId, {
      outcome,
      ...(errorCode ? { error_code: errorCode } : {}),
      duration_ms: Date.now() - startedAt,
    });

  pruneRateWindows(BURST, Date.now());
  if (!consumeRateLimit(BURST, ipHash, Date.now(), ANON_ITERATE_BURST).allowed) {
    await done('rate_limited');
    return jsonError(429, 'RATE_LIMIT', 'Zu viele Änderungen in kurzer Folge. Bitte kurz warten.');
  }

  // ── Entwurf laden ────────────────────────────────────────────────────
  const { data, error } = await admin
    .from('siteos_anonymous_drafts')
    .select('id, blueprint, content_sha256, preview_id, revision, expires_at, claimed_at')
    .eq('draft_key', draftKey)
    .maybeSingle();

  if (error) {
    await done('error', 'DRAFT_READ_FAILED');
    return jsonError(503, 'DRAFT_UNAVAILABLE', 'Der Entwurf konnte nicht geladen werden.');
  }
  if (!data) {
    await done('error', 'DRAFT_NOT_FOUND');
    return jsonError(404, 'DRAFT_NOT_FOUND', 'Dieser Entwurf existiert nicht.');
  }

  const draft = data as unknown as DraftRow;

  if (draft.claimed_at !== null) {
    // Ab der Übernahme ist der Mandant zuständig: Dort gelten RLS, Rollen und
    // Prüfpfad. Weiter über den anonymen Schlüssel zu ändern, hiesse an
    // dieser Zuständigkeit vorbei zu schreiben.
    await done('error', 'ALREADY_CLAIMED');
    return jsonError(409, 'ALREADY_CLAIMED',
      'Dieser Entwurf wurde bereits übernommen und wird im Arbeitsbereich weiterbearbeitet.');
  }
  if (Date.parse(draft.expires_at) <= Date.now()) {
    await done('error', 'DRAFT_EXPIRED');
    return jsonError(410, 'DRAFT_EXPIRED', 'Dieser Entwurf ist abgelaufen.');
  }
  if (draft.revision >= ANON_DRAFT_MAX_REVISIONS) {
    await done('rate_limited');
    return jsonError(429, 'REVISION_LIMIT',
      'Dieser Entwurf hat die maximale Zahl an Fassungen erreicht. Legen Sie ein Konto an, um weiterzuarbeiten.');
  }

  // ── Integrität vor der Änderung ──────────────────────────────────────
  const currentHash = await canonicalHash(draft.blueprint);
  if (currentHash !== draft.content_sha256) {
    await done('error', 'DRAFT_CORRUPT');
    return jsonError(409, 'DRAFT_CORRUPT',
      'Der Entwurf stimmt nicht mehr mit seinem Nachweis überein und wird nicht verändert.');
  }

  // ── Anweisung deuten ─────────────────────────────────────────────────
  const edit = parseEditIntent(instruction);
  if (edit === null) {
    // Kein Fehler des Besuchers, sondern eine Grenze der Runtime — deshalb
    // wird sie benannt, mit allem, was stattdessen geht.
    await done('error', 'INTENT_UNSUPPORTED');
    return jsonError(422, 'INTENT_UNSUPPORTED',
      'Diese Änderung kann die Runtime derzeit nicht ausführen.',
      undefined,
      { capabilities: EDIT_CAPABILITIES });
  }

  const result = applyEdit(draft.blueprint, edit);
  if (!result.changed) {
    const rejection = result.rejection!;
    // „Steht bereits so" ist kein abgelehnter Wunsch, sondern ein erfüllter.
    // Alles andere ist eine Weigerung und bekommt einen eigenen Status.
    if (rejection.code === 'NO_CHANGE') {
      await done('success');
      return jsonResponse({
        ok: true,
        applied: false,
        op: edit.op,
        reason: rejection,
        revision: draft.revision,
        content_sha256: draft.content_sha256,
      });
    }
    await done('error', rejection.code);
    return jsonError(422, rejection.code, rejection.message);
  }

  const nextBlueprint = result.blueprint;
  const nextHash = await canonicalHash(nextBlueprint);
  const nextRevision = draft.revision + 1;
  const instructionHash = await sha256Hex(instruction);

  // ── Kette verankern ──────────────────────────────────────────────────
  //
  // Entwürfe, die vor der Revisionsmigration entstanden sind, haben keine
  // Erstfassung in der Kette. Sie wird hier nachgetragen, damit die Kette
  // nicht mit einem Vorgänger beginnt, den es nirgends gibt.
  if (draft.revision === 0) {
    await admin.from('siteos_anonymous_draft_revisions').upsert(
      { draft_id: draft.id, revision: 0, content_sha256: draft.content_sha256, prev_sha256: null, op: 'create' },
      { onConflict: 'draft_id,revision', ignoreDuplicates: true },
    );
  }

  // ── Die Kette ist die Sperre ─────────────────────────────────────────
  //
  // `UNIQUE (draft_id, revision)` entscheidet, wer bei zwei gleichzeitigen
  // Änderungen gewinnt. Das ist bewusst der Eintrag im Prüfpfad und nicht die
  // Aktualisierung des Entwurfs: Wer die Kette nicht schreiben konnte, hat
  // die Fassung nicht erzeugt — und darf sie deshalb auch nicht ablegen.
  const { error: chainErr } = await admin.from('siteos_anonymous_draft_revisions').insert({
    draft_id: draft.id,
    revision: nextRevision,
    content_sha256: nextHash,
    prev_sha256: currentHash,
    op: edit.op,
    // Nur der Hash der Anweisung, nie ihr Wortlaut (DSGVO Art. 5 Abs. 1 lit. c).
    instruction_sha256: instructionHash,
  });
  if (chainErr) {
    // 23505 = unique_violation: Ein anderer Aufruf war schneller.
    const conflict = chainErr.code === '23505';
    await done('error', conflict ? 'REVISION_CONFLICT' : 'CHAIN_WRITE_FAILED');
    return conflict
      ? jsonError(409, 'REVISION_CONFLICT', 'Der Entwurf wurde gerade an anderer Stelle geändert. Bitte erneut versuchen.')
      : jsonError(503, 'CHAIN_UNAVAILABLE', 'Die Änderung konnte nicht nachgewiesen werden und wurde deshalb nicht ausgeführt.');
  }

  const { data: updated, error: updateErr } = await admin
    .from('siteos_anonymous_drafts')
    .update({ blueprint: nextBlueprint, content_sha256: nextHash, revision: nextRevision })
    .eq('id', draft.id)
    .eq('revision', draft.revision)
    .is('claimed_at', null)
    .select('id');

  if (updateErr || (updated?.length ?? 0) === 0) {
    // Die Kette steht, der Entwurf nicht. Das ist kein stiller Zustand: Der
    // Aufrufer bekommt einen Fehler, und die Kettenzeile bleibt als Spur,
    // dass hier etwas begonnen und nicht abgeschlossen wurde.
    await done('error', 'DRAFT_WRITE_FAILED');
    return jsonError(409, 'REVISION_CONFLICT',
      'Der Entwurf wurde gerade an anderer Stelle geändert. Bitte erneut versuchen.');
  }

  // ── Vorschau aktualisieren ───────────────────────────────────────────
  //
  // Unter **derselben** Kennung wie bisher. Eine neue Vorschau-Adresse bei
  // jeder Änderung würde jeden geteilten Link brechen — und dem Besucher
  // suggerieren, es sei etwas Neues entstanden.
  //
  // Wie beim Bauen nicht zwingend: Scheitert das Ablegen, bleibt die Änderung
  // gültig. Der Aufrufer erfährt es über `preview_url: null`.
  let previewUrl: string | null = null;
  const previewOrigin = Deno.env.get('SITEOS_PREVIEW_ORIGIN');
  const previewToken = Deno.env.get('PREVIEW_WRITE_TOKEN');
  if (draft.preview_id && previewOrigin && previewToken) {
    previewUrl = await pushPreview(nextBlueprint, draft.preview_id, previewOrigin, previewToken);
  }

  await done('success');

  return jsonResponse({
    ok: true,
    applied: true,
    op: edit.op,
    revision: nextRevision,
    content_sha256: nextHash,
    prev_sha256: currentHash,
    preview_id: draft.preview_id,
    preview_url: previewUrl,
    blueprint: nextBlueprint,
  });
}

/** Legt die gerenderte Startseite unter der bestehenden Kennung ab. */
async function pushPreview(
  blueprint: SiteBlueprint,
  previewId: string,
  origin: string,
  token: string,
): Promise<string | null> {
  const base = origin.replace(/\/$/, '');
  try {
    const pages = renderSite(blueprint, {});
    const html = pages.find((p) => p.path === '/')?.html ?? pages[0]?.html ?? '';
    const res = await fetch(`${base}/p/${previewId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ html, isolation: 'static' }),
    });
    if (res.ok) return `${base}/p/${previewId}`;
    console.error('preview put failed:', res.status);
  } catch (e) {
    console.error('preview put threw:', (e as Error).message);
  }
  return null;
}
