/**
 * ai-act-classify: Protokoll und Kontingent vor dem bezahlten Provider-Call.
 *
 * ## Warum es diesen Test gibt
 *
 * Die Function ist bewusst öffentlich (`verify_jwt = false`, Free-Tier-Werkzeug
 * unter /ai-act-klassifikator). Das ist eine Produktentscheidung und bleibt so.
 * Was fehlte, war die Gegenleistung dafür.
 *
 * Am 2026-09-27 gegen die deployte Function gemessen:
 *
 *   * 11 Anfragen ohne jedes Token -> 11x HTTP 200, also 11 bezahlte
 *     Provider-Calls auf Betreiber-Keys.
 *   * Danach in `anon_chat_runs`: 0 Zeilen. In `ai_tool_runs`: 0 Zeilen.
 *     Die 11 Calls standen nur in den Plattform-Logs — ohne Modell, ohne
 *     Tokens, ohne Kosten. Das verletzt CLAUDE.md ("jeder Call wird geloggt").
 *   * Das dokumentierte Limit (4/Minute je IP-Hash, FEATURE_LIMITS in
 *     _shared/aiGateway/rateLimit.ts) hat NICHT EINMAL gegriffen: die 11
 *     Anfragen liefen in 11 verschiedenen Ausfuehrungskontexten, und der
 *     Zaehler liegt im Arbeitsspeicher des Isolate. Er kann per Konstruktion
 *     nicht zuverlaessig greifen — das ist in _shared/anonRateLimit.ts auch
 *     so dokumentiert und dort ausdruecklich offen gelassen.
 *
 * Damit war `ai-act-classify` die einzige anonyme LLM-Flaeche ohne das
 * Verfahren, das governance-agent, siteos und ai-gateway ('audit_anon')
 * laengst benutzen. Dieser Test haelt sie darauf fest — es wird hier kein
 * zweites Metering-System eingefuehrt, sondern das vorhandene angewandt.
 *
 * ## Was dieser Test belegt — und was nicht
 *
 * Geprueft wird am Quelltext. Das Laufzeitverhalten von `reserveAnonAudit`
 * ist aus Vitest nicht pruefbar: die Function importiert
 * `jsr:@supabase/supabase-js`, und `vitest.config.ts` loest `jsr:`-Spezifier
 * nicht auf. Dieselbe Einschraenkung wie in optimize-analyze-auth.test.ts und
 * website-maintenance-agent-auth.test.ts. Dass die Operation im
 * Datenbank-CHECK steht, prueft test/edge/anon-op-sync.test.ts.
 *
 * Nachgewiesen wird hier: dass das Protokoll VOR dem bezahlten Call steht,
 * dass es fail-closed ist, dass das Kontingent aus der Datenbank kommt (und
 * nicht aus dem Arbeitsspeicher), und dass Modell und Tokens im Abschluss
 * landen. Ein 429 nach 20 echten Aufrufen im Betrieb braucht 20 echte
 * Aufrufe und gehoert nicht in diese Datei.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../..');
const QUELLE = readFileSync(
  resolve(ROOT, 'supabase/functions/ai-act-classify/index.ts'),
  'utf8',
);

/** Kommentarfrei — die Zusicherungen gelten dem Code, nicht der Prosa. */
const code = QUELLE
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1');

/**
 * Fehlt eine Stelle ganz, liefert indexOf -1 — und -1 liegt vor allem. Jede
 * Reihenfolge-Zusicherung muss deshalb ZUERST belegen, dass es die Stelle
 * ueberhaupt gibt, sonst ist sie leer wahr und besteht auch auf dem
 * verwundbaren Stand.
 */
function stelle(nadel: string, was: string): number {
  const i = code.indexOf(nadel);
  expect(i, `${was} fehlt vollstaendig`).toBeGreaterThan(-1);
  return i;
}

