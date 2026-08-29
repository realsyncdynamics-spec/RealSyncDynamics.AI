import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

import {
  GRACE_PERIOD_DAYS,
  graceDaysRemaining,
  subscriptionGrantsPaidAccess,
} from '../../shared/pricing';

/**
 * Grace Period nach einer fehlgeschlagenen Zahlung (AP4).
 *
 * Der Befund, der das nötig machte: `tenant_entitlements()` fragte den Status
 * der Subscription **gar nicht** ab. Ein Abo in `past_due`, `canceled` oder
 * `unpaid` lieferte unbegrenzt weiter alle Berechtigungen — es gab keine
 * Ablaufsteuerung.
 *
 * Die Regel ist bewusst großzügig: Fehlt `past_due_since`, entsteht daraus
 * **keine** Sperrung. Ein Webhook-Ereignis, das nie ankam, darf keinen
 * zahlenden Kunden aussperren.
 */

const MIGRATION = readFileSync(
  'supabase/migrations/20260829000000_grace_period.sql',
  'utf8',
);

const JETZT = new Date('2026-08-24T12:00:00Z');
const vorTagen = (n: number) =>
  new Date(JETZT.getTime() - n * 86_400_000).toISOString();

describe('Grace Period: SQL und Quelle nennen dieselbe Frist', () => {
  it('legt die Frist in shared/pricing.ts auf sieben Tage', () => {
    expect(GRACE_PERIOD_DAYS).toBe(7);
  });

  it('verwendet in der Migration dasselbe Intervall', () => {
    // Ohne diese Bindung liefe die Anzeige gegen eine andere Frist als die
    // Auflösung — der Kunde sähe „noch 3 Tage" und wäre bereits gesperrt.
    expect(MIGRATION).toContain(`interval '${GRACE_PERIOD_DAYS} days'`);
  });
});

describe('Der Auflöser prüft den Status', () => {
  it('fragt den Subscription-Status überhaupt ab', () => {
    // Genau das fehlte vorher vollständig.
    expect(MIGRATION).toContain('abo_wirksam');
    expect(MIGRATION).toContain("s.status IN ('active', 'trialing')");
    expect(MIGRATION).toContain("s.status = 'past_due'");
  });

  it('behandelt einen fehlenden Zeitstempel als nicht gesperrt', () => {
    expect(MIGRATION).toContain('s.past_due_since IS NULL');
  });

  it('fällt bei unwirksamem Abo auf den Free-Plan zurück, statt auf nichts', () => {
    // Ohne diesen Zweig hätte ein gesperrter Mandant **keine** Berechtigungen
    // — nicht einmal die des kostenlosen Plans, und damit kein Dashboard.
    expect(MIGRATION).toMatch(
      /IS NOT TRUE THEN[\s\S]{0,400}default_for_plan_key = 'free_audit'/,
    );
  });

  it('lässt Einmalkäufe von der Grace Period unberührt', () => {
    // Ein bezahlter Grant verfällt nicht, weil ein *anderes* Abo in Verzug
    // gerät. `grant_products` darf deshalb nicht von `abo_wirksam` abhängen.
    const grantBlock = MIGRATION.slice(
      MIGRATION.indexOf('grant_products AS'),
      MIGRATION.indexOf('contributing_products AS'),
    );
    expect(grantBlock).not.toContain('abo_wirksam');
  });

  it('behält Mitgliedschaftsprüfung und Ausführungsrecht', () => {
    // Die Function ist SECURITY DEFINER und autorisiert alles. Beides zu
    // verlieren wäre der schwerste denkbare Fehler dieser Migration.
    expect(MIGRATION).toContain('FROM public.memberships m');
    expect(MIGRATION).toContain('m.user_id = auth.uid()');
    expect(MIGRATION).toContain(
      'GRANT EXECUTE ON FUNCTION public.tenant_entitlements(uuid) TO authenticated',
    );
  });
});

describe('subscriptionGrantsPaidAccess — dieselbe Regel im Frontend', () => {
  it.each([
    ['active', null, true],
    ['trialing', null, true],
    ['canceled', null, false],
    ['unpaid', null, false],
    ['incomplete_expired', null, false],
    [null, null, false],
  ] as const)('Status %s → %s', (status, seit, erwartet) => {
    expect(subscriptionGrantsPaidAccess(status, seit, JETZT)).toBe(erwartet);
  });

  it('trägt am sechsten Tag des Verzugs noch', () => {
    expect(subscriptionGrantsPaidAccess('past_due', vorTagen(6), JETZT)).toBe(true);
  });

  it('trägt am achten Tag nicht mehr', () => {
    expect(subscriptionGrantsPaidAccess('past_due', vorTagen(8), JETZT)).toBe(false);
  });

  it('trägt ohne Zeitstempel — eine fehlende Information ist kein Verzug', () => {
    expect(subscriptionGrantsPaidAccess('past_due', null, JETZT)).toBe(true);
  });

  it('trägt bei unlesbarem Zeitstempel, statt zu sperren', () => {
    expect(subscriptionGrantsPaidAccess('past_due', 'kein-datum', JETZT)).toBe(true);
  });
});

describe('graceDaysRemaining — was die Oberfläche anzeigt', () => {
  it('nennt am ersten Tag sechs verbleibende Tage', () => {
    expect(graceDaysRemaining('past_due', vorTagen(1), JETZT)).toBe(6);
  });

  it('nennt am sechsten Tag einen verbleibenden Tag', () => {
    expect(graceDaysRemaining('past_due', vorTagen(6), JETZT)).toBe(1);
  });

  it('nennt nach Ablauf null', () => {
    expect(graceDaysRemaining('past_due', vorTagen(9), JETZT)).toBe(0);
  });

  it('nennt ohne Verzug keine Frist', () => {
    expect(graceDaysRemaining('active', null, JETZT)).toBeNull();
    expect(graceDaysRemaining('past_due', null, JETZT)).toBeNull();
  });
});

describe('Der Webhook hält den Zeitstempel fest', () => {
  const webhook = readFileSync('supabase/functions/stripe-webhook/index.ts', 'utf8');

  it('setzt past_due_since beim Wechsel nach past_due', () => {
    expect(webhook).toContain('past_due_since: pastDueSince');
    expect(webhook).toContain("sub.status === 'past_due'");
  });

  it('behält einen vorhandenen Zeitstempel, statt ihn neu zu setzen', () => {
    // Sonst verlängerte jeder weitere Zustellversuch die Frist stillschweigend
    // und sie liefe nie ab.
    expect(webhook).toMatch(/vorhanden\?\.past_due_since[\s\S]{0,60}\?\?\s*new Date\(\)/);
  });
});
