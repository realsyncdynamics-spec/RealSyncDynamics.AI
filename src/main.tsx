import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { validateGeminiConfig } from './lib/gemini.ts';

try {
  // Run runtime validation on application startup
  validateGeminiConfig();

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
} catch (error) {
  // Display the error in the DOM so it doesn't just result in a blank white screen
  document.getElementById('root')!.innerHTML = `
    <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background-color: #fef2f2; padding: 20px; font-family: system-ui, sans-serif;">
      <div style="max-w-md; background: white; padding: 32px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border: 1px solid #f87171;">
        <h2 style="color: #dc2626; margin-top: 0; margin-bottom: 16px; font-size: 20px; font-weight: 600;">Application Startup Error</h2>
        <p style="color: #4b5563; line-height: 1.5; margin-bottom: 0;">
          ${error instanceof Error ? error.message : String(error)}
        </p>
      </div>
    </div>
  `;
  // Still throw the error to satisfy the runtime validation requirement
  throw error;
}
