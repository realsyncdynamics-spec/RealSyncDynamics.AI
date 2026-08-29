#!/usr/bin/env node
/**
 * Meldet den Zustand eines Drift-Waechters dorthin, wo jemand hinsieht.
 *
 * ## Warum es das gibt
 *
 * Am 2026-08-29 stellte sich heraus, dass der Migration Drift Guard seit dem
 * 2026-08-26 jeden Morgen rot war — vier Tage lang, ohne dass es jemandem
 * auffiel. Der Waechter hatte funktioniert. Sein Signal stand nur an einer
 * Stelle, an die niemand schaut: im `schedule`-Lauf.
 *
 * Auf Pull Requests laufen diese Waechter bewusst `advisory`, damit
 * bestehender Drift keine fremden PRs blockiert. Diese Begruendung ist
 * richtig — aber sie verlagert das einzige harte Signal in die Nacht.
 *
 * Dieses Skript schliesst die Luecke: Bei einem fehlgeschlagenen
 * `schedule`-Lauf entsteht (oder aktualisiert sich) genau EIN offenes Issue
 * pro Waechter. Wird der Lauf wieder gruen, schliesst sich dasselbe Issue
 * von selbst. Die Issue-Liste ist damit die Wahrheit ueber offene Drift —
 * kein taeglicher Kommentar-Regen, keine stille Nacht.
 *
 * ## Aufruf
 *
 *   node scripts/report-drift-alarm.mjs alarm     (bei fehlgeschlagenem Lauf)
 *   node scripts/report-drift-alarm.mjs resolve   (bei erfolgreichem Lauf)
 *
 * Umgebung: GITHUB_TOKEN, GITHUB_REPOSITORY, GUARD_KEY, GUARD_TITLE, RUN_URL.
 *
 * Das Skript ist absichtlich fehlertolerant: Ein Problem beim Melden darf
 * den Waechter nicht uebertoenen. Es beendet sich immer mit 0 — der
 * Waechter selbst bestimmt den Ausgang des Jobs, nicht sein Melder.
 */

const API = 'https://api.github.com';

/** Unsichtbare Marke, an der das Issue dieses Waechters wiedererkannt wird. */
export function markerFor(guardKey) {
  return `<!-- drift-alarm:${guardKey} -->`;
}

/**
 * Liest den Zaehler aus einem bestehenden Issue-Text zurueck.
 *
 * Bewusst aus dem Text und nicht aus einem eigenen Speicher: Das Issue ist
 * die einzige Quelle, es gibt nichts, was mit ihm auseinanderlaufen koennte.
 */
export function parseState(body) {
  const since = /<!-- seit:([0-9T:.\-Z]+) -->/.exec(body ?? '');
  const count = /<!-- laeufe:(\d+) -->/.exec(body ?? '');
  return {
    since: since ? since[1] : null,
    count: count ? Number.parseInt(count[1], 10) : 0,
  };
}

export function renderBody({ guardKey, guardTitle, runUrl, since, count, nowIso }) {
  const tage = Math.max(1, Math.round((Date.parse(nowIso) - Date.parse(since)) / 86_400_000) + 1);
  return [
    markerFor(guardKey),
    `<!-- seit:${since} -->`,
    `<!-- laeufe:${count} -->`,
    '',
    `## ${guardTitle} schlägt an`,
    '',
    `| | |`,
    `|---|---|`,
    `| Erster roter Lauf | ${since} |`,
    `| Letzter roter Lauf | ${nowIso} |`,
    `| Rote Läufe seitdem | **${count}** |`,
    `| Betroffene Tage | ~${tage} |`,
    '',
    `Letzter Lauf: ${runUrl}`,
    '',
    'Dieses Issue wird von `scripts/report-drift-alarm.mjs` gepflegt und',
    'schließt sich selbst, sobald der Wächter wieder grün ist. Es gibt genau',
    'eines pro Wächter — deshalb kein täglicher Kommentar, sondern ein',
    'fortgeschriebener Stand.',
    '',
    'Auf Pull Requests laufen diese Wächter bewusst `advisory`, damit',
    'bestehender Drift keine fremden PRs blockiert. Das harte Signal steht',
    'allein im nächtlichen Lauf — und stand deshalb bis zum 2026-08-29 vier',
    'Tage lang unbemerkt rot. Genau dafür gibt es dieses Issue.',
  ].join('\n');
}

async function gh(path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      'x-github-api-version': '2022-11-28',
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path} → ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

async function findIssue(repo, guardKey) {
  const marker = markerFor(guardKey);
  // Die Suche laeuft ueber offene Issues statt ueber die Code-Suche: Letztere
  // ist indexverzoegert und haette hier stille Doppel-Issues zur Folge.
  const issues = await gh(`/repos/${repo}/issues?state=open&per_page=100`);
  return issues.find((i) => !i.pull_request && String(i.body ?? '').includes(marker)) ?? null;
}

async function main() {
  const mode = process.argv[2];
  const repo = process.env.GITHUB_REPOSITORY;
  const guardKey = process.env.GUARD_KEY;
  const guardTitle = process.env.GUARD_TITLE ?? guardKey;
  const runUrl = process.env.RUN_URL ?? '';
  const nowIso = new Date().toISOString();

  if (!process.env.GITHUB_TOKEN || !repo || !guardKey) {
    console.error('report-drift-alarm: GITHUB_TOKEN, GITHUB_REPOSITORY und GUARD_KEY noetig — uebersprungen.');
    return;
  }

  const existing = await findIssue(repo, guardKey);
  const title = `⛔ Drift-Alarm: ${guardTitle}`;

  if (mode === 'resolve') {
    if (!existing) {
      console.log('report-drift-alarm: gruen, kein offenes Issue — nichts zu tun.');
      return;
    }
    await gh(`/repos/${repo}/issues/${existing.number}/comments`, {
      method: 'POST',
      body: JSON.stringify({
        body: `✅ Wieder grün seit ${nowIso}. Der Wächter meldet keinen Drift mehr.\n\nLauf: ${runUrl}\n\n---\n_Generated by [Claude Code](https://claude.ai/code)_`,
      }),
    });
    await gh(`/repos/${repo}/issues/${existing.number}`, {
      method: 'PATCH',
      body: JSON.stringify({ state: 'closed', state_reason: 'completed' }),
    });
    console.log(`report-drift-alarm: Issue #${existing.number} geschlossen.`);
    return;
  }

  const prev = parseState(existing?.body);
  const since = prev.since ?? nowIso;
  const count = prev.count + 1;
  const body = renderBody({ guardKey, guardTitle, runUrl, since, count, nowIso });

  if (existing) {
    await gh(`/repos/${repo}/issues/${existing.number}`, {
      method: 'PATCH',
      body: JSON.stringify({ title, body }),
    });
    console.log(`report-drift-alarm: Issue #${existing.number} fortgeschrieben (${count}. roter Lauf).`);
  } else {
    const created = await gh(`/repos/${repo}/issues`, {
      method: 'POST',
      body: JSON.stringify({ title, body }),
    });
    console.log(`report-drift-alarm: Issue #${created.number} angelegt.`);
  }
}

// Nur ausfuehren, wenn direkt aufgerufen — die Hilfsfunktionen oben sind
// importierbar und werden im Test gegen ihre Grenzen geprueft.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  main().catch((e) => {
    // Ein Melder, der den Job zum Scheitern bringt, verdeckt genau das
    // Signal, das er transportieren soll.
    console.error('report-drift-alarm fehlgeschlagen (Waechter-Ergebnis bleibt unberuehrt):', e.message);
  });
}
