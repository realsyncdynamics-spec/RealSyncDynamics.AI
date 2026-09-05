// P2-5 — „über denselben PEP", am Quelltext geprüft.
//
// ## Warum am Quelltext
//
// Die Zusage von P2-5 ist nicht „jeder Kanal prüft", sondern „alle drei
// prüfen an derselben Stelle". Das lässt sich nicht durch Ausführen zeigen:
// Drei Kanäle mit drei eigenen, zufällig gleich eingestellten Prüfungen
// verhalten sich bei wohlwollenden Testdaten identisch zu dreien mit einer
// gemeinsamen. Der Unterschied steht im Quelltext — und er zeigt sich erst,
// wenn einer davon geändert wird und die anderen nicht.
//
// Dieselbe Bauart wie `publish-gate-backend-source.test.ts`.

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const FUNCTIONS = resolve(__dirname, '../../supabase/functions');

const CHANNELS = [
  { file: 'bot-chat/index.ts', channel: 'bot-chat' },
  { file: 'whatsapp-webhook/index.ts', channel: 'bot-whatsapp' },
  { file: 'bot-voice-webhook/index.ts', channel: 'bot-voice' },
] as const;

function src(rel: string): string {
  return readFileSync(join(FUNCTIONS, rel), 'utf8');
}

describe('Alle drei Bot-Kanäle hängen am selben PEP', () => {
  for (const { file, channel } of CHANNELS) {
    it(`${file} ruft den gemeinsamen PEP mit Kanal "${channel}"`, () => {
      const s = src(file);
      expect(s).toContain("from '../_shared/pdp/botmessage.ts'");
      expect(s).toContain('await enforceBotMessage(');
      expect(s).toContain(`channel: '${channel}'`);
    });

    it(`${file} führt keine eigene Policy-Auswertung`, () => {
      // Ein Kanal, der `decide` selbst aufruft, hat wieder seine eigene
      // Abbildung — genau die Fragmentierung, die P2-5 beseitigt.
      const s = src(file);
      expect(s).not.toContain("from '../_shared/pdp/decide.ts'");
      expect(s).not.toContain('evaluateSnapshot(');
    });

    it(`${file} prüft VOR dem Modellaufruf`, () => {
      // Danach ist das Geld ausgegeben, und bei WhatsApp und Voice ist die
      // Antwort bereits erzeugt. Eine Prüfung nach dem Versand ist ein
      // Protokoll, keine Schranke.
      const s = src(file);
      const pep = s.indexOf('await enforceBotMessage(');
      // `await runAiTool(` und nicht `runAiTool(`: Die Kopfkommentare der
      // Kanäle beschreiben den Ablauf und nennen `runAiTool('bot_reply')` —
      // das ist kein Aufruf und stand vor allem anderen in der Datei.
      const ai = s.indexOf('await runAiTool(');
      expect(pep).toBeGreaterThan(-1);
      expect(ai).toBeGreaterThan(-1);
      expect(pep).toBeLessThan(ai);
    });

    it(`${file} sendet dem Absender nur safe_reply, nie die Begründung`, () => {
      const s = src(file);
      const blockBranch = s.slice(s.indexOf('if (!verdict.allowed)'), s.indexOf('if (!verdict.allowed)') + 1600);
      // Die Begründung darf im Prüfpfad stehen (metadata/audit payload),
      // aber nicht als ausgehender Text.
      expect(blockBranch).toContain('verdict.safe_reply');
      expect(blockBranch).not.toMatch(/reply:\s*verdict\.reasons/);
      expect(blockBranch).not.toMatch(/sendWhatsAppText\([^)]*verdict\.reasons/);
      expect(blockBranch).not.toMatch(/return\s+verdict\.reasons/);
    });
  }
});

