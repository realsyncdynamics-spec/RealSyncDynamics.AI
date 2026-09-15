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

// ════════════════════════════════════════════════════════════════════════════
// Zweite Ebene: die HTTP-Antwort
// ════════════════════════════════════════════════════════════════════════════
//
// ## Warum die Job-Ebene allein nicht reicht
//
// Vom 2026-09-10 bis zum 2026-09-15 fielen neun von elf Dispatch-Jobs aus, und
// dieser Guard blieb gruen. Er hatte recht und war trotzdem blind: Nach der
// Schluesselrotation setzte `dispatch_cron_function` den HTTP-Aufruf sauber ab
// — `cron.job_run_details` meldete `succeeded` mit `return_message = '1 row'`.
// Die Empfaenger wiesen ihn mit 401 ab, weil ihre Function Secrets fehlten.
// Diese 401 steht ausschliesslich in `net._http_response`.
//
//   pg_cron ──► job_run_details  "succeeded" ✅   ← hier schaute der Guard
//        └────► HTTP ──► Function  401 ❌          ← hier lag der Ausfall
//
// Fuenf Tage, ~160 Fehlschlaege pro Tag, kein Signal. Derselbe Fehlertyp wie
// der, gegen den dieser Guard ueberhaupt gebaut wurde — nur eine Ebene tiefer.
//
// ## Die Invariante
//
// Nicht „401 ≠ 0" — das waere wieder ein Spezialfall fuer genau den Ausfall,
// den wir schon kennen. Geprueft wird die Zusage selbst:
//
//   Jeder aktive produktive Cron-Job muss innerhalb seiner erwarteten Kadenz
//   tatsaechlich eine erfolgreiche Function-Ausfuehrung erzeugen.
//
// Daraus folgen drei Befundklassen, und zwar alle drei aus einem Satz:
//   A  letzter Lauf fehlgeschlagen        (Job-Ebene, bestehend)
//   B  seit laenger als seiner Kadenz nicht gelaufen  (ausgebliebene Ausfuehrung)
//   C  Antwort war kein 2xx               (Antwort-Ebene, neu)
//
// ## Warum die Antworten nicht je Job zugeordnet werden
//
// `net.http_request_queue` wird beim Eintreffen der Antwort geleert; die URL
// ist danach weg. Eine Zuordnung Antwort→Job ginge nur ueber Zeitstempel und
// waere bei mehreren Jobs in derselben Minute geraten. Der Guard zaehlt
// deshalb: Jede Nicht-2xx-Antwort im Fenster ist ein Befund, und der
// Antwortkoerper benennt die Function ohnehin selbst
// (`{"error":"cron key required"}` etc.). Lieber eine ehrliche Zaehlung als
// eine erfundene Zuordnung.
//
// `net._http_response` haelt nur rund sechs Stunden vor — das Fenster ist
// deshalb bewusst kurz und wird in der Ausgabe mitgenannt.

export const SQL_ANTWORTEN = `
WITH fenster AS (SELECT now() - interval '6 hours' AS ab),
antworten AS (
  SELECT coalesce(r.status_code::text, '(keine Antwort)') AS status,
         count(*)::int AS anzahl,
         min(r.created)::text AS von,
         max(r.created)::text AS bis,
         left((array_agg(r.content ORDER BY r.created DESC))[1], 200) AS beispiel
  FROM net._http_response r, fenster f
  WHERE r.created >= f.ab
  GROUP BY 1
),
laeufe AS (
  SELECT count(*)::int AS anzahl
  FROM cron.job_run_details d
  JOIN cron.job j ON j.jobid = d.jobid
  CROSS JOIN fenster f
  WHERE d.start_time >= f.ab
    AND j.active
    AND j.command LIKE '%dispatch_cron_function%'
)
SELECT 'antwort' AS art, a.status, a.anzahl, a.von, a.bis, a.beispiel FROM antworten a
UNION ALL
SELECT 'dispatch', NULL, l.anzahl, NULL, NULL, NULL FROM laeufe l;`;

