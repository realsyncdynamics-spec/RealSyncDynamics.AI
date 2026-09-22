import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * C-02 — Regressionsschutz für das Konflikt-Ziel des Subscription-Upserts.
 *
 * Der Befund
 * ----------
 * `public.subscriptions` trägt zwei UNIQUE-Constraints: auf `tenant_id`
 * (20260811020621) und auf `stripe_subscription_id`. Der Trigger aus
 * 20260802000000 legt für jeden neuen Tenant eine Free-Tier-Zeile an, deren
 * `stripe_subscription_id` NULL ist.
 *
 * Postgres behandelt NULLs in Unique-Indizes als verschieden. Ein
 * `ON CONFLICT (stripe_subscription_id)` greift auf dieser Zeile also nie —
 * der Upsert wird zum INSERT und verletzt `subscriptions_tenant_id_key`
 * (SQLSTATE 23505). Der Handler wirft, der Idempotenz-Eintrag wird
 * zurückgerollt, Stripe wiederholt, das Ergebnis bleibt identisch: Die erste
 * bezahlte Subscription eines Tenants lässt sich nicht provisionieren.
 *
 * Shared write path
 * -----------------
 * Upsert + terminal-event guard live in
 * `_shared/stripe-subscription-sync.ts` (used by webhook + checkout-verify).
 */

const WEBHOOK = resolve(__dirname, '../../supabase/functions/stripe-webhook/index.ts');
const SYNC = resolve(
  __dirname,
  '../../supabase/functions/_shared/stripe-subscription-sync.ts',
);
const webhookSrc = readFileSync(WEBHOOK, 'utf-8');
const syncSrc = readFileSync(SYNC, 'utf-8');

/** Alle `.from('<tabelle>')`-Ketten mit ihrem zugehörigen upsert-Optionsobjekt. */
function upsertKonfliktZiele(quelle: string, tabelle: string): string[] {
  const treffer: string[] = [];
  const re = new RegExp(
    `\\.from\\(\\s*['"]${tabelle}['"]\\s*\\)[\\s\\S]{0,400}?\\.upsert\\([\\s\\S]{0,200}?onConflict:\\s*['"]([^'"]+)['"]`,
    'g',
  );
  let m: RegExpExecArray | null;
  while ((m = re.exec(quelle)) !== null) treffer.push(m[1]!);
  return treffer;
}

describe('C-02 — Subscription-Upsert im Stripe-Webhook', () => {
  it('delegates subscription upsert to shared syncSubscriptionFromStripe', () => {
    expect(webhookSrc).toContain('syncSubscriptionFromStripe');
    expect(webhookSrc).toContain("from '../_shared/stripe-subscription-sync.ts'");
  });

  it('nutzt tenant_id als Konflikt-Ziel, nicht stripe_subscription_id', () => {
    const ziele = upsertKonfliktZiele(syncSrc, 'subscriptions');

    // Es muss überhaupt einen Upsert geben — sonst prüft der Test nichts und
    // wäre still grün, obwohl der Pfad verschwunden oder umbenannt wurde.
    expect(ziele.length).toBeGreaterThan(0);
    expect(ziele).toEqual(ziele.map(() => 'tenant_id'));
  });

  it('nennt stripe_subscription_id nirgends mehr als Konflikt-Ziel', () => {
    expect(syncSrc).not.toMatch(/onConflict:\s*['"]stripe_subscription_id['"]/);
    expect(webhookSrc).not.toMatch(/onConflict:\s*['"]stripe_subscription_id['"]/);
  });

  it('ignoriert terminale Ereignisse einer bereits abgeloesten Subscription', () => {
    // Ohne diesen Guard könnte ein verspätetes `customer.subscription.deleted`
    // für ein altes Abo das inzwischen aktive neue Abo überschreiben — Stripe
    // garantiert keine Zustellreihenfolge.
    expect(syncSrc).toMatch(/TERMINALE_STATUS/);
    expect(syncSrc).toMatch(/canceled/);
    expect(syncSrc).toMatch(/incomplete_expired/);
  });
});

describe('C-02 — Verhalten des Guards gegen verspaetete Ereignisse', () => {
  // Spiegelt bewusst nur den Guard (reine Entscheidungslogik, kein DB-Zugriff).
  // Das Konflikt-Ziel selbst wird oben an der echten Datei geprüft.
  const TERMINALE_STATUS = ['canceled', 'incomplete_expired'];

  function schreibenUeberspringen(
    eingehend: { id: string; status: string },
    gespeicherte: string | null,
  ): boolean {
    if (!TERMINALE_STATUS.includes(eingehend.status)) return false;
    return Boolean(gespeicherte && gespeicherte !== eingehend.id);
  }

  it('ueberspringt cancel fuer ein abgeloestes Abo', () => {
    expect(schreibenUeberspringen({ id: 'sub_alt', status: 'canceled' }, 'sub_neu')).toBe(true);
  });

  it('schreibt cancel fuer das aktuell gespeicherte Abo', () => {
    expect(schreibenUeberspringen({ id: 'sub_neu', status: 'canceled' }, 'sub_neu')).toBe(false);
  });

  it('schreibt cancel auch wenn noch nichts gespeichert ist', () => {
    // Free-Tier-Zeile: stripe_subscription_id ist NULL. Der Guard darf hier
    // nicht greifen, sonst bliebe der Ursprungsbefund bestehen.
    expect(schreibenUeberspringen({ id: 'sub_neu', status: 'canceled' }, null)).toBe(false);
  });

  it('greift nie bei aktiven Ereignissen', () => {
    for (const status of ['active', 'trialing', 'past_due', 'incomplete']) {
      expect(schreibenUeberspringen({ id: 'sub_alt', status }, 'sub_neu')).toBe(false);
    }
  });
});
