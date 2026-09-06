/**
 * Browser Agent X07 — Abbildung von Beobachtung auf Befund
 *
 * Modell: Artifact „Organisationsmodell …" v0.2, §02/§03. Entscheid: ADR 0011 D1.
 *
 * Geprüft wird die reine Abbildung: Welche Beobachtung erzeugt welchen Befund,
 * mit welcher severity und category. Ohne Browser, ohne Datenbank — beides
 * wurde beim Entwurf gegen die echten Systeme verifiziert, diese Suite hält
 * das Ergebnis fest.
 *
 * Zwei Prüfungen tragen mehr als die anderen:
 *
 *  1. **Vokabular-Parität.** severity und category gehen unverändert in
 *     `agent_tickets` — deren CHECK-Constraints stehen in der Migration. Läuft
 *     eine Seite weg, schreibt X07 in Produktion in einen Constraint-Fehler,
 *     und zwar erst zur Laufzeit. Deshalb wird hier gegen die Migrations-SQL
 *     verglichen, nicht gegen eine zweite Liste im Test.
 *
 *  2. **Kein Autonomie-Feld.** ADR 0011 D1: Ein Agent, der seine eigene
 *     Autonomiegrenze auswertet, ist kein Gate. Ein Befund darf deshalb nichts
 *     tragen, woraus sich eine Freigabe ableiten liesse.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_THRESHOLDS,
  deriveFindings,
  isTicketOfRoute,
  routePrefix,
  ticketCode,
  type ObserveResult,
} from '../../supabase/functions/browser-agent-x07/findings';

const TICKETS_SQL = readFileSync(
  resolve(__dirname, '../../supabase/migrations/20260904010500_agent_tickets.sql'),
  'utf8',
);

/** Leere Beobachtung — der Normalfall einer gesunden Seite. */
function clean(overrides: Partial<ObserveResult> = {}): ObserveResult {
  return {
    ok: true,
    meta: {
      url: 'https://example.test/pricing',
      final_url: 'https://example.test/pricing',
      http_status: 200,
      duration_ms: 800,
      observer_version: '1.0.0',
      observed_at: '2026-09-06T00:00:00.000Z',
    },
    console_errors: [],
    console_warnings: [],
    page_errors: [],
    failed_requests: [],
    timings: { response_start_ms: 100, dom_content_loaded_ms: 400, load_ms: 900 },
    viewports: [
      { label: 'desktop', width: 1280, height: 900, document_scroll_width: 1280, horizontal_overflow: false, selectors: [] },
      { label: 'mobile', width: 390, height: 844, document_scroll_width: 390, horizontal_overflow: false, selectors: [] },
    ],
    ...overrides,
  };
}

describe('Eine gesunde Seite erzeugt keinen Befund', () => {
  it('meldet nichts, wenn nichts zu melden ist', () => {
    expect(deriveFindings('/pricing', clean())).toEqual([]);
  });
});

describe('JavaScript', () => {
  it('Konsolenfehler → warn · ui_bug', () => {
    const f = deriveFindings('/pricing', clean({
      console_errors: [
        { level: 'error', text: 'Uncaught TypeError: x is not a function', url: 'https://example.test/a.js', line: 12 },
        { level: 'error', text: 'Failed to load resource', url: null, line: null },
      ],
    }));
    expect(f).toHaveLength(1);
    expect(f[0].code).toBe('js.console-error');
    expect(f[0].severity).toBe('warn');
    expect(f[0].category).toBe('ui_bug');
    expect(f[0].title).toContain('2');
    expect(f[0].evidence).toMatchObject({ route: '/pricing' });
  });

  it('unbehandelte Ausnahme → critical, weil die Seite dann kaputt ist', () => {
    const f = deriveFindings('/', clean({ page_errors: ['boom'] }));
    expect(f).toHaveLength(1);
    expect(f[0].code).toBe('js.page-error');
    expect(f[0].severity).toBe('critical');
  });

  it('unterscheidet Ausnahme und Konsolenfehler statt sie zu vermengen', () => {
    const f = deriveFindings('/', clean({
      page_errors: ['boom'],
      console_errors: [{ level: 'error', text: 'x', url: null, line: null }],
    }));
    expect(f.map((x) => x.code)).toEqual(['js.page-error', 'js.console-error']);
  });
});