/**
 * Groesster erwarteter Abstand zwischen zwei Laeufen, in Minuten.
 *
 * Bewusst kein vollstaendiger Cron-Parser: gebraucht werden die Formen, die im
 * Repo vorkommen. Alles Unbekannte ergibt `null` — dann wird der Job auf
 * Frische NICHT bewertet, statt eine Zahl zu erfinden.
 */
export function erwarteterAbstandMinuten(schedule) {
  const felder = String(schedule || '').trim().split(/\s+/);
  if (felder.length !== 5) return null;
  const [minute, stunde, tag, monat, wochentag] = felder;
  if (monat !== '*') return null;

  const schritt = (feld) => {
    const m = /^\*\/(\d+)$/.exec(feld);
    return m ? Number(m[1]) : null;
  };

  // Tages- oder Wochenbindung schlaegt alles darunter.
  if (wochentag !== '*') return 7 * 24 * 60;
  if (tag !== '*') return 31 * 24 * 60;

  const minutenSchritt = schritt(minute);
  if (minutenSchritt) return minutenSchritt;
  if (!/^\d+$/.test(minute)) return null;

  if (stunde === '*') return 60;
  const stundenSchritt = schritt(stunde);
  if (stundenSchritt) return stundenSchritt * 60;
  if (/^\d+$/.test(stunde)) return 24 * 60;
  return null;
}

/**
 * Klasse B: Jobs, deren letzter Lauf laenger her ist, als ihre Kadenz zulaesst.
 *
 * Toleranz: doppelter Abstand plus 15 Minuten Karenz. Ein einzelner verpasster
 * Tick soll den Guard nicht flattern lassen — zwei verpasste sind ein Befund.
 * Jobs, die nie liefen, gehoeren in die bestehende Klasse `nie` und werden
 * hier uebergangen.
 */
export function evaluateFrische(rows, jetztMs) {
  const veraltet = [];
  for (const r of rows) {
    if (r.active === false || !r.last_run) continue;
    const abstand = erwarteterAbstandMinuten(r.schedule);
    if (!abstand) continue;
    const alterMin = (jetztMs - Date.parse(r.last_run)) / 60000;
    if (!Number.isFinite(alterMin)) continue;
    const grenze = abstand * 2 + 15;
    if (alterMin > grenze) {
      veraltet.push({ ...r, alter_minuten: Math.round(alterMin), grenze_minuten: grenze });
    }
  }
  return veraltet.sort((a, b) => b.alter_minuten / b.grenze_minuten - a.alter_minuten / a.grenze_minuten);
}

/**
 * Klasse C: Antworten, die kein 2xx waren.
 *
 * `dispatchLaeufe` ist die Zahl der Dispatch-Laeufe im selben Fenster. Sie
 * deckt den Fall ab, in dem gar keine Antwort ankommt: Laeufe ohne jede
 * Antwort sind genauso ein Ausfall wie eine 401 — nur noch leiser.
 */
