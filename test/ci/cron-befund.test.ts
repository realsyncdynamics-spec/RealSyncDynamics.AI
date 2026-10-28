/**
 * Befundzeilen des Cron-Health-Guards im Issue (P0-2, Masterplan 2026/27).
 *
 * Erkennung und Zustellung liefen: #1521 ist seit dem 2026-09-22 offen. Aber
 * jeder der 35 Folgekommentare lautete „❌ Weiterhin rot — Lauf #n" — ohne
 * Ursache, und der Wechsel von 401 (falsches Secret) auf 500 (Secret fehlt)
 * war im Issue nicht zu sehen. Diese Tests halten fest, dass der Kommentar
 * die Ursache nennt und einen Wechsel als Wechsel meldet.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  befundAusLog,
  befundMarkdown,
  fingerabdruck,
  folgeKommentar,
  formatBefundZeile,
  leseMarker,
  marker,
} from '../../scripts/cron-befund.mjs';
import { befundZeilen, evaluateAntworten } from '../../scripts/check-cron-health.mjs';

const FEHLT = '{"error":{"code":"CRON_KEY_MISSING","message":"cron key not configured"}}';
const FALSCH = '{"error":"cron only"}';

/** Antwortzeilen wie am 2026-10-26 (Lauf #72): 36× 500, 3× 401, 6× 200. */
const ANTWORTEN_26_10 = [
  { art: 'antwort', status: '500', anzahl: 24, von: 'a', bis: 'b', beispiel: FEHLT },
  { art: 'antwort', status: '500', anzahl: 6, von: 'a', bis: 'b', beispiel: FEHLT },
  { art: 'antwort', status: '500', anzahl: 6, von: 'a', bis: 'b', beispiel: FEHLT },
  { art: 'antwort', status: '401', anzahl: 3, von: 'a', bis: 'b', beispiel: FALSCH },
  { art: 'antwort', status: '200', anzahl: 6, von: 'a', bis: 'b', beispiel: '{}' },
  { art: 'dispatch', status: null, anzahl: 45, von: null, bis: null, beispiel: null },
];

describe('befundZeilen', () => {
  it('fasst Antworten nach Status und Ursache zusammen, mit Anzahl daneben', () => {
    const zeilen = befundZeilen({ antwort: evaluateAntworten(ANTWORTEN_26_10) });
    expect(zeilen).toEqual([
      {
        schluessel: 'C · HTTP 500 · Function Secret fehlt (CRON_*_KEY nicht gesetzt) — siehe docs/runbooks/cron-vault-secrets.md',
        anzahl: 36,
      },
      {
        schluessel: 'C · HTTP 401 · Function Secret mismatch (Bearer-Token passt nicht zum Function Secret) — siehe docs/runbooks/cron-vault-secrets.md',
        anzahl: 3,
      },
    ]);
  });

  it('nennt gescheiterte und ueberfaellige Jobs namentlich', () => {
    const zeilen = befundZeilen({
      broken: [
        { name: 'memory-decay-hourly', last_message: 'Vault-Secret fehlt', erfolge: 0, fehler: 3 },
        { name: 'governance-monitoring-hourly', last_message: 'Vault-Secret fehlt', erfolge: 0, fehler: 3 },
      ],
      veraltet: [{ name: 'scan-scheduler-dispatch' }],
    });
    expect(zeilen.map((z) => z.schluessel)).toEqual([
      'A · letzter Lauf gescheitert · Vault-Secret fehlt · governance-monitoring-hourly, memory-decay-hourly',
      'B · ueberfaellig · scan-scheduler-dispatch',
    ]);
  });

  it('meldet Dispatches ohne jede Antwort', () => {
    const zeilen = befundZeilen({
      antwort: evaluateAntworten([{ art: 'dispatch', status: null, anzahl: 4, von: null, bis: null, beispiel: null }]),
    });
    expect(zeilen).toEqual([{ schluessel: 'C · Dispatch ohne jede Antwort', anzahl: 4 }]);
  });
});

