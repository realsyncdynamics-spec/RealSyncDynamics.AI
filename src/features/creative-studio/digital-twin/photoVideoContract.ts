/** Local-only preview contract; no network, recognition, cloning, rendering or billing. */
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const MAX_SCRIPT_LENGTH = 1000;
export type TwinFormat = '9:16' | '16:9' | '1:1';

export function validatePhoto(file: Pick<File, 'type' | 'size'> | null): string | null {
  if (!file) return 'Bitte ein Porträtfoto auswählen.';
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return 'Erlaubt sind JPG, PNG und WEBP.';
  if (file.size < 1 || file.size > MAX_PHOTO_BYTES) return 'Das Foto darf maximal 10 MB groß sein.';
  return null;
}

export function validateScript(value: string): string | null {
  if (!value.trim()) return 'Bitte Sprechtext eingeben.';
  if (value.length > MAX_SCRIPT_LENGTH) return 'Maximal 1000 Zeichen.';
  return null;
}

export function canPreview(
  file: Pick<File, 'type' | 'size'> | null,
  script: string,
  consent: boolean,
  tenantId: string | null,
): boolean {
  return Boolean(tenantId && consent && !validatePhoto(file) && !validateScript(script));
}
