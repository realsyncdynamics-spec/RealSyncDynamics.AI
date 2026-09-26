/**
 * optimize-analyze: Autorisierung vor Wirkung.
 *
 * ## Warum es diesen Test gibt
 *
 * Die Function nahm `tenantId` aus dem Body und pruefte ihn gar nicht — es gab
 * keinerlei Auth im Code, nur `if (!tenantId) return 400`. Gearbeitet wurde mit
 * einem Service-Role-Client auf Modulebene, also an RLS vorbei. Am 2026-09-26
 * gegen die deployte Function gemessen: mit dem oeffentlichen Anon-Key (er
 * liegt im Frontend-Bundle und ist ein gueltiges JWT, das Plattform-verify_jwt
 * also passiert) erreichte ein fremder Aufrufer die Datenbankschicht — belegt
 * durch HTTP 500 aus dem UUID-Cast-Fehler bei `tenantId: "nicht-eine-uuid"`,
 * bewusst so gewaehlt, dass der Read vor jedem Write scheitert.
 *
 * Mit einer gueltigen fremden Mandanten-UUID waere daraus geworden:
 *   1. `compliance_score_history` und `risk_dashboard_summary` des fremden
 *      Mandanten gelesen,
 *   2. diese Daten an Anthropic geschickt, auf Betreiberrechnung,
 *   3. `optimization_recommendations` unter dem fremden Mandanten geschrieben.
 *
 * Der Leseschritt unterscheidet diesen Fall von website-operations-agent und
 * enterprise-ai-os-agents-run: dort ging es um Fremdschreiben und
 * Provider-Kosten, hier zusaetzlich um einen Datenabfluss an einen
 * Auftragsverarbeiter (Art. 28 DSGVO, Art. 32 Abs. 1 lit. b).
 *
 * ## Was dieser Test belegt — und was nicht
 *
 * Die Entscheidungslogik (401 ohne Sitzung, 400 ohne Mandanten, 403 bei
 * fremdem Mandanten) liegt in `_shared/auth.ts` und ist hier NICHT neu
 * gebaut. Ihr Laufzeitverhalten ist aus Vitest nicht pruefbar: `auth.ts`
 * importiert `jsr:@supabase/supabase-js`, und `vitest.config.ts` loest
 * `jsr:`-Spezifier nicht auf. Dieselbe Einschraenkung wie in
 * `website-operations-agent-auth.test.ts`.
 *
 * Geprueft wird deshalb am Quelltext, was zuvor verletzt war: dass die
 * Autorisierung ueberhaupt stattfindet, dass sie vor Read, Provider-Aufruf und
 * Write steht, dass der Body-Wert danach nicht mehr verwendet wird, und dass
 * der RLS-umgehende Client nicht mehr ohne Pruefung erreichbar ist.
 * Die Bestaetigung der Statuscodes 403 und 200 braucht echte Sitzungen und
 * gehoert nicht in diese Datei.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../..');
const QUELLE = readFileSync(
  resolve(ROOT, 'supabase/functions/optimize-analyze/index.ts'),
  'utf8',
);

/** Kommentarfrei — die Zusicherungen gelten dem Code, nicht der Prosa. */
const code = QUELLE
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1');

/**
 * Die Hilfsfunktionen stehen im Quelltext OBERHALB von `handleRequest`. Ein
 * Index-Vergleich ueber die ganze Datei traefe ihre Definition statt ihres
 * Aufrufs und wuerde fehlschlagen, obwohl die Reihenfolge stimmt. Die
 * Reihenfolge-Zusicherungen gelten deshalb dem Handler-Rumpf.
 */
function handlerRumpf(): string {
  const i = code.indexOf('async function handleRequest');
  expect(i, 'handleRequest nicht gefunden').toBeGreaterThan(-1);
  return code.slice(i);
}