describe('Netzwerk', () => {
  it('fehlgeschlagene Anfragen → warn · ui_bug', () => {
    const f = deriveFindings('/audit', clean({
      failed_requests: [{ url: 'https://example.test/x.js', method: 'GET', failure: null, status: 404 }],
    }));
    expect(f).toHaveLength(1);
    expect(f[0].code).toBe('net.request-failed');
    expect(f[0].severity).toBe('warn');
  });
});

describe('Darstellung je Breite', () => {
  it('erwartetes Element ausserhalb des Viewports → Befund mit Breite im Titel', () => {
    const obs = clean();
    obs.viewports[1].selectors = [
      { selector: '[data-cta]', found: true, visible: true, within_viewport: false, right: 470 },
    ];
    const f = deriveFindings('/', obs);
    expect(f).toHaveLength(1);
    expect(f[0].code).toBe('ui.element-not-visible');
    expect(f[0].title).toContain('390px');
  });

  it('unterscheidet fehlend, unsichtbar und ausserhalb — der Grund steht im Beleg', () => {
    const obs = clean();
    obs.viewports[0].selectors = [
      { selector: '#a', found: false, visible: false, within_viewport: false, right: null },
      { selector: '#b', found: true, visible: false, within_viewport: false, right: 10 },
      { selector: '#c', found: true, visible: true, within_viewport: false, right: 2000 },
    ];
    const gruende = (deriveFindings('/', obs)[0].evidence as { elements: Array<{ reason: string }> }).elements;
    expect(gruende.map((e) => e.reason)).toEqual(['nicht im DOM', 'nicht sichtbar', 'ausserhalb des Viewports']);
  });

  it('horizontaler Überlauf → eigener Befund', () => {
    const obs = clean();
    obs.viewports[1].horizontal_overflow = true;
    obs.viewports[1].document_scroll_width = 563;
    const f = deriveFindings('/', obs);
    expect(f.map((x) => x.code)).toEqual(['ui.horizontal-overflow']);
    expect(f[0].title).toContain('390px');
  });

  it('eine Breite, die nicht lädt, ist critical und verdeckt die anderen nicht', () => {
    const obs = clean();
    obs.viewports[1] = {
      label: 'mobile', width: 390, height: 844, document_scroll_width: 0,
      horizontal_overflow: false, selectors: [], load_error: 'Timeout 30000ms exceeded',
    };
    obs.viewports[0].horizontal_overflow = true;
    const codes = deriveFindings('/', obs).map((x) => x.code);
    expect(codes).toContain('ui.viewport-load-error');
    expect(codes).toContain('ui.horizontal-overflow');
  });
});

describe('Ladezeit', () => {
  it('unterhalb der Grenze kein Befund', () => {
    const obs = clean({ timings: { response_start_ms: 50, dom_content_loaded_ms: 200, load_ms: DEFAULT_THRESHOLDS.slowLoadMs } });
    expect(deriveFindings('/', obs)).toEqual([]);
  });

  it('oberhalb → info · performance, nie höher', () => {
    const obs = clean({ timings: { response_start_ms: 50, dom_content_loaded_ms: 200, load_ms: DEFAULT_THRESHOLDS.slowLoadMs + 1 } });
    const f = deriveFindings('/', obs);
    expect(f).toHaveLength(1);
    expect(f[0].severity).toBe('info');
    expect(f[0].category).toBe('performance');
  });

  it('fehlende Timings erzeugen keinen Befund statt einer Null-Messung', () => {
    expect(deriveFindings('/', clean({ timings: null }))).toEqual([]);
  });
});

