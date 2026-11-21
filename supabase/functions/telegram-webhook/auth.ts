/**
 * Telegram's secret_token must be configured and must match on every update.
 * A missing or invalid configuration is never a bypass. Deno-independent to
 * allow the exact production check to be covered by Vitest.
 */
import { timingSafeEqual } from '../_shared/timingSafeEqual.ts';

const VALID_TELEGRAM_SECRET = /^[A-Za-z0-9_-]{1,256}$/;

/** No side effects. An empty/malformed configuration is always denied. */
export function telegramWebhookAuthorized(
  expectedSecret: string | null | undefined,
  presentedSecret: string | null | undefined,
): boolean {
  if (!expectedSecret || !VALID_TELEGRAM_SECRET.test(expectedSecret)) return false;
  if (!presentedSecret || !VALID_TELEGRAM_SECRET.test(presentedSecret)) return false;
  return timingSafeEqual(presentedSecret, expectedSecret);
}
