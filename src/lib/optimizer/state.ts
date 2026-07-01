/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Flow-State für den Cloud Code Optimizer.
 *
 * Zustand wird bewusst NICHT im DOM/Router gehalten, sondern in
 * `sessionStorage` — so übersteht der Flow einen Reload und jede Seite
 * ist per URL direkt erreichbar (deep-linkbar), ohne dass Ergebnisse
 * verloren gehen. Die Ziel-URL wird zwischen SEITE 2 → 3 übergeben, das
 * Scan-Ergebnis zwischen SEITE 3 → 4.
 */

import type { OptimizerScanResult } from './types';

const URL_KEY = 'rsd.optimizer.targetUrl';
const RESULT_KEY = 'rsd.optimizer.scanResult';
const PENDING_EMAIL_KEY = 'rsd.optimizer.pendingEmail';

function safeSession(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    // sessionStorage kann in strengen Privacy-Modi werfen.
    return null;
  }
}

/** Normalisiert eine Nutzereingabe zu einer absoluten https-URL. */
export function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/** Extrahiert den Host für die Anzeige ("https://x.de/y" → "x.de"). */
export function domainFromUrl(url: string): string {
  try {
    return new URL(normalizeUrl(url)).host;
  } catch {
    return url.replace(/^https?:\/\//i, '').split('/')[0] ?? url;
  }
}

export function setTargetUrl(url: string): void {
  safeSession()?.setItem(URL_KEY, url);
}

export function getTargetUrl(): string | null {
  return safeSession()?.getItem(URL_KEY) ?? null;
}

export function setScanResult(result: OptimizerScanResult): void {
  safeSession()?.setItem(RESULT_KEY, JSON.stringify(result));
}

export function getScanResult(): OptimizerScanResult | null {
  const raw = safeSession()?.getItem(RESULT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as OptimizerScanResult;
  } catch {
    return null;
  }
}

/** E-Mail, die gerade registriert wird (für „Bestätigung erneut senden"). */
export function setPendingEmail(email: string): void {
  safeSession()?.setItem(PENDING_EMAIL_KEY, email);
}

export function getPendingEmail(): string | null {
  return safeSession()?.getItem(PENDING_EMAIL_KEY) ?? null;
}

/** Räumt Flow-State auf (z. B. bei „Neuer Scan"). */
export function clearOptimizerState(): void {
  const s = safeSession();
  s?.removeItem(URL_KEY);
  s?.removeItem(RESULT_KEY);
}