describe('Ticket-Codes sind stabil und routentreu', () => {
  it('derselbe Befund an derselben Route ergibt denselben Code', () => {
    expect(ticketCode('/pricing', 'js.console-error')).toBe(ticketCode('/pricing', 'js.console-error'));
    expect(ticketCode('/pricing', 'js.console-error')).toBe('X07:pricing:js.console-error');
  });

  it('die Wurzel bekommt einen Namen statt eines leeren Segments', () => {
    expect(ticketCode('/', 'js.console-error')).toBe('X07:root:js.console-error');
  });

  it('enthält keinen Zeitstempel — sonst entstünde je Lauf ein neues Ticket', () => {
    expect(ticketCode('/pricing', 'js.console-error')).not.toMatch(/\d{4}-\d{2}-\d{2}|\d{10,}/);
  });

  it('eine Route ist kein Präfix einer längeren', () => {
    const code = ticketCode('/audit-extra', 'js.console-error');
    expect(isTicketOfRoute(code, '/audit-extra')).toBe(true);
    expect(
      isTicketOfRoute(code, '/audit'),
      'sonst schliesst die Verifikation Tickets einer fremden Route',
    ).toBe(false);
  });

  it('routePrefix passt zu den erzeugten Codes', () => {
    for (const route of ['/', '/pricing', '/audit']) {
      expect(ticketCode(route, 'perf.slow-load').startsWith(`${routePrefix(route)}:`)).toBe(true);
    }
  });
});

describe('ADR 0011 D1 — der Befund entscheidet nichts über Autonomie', () => {
  it('trägt kein Feld, aus dem sich eine Freigabe ableiten liesse', () => {
    const obs = clean({ page_errors: ['boom'], console_errors: [{ level: 'error', text: 'x', url: null, line: null }] });
    for (const f of deriveFindings('/', obs)) {
      expect(Object.keys(f).sort()).toEqual(['category', 'code', 'evidence', 'severity', 'title']);
    }
  });

  it('meldet nichts als security oder compliance — X07 beobachtet den Browser', () => {
    const obs = clean({
      page_errors: ['boom'],
      console_errors: [{ level: 'error', text: 'x', url: null, line: null }],
      failed_requests: [{ url: 'u', method: 'GET', failure: 'net::ERR', status: null }],
      timings: { response_start_ms: 1, dom_content_loaded_ms: 2, load_ms: 99_999 },
    });
    obs.viewports[0].horizontal_overflow = true;
    for (const f of deriveFindings('/', obs)) {
      expect(['security', 'compliance']).not.toContain(f.category);
    }
  });
});

describe('Vokabular-Parität mit agent_tickets', () => {
  function checkList(column: string): string[] {
    const m = TICKETS_SQL.match(new RegExp(`${column}\\s+text[^,]*?CHECK \\(${column} IN\\s*\\(([^)]+)\\)`, 's'));
    expect(m, `CHECK-Liste für ${column} nicht in der Migration gefunden`).toBeTruthy();
    return (m![1].match(/'([^']+)'/g) ?? []).map((s) => s.replace(/'/g, ''));
  }

  /** Alle Zweige der Abbildung einmal auslösen. */
  function alleBefunde() {
    const obs = clean({
      page_errors: ['boom'],
      console_errors: [{ level: 'error', text: 'x', url: null, line: null }],
      failed_requests: [{ url: 'u', method: 'GET', failure: 'net::ERR', status: null }],
      timings: { response_start_ms: 1, dom_content_loaded_ms: 2, load_ms: 99_999 },
    });
    obs.viewports[0].horizontal_overflow = true;
    obs.viewports[0].selectors = [{ selector: '#x', found: false, visible: false, within_viewport: false, right: null }];
    obs.viewports[1] = {
      label: 'mobile', width: 390, height: 844, document_scroll_width: 0,
      horizontal_overflow: false, selectors: [], load_error: 'timeout',
    };
    return deriveFindings('/pricing', obs);
  }

  it('alle sieben Befundarten sind abgedeckt', () => {
    expect(new Set(alleBefunde().map((f) => f.code)).size).toBe(7);
  });

  it('jede erzeugte severity steht im CHECK der Migration', () => {
    const erlaubt = checkList('severity');
    expect(erlaubt).toContain('warn');
    for (const f of alleBefunde()) expect(erlaubt).toContain(f.severity);
  });

  it('jede erzeugte category steht im CHECK der Migration', () => {
    const erlaubt = checkList('category');
    expect(erlaubt).toContain('ui_bug');
    for (const f of alleBefunde()) expect(erlaubt).toContain(f.category);
  });
});
