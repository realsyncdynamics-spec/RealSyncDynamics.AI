/**
 * Sentry — no-op ohne VITE_SENTRY_DSN.
 * DSN muss ingest.de.sentry.io sein (Sub-Processor EU / Frankfurt).
 */
import * as Sentry from '@sentry/react';
import { browserTracingIntegration } from '@sentry/react';

const DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;
const ENV = import.meta.env.MODE;
const SHA = (import.meta.env.VITE_COMMIT_SHA as string | undefined)?.slice(0, 12);
const TRACES = Number.parseFloat(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? '');

function tracesSampleRate(): number {
  if (Number.isFinite(TRACES) && TRACES >= 0 && TRACES <= 1) return TRACES;
  return ENV === 'production' ? 0.08 : 0;
}

function stripUrl(raw?: string): string | undefined {
  if (!raw) return raw;
  try {
    const u = new URL(raw);
    u.search = '';
    u.hash = '';
    return u.toString();
  } catch {
    return raw.split('?')[0];
  }
}

export function initSentry(): void {
  if (!DSN || !DSN.startsWith('https://')) return;
  if (!DSN.includes('ingest.de.sentry.io') && ENV === 'production') {
    console.warn('[sentry] DSN is not ingest.de.sentry.io — skip init in production');
    return;
  }

  Sentry.init({
    dsn: DSN,
    environment: ENV,
    release: SHA ? `realsync-web@${SHA}` : undefined,
    sendDefaultPii: false,
    tracesSampleRate: tracesSampleRate(),
    profilesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    integrations: [browserTracingIntegration({ enableInp: true })],
    tracePropagationTargets: [
      'localhost',
      /^https:\/\/realsyncdynamicsai\.de/i,
      /^https:\/\/[a-z0-9-]+\.supabase\.co/i,
    ],
    allowUrls: [/realsyncdynamicsai\.de/i, /localhost/i],
    denyUrls: [
      /extensions\//i,
      /^chrome:\/\//i,
      /^moz-extension:\/\//i,
      /gtag\/js/i,
      /googletagmanager/i,
      /connect\.facebook\.net/i,
    ],
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'Non-Error promise rejection captured',
      'NetworkError when attempting to fetch',
      'Load failed',
      'ChunkLoadError',
      'Failed to fetch dynamically imported module',
      'Importing a module script failed',
    ],
    beforeSend(event) {
      if (event.user) event.user = {};
      if (event.request) {
        delete event.request.cookies;
        delete event.request.headers;
        if (event.request.url) event.request.url = stripUrl(event.request.url);
        if (event.request.query_string) event.request.query_string = '';
      }
      if (event.exception?.values) {
        for (const v of event.exception.values) {
          if (v.value) v.value = v.value.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]');
        }
      }
      return event;
    },
    initialScope: {
      tags: {
        app: 'realsync-web',
        region: 'eu',
      },
    },
  });
}

export function sentryEnabled(): boolean {
  return Boolean(DSN && DSN.startsWith('https://'));
}
