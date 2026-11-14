/**
 * RSD-012: HTTP-Lookback 24h, Retention 6h, konfigurierbar.
 * Ergaenzt test/ci/cron-health.test.ts, ohne die bestehenden Klasse-C-Faelle zu ersetzen.
 */
import { describe, expect, it } from 'vitest';
import {
  buildSqlAntworten,
  cronHealthHttpLookbackHours,
  cronHealthHttpRetentionHours,
  erwarteterAbstandMinuten,
  evaluateAntworten,
  SQL_ANTWORTEN,
} from '../../scripts/check-cron-health.mjs';

describe('RSD-012 HTTP-Fenster', () => {
  it('hat als Default 24h Lookback und 6h Retention', () => {
    expect(cronHealthHttpLookbackHours()).toBe(24);
    expect(cronHealthHttpRetentionHours()).toBe(6);
    expect(SQL_ANTWORTEN).toContain("interval '24 hours'");
    expect(SQL_ANTWORTEN).toContain("interval '6 hours'");
    expect(SQL_ANTWORTEN).toContain('antwort_im_retention');
    expect(SQL_ANTWORTEN).toContain('JOIN net._http_response r ON r.id = l.request_id');
    expect(SQL_ANTWORTEN).toContain("q.dispatched_at < now() - interval '2 minutes'");
  });

  it('erzeugt das alte 6h-Fenster rueckwaertskompatibel', () => {
    const sql = buildSqlAntworten(6, 6);
    expect(sql).toContain("interval '6 hours'");
    expect(sql).not.toContain("interval '24 hours'");
  });

  it('verwirft ungueltige Stunden und faellt auf die Defaults zurueck', () => {
    const sql = buildSqlAntworten(Number.NaN, -3);
    expect(sql).toContain("interval '24 hours'");
    expect(sql).toContain("interval '6 hours'");
  });

  it('zaehlt Ohne-Antwort nur im Retention-Fenster, auch wenn der Lookback mehr Antworten hat', () => {
    const a = evaluateAntworten([
      { art: 'antwort', status: '401', anzahl: 2, von: 'a', bis: 'b', beispiel: '{"error":"cron only"}' },
      { art: 'antwort', status: '200', anzahl: 10, von: 'a', bis: 'b', beispiel: '{}' },
      { art: 'dispatch', status: null, anzahl: 8, von: null, bis: null, beispiel: null },
      { art: 'antwort_im_retention', status: null, anzahl: 8, von: null, bis: null, beispiel: null },
    ]);
    expect(a.summeSchlecht).toBe(2);
    expect(a.summeGut).toBe(10);
    expect(a.ohneAntwort).toBe(0);
    expect(a.dispatchLaeufe).toBe(8);
  });

  it('behaelt die alte Ohne-Antwort-Rechnung, wenn antwort_im_retention fehlt', () => {
    const a = evaluateAntworten([
      { art: 'antwort', status: '200', anzahl: 2, von: 'a', bis: 'b', beispiel: '{}' },
      { art: 'dispatch', status: null, anzahl: 9, von: null, bis: null, beispiel: null },
    ]);
    expect(a.ohneAntwort).toBe(7);
  });
});

describe('RSD-012 Kadenz fuer versetzte Minutenlisten (RSD-013)', () => {
  it('leitet 4,19,34,49 als 15-Minuten-Abstand ab', () => {
    expect(erwarteterAbstandMinuten('4,19,34,49 * * * *')).toBe(15);
    expect(erwarteterAbstandMinuten('2 * * * *')).toBe(60);
    expect(erwarteterAbstandMinuten('1 3 * * *')).toBe(24 * 60);
  });
});
