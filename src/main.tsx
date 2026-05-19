import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './styles/runtime-theme.css';
import { validateGeminiConfig } from './lib/gemini.ts';
import { initSentry } from './lib/sentry.ts';
import { captureAffiliateRef } from './lib/affiliate.ts';

// Initialize Sentry (no-op if VITE_SENTRY_DSN missing).
initSentry();

// Capture ?ref=<code> for affiliate tracking (90-day localStorage TTL).
captureAffiliateRef();

// Soft probe — logs a warning if Gemini is unset but never blocks render.
// Hard validation moves to call sites that actually use the Gemini SDK.
validateGeminiConfig();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
