/**
 * P2-1 — Parität zwischen Code und SQL bei den Durchsetzbarkeits-Klassen.
 *
 * WARUM DIESER TEST EXISTIERT
 *
 * Die Zuordnung Systemtyp → Klasse steht zwangsläufig doppelt: einmal in
 * `shared/enforcement-classes.ts` (Oberfläche, Node) und einmal in
 * `connector_enforcement_class()` (Datenbank, Trigger). Ein Zwilling, der
 * auseinanderläuft, ist hier besonders teuer: Die Oberfläche würde eine Klasse
 * anzeigen, die die Datenbank nicht setzt — der Kunde läse „A — anhaltbar",
 * während die Registratur „C — nur nachgelagert" führt. Das ist genau die
 * Falschaussage, gegen die P2-1 gebaut ist.
 *
 * Derselbe Mechanismus wie bei RFC-003 (`rfc003-sql-parity.test.ts`), aus
 * demselben Grund: Doppelte Wahrheit ist nur zulässig, wenn sie erzwungen
 * gleich bleibt.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ENFORCEMENT_CLASSES,
  SYSTEM_CLASSIFICATIONS,
  canBlock,
  enforcementClassOf,
  enforcementReasonOf,
  systemLabelOf,
  verdictIsHonest,
  type EnforcementClass,
} from '../../shared/enforcement-classes';

const MIGRATION = join(
  process.cwd(),
  'supabase/migrations/20260904100000_connector_registry.sql',
);

/** Liest die WHEN-Zweige aus `connector_enforcement_class()`. */
function sqlMapping(): Map<string, string> {
  const sql = readFileSync(MIGRATION, 'utf8');
  const start = sql.indexOf('CREATE OR REPLACE FUNCTION public.connector_enforcement_class');
  expect(start, 'connector_enforcement_class() nicht in der Migration gefunden').toBeGreaterThan(-1);
  const end = sql.indexOf('$$;', start);
  const body = sql.slice(start, end);

  const map = new Map<string, string>();
  for (const m of body.matchAll(/WHEN\s+'([a-z0-9_]+)'\s+THEN\s+'([ABCD])'/gi)) {
    map.set(m[1]!, m[2]!);
  }
  return map;
}

describe('P2-1 / Durchsetzbarkeits-Klassen: Code und SQL stimmen überein', () => {
  it('die Migration ordnet genau dieselben Systemtypen zu wie der Code', () => {
    const sql = sqlMapping();
    const code = new Set(SYSTEM_CLASSIFICATIONS.map((s) => s.systemType));

    // Beide Richtungen prüfen — eine Zahlengleichheit wäre kein Beleg.
    const nurInSql = [...sql.keys()].filter((t) => !code.has(t));
    const nurImCode = [...code].filter((t) => !sql.has(t));

    expect(nurInSql, 'Systemtypen nur in der SQL — shared/enforcement-classes.ts nachziehen').toEqual([]);
    expect(nurImCode, 'Systemtypen nur im Code — Migration nachziehen').toEqual([]);
  });

  it('jede Zuordnung trägt in beiden Quellen dieselbe Klasse', () => {
    const sql = sqlMapping();
    for (const s of SYSTEM_CLASSIFICATIONS) {
      expect(sql.get(s.systemType), `Klasse für "${s.systemType}"`).toBe(s.klasse);
    }
  });

  it('der unbekannte Fall fällt in beiden Quellen auf C, nicht auf A', () => {
    // Die vorsichtige Annahme ist die einzige ehrliche: Ein System, dessen
    // Integrationspunkt niemand belegt hat, kann nichts verhindern.
    const sql = readFileSync(MIGRATION, 'utf8');
    expect(sql).toMatch(/ELSE\s+'C'/);
    expect(enforcementClassOf('irgendein-unbekanntes-system')).toBe('C');
  });
});

