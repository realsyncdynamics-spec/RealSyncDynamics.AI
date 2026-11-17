// Media Studio — Katalog (eine Quelle für Edge Function und Browser-UI).
//
// Deno- und Node-frei: keine Imports, nur Daten und reine Funktionen. Der
// Browser importiert diese Datei direkt (Präzedenz: decision-proposal.ts).
//
// Herkunft der Anbieterangaben (Stand 17.11.2026, gelesen in den Anbieter-Docs):
//  - Google Gemini API (AI Studio), Interactions API:
//    POST https://generativelanguage.googleapis.com/v1beta/interactions
//    Bild: Modell `gemini-nano-banana-2.1`, response_format.type = image.
//    Video: Modell `gemini-omni-1.2-flash`, response_format.type = video,
//    3–15 s, 16:9 oder 9:16. Veo-3.1-Preview ist in der Gemini API abgeschaltet.
//  - Higgsfield API: https://api.higgsfield.ai, Header `Authorization: Key id:secret`,
//    POST /<model-path> → request_id + status_url, Status
//    queued|in_progress|completed|failed|nsfw|canceled, Ergebnis images[].url / video.url.
// Modell-IDs ändern sich schnell. Deshalb sind sie in der Edge Function per Env
// überschreibbar; die Werte hier sind nur Defaults.

export type MediaKind = 'image' | 'video';
export type MediaProviderId = 'google' | 'higgsfield';
export type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4';

export interface CameraPreset {
  id: string;
  label: string;
  /** Regieanweisung, die an den Prompt angehängt wird (anbieterneutral). */
  directive: string;
}

/**
 * Kamerabewegungen als Prompt-Regie. Keiner der Anbieter dokumentiert einen
 * belastbaren API-Parameter dafür; beide verarbeiten Bewegung im Prompt.
 */
export const CAMERA_PRESETS: readonly CameraPreset[] = [
  { id: 'static', label: 'Statisch', directive: 'Locked-off static camera, no camera movement.' },
  { id: 'dolly_in', label: 'Dolly-In', directive: 'Slow dolly-in towards the subject.' },
  { id: 'dolly_out', label: 'Dolly-Out', directive: 'Slow dolly-out revealing the surroundings.' },
  { id: 'orbit', label: 'Orbit', directive: 'Smooth 90-degree orbit around the subject.' },
  { id: 'crane_up', label: 'Kran hoch', directive: 'Crane shot rising upwards over the scene.' },
  { id: 'pan_right', label: 'Schwenk rechts', directive: 'Slow pan from left to right.' },
  { id: 'handheld', label: 'Handkamera', directive: 'Subtle handheld documentary camera, natural shake.' },
  { id: 'fpv', label: 'FPV-Flug', directive: 'Fast FPV drone fly-through, dynamic but stable.' },
  { id: 'macro', label: 'Makro', directive: 'Macro close-up with shallow depth of field and slow focus pull.' },
] as const;

export interface MediaModel {
  provider: MediaProviderId;
  kind: MediaKind;
  /** Default-ID; Edge Function darf per Env überschreiben. */
  defaultModelId: string;
  label: string;
  aspectRatios: readonly AspectRatio[];
  /** Video: zulässige Dauer in Sekunden. */
  durationS?: { min: number; max: number; default: number };
  /** Akzeptiert ein Referenzbild (Bild-zu-Video / Bild-Bearbeitung). */
  acceptsReference: 'none' | 'inline' | 'url';
  /** Ergebnis kommt synchron oder als Auftrag mit Statusabfrage. */
  delivery: 'sync' | 'async';
  /** Env-Name, der die Modell-ID überschreibt. */
  envModel: string;
}

export const MEDIA_MODELS: readonly MediaModel[] = [
  {
    provider: 'google',
    kind: 'image',
    defaultModelId: 'gemini-nano-banana-2.1',
    label: 'Google Gemini Bild',
    aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4'],
    acceptsReference: 'inline',
    delivery: 'sync',
    envModel: 'MEDIA_GOOGLE_IMAGE_MODEL',
  },
  {
    provider: 'google',
    kind: 'video',
    defaultModelId: 'gemini-omni-1.2-flash',
    label: 'Google Gemini Omni Video',
    aspectRatios: ['16:9', '9:16'],
    durationS: { min: 3, max: 15, default: 8 },
    acceptsReference: 'inline',
    delivery: 'sync',
    envModel: 'MEDIA_GOOGLE_VIDEO_MODEL',
  },
  {
    provider: 'higgsfield',
    kind: 'image',
    defaultModelId: 'higgsfield-ai/soul/v2/standard',
    label: 'Higgsfield Soul Bild',
    aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4'],
    acceptsReference: 'none',
    delivery: 'async',
    envModel: 'MEDIA_HIGGSFIELD_IMAGE_MODEL',
  },
  {
    provider: 'higgsfield',
    kind: 'video',
    // Kein belegter Default-Pfad in den Docs → nur nutzbar, wenn per Env gesetzt.
    defaultModelId: '',
    label: 'Higgsfield Video',
    aspectRatios: ['16:9', '9:16', '1:1'],
    durationS: { min: 3, max: 10, default: 5 },
    acceptsReference: 'url',
    delivery: 'async',
    envModel: 'MEDIA_HIGGSFIELD_VIDEO_MODEL',
  },
] as const;

export const PROMPT_MAX_CHARS = 2_000;
export const NEGATIVE_PROMPT_MAX_CHARS = 500;
/** Referenzbild inline (Base64-Zeichen). ~6 MB Binär. */
export const REFERENCE_MAX_BASE64_CHARS = 8_000_000;

export const MEDIA_FEATURE = 'media_studio';

/** Rate-Limits je Nutzer und Mandant, getrennt nach Medienart. */
export const MEDIA_LIMITS: Record<MediaKind, { perMinute: number; perHour: number }> = {
  image: { perMinute: 6, perHour: 60 },
  video: { perMinute: 2, perHour: 10 },
};

export function findModel(provider: MediaProviderId, kind: MediaKind): MediaModel | undefined {
  return MEDIA_MODELS.find((m) => m.provider === provider && m.kind === kind);
}

export function cameraPreset(id: string | null | undefined): CameraPreset | undefined {
  if (!id) return undefined;
  return CAMERA_PRESETS.find((p) => p.id === id);
}

/** Endgültiger Prompt an den Anbieter: Nutzertext + Kamera-Regie. */
export function composeProviderPrompt(prompt: string, cameraId?: string | null): string {
  const cam = cameraPreset(cameraId);
  const base = prompt.trim();
  return cam ? `${base}\n\nCamera: ${cam.directive}` : base;
}
