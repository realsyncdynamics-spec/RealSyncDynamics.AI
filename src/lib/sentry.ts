/**
 * Sentry initialization — runs only when VITE_SENTRY_DSN is set.
 *
 * To activate:
 *   1. Create a Sentry project (free tier: 5k errors/month)
 *   2. Copy the DSN
 *   3. Set VITE_SENTRY_DSN in GitHub Actions repo secrets
 *   4. Re-run deploy-pages workflow
 *
 * No-op when DSN is missing — safe to keep imported in main.tsx.
 *
 * Privacy notes (DSGVO):
 *   - We mask all text content (PII protection) by default
 *   - IP addresses are NOT collected (sendDefaultPii: false)
 *   - Replays disabled until we have explicit user consent toggle
 */
import * as Sentry from '@sentry/react';

const DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;
const ENV = import.meta.env.MODE; // 'production' | 'development'

export function initSentry(): void {
  if (!DSN || !DSN.startsWith('https://')) return;

  Sentry.init({
    dsn: DSN,
    environment: ENV,
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    ignoreErrors: [
      // Browser-noise we don't care about
      'ResizeObserver loop limit exceeded',
      'Non-Error promise rejection captured',
      'NetworkError when attempting to fetch',
    ],
    beforeSend(event) {
      // Strip user email + IP from any error context
      if (event.user) {
        event.user = { id: event.user.id };
      }
      return event;
    },
  });
}
