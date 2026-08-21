// siteos — Domänen-Router für die SiteOS-Schreibpfade.
//
//   POST /functions/v1/siteos/discover         Ausgangsseite lesen (auth + tenant)
//   POST /functions/v1/siteos/public-discover  HTML-Crawl ohne Login (Photoreal-Builder)
//   POST /functions/v1/siteos/builder          Prompt → geprüfter Blueprint
//   POST /functions/v1/siteos/runtime-scan     die acht Laufzeit-Analysen
//   POST /functions/v1/siteos/agents           die sieben asynchronen Agenten
//
// ## Warum ein Router und nicht vier Functions
//
// Zum Zeitpunkt des Umbaus galt eine Obergrenze von 100 Edge Functions als
// belegt — ein früherer Deploy war mit `HTTP 402: Max number of functions
// reached for project` gescheitert. Vier Einzel-Functions hätten vier Slots
// gekostet, ein Router kostet einen.
//
// Beim ersten Deploy stellte sich heraus, dass die Grenze dort nicht mehr
// liegt: `siteos` ging als 101. Function ohne Fehler durch. Der Router bleibt
// trotzdem richtig — Endpunkte, die dieselbe Vorprüfung und denselben
// Kern (`packages/siteos-core`) teilen, gehören in einen Slot, unabhängig
// davon, wie viele noch frei sind.
//
// Anders als bei der Konsolidierung K1 (`enterprise-ai-os`) gibt es hier
// **keinen Cutover-Zeitraum**: Keine der Functions war je in Produktion.
// Es verschwindet also kein Endpunkt, der gerade bedient wird.
//
// Jeder Handler behandelt Preflight, Methode, Bearer-Token und die
// Mandanten-Zugehörigkeit weiterhin selbst. `public-discover` ist die
// bewusste Ausnahme: Der Kunde muss die rekonstruierte Seite sehen, bevor
// er ein Konto anlegt.

import { jsonError } from '../_shared/gateway.ts';
import { resolveEndpoint } from './resolve.ts';
import { handle as agents } from './handlers/agents.ts';
import { handle as builder } from './handlers/builder.ts';
import { handle as discover } from './handlers/discover.ts';
import { handle as publicDiscover } from './handlers/public-discover.ts';
import { handle as runtimeScan } from './handlers/runtime-scan.ts';

const routes: Record<string, (req: Request) => Response | Promise<Response>> = {
  'agents': agents,
  'builder': builder,
  'discover': discover,
  'public-discover': publicDiscover,
  'runtime-scan': runtimeScan,
};

Deno.serve((req) => {
  const endpoint = resolveEndpoint(new URL(req.url).pathname);
  const handler = endpoint ? routes[endpoint] : undefined;
  if (!handler) {
    // Fehlerhülle wie in allen Handlern (`{ ok:false, error:{ code, message } }`),
    // damit ein Tippfehler im Pfad im Client denselben Weg nimmt wie jeder
    // andere Fehler — und nicht als „ungültige Server-Antwort" auffällt.
    return jsonError(
      404,
      'UNKNOWN_ENDPOINT',
      `unknown endpoint; known: ${Object.keys(routes).sort().join(', ')}`,
    );
  }
  return handler(req);
});
