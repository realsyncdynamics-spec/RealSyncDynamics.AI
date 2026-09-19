export interface RecoveryCodeRow {
  id: string;
  user_id: string;
  code_hash: string;
  used_at: string | null;
}

export function normalizeRecoveryCode(code: string): string {
  return code.replace(/[\s-]+/g, '').toUpperCase();
}

export async function sha256HexRecoveryCode(code: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalizeRecoveryCode(code)));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function findConsumableRecoveryCode(
  rows: RecoveryCodeRow[],
  userId: string,
  codeHash: string,
): RecoveryCodeRow | null {
  return rows.find((row) => row.user_id === userId && row.code_hash === codeHash && row.used_at === null) ?? null;
}
