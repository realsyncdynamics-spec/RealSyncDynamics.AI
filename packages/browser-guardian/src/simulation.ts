// SIMULATION — kein Browser. Für Tests und `--simulate` im lokalen MVP.
// Jeder Nachweis trägt executor: 'simulation'; ein simulierter Lauf ist kein
// Beleg für eine Ausführung im echten Browser.

import type { BrowserDriver, EgressGuard } from './guardian.ts';
import type { DriverResult } from './redact.ts';
import type { BrowserAction } from './types.ts';

export interface SimulatedPage {
  title: string;
  text: string;
  /** Weiterleitung auf eine andere Adresse (prüft der Egress-Wächter erneut). */
  redirect_to?: string;
  /** Klick auf diesen Selektor löst ein Absenden an diese Adresse aus. */
  submits?: Record<string, string>;
}

export class SimulatedDriver implements BrowserDriver {
  readonly kind = 'simulation' as const;
  calls: BrowserAction[] = [];
  #pages: Record<string, SimulatedPage>;
  #fallback: ((url: string) => SimulatedPage) | null;
  #url: string | null = null;

  constructor(pages: Record<string, SimulatedPage>, fallback: ((url: string) => SimulatedPage) | null = null) {
    this.#pages = pages;
    this.#fallback = fallback;
  }

  #page(url: string | null): SimulatedPage | undefined {
    if (!url) return undefined;
    return this.#pages[url] ?? this.#fallback?.(url);
  }

  #open(url: string, guard: EgressGuard, hops = 0): DriverResult {
    if (!guard.document(url)) return { ok: false, url: this.#url, error: 'DOCUMENT_BLOCKED', blocked_requests: 1 };
    const page = this.#page(url);
    if (!page) return { ok: false, url: this.#url, error: 'NOT_FOUND' };
    if (page.redirect_to && hops < 5) return this.#open(page.redirect_to, guard, hops + 1);
    this.#url = url;
    return { ok: true, url, title: page.title };
  }

  async run(action: BrowserAction, guard: EgressGuard): Promise<DriverResult> {
    this.calls.push(action);
    const page = this.#page(this.#url);
    switch (action.type) {
      case 'navigate':
        return this.#open(action.url, guard);
      case 'extract':
        return { ok: Boolean(page), url: this.#url, title: page?.title, text: page?.text ?? '' };
      case 'screenshot':
        return { ok: Boolean(page), url: this.#url, screenshot_png: new TextEncoder().encode(`png:${this.#url}`) };
      case 'click': {
        const target = page?.submits?.[action.selector];
        if (target) return this.#open(target, guard);
        return { ok: Boolean(page), url: this.#url };
      }
      default:
        return { ok: true, url: this.#url };
    }
  }

  async close(): Promise<void> {
    this.#url = null;
  }
}
