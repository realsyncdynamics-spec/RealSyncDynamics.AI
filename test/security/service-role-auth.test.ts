/**
 * F-04 — `requireServiceRole` und der systemische Regressionsschutz gegen die
 * Praefix-Auth-Klasse.
 *
 * Befund F-04 (AUDIT/18_FINDINGS.md) war keine einzelne Luecke, sondern ein
 * Muster: mehrere Functions pruefen
 *
 *     if (!auth?.startsWith('Bearer ')) return 401;
 *
 * und arbeiten danach mit Service-Role weiter. Das Plattform-Gate
 * (`verify_jwt`, default true) faengt zwar ungueltige Tokens ab — aber nicht
 * den eingeloggten Nutzer, der anschliessend eine fremde `tenant_id` schickt
 * oder einen Cron-Endpunkt von Hand anstoesst.
 *
 * Der zweite Block hier ist der eigentliche Wert: er prueft nicht einzelne
 * Functions, sondern dass das MUSTER nirgends zurueckkommt.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
// Import aus dem Deno-freien Modul, NICHT aus auth.ts: dessen
// `jsr:@supabase/supabase-js@2` ist ausserhalb von Deno nicht auflösbar und
// haette den Typecheck gebrochen (tsconfig schliesst supabase/functions aus,
// ein Import aus test/ zieht die Datei aber trotzdem ins Programm).
import { timingSafeEqual } from '../../supabase/functions/_shared/timingSafeEqual';

// ── timingSafeEqual ────────────────────────────────────────────────────────

describe('timingSafeEqual', () => {
  it('vergleicht gleiche Strings positiv', () => {
    expect(timingSafeEqual('service-role-key', 'service-role-key')).toBe(true);
    expect(timingSafeEqual('', '')).toBe(true);
  });

  it('lehnt Abweichungen ab — auch bei gleicher Laenge', () => {
    expect(timingSafeEqual('abcdef', 'abcdeF')).toBe(false);
    expect(timingSafeEqual('abcdef', 'Abcdef')).toBe(false);
  });

  it('lehnt unterschiedliche Laengen ab', () => {
    expect(timingSafeEqual('abc', 'abcd')).toBe(false);
    expect(timingSafeEqual('', 'a')).toBe(false);
  });

  it('INVARIANTE: ein Praefix des Secrets genuegt nicht', () => {
    // Der Kern von F-04: "Bearer " war ein akzeptiertes Praefix.
    expect(timingSafeEqual('service', 'service-role-key')).toBe(false);
  });
});

// ── Systemischer Regressionsschutz ─────────────────────────────────────────

const FUNCTIONS_DIR = resolve(__dirname, '../../supabase/functions');

/** Liest alle Edge-Function-Entrypoints als [slug, quelltext]. */
function entrypoints(): Array<[string, string]> {
  return readdirSync(FUNCTIONS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('_'))
    .map((e) => [e.name, join(FUNCTIONS_DIR, e.name, 'index.ts')] as const)
    .filter(([, p]) => existsSync(p))
    .map(([slug, p]) => [slug, readFileSync(p, 'utf-8')]);
}

/**
 * Prueft, ob eine Function echte Identitaetspruefung betreibt — egal auf
 * welchem der im Repo etablierten Wege.
 */
function validatesIdentity(src: string): boolean {
  return [
    /requireUser\s*\(/,                  // _shared/auth.ts
    /requireAuthAndTenant\s*\(/,
    /requireTenantMembership\s*\(/,
    /requireServiceRole\s*\(/,
    /auth\.getUser\s*\(/,                // manuell, kanonisches Muster
    /get_app_secret/,                    // Vault-Token (Cron)
    /constructEventAsync|constructEvent/, // Stripe-HMAC
    /verify_api_key|api_key_validate/,   // API-Key-RPC
    /hashApiKey|sha256Hex/,              // gehashter Ingest-/Partner-Key
    /verifyHmac|verifyShopifyHmac/,      // Shopify
    /AiGatewayEdgeClient/,               // Token wird an das Gateway delegiert
  ].some((re) => re.test(src));
}

/**
 * Fuenftes legitimes Muster: die Function baut einen *caller-scoped* Client mit
 * ANON-Key und durchgereichtem Authorization-Header. Die Identitaetspruefung
 * uebernimmt dann Postgres per RLS — ein ungueltiges Token sieht schlicht keine
 * Zeilen. `evidence-export` arbeitet so: der Lesezugriff laeuft ueber `caller`,
 * Service-Role beruehrt nur die bereits RLS-validierte Zeile.
 *
 * Absichtlich eng gefasst: verlangt wird der ANON-Key UND das Durchreichen des
 * Headers. Ein Service-Role-Client erfuellt das nicht.
 */
function delegatesToRls(src: string): boolean {
  return /SUPABASE_ANON_KEY/.test(src)
    && /global:\s*\{\s*headers:\s*\{\s*Authorization/.test(src);
}

describe('F-04 — keine Function authentifiziert per Bearer-Praefix allein', () => {
  const verdaechtig = entrypoints()
    .filter(([, src]) => /startsWith\(\s*['"]Bearer\s['"]\s*\)/.test(src))
    .filter(([, src]) => !validatesIdentity(src) && !delegatesToRls(src))
    .map(([slug]) => slug);

  it('kein Entrypoint prueft nur das Praefix', () => {
    // Schlaegt dieser Test fehl, ist eine Function auf das Muster aus F-04
    // zurueckgefallen. Der Fix ist nicht, den Test zu lockern, sondern die
    // Function auf _shared/auth.ts umzustellen.
    expect(verdaechtig).toEqual([]);
  });

  it('evidence-export delegiert nachweislich an RLS (nicht nur Praefix)', () => {
    // Gegenprobe zur Ausnahme oben: haette evidence-export den caller-scoped
    // Client nicht mehr, waere die Function wieder ein F-04-Fall — und der
    // Test oben wuerde sie wieder melden.
    const src = readFileSync(join(FUNCTIONS_DIR, 'evidence-export', 'index.ts'), 'utf-8');
    expect(delegatesToRls(src)).toBe(true);
  });
});

describe('F-04 — die vier remediierten Endpunkte behalten ihre Pruefung', () => {
  const src = (slug: string) =>
    readFileSync(join(FUNCTIONS_DIR, slug, 'index.ts'), 'utf-8');

  // Maschinen-Endpunkte: Cron bzw. DB-Trigger, kein menschlicher Aufrufer.
  for (const slug of [
    'governance-score-calculator',
    'governance-deadline-monitor',
    'automation-trigger-trial-webhook',
  ]) {
    it(`${slug} verlangt den Service-Role-Aufrufer`, () => {
      expect(src(slug)).toMatch(/requireServiceRole\s*\(\s*req\s*\)/);
    });
  }

  it('oauth2-apps prueft Mitgliedschaft und Rolle im Zieltenant', () => {
    const s = src('oauth2-apps');
    expect(s).toMatch(/requireAuthAndTenant\s*\(/);
    // rotate_secret / delete_app sind zerstoerend → nicht fuer member/viewer.
    expect(s).toMatch(/\[\s*'owner'\s*,\s*'admin'\s*\]/);
  });

  it('oauth2-apps baut keinen eigenen Service-Role-Client mehr', () => {
    // Der Client kommt jetzt aus dem AuthContext — also erst NACH der
    // Mitgliedschaftspruefung.
    expect(src('oauth2-apps')).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
  });
});
