/**
 * SYNC-Evaluierung mit ECHTEN Modellantworten (kostenpflichtig).
 *
 * Schickt die 10 Szenarien aus test/sync/sync-scenarios.json an
 * governance-agent (op 'chat_anon') und prüft jede Antwort mit
 * evaluateSyncReply + den Erwartungen des Szenarios.
 *
 * Läuft NUR mit ausdrücklicher Freigabe:
 *   SYNC_EVAL_ALLOW_PAID=1 \
 *   SYNC_EVAL_URL=https://<projekt>.supabase.co/functions/v1/governance-agent \
 *   SYNC_EVAL_ANON_KEY=<öffentlicher anon key> \
 *   npx tsx scripts/sync-eval.ts
 *
 * Hinweise: 10 Aufrufe = 10 Modellaufrufe. Anon-Limit 5/min/IP und
 * Monatskontingent je IP beachten; zwischen den Aufrufen wird 15 s gewartet.
 * Bevorzugt gegen Staging, nicht gegen Produktion.
 */
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { evaluateSyncReply } from '../supabase/functions/_shared/syncReplyGuard';

const { SYNC_EVAL_ALLOW_PAID, SYNC_EVAL_URL, SYNC_EVAL_ANON_KEY } = process.env;
if (SYNC_EVAL_ALLOW_PAID !== '1' || !SYNC_EVAL_URL) {
  console.error('Abbruch: SYNC_EVAL_ALLOW_PAID=1 und SYNC_EVAL_URL erforderlich (kostenpflichtige Modellaufrufe).');
  process.exit(2);
}

const { scenarios } = JSON.parse(readFileSync('test/sync/sync-scenarios.json', 'utf8')) as {
  scenarios: { id: string; message: string; mustMentionAny: string[]; mustMentionAll?: string[] }[];
};

let failed = 0;
for (const s of scenarios) {
  const res = await fetch(SYNC_EVAL_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(SYNC_EVAL_ANON_KEY ? { apikey: SYNC_EVAL_ANON_KEY, authorization: `Bearer ${SYNC_EVAL_ANON_KEY}` } : {}),
    },
    body: JSON.stringify({ op: 'chat_anon', session_id: randomUUID(), message: s.message, history: [] }),
  });
  const data = (await res.json().catch(() => ({}))) as { response?: string };
  const reply = data.response ?? '';
  const guard = evaluateSyncReply(reply);
  const mention = s.mustMentionAny.some((k) => reply.includes(k)) && (s.mustMentionAll ?? []).every((k) => reply.includes(k));
  const ok = res.ok && guard.ok && mention;
  if (!ok) failed++;
  console.log(JSON.stringify({ id: s.id, http: res.status, ok, violations: guard.violations, mention, reply }));
  await new Promise((r) => setTimeout(r, 15_000));
}
console.log(`Ergebnis: ${scenarios.length - failed}/${scenarios.length} bestanden`);
process.exit(failed ? 1 : 0);
