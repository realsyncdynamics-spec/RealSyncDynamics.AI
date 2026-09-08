import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Der Browser-Client und sein Deno-Spiegel muessen dieselbe Anfrage bauen.
 *
 * `src/core/ai-gateway/edgeClient.ts` traegt seit jeher den Satz „Keep both
 * files in sync" — durchgesetzt hat ihn nichts. Das Repo sichert vergleichbare
 * Paare ausdruecklich per Test ab (Evidence-Hash-Kanonisierung, RFC-003
 * SQL-Paritaet, `pdp_shadow_known_sources`), und aus demselben Grund: Eine
 * Abweichung bricht nichts sichtbar, sie aendert nur das Verhalten auf einem
 * der beiden Wege.
 *
 * Anlass ist die Aenderung vom 2026-09-08, die `accessToken` eingefuehrt hat.
 * Bliebe sie einseitig, wuerde der Aufruf aus einer Edge Function weiterhin
 * anonym laufen, waehrend der aus dem Browser Identitaet traegt — und niemand
 * saehe es, weil beide Wege weiterhin funktionieren.
 *
 * Geprueft werden die **tragenden Zeilen**, nicht die ganze Datei: Die beiden
 * unterscheiden sich zulaessig in Importpfaden (`./types` vs `./types.ts`) und
 * in ihren Kopfkommentaren.
 */

const FRONTEND = resolve(__dirname, '../../../src/core/ai-gateway/edgeClient.ts');
const DENO = resolve(__dirname, '../../../supabase/functions/_shared/aiGateway/edgeClient.ts');

const read = (p: string) => readFileSync(p, 'utf8');

describe('edgeClient — Browser und Deno-Spiegel', () => {
  it('bauen den Authorization-Header identisch', () => {
    const line = "'authorization': `Bearer ${this.config.accessToken ?? this.config.apiKey}`,";
    expect(read(FRONTEND)).toContain(line);
    expect(read(DENO)).toContain(line);
  });

  it('senden beide den Schluessel unveraendert als apikey', () => {
    const line = "'apikey':         this.config.apiKey,";
    expect(read(FRONTEND)).toContain(line);
    expect(read(DENO)).toContain(line);
  });

  it('kennen beide das optionale accessToken', () => {
    expect(read(FRONTEND)).toContain('accessToken?: string | null;');
    expect(read(DENO)).toContain('accessToken?: string | null;');
  });

  it('bieten beide dieselben Operationen mit derselben Signatur an', () => {
    // Auf die vollen Signaturen gepruefte Zeilen, nicht auf den blossen
    // Methodennamen: `extractJson` ist generisch, und genau daran ist die
    // erste, zu naive Fassung dieses Tests gescheitert.
    const signatures = [
      'generate(request: AiGatewayRequest): Promise<AiGatewayResponse<string>>',
      'extractJson<T>(request: AiGatewayRequest): Promise<AiGatewayResponse<T>>',
      'embed(request: AiGatewayRequest): Promise<AiGatewayResponse<number[]>>',
    ];
    for (const signature of signatures) {
      expect(read(FRONTEND)).toContain(signature);
      expect(read(DENO)).toContain(signature);
    }
  });
});