describe('Das Shadow-Protokoll wird überall als Objekt aufgerufen', () => {
  // Der Fehler aus P2-3: sechs Positionsargumente gegen eine
  // Objekt-Signatur, hinter `.catch(() => {})`. Kein Gate konnte ihn sehen —
  // `tsc --noEmit` deckt `supabase/functions` nicht ab, `check:edge-syntax`
  // ist ein Parse-Check, `check:edge-refs` prüft nur, ob Namen auflösen.
  // Diese Prüfung schliesst die Lücke für genau diese Fehlerklasse.

  function walk(dir: string, out: string[] = []): string[] {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p, out);
      else if (e.name.endsWith('.ts')) out.push(p);
    }
    return out;
  }

  it('kein Aufruf übergibt das zweite Argument als String', () => {
    const offenders: string[] = [];
    for (const file of walk(FUNCTIONS)) {
      const s = readFileSync(file, 'utf8');
      if (!s.includes('logShadowComparison(')) continue;
      // Die Definition in decide.ts ist selbst ein Treffer auf
      // `logShadowComparison(` — sie ist die Signatur, nicht ihr Missbrauch.
      if (file.endsWith('_shared/pdp/decide.ts')) continue;
      for (const m of s.matchAll(/logShadowComparison\(\s*([^)]*?)(?:\{|\))/gs)) {
        const head = m[1];
        // Korrekt ist `logShadowComparison(admin, {` — nach dem ersten Komma
        // folgt direkt eine geschweifte Klammer. Steht dort etwas anderes,
        // ist es ein Positionsargument.
        const afterFirstComma = head.split(',').slice(1).join(',').trim();
        if (afterFirstComma.length > 0) {
          offenders.push(`${file.replace(FUNCTIONS, '')}: logShadowComparison(${head.trim()}…`);
        }
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it('der Publish Gate protokolliert wieder — und zwar mit tenant_id', () => {
    const s = src('siteos/handlers/publish-gate.ts');
    const call = s.slice(s.indexOf('await logShadowComparison('));
    expect(call.slice(0, 400)).toContain('tenant_id: ctx.tenantId');
    expect(call.slice(0, 400)).toContain("source: 'siteos_publish'");
  });
});

describe('Vokabular von Code und Datenbank stimmt überein', () => {
  it('jede Quelle im TypeScript-Typ steht auch in der CHECK-Bedingung', () => {
    // Ein Wert, den nur eine der beiden Seiten kennt, fällt erst beim Insert
    // auf — und der läuft im Hintergrund.
    const ts = src('_shared/pdp/decide.ts');
    // Ab der Signatur von logShadowComparison suchen, sonst trifft
    // `indexOf('source:')` das `policy_source:` weiter oben in der Datei.
    const sig = ts.indexOf('export async function logShadowComparison');
    const typeBlock = ts.slice(ts.indexOf('source:', sig), ts.indexOf('legacy_status:', sig));
    const inCode = [...typeBlock.matchAll(/'([a-z0-9-_]+)'/g)].map((m) => m[1]).sort();

    // NICHT gegen eine feste Migration pruefen: Die Bedingung wird erweitert,
    // sobald ein Kanal dazukommt (P2-2 hat es getan). Ein fester Dateiname
    // liesse den Test rot werden, obwohl beide Seiten stimmen — und der
    // naheliegende „Fix" waere dann, die Pruefung zu entschaerfen. Massgeblich
    // ist die zuletzt angewandte Migration, also die mit der hoechsten Version.
    const MIGRATIONS = resolve(__dirname, '../../supabase/migrations');
    const massgeblich = readdirSync(MIGRATIONS)
      .filter((f) => f.endsWith('.sql'))
      .sort()
      .filter((f) => readFileSync(resolve(MIGRATIONS, f), 'utf8')
        .includes('pdp_shadow_log_source_check'))
      .pop();
    expect(massgeblich, 'keine Migration definiert pdp_shadow_log_source_check').toBeTruthy();

    const sql = readFileSync(resolve(MIGRATIONS, massgeblich!), 'utf8');
    const checkStart = sql.indexOf('CHECK (source IN (');
    const checkBlock = sql.slice(checkStart, sql.indexOf('));', checkStart));
    const inSql = [...checkBlock.matchAll(/'([a-z0-9-_]+)'/g)].map((m) => m[1]).sort();

    expect(inCode.length).toBeGreaterThan(0);
    expect(inCode).toEqual(inSql);
  });
});
