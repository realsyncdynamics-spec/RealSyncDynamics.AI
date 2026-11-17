// Media Studio — Medien-Bytes prüfen (rein, testbar).
//
// Der Dateityp wird an den ersten Bytes erkannt, nie aus Anbieter-Headern
// übernommen (Muster aus PR #2271, creativeXaiImageProvider.ts).

import { MEDIA_MAX_BYTES } from './catalog.ts';

export type StoredMime = 'image/png' | 'image/jpeg' | 'image/webp' | 'video/mp4';

export const EXT: Record<StoredMime, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
};

export function sniffMime(bytes: Uint8Array): StoredMime | null {
  if (bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => bytes[i] === n)) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (bytes.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  if (bytes.length >= 12 && ascii(4, 8) === 'ftyp') return 'video/mp4';
  return null;
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(bin);
}

export type MediaRejectedCode = 'TOO_LARGE' | 'UNSUPPORTED_TYPE' | 'KIND_MISMATCH' | 'EMPTY';

export class MediaRejectedError extends Error {
  readonly code: MediaRejectedCode;
  constructor(code: MediaRejectedCode) {
    super(code);
    this.code = code;
    this.name = 'MediaRejectedError';
  }
}

/** Prüft Größe, Typ und Medienart; liefert Pfad-Endung und MIME für die Ablage. */
export function checkMedia(bytes: Uint8Array, kind: 'image' | 'video'): { mime: StoredMime; ext: string } {
  if (bytes.length === 0) throw new MediaRejectedError('EMPTY');
  if (bytes.length > MEDIA_MAX_BYTES) throw new MediaRejectedError('TOO_LARGE');
  const mime = sniffMime(bytes);
  if (!mime) throw new MediaRejectedError('UNSUPPORTED_TYPE');
  if ((kind === 'video') !== (mime === 'video/mp4')) throw new MediaRejectedError('KIND_MISMATCH');
  return { mime, ext: EXT[mime] };
}

/** Ablagepfad: <tenant_id>/<job_id>/<index>.<ext> — Mandant immer erstes Segment. */
export function assetPath(tenantId: string, jobId: string, index: number, ext: string): string {
  return `${tenantId}/${jobId}/${index}.${ext}`;
}
