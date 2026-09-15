/**
 * cloudflare-deployer: Autorisierung und Ressourcenbindung vor jeder
 * Cloudflare-Operation.
 *
 * ## Warum es diesen Test gibt
 *
 * Die Function haelt `CF_API_TOKEN` und fuehrt damit fuenf Operationen aus:
 * create-pages-project, upload-assets, deploy-to-pages, setup-domain,
 * validate-ssl. Sie hatte keine Eingangspruefung. `project_id` und
 * `tenant_id` kamen aus dem Body und wurden nur auf Vorhandensein geprueft;
 * das Projekt wurde mit `.eq('id', body.project_id)` geladen, ohne Bindung an
 * einen Mandanten.
 *
 * `config.toml` hat keinen Eintrag, es gilt also der Default
 * `verify_jwt = true` — und der Anon-Key ist ein gueltiges JWT, das im
 * Frontend-Bundle ausgeliefert wird. Das vorgelagerte
 * `siteos/handlers/publish-gate.ts` prueft zwar Nutzer und Mitgliedschaft,
 * schuetzt diese Function aber nicht: sie ist eine eigene Function und direkt
 * aufrufbar.
 *
 * Anders als bei den AI-Pfaden geht es hier nicht um Providerkosten, sondern
 * um Infrastruktur-Autoritaet: Deployment und Domain-Bindung.
 *
 * ## Was dieser Test belegt — und was nicht
 *
 * Die Entscheidungslogik (401 ohne Sitzung, 403 bei fremdem Mandanten) liegt
 * in `_shared/auth.ts` und wird von sieben weiteren Functions genutzt. Dieser
 * PR implementiert sie nicht neu. Ihr Laufzeitverhalten ist aus Vitest nicht
 * pruefbar: `auth.ts` importiert `jsr:@supabase/supabase-js`, und
 * `vitest.config.ts` loest `jsr:`-Spezifier nicht auf.
 *
 * Geprueft wird deshalb, was am Quelltext pruefbar ist und was zuvor verletzt
 * war: dass autorisiert wird, dass die Autorisierung VOR jeder
 * Cloudflare-Operation steht, dass das Projekt an den geprueften Mandanten
 * gebunden geladen wird, und dass der vom Aufrufer genannte Mandant danach
 * nicht mehr verwendet wird.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../..');
const QUELLE = readFileSync(
  resolve(ROOT, 'supabase/functions/cloudflare-deployer/index.ts'),
  'utf8',
);

/** Kommentarfrei — die Zusicherungen gelten dem Code, nicht der Prosa. */
const code = QUELLE
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1');

/** Die fuenf privilegierten Aktionen, je Aufrufstelle im Handler. */
const AKTIONEN = [
  'createPagesProject(',
  'uploadAssetsToR2(',
  'deployToPages(',
  'setupDomain(',
  'validateSSL(',
];

describe('cloudflare-deployer: Autorisierung findet statt', () => {
  it('nutzt den gemeinsamen Resolver aus _shared/auth.ts', () => {
    expect(code).toContain("from '../_shared/auth.ts'");
    expect(code).toContain('requireAuthAndTenant');
  });

  it('reicht die Ablehnung unveraendert durch', () => {
    expect(code).toContain('const auth = await requireAuthAndTenant(req, body.tenant_id)');
    expect(code).toContain('if (auth instanceof Response) return auth');
  });
});

