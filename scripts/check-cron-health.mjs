#!/usr/bin/env node
// Cron-Health-Guard.
//
// ## Warum es diesen Guard gibt
//
// Am 2026-09-06 gegen die Live-DB gemessen: vier pg_cron-Jobs scheitern seit
// dem 2026-08-12 bei JEDEM Lauf — zusammen 3629 Fehllaeufe, an einer einzigen
// Ursache (das Vault-Secret `service_role_key` fehlt):
//
//   scan-scheduler-dispatch        */15 * * * *   2403 Fehllaeufe
//   governance-monitoring-hourly   15 * * * *      601
//   memory-decay-hourly            0 * * * *       600
//   governance-monitoring-daily    0 2 * * *        25
//
// Keiner dieser Ausfaelle war irgendwo sichtbar. Die drei bestehenden Guards
// pruefen Migrationen, Edge-Function-Existenz und Funktions-ACLs — dass ein
// registrierter Job zwar existiert, aber nie durchlaeuft, sieht keiner von
// ihnen. CLAUDE.md §5 fuehrte nur `memory-decay-hourly`; die drei anderen
// standen nirgends.
//
// Das ist derselbe Fehlertyp wie beim ACL-Vorfall vom 2026-08-23: Der Zustand
// war messbar, nur hat ihn niemand gemessen. Und es ist derselbe Fehlertyp wie
// bei `drift-alert.yml` selbst — ein Ausfall, der niemandem auffaellt, weil er
// leise ist.
//
// ## Warum „letzter Lauf fehlgeschlagen" die Regel ist
//
// Nicht die Fehlerquote, nicht ein Schwellwert: der **letzte** Lauf. Ein Job,
// dessen juengster Lauf fehlschlaegt, tut gerade nichts — unabhaengig davon,
// wie gut seine Historie aussieht. Umgekehrt ist ein Job mit alten Fehlern und
// gruenem letzten Lauf repariert und soll den Guard nicht rot halten. Genau
// diese Unterscheidung war bei der Messung noetig: `dsr-erasure-sweep` und
// `agent-os-runner-hourly` tragen hunderte alte Fehllaeufe aus der Zeit vor
// `20260820000000_cron_dispatch_fix.sql` und laufen heute sauber.
//
// ## Keine Ausnahmeliste
//
// Bewusst ohne Allowlist. Ein bekannter Ausfall, der den Guard gruen laesst,
// ist wieder ein Befund, den niemand sieht. Der Guard bleibt rot, bis der
// Betreiber das fehlende Secret anlegt — `drift-alert.yml` haelt dafuer genau
// ein Issue offen. Anleitung: docs/runbooks/cron-vault-secrets.md
//
// Zugriff: Supabase Management API (POST /v1/projects/{ref}/database/query)
// mit SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_ID — dieselben Secrets wie der
// Migrations- und der ACL-Guard, keine neue Dependency. Ohne Secrets
// (Fork-PRs) wird sauber uebersprungen (Exit 0). API-/Netz-Fehler failen NICHT
// hart (≠ Befund) — aber es gibt dann auch keinen gruenen Haken.

export const SQL = `
WITH letzter AS (
  SELECT DISTINCT ON (d.jobid)
         d.jobid, d.status, d.start_time, d.return_message
  FROM cron.job_run_details d
  ORDER BY d.jobid, d.start_time DESC
),
zaehler AS (
  SELECT d.jobid,
         count(*) FILTER (WHERE d.status = 'failed')    AS fehler,
         count(*) FILTER (WHERE d.status = 'succeeded') AS erfolge,
         max(d.start_time) FILTER (WHERE d.status = 'succeeded') AS letzter_erfolg
  FROM cron.job_run_details d
  GROUP BY d.jobid
)
SELECT j.jobname                       AS name,
       j.schedule                      AS schedule,
       j.active                        AS active,
       l.status                        AS last_status,
       l.start_time                    AS last_run,
       left(coalesce(l.return_message, ''), 200) AS last_message,
       coalesce(z.fehler, 0)           AS fehler,
       coalesce(z.erfolge, 0)          AS erfolge,
       z.letzter_erfolg                AS letzter_erfolg
FROM cron.job j
LEFT JOIN letzter l ON l.jobid = j.jobid
LEFT JOIN zaehler z ON z.jobid = j.jobid
ORDER BY j.jobname;`;

/**
 * Teilt die Jobzeilen in vier Klassen. Rein, ohne Netz — damit die Regel
 * testbar ist und nicht erst im naechtlichen Lauf auffaellt.
 *
 * broken   letzter Lauf fehlgeschlagen → der Job tut gerade nichts
 * nie      aktiv, aber noch nie gelaufen → meist frisch registriert, kein Fehler
 * inaktiv  bewusst abgeschaltet, wird nicht bewertet
 * ok       letzter Lauf erfolgreich
 */
export function evaluate(rows) {
  const broken = [], nie = [], inaktiv = [], ok = [];
  for (const r of rows) {
    if (r.active === false) { inaktiv.push(r); continue; }
    if (!r.last_status) { nie.push(r); continue; }
    if (r.last_status === 'failed') { broken.push(r); continue; }
    ok.push(r);
  }
  // Der lauteste Ausfall zuerst: wer nie einen Erfolg hatte, ist nicht
  // „kaputtgegangen", sondern hat nie funktioniert.
  broken.sort((a, b) => (a.erfolge - b.erfolge) || (b.fehler - a.fehler));
  return { broken, nie, inaktiv, ok };
}