export function evaluateAntworten(zeilen) {
  const antworten = zeilen.filter((z) => z.art === 'antwort');
  const dispatchLaeufe = zeilen.find((z) => z.art === 'dispatch')?.anzahl ?? 0;

  const schlecht = antworten.filter((a) => !/^2\d\d$/.test(String(a.status)));
  const gut = antworten.filter((a) => /^2\d\d$/.test(String(a.status)));
  const summeGut = gut.reduce((s, a) => s + a.anzahl, 0);
  const summeSchlecht = schlecht.reduce((s, a) => s + a.anzahl, 0);

  // Weniger Antworten als Laeufe heisst: irgendwo kam nichts zurueck.
  const ohneAntwort = Math.max(0, dispatchLaeufe - (summeGut + summeSchlecht));

  return {
    schlecht: schlecht.sort((a, b) => b.anzahl - a.anzahl),
    summeGut,
    summeSchlecht,
    dispatchLaeufe,
    ohneAntwort,
  };
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

  async function frage(sql) {
    const resp = await fetch(
      `https://api.supabase.com/v1/projects/${projectId}/database/query`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: sql }),
      },
    );
    if (!resp.ok) {
      throw new Error(`Management API antwortete ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
    }
    return resp.json();
  }

  let rows, antwortZeilen;
  try {
    [rows, antwortZeilen] = await Promise.all([frage(SQL), frage(SQL_ANTWORTEN)]);
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
  const veraltet = evaluateFrische(rows, Date.now());
  const antwort = Array.isArray(antwortZeilen)
    ? evaluateAntworten(antwortZeilen)
    : null;

  console.log(`\nCron-Jobs: ${rows.length} registriert — ${ok.length} zuletzt gruen, ` +
              `${broken.length} zuletzt rot, ${nie.length} nie gelaufen, ${inaktiv.length} inaktiv.\n`);

  for (const r of nie) {
    console.log(`ℹ️  ${r.name} (${r.schedule}) ist aktiv, aber noch nie gelaufen.`);
  }

  let befund = false;

  // ── A: letzter Lauf fehlgeschlagen ────────────────────────────────────────
  if (broken.length > 0) {
    befund = true;
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
  } else {
    console.log('✅ Kein aktiver Job ist im letzten Lauf gescheitert.');
  }

  // ── B: laenger nicht gelaufen, als die Kadenz zulaesst ────────────────────
  if (veraltet.length > 0) {
    befund = true;
    console.error(`\n❌ ${veraltet.length} aktive Cron-Jobs sind ueberfaellig:\n`);
    for (const r of veraltet) {
      console.error(`  ${r.name}  (${r.schedule})`);
      console.error(`    letzter Lauf vor ${r.alter_minuten} min, erlaubt sind ${r.grenze_minuten} min`);
      console.error('');
    }
    console.error('Ein Job, der nicht laeuft, meldet auch keinen Fehler — deshalb faellt\ndieser Fall in der Job-Ebene sonst durch.\n');
  } else {
    console.log('✅ Kein aktiver Job ist ueber seine Kadenz hinaus ueberfaellig.');
  }

  // ── C: Antwort war kein 2xx ───────────────────────────────────────────────
  if (!antwort) {
    console.error('\n⚠️  Antwort-Ebene nicht auswertbar (unerwartetes Format von net._http_response).');
  } else if (antwort.summeSchlecht > 0 || antwort.ohneAntwort > 0) {
    befund = true;
    console.error(
      `\n❌ Im 6-Stunden-Fenster: ${antwort.summeSchlecht} Antworten ohne 2xx` +
      (antwort.ohneAntwort > 0 ? ` und ${antwort.ohneAntwort} Dispatch-Laeufe ohne jede Antwort` : '') +
      ` (${antwort.summeGut} erfolgreich, ${antwort.dispatchLaeufe} Dispatch-Laeufe):\n`,
    );
    for (const a of antwort.schlecht) {
      console.error(`  ${a.anzahl}× HTTP ${a.status}   ${a.von} … ${a.bis}`);
      console.error(`      ${String(a.beispiel ?? '').replace(/\s+/g, ' ').slice(0, 160)}\n`);
    }
    console.error(
      'Ein abgesetzter Aufruf ist keine ausgefuehrte Function. `job_run_details`\n' +
      'meldet `succeeded`, sobald net.http_post die Anfrage eingereiht hat — die\n' +
      'Ablehnung steht nur hier. Anleitung: docs/runbooks/cron-vault-secrets.md\n',
    );
  } else if (antwort.dispatchLaeufe === 0) {
    console.log('ℹ️  Antwort-Ebene: im 6-Stunden-Fenster lief kein Dispatch-Job.');
  } else {
    console.log(`✅ Antwort-Ebene: ${antwort.summeGut} von ${antwort.summeGut} Antworten waren 2xx.`);
  }

  if (!befund) {
    console.log('\n✅ Jeder aktive Job laeuft in seiner Kadenz und erreicht seine Function.');
    process.exit(0);
  }

  console.error(
    'Invariante: Jeder aktive produktive Cron-Job muss innerhalb seiner erwarteten\n' +
    'Kadenz tatsaechlich eine erfolgreiche Function-Ausfuehrung erzeugen.\n',
  );
  process.exit(ADVISORY ? 0 : 1);
}