describe('cloudflare-deployer: nichts Privilegiertes vor der Autorisierung', () => {
  // Fehlt die Autorisierung, liefert indexOf -1 — und -1 liegt vor allem.
  // Jede Reihenfolge-Zusicherung belegt deshalb ZUERST, dass es sie gibt.
  function autorisierungAn(): number {
    const i = code.indexOf('requireAuthAndTenant(req,');
    expect(i, 'Autorisierung fehlt vollstaendig').toBeGreaterThan(-1);
    return i;
  }

  it.each(AKTIONEN)('vor %s', (aufruf) => {
    const auth = autorisierungAn();
    const stelle = code.indexOf(aufruf);
    expect(stelle, `Aktion ${aufruf} nicht gefunden`).toBeGreaterThan(-1);
    expect(auth, `${aufruf} liegt vor der Autorisierung`).toBeLessThan(stelle);
  });

  it('vor dem ersten Datenbankzugriff', () => {
    const auth = autorisierungAn();
    const ersterZugriff = code.search(/admin\s*\n?\s*\.from\(|admin\.from\(/);
    expect(ersterZugriff, 'kein Datenbankzugriff gefunden').toBeGreaterThan(-1);
    expect(auth, 'Datenbankzugriff vor der Autorisierung').toBeLessThan(ersterZugriff);
  });

  it('vor jedem deployment_logs-Eintrag', () => {
    const auth = autorisierungAn();
    const logs = [...code.matchAll(/logDeploymentEvent\(/g)];
    expect(logs.length, 'kein logDeploymentEvent gefunden').toBeGreaterThan(0);
    for (const treffer of logs) {
      expect(auth, `Log an Position ${treffer.index} liegt vor der Autorisierung`)
        .toBeLessThan(treffer.index!);
    }
  });
});

describe('cloudflare-deployer: das Projekt ist an den Mandanten gebunden', () => {
  it('laedt website_projects mit tenant_id-Bindung', () => {
    // Das ist die Sperre fuer alle fuenf Aktionen: sie liegen hinter diesem
    // Load. Ohne die Bindung wirkt eine fremde project_id auf fremde Projekte.
    expect(code).toMatch(/\.eq\('id',\s*body\.project_id\)/);
    expect(code).toMatch(/\.eq\('tenant_id',\s*tenantId\)/);
  });

  it('die Bindung steht im selben Query wie die id', () => {
    const start = code.indexOf("from('website_projects')");
    expect(start, 'website_projects-Query nicht gefunden').toBeGreaterThan(-1);
    const query = code.slice(start, start + 320);
    expect(query, 'tenant_id-Bindung fehlt im Projekt-Load').toContain("eq('tenant_id', tenantId)");
  });

  it('der Projekt-Load steht vor jeder Aktion', () => {
    const load = code.indexOf("from('website_projects')");
    for (const aufruf of AKTIONEN) {
      const stelle = code.indexOf(aufruf);
      expect(load, `${aufruf} liegt vor dem Projekt-Load`).toBeLessThan(stelle);
    }
  });
});

describe('cloudflare-deployer: der genannte Mandant wird nicht weiterverwendet', () => {
  it('body.tenant_id kommt genau einmal vor — als Argument der Pruefung', () => {
    const treffer = code.match(/body\.tenant_id/g) ?? [];
    expect(treffer.length).toBe(1);
    expect(code).toContain('requireAuthAndTenant(req, body.tenant_id)');
  });

  it('deployment_logs laufen auf den geprueften Mandanten', () => {
    expect(code).not.toMatch(/logDeploymentEvent\([^)]*body\.tenant_id/);
    expect(code).toMatch(/logDeploymentEvent\(body\.project_id,\s*tenantId/);
  });
});

describe('cloudflare-deployer: unveraendert erhalten', () => {
  it('alle fuenf Aktionen sind weiterhin erreichbar', () => {
    for (const a of [
      'create-pages-project', 'upload-assets', 'deploy-to-pages',
      'setup-domain', 'validate-ssl',
    ]) {
      expect(code, `Aktion ${a} fehlt`).toContain(`'${a}'`);
    }
  });

  it('CF_API_TOKEN bleibt unangetastet', () => {
    // Der Fix aendert die Autorisierung, nicht den Cloudflare-Zugang.
    expect(code).toContain('CF_API_TOKEN');
    expect(code).toContain('CLOUDFLARE_NOT_CONFIGURED');
  });

  it('kein Entitlement, kein Usage, keine Kosten in diesem PR', () => {
    // Bewusst ausserhalb des Security-Fixes — gehoert in die gemeinsame
    // Boundary, nicht in eine Sonderloesung hier.
    expect(code).not.toContain('gateFeature');
    expect(code).not.toContain('consumeUsage');
    expect(code).not.toContain('reserveLlmBudget');
  });
});

describe('cloudflare-deployer: Plattform-Gate bleibt konsistent', () => {
  const toml = readFileSync(resolve(ROOT, 'supabase/config.toml'), 'utf8');

  it('steht nicht auf verify_jwt = false', () => {
    const kopf = '[functions.cloudflare-deployer]';
    const start = toml.indexOf(kopf);
    if (start === -1) return; // kein Eintrag: Default true, korrekt
    const rest = toml.slice(start + kopf.length);
    const next = rest.search(/\n\[/);
    const stanza = rest.slice(0, next === -1 ? rest.length : next);
    expect(stanza).not.toMatch(/verify_jwt\s*=\s*false/);
  });
});
