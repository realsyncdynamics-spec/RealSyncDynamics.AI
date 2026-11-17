// Media Studio — Eingabeprüfung (rein, testbar).
//
// Mandant, Rechte, Residency und Kill-Switch kommen NIE aus diesem Body;
// hier wird nur die fachliche Generierungsanfrage geprüft.

import {
  type AspectRatio,
  CAMERA_PRESETS,
  findModel,
  type MediaKind,
  type MediaModel,
  type MediaProviderId,
  NEGATIVE_PROMPT_MAX_CHARS,
  PROMPT_MAX_CHARS,
} from './catalog.ts';

/** Verweis auf ein früheres Ergebnis desselben Mandanten (serverseitig aufgelöst). */
export interface ReferenceInput {
  job_id: string;
  index: number;
}

export interface GenerateInput {
  kind: MediaKind;
  provider: MediaProviderId;
  prompt: string;
  negative_prompt?: string;
  aspect_ratio: AspectRatio;
  duration_s?: number;
  resolution?: '720p' | '1080p';
  camera?: string;
  reference?: ReferenceInput;
  /** Idempotenz je Mandant: derselbe Schlüssel reserviert und generiert nie zweimal. */
  idempotency_key: string;
  /** Client-Korrelation für den Prüfpfad (z. B. Plan-Schritt). */
  client_ref?: string;
}

export type ValidationResult =
  | { ok: true; value: GenerateInput; model: MediaModel }
  | { ok: false; code: string; message: string };

const KINDS: readonly MediaKind[] = ['image', 'video'];
const PROVIDERS: readonly MediaProviderId[] = ['google', 'higgsfield'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDEMPOTENCY_RE = /^[A-Za-z0-9:_-]{8,120}$/;

function fail(code: string, message: string): ValidationResult {
  return { ok: false, code, message };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function validateGenerateInput(raw: unknown): ValidationResult {
  if (!isRecord(raw)) return fail('BAD_REQUEST', 'Body fehlt.');

  const kind = raw.kind as MediaKind;
  if (!KINDS.includes(kind)) return fail('BAD_REQUEST', 'kind muss image oder video sein.');

  const provider = raw.provider as MediaProviderId;
  if (!PROVIDERS.includes(provider)) return fail('BAD_REQUEST', 'Unbekannter Anbieter.');

  const model = findModel(provider, kind);
  if (!model) return fail('BAD_REQUEST', 'Anbieter unterstützt diese Medienart nicht.');

  const prompt = typeof raw.prompt === 'string' ? raw.prompt.trim() : '';
  if (prompt.length < 3) return fail('BAD_REQUEST', 'Prompt ist zu kurz.');
  if (prompt.length > PROMPT_MAX_CHARS) return fail('BAD_REQUEST', `Prompt ist länger als ${PROMPT_MAX_CHARS} Zeichen.`);

  let negative: string | undefined;
  if (raw.negative_prompt !== undefined && raw.negative_prompt !== null && raw.negative_prompt !== '') {
    if (typeof raw.negative_prompt !== 'string' || raw.negative_prompt.length > NEGATIVE_PROMPT_MAX_CHARS) {
      return fail('BAD_REQUEST', 'negative_prompt ist ungültig.');
    }
    negative = raw.negative_prompt.trim();
  }

  const aspect = raw.aspect_ratio as AspectRatio;
  if (!model.aspectRatios.includes(aspect)) {
    return fail('BAD_REQUEST', `Seitenverhältnis ${String(aspect)} wird von ${model.label} nicht unterstützt.`);
  }

  let duration: number | undefined;
  if (kind === 'video') {
    const range = model.durationS!;
    duration = raw.duration_s === undefined ? range.default : Number(raw.duration_s);
    if (!Number.isInteger(duration) || duration < range.min || duration > range.max) {
      return fail('BAD_REQUEST', `Dauer muss zwischen ${range.min} und ${range.max} Sekunden liegen.`);
    }
  } else if (raw.duration_s !== undefined) {
    return fail('BAD_REQUEST', 'duration_s gilt nur für Video.');
  }

  let resolution: GenerateInput['resolution'];
  if (raw.resolution !== undefined) {
    if (kind !== 'video' || (raw.resolution !== '720p' && raw.resolution !== '1080p')) {
      return fail('BAD_REQUEST', 'resolution ist ungültig.');
    }
    resolution = raw.resolution;
  }

  let camera: string | undefined;
  if (raw.camera !== undefined && raw.camera !== null && raw.camera !== '') {
    if (kind !== 'video') return fail('BAD_REQUEST', 'Kamerabewegung gilt nur für Video.');
    if (!CAMERA_PRESETS.some((p) => p.id === raw.camera)) return fail('BAD_REQUEST', 'Unbekannte Kamerabewegung.');
    camera = raw.camera as string;
  }

  let reference: ReferenceInput | undefined;
  if (raw.reference !== undefined && raw.reference !== null) {
    if (!isRecord(raw.reference)) return fail('BAD_REQUEST', 'reference ist ungültig.');
    if (model.acceptsReference === 'none') {
      return fail('BAD_REQUEST', `${model.label} nimmt kein Referenzbild an.`);
    }
    const r = raw.reference;
    const index = Number(r.index ?? 0);
    if (typeof r.job_id !== 'string' || !UUID_RE.test(r.job_id) || !Number.isInteger(index) || index < 0 || index > 3) {
      return fail('BAD_REQUEST', 'Referenz muss auf ein Ergebnis aus diesem Studio zeigen.');
    }
    reference = { job_id: r.job_id, index };
  }

  if (typeof raw.idempotency_key !== 'string' || !IDEMPOTENCY_RE.test(raw.idempotency_key)) {
    return fail('BAD_REQUEST', 'idempotency_key fehlt oder ist ungültig.');
  }

  const clientRef = typeof raw.client_ref === 'string' ? raw.client_ref.slice(0, 80) : undefined;

  return {
    ok: true,
    model,
    value: {
      kind,
      provider,
      prompt,
      negative_prompt: negative,
      aspect_ratio: aspect,
      duration_s: duration,
      resolution,
      camera,
      reference,
      idempotency_key: raw.idempotency_key,
      client_ref: clientRef,
    },
  };
}
