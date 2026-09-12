/**
 * Open-redirect guard for `?next=` resume paths.
 * Only same-origin relative paths starting with `/` (not `//evil`).
 */
export function safeInternalPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const path = raw.trim();
  if (!path.startsWith('/') || path.startsWith('//')) return null;
  return path;
}
