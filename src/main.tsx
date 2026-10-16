import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';
import './styles/brand-v4-tokens.css';
import './styles/command-center.css';
import './styles/enterprise-hero.css';
import { initSentry } from './lib/sentry.ts';
import { captureAffiliateRef } from './lib/affiliate.ts';
import { initPerformanceMonitoring } from './lib/performance/index.ts';
import { ensureCsrfCookie } from './lib/csrf.ts';

// Initialize Sentry (no-op if VITE_SENTRY_DSN missing).
initSentry();

// Initialize performance monitoring (Web Vitals, resource tracking).
initPerformanceMonitoring();

// Capture ?ref=<code> for affiliate tracking (90-day localStorage TTL).
captureAffiliateRef();

// CSRF-Cookie für same-origin mutierende Requests. 404 im Vite-Dev ist ok.
void ensureCsrfCookie();


createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