describe('ai-act-classify: das Protokoll benutzt das vorhandene Verfahren', () => {
  it('nutzt den kanonischen Helfer aus _shared/anonAudit.ts', () => {
    expect(code).toMatch(/from ['"]\.\.\/_shared\/anonAudit\.ts['"]/);
    expect(code).toContain('reserveAnonAudit');
    expect(code).toContain('completeAnonAudit');
  });

  it('fuehrt keine eigene Protokoll-Tabelle ein', () => {
    // Ein zweites Metering neben anon_chat_runs waere genau das, was die
    // Architektur-Vorgabe verbietet. Die Function darf nur diese Tabelle
    // beschreiben — und zwar durch den Helfer.
    const tabellen = [...code.matchAll(/\.from\('([a-z_]+)'\)/g)].map((m) => m[1]);
    expect(tabellen.length, 'kein .from() gefunden').toBeGreaterThan(0);
    expect(new Set(tabellen)).toEqual(new Set(['anon_chat_runs']));
  });

  it('benutzt die eigene Operation, nicht die eines anderen Pfads', () => {
    expect(code).toMatch(/ANON_OP\s*:\s*AnonOp\s*=\s*'ai_act_classify_anon'/);
  });

  it('gibt dem Protokoll nur Schluesselnamen, nie die Beschreibung', () => {
    // payload_keys darf die Systembeschreibung des Nutzers nicht enthalten.
    const von = stelle('reserveAnonAudit(admin', 'Reservierung');
    const bis = code.indexOf('}', code.indexOf('});', von));
    const block = code.slice(von, bis > von ? bis : von + 600);
    expect(block).toContain('extractPayloadKeys(');
    expect(block).not.toContain('description');
  });
});

describe('ai-act-classify: das Protokoll steht vor dem bezahlten Call', () => {
  it('reserviert vor beiden Provider-Aufrufen', () => {
    const reserve = stelle('reserveAnonAudit(admin', 'Reservierung');
    const openai  = stelle('await callOpenAI(',    'OpenAI-Aufruf');
    const claude  = stelle('await callAnthropic(', 'Anthropic-Aufruf');
    expect(reserve, 'OpenAI-Call vor der Reservierung').toBeLessThan(openai);
    expect(reserve, 'Anthropic-Call vor der Reservierung').toBeLessThan(claude);
  });

  it('reserviert auch vor dem Lesen der Provider-Keys', () => {
    // Der Vault-Zugriff ist der erste Schritt, der ohne Protokoll nichts
    // mehr rueckmelden koennte.
    const reserve = stelle('reserveAnonAudit(admin', 'Reservierung');
    const key = stelle("getSecret(admin, 'OPENAI_API_KEY')", 'Key-Abfrage');
    expect(reserve).toBeLessThan(key);
  });

  it('verweigert die Arbeit, wenn das Protokoll nicht schreibbar ist', () => {
    // Fail-closed. Ein `catch`, das weiterlaeuft, waere schlimmer als keins:
    // der Aufruf kostet dann Geld und hinterlaesst keine Spur.
    expect(code).toMatch(/jsonError\(\s*503,\s*'AUDIT_UNAVAILABLE'/);
    const reserve = stelle('reserveAnonAudit(admin', 'Reservierung');
    const fehler  = stelle("503, 'AUDIT_UNAVAILABLE'", 'Fail-closed-Antwort');
    const openai  = stelle('await callOpenAI(', 'OpenAI-Aufruf');
    expect(reserve).toBeLessThan(fehler);
    expect(fehler, 'Fail-closed-Zweig erst nach dem Provider-Call').toBeLessThan(openai);
  });
});

describe('ai-act-classify: das Kontingent kommt aus der Datenbank', () => {
  it('zaehlt in anon_chat_runs statt im Arbeitsspeicher', () => {
    // DIE zentrale Zusicherung. Ein Zaehler in einer Map ueberlebt keinen
    // Kaltstart und wird von mehreren Isolaten getrennt gefuehrt — genau
    // deshalb griff das alte Limit 11 von 11 Mal nicht.
    expect(code).toContain("from('anon_chat_runs')");
    expect(code).toMatch(/count:\s*'exact',\s*head:\s*true/);
    expect(code).toMatch(/\.gte\('occurred_at',\s*since\)/);
  });

  it('zaehlt je Operation und IP-Hash, nicht global', () => {
    expect(code).toMatch(/\.eq\('op',\s*ANON_OP\)/);
    expect(code).toMatch(/\.eq\('ip_hash',\s*ipHash\)/);
  });

  it('rechnet die eigene Reservierung nicht mit', () => {
    // Der Pruefpfad schreibt vor dem Kontingent. Ohne diesen Ausschluss
    // waere das Kontingent still um eins kleiner als die Zahl im Quelltext.
    expect(code).toMatch(/\.neq\('request_id',\s*requestId\)/);
  });

  it('rechnet abgewiesene Anfragen nicht mit', () => {
    // Sonst koennte ein Burst hinter einer geteilten IP das Tageskontingent
    // aufbrauchen, ohne dass je eine Klassifikation zustande kam.
    expect(code).toMatch(/\.neq\('outcome',\s*'rate_limited'\)/);
  });

  it('ist bei unlesbarem Kontingent fail-closed', () => {
    // Ein Kontingent, das bei jedem Lesefehler alles durchlaesst, ist keines.
    expect(code).toMatch(/status:\s*'unavailable'/);
    expect(code).toMatch(/jsonError\(\s*503,\s*'QUOTA_UNAVAILABLE'/);
    // Und der Fehlerfall darf nicht als 'ok' durchgehen.
    expect(code).not.toMatch(/error\s*\?\s*\{\s*status:\s*'ok'/);
  });

  it('weist ein erschoepftes Kontingent mit 429 ab', () => {
    expect(code).toMatch(/jsonError\(\s*\n?\s*429,\s*\n?\s*'QUOTA_EXCEEDED'/);
  });

  it('prueft das Kontingent vor dem bezahlten Call', () => {
    const quote = stelle('checkClassifyQuota(admin', 'Kontingent-Pruefung');
    const openai = stelle('await callOpenAI(', 'OpenAI-Aufruf');
    expect(quote, 'Provider-Call vor der Kontingent-Pruefung').toBeLessThan(openai);
  });
});

describe('ai-act-classify: der Abschluss traegt Modell und Tokens', () => {
  it('schreibt Modell und beide Token-Zahlen beim Erfolg', () => {
    const i = stelle("outcome: 'success'", 'Erfolgs-Abschluss');
    const block = code.slice(i, i + 400);
    expect(block).toContain('model:');
    expect(block).toContain('input_tokens:');
    expect(block).toContain('output_tokens:');
    expect(block).toContain('duration_ms:');
  });

  it('liest die Tokens bei beiden Anbietern aus der Antwort', () => {
    // OpenAI und Anthropic benennen die Felder verschieden. Nur eines zu
    // lesen heisst: beim anderen Anbieter steht NULL, und die Kosten sind
    // wieder unbekannt.
    expect(code).toMatch(/usage\?\.prompt_tokens/);
    expect(code).toMatch(/usage\?\.completion_tokens/);
    expect(code).toMatch(/usage\?\.input_tokens/);
    expect(code).toMatch(/usage\?\.output_tokens/);
  });

  it('behauptet keine Null, wenn der Anbieter kein usage schickt', () => {
    // 0 Tokens waere die Aussage "hat nichts verbraucht". NULL ist die
    // Aussage "wir wissen es nicht" — nur die ist wahr.
    expect(code).toMatch(/function numOrUndefined/);
    expect(code).toMatch(/Number\.isFinite\(v\)\s*\?\s*v\s*:\s*undefined/);
  });

  it('protokolliert auch die Fehlschlaege', () => {
    for (const code_ of ['LLM_CALL_FAILED', 'LLM_NOT_CONFIGURED', 'QUOTA_EXCEEDED', 'QUOTA_UNAVAILABLE']) {
      expect(code, `${code_} ohne Abschluss-Eintrag`).toContain(`error_code: '${code_}'`);
    }
  });
});

describe('ai-act-classify: der Free-Tier bleibt offen', () => {
  const toml = readFileSync(resolve(ROOT, 'supabase/config.toml'), 'utf8');

  it('bleibt bewusst ohne Plattform-Gate', () => {
    // Anders als bei optimize-analyze und website-maintenance-agent ist das
    // hier KEIN Mangel: Das Werkzeug soll ohne Konto benutzbar sein, und der
    // Aufruf aus src/lib/ai-act/signal-extraction.ts schickt gar kein Token.
    // Ein verify_jwt = true wuerde das Werkzeug fuer jeden anonymen Besucher
    // stillschweigend auf den lokalen Fallback zuruecksetzen. Die Schranke
    // ist stattdessen das Kontingent oben — und die ist jetzt vorhanden.
    const kopf = '[functions.ai-act-classify]';
    const i = toml.indexOf(kopf);
    expect(i, 'kein Eintrag fuer ai-act-classify in config.toml').toBeGreaterThan(-1);
    expect(toml.slice(i, i + 200)).toMatch(/verify_jwt\s*=\s*false/);
  });

  it('haelt die Kontingent-Groesse im Quelltext, nicht verstreut', () => {
    expect(code).toMatch(/QUOTA_PER_DAY\s*=\s*\d+/);
    expect(code).toMatch(/QUOTA_WINDOW_MS\s*=\s*24 \* 60 \* 60 \* 1000/);
  });
});

describe('ai-act-classify: die Migration traegt die Operation und den Index', () => {
  const migration = readFileSync(
    resolve(ROOT, 'supabase/migrations/20260927100000_anon_chat_runs_ai_act_classify_op.sql'),
    'utf8',
  );

  it('erlaubt die neue Operation im CHECK', () => {
    expect(migration).toContain("'ai_act_classify_anon'");
  });

  it('behaelt alle bisherigen Operationen', () => {
    // Ein CHECK wird hier ersetzt, nicht ergaenzt. Faellt ein alter Wert
    // heraus, bricht ein anderer anonymer Pfad — nicht dieser.
    for (const op of [
      'chat_anon', 'start_audit_scan', 'explain_finding', 'generate_fix_snippet',
      'siteos_build_anon', 'siteos_refine_anon', 'audit_copilot_anon',
    ]) {
      expect(migration, `${op} aus dem CHECK gefallen`).toContain(`'${op}'`);
    }
  });

  it('legt den Index fuer die Kontingent-Abfrage an', () => {
    // Die Zaehlung liegt auf dem heissen Pfad jedes anonymen Aufrufs.
    expect(migration).toMatch(/CREATE INDEX IF NOT EXISTS anon_chat_runs_op_ip_time_idx/i);
    expect(migration).toMatch(/\(op,\s*ip_hash,\s*occurred_at DESC\)/i);
  });

  it('ist nicht destruktiv', () => {
    expect(migration).not.toMatch(/\bDROP\s+TABLE\b/i);
    expect(migration).not.toMatch(/\bDROP\s+COLUMN\b/i);
    expect(migration).not.toMatch(/\bTRUNCATE\b/i);
    expect(migration).not.toMatch(/\bDELETE\s+FROM\b/i);
  });
});