describe('optimize-analyze: Autorisierung findet statt', () => {
  it('nutzt den kanonischen Resolver aus _shared/auth.ts', () => {
    // Kein zweiter Auth-Pfad und keine eigene Membership-Abfrage — dieselbe
    // Funktion, die website-operations-agent, enterprise-ai-os-agents-run und
    // ai-gateway verwenden.
    // Schreibweise-unabhaengig: diese Datei nutzt doppelte Anfuehrungszeichen,
    // die Referenzfunktionen einfache. Der Import zaehlt, nicht sein Stil.
    expect(code).toMatch(/from ['"]\.\.\/_shared\/auth\.ts['"]/);
    expect(code).toContain('requireAuthAndTenant');
  });

  it('reicht die Ablehnung unveraendert durch', () => {
    expect(code).toContain('const auth = await requireAuthAndTenant(req, body.tenantId)');
    expect(code).toContain('if (auth instanceof Response) return auth');
  });

  it('ersetzt die alte Pflichtfeld-Pruefung, statt sie zu ergaenzen', () => {
    // `if (!tenantId) return 400` war die einzige Huerde und sagte nichts
    // ueber Berechtigung. Der Resolver deckt den Fall mit ab.
    expect(code).not.toMatch(/tenantId required/);
  });
});

describe('optimize-analyze: Autorisierung steht vor jeder Wirkung', () => {
  // Fehlt die Autorisierung ganz, liefert indexOf -1 — und -1 liegt vor
  // allem. Jede Reihenfolge-Zusicherung muss deshalb ZUERST belegen, dass es
  // sie ueberhaupt gibt, sonst ist sie leer wahr und besteht auch auf dem
  // verwundbaren Stand.
  function autorisierungAn(rumpf: string): number {
    const i = rumpf.indexOf('requireAuthAndTenant(req,');
    expect(i, 'Autorisierung fehlt vollstaendig').toBeGreaterThan(-1);
    return i;
  }

  it('vor dem Lesen fremder Compliance-Daten', () => {
    const rumpf = handlerRumpf();
    const auth = autorisierungAn(rumpf);
    const read = rumpf.indexOf('analyzeComplianceTrends(supabase, tenantId)');
    expect(read, 'Aufruf der Leseanalyse nicht gefunden').toBeGreaterThan(-1);
    expect(auth, 'Leseanalyse vor der Autorisierung').toBeLessThan(read);
  });

  it('vor dem Write', () => {
    const rumpf = handlerRumpf();
    const auth = autorisierungAn(rumpf);
    const write = rumpf.indexOf('storeRecommendations(supabase, tenantId,');
    expect(write, 'Write-Aufruf nicht gefunden').toBeGreaterThan(-1);
    expect(auth, 'Write vor der Autorisierung').toBeLessThan(write);
  });

  it('vor dem Provider-Aufruf', () => {
    // Der Anthropic-Aufruf steht NICHT im Handler, sondern in
    // analyzeComplianceTrends. Er ist damit genau dann abgeschirmt, wenn der
    // Aufruf dieser Funktion abgeschirmt ist — und die Funktion kann ihren
    // Client nicht selbst beschaffen (siehe naechster Block). Beides wird hier
    // einzeln belegt, statt es aus der Dateireihenfolge zu schliessen.
    const rumpf = handlerRumpf();
    const auth = autorisierungAn(rumpf);
    const read = rumpf.indexOf('analyzeComplianceTrends(supabase, tenantId)');
    expect(auth).toBeLessThan(read);

    expect(code, 'Provider-Aufruf nicht gefunden').toContain('anthropic.messages.create');
    expect(rumpf, 'Provider-Aufruf direkt im Handler — Reihenfolge nicht mehr belegt')
      .not.toContain('anthropic.messages.create');
  });
});

describe('optimize-analyze: der Service-Role-Client ist nicht ohne Pruefung erreichbar', () => {
  it('kein Service-Role-Client auf Modulebene', () => {
    // Das war der strukturelle Kern des Befunds: ein modulweiter Client mit
    // SUPABASE_SERVICE_ROLE_KEY, den jede Funktion ungeprueft benutzen konnte.
    expect(code).not.toMatch(/createClient\(/);
    expect(code).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it('der Client kommt aus dem geprueften Kontext', () => {
    expect(code).toContain('const supabase = auth.admin');
  });

  it('die Hilfsfunktionen bekommen ihn uebergeben, statt ihn zu beschaffen', () => {
    // So kann keine von ihnen an RLS vorbei arbeiten, ohne dass der Aufrufer
    // die Pruefung durchlaufen hat.
    expect(code).toMatch(/async function analyzeComplianceTrends\(\s*supabase: SupabaseClient/);
    expect(code).toMatch(/async function storeRecommendations\(\s*supabase: SupabaseClient/);
  });
});

describe('optimize-analyze: der genannte Mandant wird nicht weiterverwendet', () => {
  it('body.tenantId kommt genau einmal vor — als Argument der Pruefung', () => {
    // Das ist die eigentliche Zusicherung: nach der Pruefung existiert nur
    // noch der verifizierte Wert. Jede weitere Verwendung waere ein Rueckfall.
    const treffer = code.match(/body\.tenantId/g) ?? [];
    expect(treffer.length).toBe(1);
    expect(code).toContain('requireAuthAndTenant(req, body.tenantId)');
  });

  it('kein Read und kein Write nimmt den ungeprueften Wert', () => {
    expect(code).not.toMatch(/eq\("tenant_id",\s*body\.tenantId\)/);
    expect(code).not.toMatch(/tenant_id:\s*body\.tenantId/);
  });

  it('die Folgeschritte rechnen mit dem geprueften Mandanten', () => {
    expect(code).toContain('const tenantId = auth.tenantId');
    expect(code).toMatch(/tenant_id:\s*tenantId/);
  });
});

describe('optimize-analyze: Plattform-Gate bleibt konsistent', () => {
  const toml = readFileSync(resolve(ROOT, 'supabase/config.toml'), 'utf8');

  it('steht nicht auf verify_jwt = false', () => {
    // Kein Eintrag = Default true. Ein `false` waere hier ein Rueckfall: der
    // Resolver verlangt eine Sitzung, und ohne Plattform-Gate erreichten auch
    // voellig tokenlose Aufrufe erst den Handler.
    const kopf = '[functions.optimize-analyze]';
    const i = toml.indexOf(kopf);
    if (i === -1) return; // kein Eintrag, Default gilt
    const block = toml.slice(i, i + 400);
    expect(block).not.toMatch(/verify_jwt\s*=\s*false/);
  });
});
