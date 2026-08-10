/**
 * RFC-003 — Parität zwischen TypeScript-Spiegel und SQL-Implementierung
 *
 * Die Decay-Logik existiert zweimal: als reine TS-Funktionen
 * (src/core/governance/rfc003-memory.ts, Referenz für Producer-Code) und als
 * SQL im Decay-Worker (supabase/migrations/*). Läuft eine Seite weg, verhält
 * sich die Anwendung anders als die Datenbank — und der Prüfpfad wird
 * unglaubwürdig.
 *
 * Diese Tests lesen die Migrations-SQL und vergleichen die dort kodierten
 * Schwellen und Intervalle gegen die TS-Konstanten. Sie brauchen keine DB.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PURGE_GRACE_DAYS,
  REVALIDATION_DELAY_HOURS,
  RETENTION_INTERVALS_DAYS,
  getConfidenceDecayAction,
} from '@/src/core/governance/rfc003-memory';

const MIGRATIONS = resolve(__dirname, '../../supabase/migrations');

function sql(file: string): string {
  return readFileSync(resolve(MIGRATIONS, file), 'utf8');
}

const decayWorkerSql = sql('20260818000000_rfc003_decay_worker.sql');
const confidenceSql = sql('20260819000000_rfc003_confidence_triggers.sql');
const schemaSql = sql('20260803000000_rfc003_memory_governance.sql');

describe('RFC-003 / SQL-Parität — Decay-Schwellen', () => {
  it('cooling-Schwelle 0.5 steht so im Decay-Worker', () => {
    // active → cooling: freshness < 0.5 ODER confidence < 0.5
    expect(decayWorkerSql).toMatch(/\)\s*<\s*0\.5\)/);
    expect(decayWorkerSql).toMatch(/m\.confidence\s*<\s*0\.5/);
  });

  it('archive-Schwelle 0.2 steht so im Decay-Worker', () => {
    // cooling → archived: freshness < 0.2 UND relevance < 0.2
    expect(decayWorkerSql).toMatch(/<\s*0\.2/);
    expect(decayWorkerSql).toMatch(/m\.relevance\s*<\s*0\.2/);
  });

  it('Purge-Grace entspricht PURGE_GRACE_DAYS', () => {
    const match = decayWorkerSql.match(
      /automated_purge_date\s*\+\s*INTERVAL\s*'(\d+)\s*days'\s*<\s*now\(\)/,
    );
    expect(match, 'Grace-Intervall im Purge-Zweig nicht gefunden').not.toBeNull();
    expect(Number(match![1])).toBe(PURGE_GRACE_DAYS);
  });

  it('Facts sind im Freshness-Pfad ausgenommen (kein temporaler Verfall)', () => {
    // getEffectiveFreshness() gibt für Facts konstant 1.0 zurück — die SQL
    // muss sie entsprechend vom Freshness-Vergleich ausschließen.
    expect(decayWorkerSql).toMatch(/classification\s*!=\s*'fact'/);
  });

  it('Holds blockieren jeden Übergang', () => {
    // Jeder der vier UPDATE-Zweige muss beide Holds prüfen.
    const holdGuards = decayWorkerSql.match(
      /NOT\s+m\.regulatory_hold\s+AND\s+NOT\s+m\.incident_hold/g,
    );
    expect(holdGuards?.length ?? 0).toBeGreaterThanOrEqual(4);
  });
});

describe('RFC-003 / SQL-Parität — Confidence-Decay (§3.2)', () => {
  it('Schwellen 0.5 und 0.8 entsprechen getConfidenceDecayAction', () => {
    // TS-Seite: die Matrix, die die SQL spiegeln muss.
    expect(getConfidenceDecayAction(0.49)).toBe('immediate_archive');
    expect(getConfidenceDecayAction(0.5)).toBe('cool_and_revalidate');
    expect(getConfidenceDecayAction(0.79)).toBe('cool_and_revalidate');
    expect(getConfidenceDecayAction(0.8)).toBe('revalidate_only');

    // SQL-Seite: dieselben Grenzen im state-CASE.
    expect(confidenceSql).toMatch(/WHEN\s+m\.confidence\s*<\s*0\.5\s+THEN\s+'archived'/);
    expect(confidenceSql).toMatch(/WHEN\s+m\.confidence\s*<\s*0\.8\s+THEN\s+'cooling'/);
  });

  it('Re-Validation-Intervalle entsprechen REVALIDATION_DELAY_HOURS', () => {
    const cool = confidenceSql.match(
      /WHEN\s+m\.confidence\s*<\s*0\.8\s+THEN\s+now\(\)\s*\+\s*INTERVAL\s*'(\d+)\s*hours'/,
    );
    const revalidate = confidenceSql.match(
      /ELSE\s+now\(\)\s*\+\s*INTERVAL\s*'(\d+)\s*hours'/,
    );

    expect(cool, 'cool_and_revalidate-Intervall nicht gefunden').not.toBeNull();
    expect(revalidate, 'revalidate_only-Intervall nicht gefunden').not.toBeNull();

    expect(Number(cool![1])).toBe(REVALIDATION_DELAY_HOURS.cool_and_revalidate);
    expect(Number(revalidate![1])).toBe(REVALIDATION_DELAY_HOURS.revalidate_only);
  });

  it('archivierte Items bekommen keine Re-Validation', () => {
    // confidence < 0.5 → archiviert, revalidation_due_at bleibt NULL.
    expect(confidenceSql).toMatch(/WHEN\s+m\.confidence\s*<\s*0\.5\s+THEN\s+NULL/);
  });

  it('Facts sind vom Confidence-Decay ausgenommen', () => {
    expect(confidenceSql).toMatch(/classification\s*!=\s*'fact'/);
  });
});

describe('RFC-003 / SQL-Parität — Aufbewahrung', () => {
  it('jede Retention-Klasse aus TS existiert in calculate_automated_purge_date', () => {
    for (const cls of Object.keys(RETENTION_INTERVALS_DAYS)) {
      expect(
        schemaSql.includes(`WHEN '${cls}'`),
        `Retention-Klasse '${cls}' fehlt in der SQL-Funktion`,
      ).toBe(true);
    }
  });

  it("'forever' wird in SQL zu NULL (kein Purge-Datum)", () => {
    expect(RETENTION_INTERVALS_DAYS.forever).toBeNull();
    expect(schemaSql).toMatch(/WHEN\s+'forever'\s+THEN\s+NULL/);
  });

  it('jede endliche Retention-Klasse addiert die Grace-Periode', () => {
    // Alle Zweige außer 'forever' und 'ephemeral' hängen + 7 days an.
    const graceBranches = schemaSql.match(
      /INTERVAL\s*'[^']+'\s*\+\s*INTERVAL\s*'7\s*days'/g,
    );
    const finite = Object.entries(RETENTION_INTERVALS_DAYS)
      .filter(([k, v]) => v !== null && k !== 'ephemeral');
    expect(graceBranches?.length ?? 0).toBe(finite.length);
  });
});

describe('RFC-003 / SQL-Parität — Betriebsvoraussetzungen', () => {
  it('der Decay-Worker ist per Cron registriert', () => {
    // Ohne cron.schedule existiert der Worker, tickt aber nie.
    expect(confidenceSql).toMatch(/cron\.schedule\(\s*\n?\s*'memory-decay-hourly'/);
    expect(confidenceSql).toMatch(/functions\/v1\/memory-decay-worker/);
  });

  it('die Decay-RPCs sind auf service_role beschränkt', () => {
    for (const fn of ['governance_memory_decay_tick', 'governance_memory_refresh_views']) {
      expect(decayWorkerSql).toMatch(
        new RegExp(`REVOKE ALL ON FUNCTION ${fn}\\(\\)[\\s\\S]*?FROM PUBLIC, anon, authenticated`),
      );
      expect(decayWorkerSql).toMatch(
        new RegExp(`GRANT EXECUTE ON FUNCTION ${fn}\\(\\) TO service_role`),
      );
    }
    expect(confidenceSql).toMatch(/GRANT EXECUTE ON FUNCTION governance_memory_confidence_reassess[\s\S]*?TO service_role/);
  });

  it('die widersprüchliche Supersession-Constraint ist entfernt', () => {
    // memory_supersession_immutable machte den purged-Zustand unerreichbar.
    expect(decayWorkerSql).toMatch(
      /DROP CONSTRAINT IF EXISTS memory_supersession_immutable/,
    );
  });
});