describe('Protokoll → Befundzeilen', () => {
  it('liest die Zeilen aus einem Actions-Protokoll mit Zeitstempeln zurueck', () => {
    const original = befundZeilen({ antwort: evaluateAntworten(ANTWORTEN_26_10) });
    const protokoll = [
      '2026-10-26T13:36:17.3016264Z Cron-Jobs: 20 registriert — 20 zuletzt gruen, 0 zuletzt rot, 0 nie gelaufen, 0 inaktiv.',
      '2026-10-26T13:36:17.3025060Z   24× HTTP 500   2026-10-26 07:45:00.679109+00 … 2026-10-26 13:30:00.659248+00',
      ...original.map((z, i) => `2026-10-26T13:36:17.30${40 + i}000Z ${formatBefundZeile(z)}`),
      '2026-10-26T13:36:17.3084001Z ##[error]Process completed with exit code 1.',
    ].join('\n');
    expect(befundAusLog(protokoll)).toEqual(original);
  });

  it('akzeptiert Zeilen ohne Zeitstempel und ignoriert alles andere', () => {
    expect(befundAusLog('BEFUND| B · ueberfaellig · x\nirgendwas BEFUND| y\n')).toEqual([
      { schluessel: 'B · ueberfaellig · x', anzahl: null },
    ]);
    expect(befundAusLog('')).toEqual([]);
    expect(befundAusLog(undefined)).toEqual([]);
  });
});

describe('fingerabdruck', () => {
  const heute = befundZeilen({ antwort: evaluateAntworten(ANTWORTEN_26_10) });

  it('aendert sich nicht, wenn sich nur die Anzahlen aendern', () => {
    const morgen = heute.map((z) => ({ ...z, anzahl: (z.anzahl ?? 0) + 7 }));
    expect(fingerabdruck(morgen)).toBe(fingerabdruck(heute));
    expect(fingerabdruck([...heute].reverse())).toBe(fingerabdruck(heute));
  });

  it('aendert sich beim Wechsel von 401 auf 500', () => {
    // Genau dieser Wechsel war im Oktober im Issue unsichtbar.
    const nur401 = heute.filter((z) => z.schluessel.includes('HTTP 401'));
    expect(fingerabdruck(nur401)).not.toBe(fingerabdruck(heute));
    expect(fingerabdruck(heute)).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe('folgeKommentar', () => {
  const zeilen = befundZeilen({ antwort: evaluateAntworten(ANTWORTEN_26_10) });
  const fp = fingerabdruck(zeilen);
  const link = '[Lauf #72](https://example.invalid/72)';
  const when = '2026-10-26T13:36:20Z';

  it('nennt die Ursache und markiert den ersten Stand', () => {
    const body = folgeKommentar({ zeilen, vorher: null, link, when });
    expect(body).toContain('Befund hat sich geändert');
    expect(body).toContain('HTTP 500 · Function Secret fehlt');
    expect(body).toContain('— 36×');
    expect(leseMarker(body)).toEqual({ fingerabdruck: fp, seit: when });
  });

  it('meldet „unveraendert seit" und traegt den Beginn weiter', () => {
    const body = folgeKommentar({
      zeilen,
      vorher: { fingerabdruck: fp, seit: '2026-10-08T06:45:00Z' },
      link,
      when,
    });
    expect(body).toContain('unverändert seit 2026-10-08T06:45:00Z');
    expect(body).not.toContain('geändert**');
    expect(leseMarker(body)).toEqual({ fingerabdruck: fp, seit: '2026-10-08T06:45:00Z' });
  });

  it('meldet einen neuen Befund als Wechsel, mit neuem Beginn', () => {
    const body = folgeKommentar({ zeilen, vorher: { fingerabdruck: 'deadbeef', seit: 'x' }, link, when });
    expect(body).toContain('Befund hat sich geändert');
    expect(leseMarker(body)?.seit).toBe(when);
  });

  it('faellt ohne lesbare Zeilen auf den Lauf-Link zurueck, ohne Marker', () => {
    const body = folgeKommentar({ zeilen: [], vorher: null, link, when });
    expect(body).toContain('Weiterhin rot');
    expect(body).toContain(link);
    expect(leseMarker(body)).toBeNull();
  });

  it('bricht Inline-Code nicht an Backticks', () => {
    expect(befundMarkdown([{ schluessel: 'C · HTTP 500 · `x`', anzahl: 1 }])).toBe("- `C · HTTP 500 · 'x'` — 1×");
    expect(marker('0000abcd', 's')).toBe('<!-- cron-befund: 0000abcd seit=s -->');
  });
});

describe('drift-alert.yml nutzt die Befundzeilen', () => {
  const src = readFileSync(resolve(__dirname, '../../.github/workflows/drift-alert.yml'), 'utf8');

  it('darf das Protokoll des Guards lesen und laedt das Modul vom Default-Branch', () => {
    expect(src).toMatch(/^\s+actions: read$/m);
    expect(src).toContain('scripts/cron-befund.mjs');
    expect(src).toContain('downloadJobLogsForWorkflowRun');
    expect(src).toContain('befund.folgeKommentar(');
  });

  it('haelt die Zustellung unabhaengig vom Lesen der Zeilen', () => {
    expect(src).toContain('Befundzeilen des Cron-Guards nicht lesbar');
  });
});
