import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { validateGeminiConfig } from './lib/gemini.ts';
import { initSentry } from './lib/sentry.ts';

// Initialize Sentry (no-op if VITE_SENTRY_DSN missing).
initSentry();

// Soft probe — logs a warning if Gemini is unset but never blocks render.
// Hard validation moves to call sites that actually use the Gemini SDK.
validateGeminiConfig();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
