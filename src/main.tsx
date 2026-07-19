import {StrictMode} from 'react';
// @ts-expect-error - react-dom/client types not available in this environment
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';
import { validateGeminiConfig } from './lib/gemini.ts';
import { initSentry } from './lib/sentry.ts';
import { captureAffiliateRef } from './lib/affiliate.ts';
import { initPerformanceMonitoring } from './lib/performance/index.ts';

// Initialize Sentry (no-op if VITE_SENTRY_DSN missing).
initSentry();

// Initialize performance monitoring (Web Vitals, resource tracking).
initPerformanceMonitoring();

// Capture ?ref=<code> for affiliate tracking (90-day localStorage TTL).
captureAffiliateRef();

// Soft probe — logs a warning if Gemini is unset but never blocks render.
// Hard validation moves to call sites that actually use the Gemini SDK.
validateGeminiConfig();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