describe('P2-1 / Die Klassen sagen die Wahrheit über das Können', () => {
  it('nur A und B können blockieren', () => {
    expect(canBlock('A')).toBe(true);
    expect(canBlock('B')).toBe(true);
    expect(canBlock('C')).toBe(false);
    expect(canBlock('D')).toBe(false);
  });

  it('C und D führen "block" nicht unter ihren Verdikten', () => {
    // Der eigentliche Schutz: Wer für einen C-Connector `block` verspricht,
    // verspricht etwas, das die Plattform dort nicht leisten kann.
    expect(verdictIsHonest('C', 'block')).toBe(false);
    expect(verdictIsHonest('D', 'block')).toBe(false);
    expect(verdictIsHonest('C', 'react')).toBe(true);
    expect(verdictIsHonest('A', 'block')).toBe(true);
    expect(verdictIsHonest('B', 'block')).toBe(true);
  });

  it('"react" gibt es nur dort, wo nachgelagert reagiert wird', () => {
    expect(verdictIsHonest('A', 'react')).toBe(false);
    expect(verdictIsHonest('B', 'react')).toBe(false);
    expect(verdictIsHonest('D', 'react')).toBe(false);
  });

  it('jede Klasse kann wenigstens protokollieren — auch die unerreichbare', () => {
    for (const k of ['A', 'B', 'C', 'D'] as EnforcementClass[]) {
      expect(verdictIsHonest(k, 'log_only'), `Klasse ${k}`).toBe(true);
    }
  });
});

describe('P2-1 / Einordnung der im Auftrag genannten Systeme', () => {
  it('Microsoft 365 ist C — nicht blockierbar, und das steht so da', () => {
    // Der Beispielfall des Auftrags (Excel mit personenbezogenen Daten an
    // einen nicht freigegebenen KI-Dienst). Plan §2.3 hält fest: heute C
    // oder D, nicht A. Dieser Test hält es fest, damit es niemand versehentlich
    // hochstuft.
    expect(enforcementClassOf('microsoft365')).toBe('C');
    expect(canBlock(enforcementClassOf('microsoft365'))).toBe(false);
    expect(enforcementReasonOf('microsoft365')).toMatch(/Purview|nachgelagert|nach der Aktion/i);
  });

  it('der direkte Browser-Zugriff ist D — ohne Endpunkt-Agent kein Zugriff', () => {
    expect(enforcementClassOf('browser_direct')).toBe('D');
    expect(enforcementReasonOf('browser_direct')).toMatch(/Endpunkt-Agent|Unternehmensproxy/i);
  });

  it('die eigenen Pfade sind A — dort und nur dort greift der Block sofort', () => {
    for (const t of ['ai_gateway', 'agent_runtime', 'chatbot', 'whatsapp', 'voice']) {
      expect(enforcementClassOf(t), t).toBe('A');
    }
  });

  it('die eigenen Schranken sind B', () => {
    expect(enforcementClassOf('siteos_publish')).toBe('B');
    expect(enforcementClassOf('cicd_gate')).toBe('B');
  });

  it('jede Einordnung trägt eine lesbare Begründung — die Klasse allein genügt nicht', () => {
    for (const s of SYSTEM_CLASSIFICATIONS) {
      expect(s.begruendung.length, `Begründung für ${s.systemType}`).toBeGreaterThan(30);
      expect(s.label.length, `Label für ${s.systemType}`).toBeGreaterThan(2);
    }
  });

  it('unbekannte Typen bekommen Label und Begründung, statt leer zu bleiben', () => {
    expect(systemLabelOf('foo_bar')).toBe('foo_bar');
    expect(enforcementReasonOf('foo_bar')).toMatch(/vorsichtshalber|nachgelagert/i);
  });

  it('jede Klassendefinition ist vollständig beschrieben', () => {
    for (const k of ['A', 'B', 'C', 'D'] as EnforcementClass[]) {
      const d = ENFORCEMENT_CLASSES[k];
      expect(d.klasse).toBe(k);
      expect(d.bedeutung.length, `Bedeutung ${k}`).toBeGreaterThan(30);
      expect(d.voraussetzung.length, `Voraussetzung ${k}`).toBeGreaterThan(10);
      expect(d.verdikte.length, `Verdikte ${k}`).toBeGreaterThan(0);
    }
  });
});
