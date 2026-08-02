import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Regressionstest für scripts/verify-prerender.mjs.
 *
 * Hintergrund (2026-08-02): Die Live-Site lieferte auf JEDER Route denselben
 * leeren SPA-Shell aus — kein H1, kein Text, identischer <title>. Ursache war
 * ein Build-Pfad ohne Prerender (siehe scripts/build-postprocess.mjs).
 * verify-prerender.mjs ist der Wächter dagegen; dieser Test stellt sicher,
 * dass der Wächter selbst nicht stillschweigend kaputtgeht — ein Check, der
 * immer grün ist, wäre schlimmer als gar keiner.
 */

const SCRIPT = join(process.cwd(), 'scripts', 'verify-prerender.mjs');

/** Minimaler SPA-Shell, wie ihn `vite build` ohne Prerender erzeugt. */
const SHELL = `<!doctype html><html lang="de"><head>
<title>RealSyncDynamics.AI — Runtime-native AI-Governance-Plattform</title>
<meta name="description" content="Europäische Governance-Runtime." />
<script type="application/ld+json">{"@type":"Organization"}</script>
</head><body><div id="root"></div>
<script src="/assets/index-abc.js"></script></body></html>`;

/** Prerenderte Seite: H1 + genug Fließtext, um über der Schwelle zu liegen. */
function rendered(title: string, h1: string): string {
  const body = `${h1} — kontinuierliche Überwachung von Web-, Daten- und KI-Systemen, `.repeat(60);
  return `<!doctype html><html lang="de"><head><title>${title}</title></head>
<body><div id="root"><h1>${h1}</h1><p>${body}</p></div></body></html>`;
}

function runVerify(dist: string) {
  const res = spawnSync('node', [SCRIPT], {
    env: { ...process.env, VERIFY_DIST: dist },
    encoding: 'utf8',
  });
  return { code: res.status, out: `${res.stdout}${res.stderr}` };
}

let tmp: string;

beforeAll(async () => {
  tmp = await mkdtemp(join(tmpdir(), 'verify-prerender-'));
});

afterAll(async () => {
  await rm(tmp, { recursive: true, force: true });
});

describe('verify-prerender', () => {
  it('schlägt fehl, wenn nur der leere SPA-Shell ausgeliefert wird', async () => {
    const dist = join(tmp, 'shell');
    await mkdir(dist, { recursive: true });
    await writeFile(join(dist, 'index.html'), SHELL);
    for (const route of ['pricing', 'ai-act', 'faq', 'security', 'trust', 'docs']) {
      await mkdir(join(dist, route), { recursive: true });
      await writeFile(join(dist, route, 'index.html'), SHELL);
    }

    const { code, out } = runVerify(dist);

    expect(code).toBe(1);
    expect(out).toContain('kein <h1>');
  });

  it('ist grün, wenn Content und eigene Titles im HTML stehen', async () => {
    const dist = join(tmp, 'prerendered');
    await mkdir(dist, { recursive: true });
    await writeFile(join(dist, 'index.html'), rendered('Startseite', 'Das KI-Betriebssystem'));

    // Über der MIN_ROUTES-Schwelle (20) bleiben, sonst greift Check 2.
    for (let i = 0; i < 25; i++) {
      const route = `route-${i}`;
      await mkdir(join(dist, route), { recursive: true });
      await writeFile(join(dist, route, 'index.html'), rendered(`Seite ${i}`, `Überschrift ${i}`));
    }

    const { code, out } = runVerify(dist);

    expect(out).toContain('Content steht im ausgelieferten HTML');
    expect(code).toBe(0);
  });

  it('schlägt fehl, wenn alle Routen sich denselben <title> teilen', async () => {
    const dist = join(tmp, 'same-titles');
    await mkdir(dist, { recursive: true });
    await writeFile(join(dist, 'index.html'), rendered('Immergleich', 'Startseite'));
    for (let i = 0; i < 25; i++) {
      const route = `route-${i}`;
      await mkdir(join(dist, route), { recursive: true });
      await writeFile(join(dist, route, 'index.html'), rendered('Immergleich', `Überschrift ${i}`));
    }

    const { code, out } = runVerify(dist);

    expect(code).toBe(1);
    expect(out).toContain('<title>');
  });
});
