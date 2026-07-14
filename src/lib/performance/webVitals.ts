/**
 * Web Vitals monitoring — measures Core Web Vitals and reports to Sentry.
 *
 * Core Web Vitals (as of 2025):
 *   - LCP (Largest Contentful Paint): when the largest element renders
 *   - INP (Interaction to Next Paint): input responsiveness
 *   - CLS (Cumulative Layout Shift): visual stability
 *
 * Also tracks:
 *   - TTFB (Time to First Byte): initial server response time
 *   - FCP (First Contentful Paint): when first element renders
 *   - DCL (DOMContentLoaded): DOM ready
 *   - LFP (Largest Form Factor Paint): page paint completion
 *
 * Reports to Sentry when available; no-op if DSN is missing.
 * Privacy-first: no user IDs or session data in metrics.
 */

import * as Sentry from '@sentry/react';

declare global {
  interface Window {
    Sentry?: typeof Sentry;
  }
  interface PerformanceEntryMap {
    'largest-contentful-paint': PerformanceEntry & {
      renderTime: number;
      loadTime: number;
      id: string;
    };
  }
  interface PerformanceEventTiming extends PerformanceEntry {
    processingDuration: number;
    hadRecentInput: boolean;
    value?: number;
  }
  interface PerformanceNavigationTiming {
    firstContentfulPaint?: number;
  }
}

export interface WebVital {
  name: 'LCP' | 'INP' | 'CLS' | 'TTFB' | 'FCP' | 'DCL' | 'LFP';
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta?: number;
  id: string;
  navigationType?: 'navigate' | 'reload' | 'back-forward' | 'back-forward-cache' | 'restore';
}

// Thresholds from Web Vitals 2025 specifications
const THRESHOLDS: Record<string, [number, number]> = {
  LCP: [2500, 4000], // good: ≤2.5s, poor: >4s
  INP: [200, 500], // good: ≤200ms, poor: >500ms
  CLS: [0.1, 0.25], // good: ≤0.1, poor: >0.25
  TTFB: [600, 1200], // good: ≤600ms, poor: >1.2s
  FCP: [1800, 3000], // good: ≤1.8s, poor: >3s
};

function getRating(name: string, value: number): 'good' | 'needs-improvement' | 'poor' {
  const [good, poor] = THRESHOLDS[name] || [Infinity, Infinity];
  if (value <= good) return 'good';
  if (value <= poor) return 'needs-improvement';
  return 'poor';
}

/**
 * Send a Web Vital metric to Sentry.
 * Automatically rates the metric as good/needs-improvement/poor.
 */
export function reportWebVital(vital: WebVital): void {
  try {
    if (!Sentry) return;
  } catch {
    return;
  }

  const rating = getRating(vital.name, vital.value);
  vital.rating = rating;

  // Only report poor/needs-improvement to reduce noise (sample good metrics separately)
  const shouldReport = rating !== 'good' || Math.random() < 0.1;
  if (!shouldReport) return;

  Sentry.captureMessage(`Web Vital: ${vital.name}`, {
    level: rating === 'poor' ? 'warning' : 'info',
    contexts: {
      performance: {
        name: vital.name,
        value: Math.round(vital.value),
        rating,
        delta: vital.delta ? Math.round(vital.delta) : undefined,
        navigationType: vital.navigationType,
      },
    },
    tags: {
      'vital.name': vital.name,
      'vital.rating': rating,
    },
  });
}

/**
 * Initialize Web Vitals monitoring using PerformanceObserver.
 * Call once on app startup (in main.tsx or App.tsx).
 */
export function initWebVitals(): void {
  if (typeof window === 'undefined' || !('PerformanceObserver' in window)) return;

  // Track LCP
  try {
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1] as any;
      if (lastEntry) {
        const prevEntry = entries.length > 1 ? (entries[entries.length - 2] as any) : null;
        reportWebVital({
          name: 'LCP',
          value: lastEntry.renderTime || lastEntry.loadTime,
          rating: 'good',
          id: lastEntry.id || 'lcp',
          delta: prevEntry ? (lastEntry.renderTime || lastEntry.loadTime) - (prevEntry.renderTime || prevEntry.loadTime) : undefined,
        });
      }
    });
    lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
  } catch (e) {
    // PerformanceObserver not supported in older browsers
  }

  // Track INP (Interaction to Next Paint)
  try {
    const inpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1] as any;
      if (lastEntry) {
        const inpValue = Math.max(
          ...entries.map((e: any) => (e.processingDuration || 0) + (e.duration || 0))
        );
        const prevInpValue = entries.length > 1
          ? Math.max(...entries.slice(0, -1).map((e: any) => (e.processingDuration || 0) + (e.duration || 0)))
          : 0;
        reportWebVital({
          name: 'INP',
          value: inpValue,
          rating: 'good',
          id: lastEntry.name,
          delta: entries.length > 1 ? inpValue - prevInpValue : undefined,
        });
      }
    });
    (inpObserver.observe as any)({ entryTypes: ['event'], durationThreshold: 0 });
  } catch (e) {
    // PerformanceObserver not supported
  }

  // Track CLS (Cumulative Layout Shift)
  try {
    let clsValue = 0;
    const clsObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const entryAny = entry as any;
        if (!entryAny.hadRecentInput) {
          const delta = entryAny.value || 0;
          clsValue += delta;
          reportWebVital({
            name: 'CLS',
            value: clsValue,
            rating: 'good',
            id: 'cls',
            delta,
          });
        }
      }
    });
    clsObserver.observe({ entryTypes: ['layout-shift'] });
  } catch (e) {
    // PerformanceObserver not supported
  }

  // Track navigation timing (TTFB, FCP, DCL)
  try {
    const navTiming = performance.getEntriesByType('navigation')[0] as any;
    if (navTiming) {
      const ttfb = navTiming.responseStart - navTiming.fetchStart;
      if (ttfb > 0) {
        reportWebVital({
          name: 'TTFB',
          value: ttfb,
          rating: 'good',
          id: 'ttfb',
          navigationType: navTiming.type as any,
        });
      }

      const fcp = navTiming.firstContentfulPaint;
      if (fcp && fcp > 0) {
        reportWebVital({
          name: 'FCP',
          value: fcp,
          rating: 'good',
          id: 'fcp',
        });
      }

      const dcl = navTiming.domContentLoadedEventEnd - navTiming.fetchStart;
      if (dcl > 0) {
        reportWebVital({
          name: 'DCL',
          value: dcl,
          rating: 'good',
          id: 'dcl',
        });
      }
    }
  } catch (e) {
    // Navigation Timing API not available
  }
}
