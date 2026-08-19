// siteos — Domänen-Router für die SiteOS-Schreibpfade.
//
//   POST /functions/v1/siteos/discover      Ausgangsseite lesen
//   POST /functions/v1/siteos/builder       Prompt → geprüfter Blueprint
//   POST /functions/v1/siteos/runtime-scan  die acht Laufzeit-Analysen
//   POST /functions/v1/siteos/agents        die sieben asynchronen Agenten
//
// ## Warum ein Router und nicht vier Functions
//
// Die Organisation läuft auf dem Supabase-Free-Plan mit hartem Limit von
// 100 Edge Functions; belegt sind 100. Jeder weitere Deploy scheitert mit
// `HTTP 402: Max number of functions reached for project`
// (docs/runbooks/edge-function-kontingent.md). Als vier Einzel-Functions
// kostet SiteOS vier Slots, die es nicht gibt — als Router kostet es einen.
// Damit ist der Weg zur Freischaltung nicht mehr „vier Slots tauschen",
// sondern „einen".
//
// Anders als bei der Konsolidierung K1 (`enterprise-ai-os`) gibt es hier
// **keinen Cutover-Zeitraum**: Keine der vier Functions war je in Produktion.
// Es verschwindet also kein Endpunkt, der gerade bedient wird.
//
// Jeder Handler behandelt Preflight, Methode, Bearer-Token und die
// Mandanten-Zugehörigkeit weiterhin selbst — unverändert aus den
// Einzel-Functions übernommen. Der Router löst nur den Pfad auf. Das ist
// Absicht: Eine gemeinsame Vorprüfung im Router hätte die vier Handler beim
// Verschieben verändert, und eine Änderung an der Zugriffsprüfung ist genau
// die Sorte Änderung, die man nicht nebenbei macht.

import { jsonError } from '../_shared/gateway.ts';
import { resolveEndpoint } from './resolve.ts';
import { handle as agents } from './handlers/agents.ts';
import { handle as builder } from './handlers/builder.ts';
import { handle as discover } from './handlers/discover.ts';
import { handle as runtimeScan } from './handlers/runtime-scan.ts';

const routes: Record<string, (req: Request) => Response | Promise<Response>> = {
  'agents': agents,
  'builder': builder,
  'discover': discover,
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
