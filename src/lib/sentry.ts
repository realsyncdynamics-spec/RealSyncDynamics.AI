/**
 * Sentry — no-op ohne VITE_SENTRY_DSN.
 * DSN muss ingest.de.sentry.io sein (Sub-Processor EU / Frankfurt).
 */
import * as Sentry from '@sentry/react';
import { browserTracingIntegration } from '@sentry/react';
import { redactAuthInUrl } from './auth-session';

const DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;
const ENV = import.meta.env.MODE;
const SHA = (import.meta.env.VITE_COMMIT_SHA as string | undefined)?.slice(0, 12);
const TRACES = Number.parseFloat(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? '');

function tracesSampleRate(): number {
  if (Number.isFinite(TRACES) && TRACES >= 0 && TRACES <= 1) return TRACES;
  return ENV === 'production' ? 0.08 : 0;
}

/** True only when the DSN host is the EU ingest endpoint (exact or subdomain). */
function isEuSentryDsn(dsn: string): boolean {
  try {
    const host = new URL(dsn).hostname.toLowerCase();
    return host === 'ingest.de.sentry.io' || host.endsWith('.ingest.de.sentry.io');
  } catch {
    return false;
  }
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
  if (!isEuSentryDsn(DSN) && ENV === 'production') {
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
      /^https:\/\/([^/]*\.)?realsyncdynamicsai\.de(?:\/|$)/i,
      /^https:\/\/[a-z0-9-]+\.supabase\.co(?:\/|$)/i,
    ],
    allowUrls: [
      /^https?:\/\/([^/]*\.)?realsyncdynamicsai\.de(?:\/|$)/i,
      /^https?:\/\/localhost(?::\d+)?(?:\/|$)/i,
    ],
    denyUrls: [
      /(?:^|\/)extensions\//i,
      /^chrome:\/\//i,
      /^moz-extension:\/\//i,
      /(?:^|\/)gtag\/js(?:\?|$)/i,
      /^https?:\/\/([^/]*\.)?googletagmanager\.com(?:\/|$)/i,
      /^https?:\/\/([^/]*\.)?connect\.facebook\.net(?:\/|$)/i,
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
      if (event.request?.url) {
        event.request.url = redactAuthInUrl(event.request.url);
      }
      if (event.request?.headers) {
        delete event.request.headers.Authorization;
        delete event.request.headers.authorization;
        delete event.request.headers.Cookie;
        delete event.request.headers.cookie;
      }
      return event;
    },
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.data && typeof breadcrumb.data.url === 'string') {
        breadcrumb.data.url = redactAuthInUrl(breadcrumb.data.url);
      }
      if (typeof breadcrumb.message === 'string') {
        breadcrumb.message = redactAuthInUrl(breadcrumb.message);
      }
      return breadcrumb;
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