/**
 * Normalisiert eine Fehlermeldung auf ihre Ursache.
 *
 * Roh gruppiert die Meldung NICHT, und das war am 2026-09-06 im ersten Lauf
 * dieses Guards zu sehen: Die vier Jobs scheitern an einem einzigen fehlenden
 * Vault-Secret, `dispatch_cron_function` stellt aber die aufgerufene Function
 * voran ("Cron-Dispatch \"memory-decay-worker\" abgebrochen: …"). Damit zerfiel
 * die eine Ursache in drei Gruppen und die Ausgabe behauptete das Gegenteil
 * dessen, wofuer die Gruppierung da ist.
 *
 * Zwei Normalisierungen, beide gezielt:
 *   1. Alles ab `CONTEXT:` weg — der plpgsql-Aufrufpfad haengt an jeder
 *      Meldung und traegt nichts zur Unterscheidung bei.
 *   2. Den Namen der aufgerufenen Function durch einen Platzhalter ersetzen.
 *      `"service_role_key"` bleibt ausdruecklich stehen: Das IST die Ursache,
 *      und zwei Jobs mit verschiedenen fehlenden Secrets sind zwei Befunde.
 */
export function causeKey(message) {
  return (message || '(ohne Meldung)')
    .split(/\n\s*CONTEXT:/)[0]
    .replace(/Cron-Dispatch\s+"[^"]*"/g, 'Cron-Dispatch <function>')
    .trim();
}

/** Gruppiert Ausfaelle nach ihrer Ursache — meist steckt eine hinter vielen Jobs. */
export function groupByCause(broken) {
  const nach = new Map();
  for (const r of broken) {
    const ursache = causeKey(r.last_message);
    if (!nach.has(ursache)) nach.set(ursache, []);
    nach.get(ursache).push(r.name);
  }
  return [...nach.entries()].sort((a, b) => b[1].length - a[1].length);
}

// ── Ausfuehrung ──────────────────────────────────────────────────────────────
// Nur wenn direkt gestartet: der Test importiert evaluate/groupByCause.

const direkt = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (direkt) {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const projectId = process.env.SUPABASE_PROJECT_ID;

  if (!token || !projectId) {
    console.log('ℹ️  Cron-Health-Check uebersprungen (keine Supabase-Secrets).');
    process.exit(0);
  }

  const ADVISORY = (process.env.CRON_HEALTH_MODE ?? 'fail') === 'advisory';

  let rows;
  try {
    const resp = await fetch(
      `https://api.supabase.com/v1/projects/${projectId}/database/query`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: SQL }),
      },
    );
    if (!resp.ok) {
      throw new Error(`Management API antwortete ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
    }
    rows = await resp.json();
  } catch (e) {
    console.error('⚠️  Cron-Abfrage nicht ausfuehrbar (Infra, kein Befund):', e.message);
    process.exit(0);
  }

  // Format-Wachhund wie bei den anderen Guards: keine Zeile heisst, dass
  // NICHTS geprueft wurde — dann keine Entwarnung ausgeben.
  if (!Array.isArray(rows) || rows.length === 0) {
    console.error(
      '\n❌ Keine Job-Zeilen von der Management API erhalten. Entweder ist pg_cron\n' +
      'nicht eingerichtet oder das Antwortformat hat sich geaendert — geprueft\n' +
      'wurde in beiden Faellen nichts. Parser in scripts/check-cron-health.mjs pruefen.',
    );
    process.exit(ADVISORY ? 0 : 1);
  }

  const { broken, nie, inaktiv, ok } = evaluate(rows);

  console.log(`\nCron-Jobs: ${rows.length} registriert — ${ok.length} zuletzt gruen, ` +
              `${broken.length} zuletzt rot, ${nie.length} nie gelaufen, ${inaktiv.length} inaktiv.\n`);

  for (const r of nie) {
    console.log(`ℹ️  ${r.name} (${r.schedule}) ist aktiv, aber noch nie gelaufen.`);
  }

  if (broken.length === 0) {
    console.log('✅ Kein aktiver Job ist im letzten Lauf gescheitert.');
    process.exit(0);
  }

  console.error(`\n❌ ${broken.length} aktive Cron-Jobs sind im letzten Lauf gescheitert:\n`);
  for (const r of broken) {
    const nie_gelaufen = r.erfolge === 0 ? '  — noch NIE erfolgreich' : `  — letzter Erfolg: ${r.letzter_erfolg}`;
    console.error(`  ${r.name}  (${r.schedule})`);
    console.error(`    letzter Lauf: ${r.last_run}  ·  ${r.fehler} Fehllaeufe insgesamt${nie_gelaufen}`);
    console.error(`    Meldung: ${causeKey(r.last_message)}`);
    console.error('');
  }

  const ursachen = groupByCause(broken);
  if (ursachen.length < broken.length) {
    console.error('Nach Ursache gruppiert — eine Konfiguration kann viele Jobs lahmlegen:\n');
    for (const [ursache, jobs] of ursachen) {
      console.error(`  ${jobs.length}× ${jobs.join(', ')}`);
      console.error(`      ${ursache}\n`);
    }
  }

  console.error(
    'Ein registrierter Job ist kein laufender Job. Fehlt einem Dispatch sein\n' +
    'Vault-Secret, meldet er das bei jedem Lauf — und niemand liest es.\n' +
    'Anleitung: docs/runbooks/cron-vault-secrets.md\n',
  );

  process.exit(ADVISORY ? 0 : 1);
}
