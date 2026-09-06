import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Der Recovery-Pfad ist eine bewusst gesetzte Ausnahme von der
 * AAL2-Pflicht — und trägt nur, solange drei Dinge gleichzeitig gelten.
 * Jede einzelne Abweichung hebt die Begründung auf, ohne dass irgendetwas
 * bricht: Die Seite sähe unverändert aus und wäre trotzdem eine offene
 * Tür ins volle Stripe-Portal.
 *
 * Deshalb wird hier am Quelltext geprüft, nicht am Verhalten. Dass die
 * Oberfläche weniger Knöpfe zeigt, ist kein Beleg für einen eingeschränkten
 * Umfang — den erzeugt allein `flow: 'payment_method_update'` in der
 * Portal-Sitzung.
 */
const lies = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');

describe('Zahlungs-Wiederherstellung (/app/billing/recover)', () => {
  const app = lies('src/App.tsx');

  it('/app/billing bleibt hinter RequireAal2', () => {
    expect(app).toMatch(
      /path="\/app\/billing"[^\n]*<RequireAal2 action="Billing-Verwaltung">/,
    );
  });

  it('/app/billing/recover steht ohne RequireAal2, aber hinter AppGate', () => {
    const zeile = app
      .split('\n')
      .find((l) => l.includes('path="/app/billing/recover"'));
    expect(zeile, 'Route /app/billing/recover fehlt').toBeDefined();
    expect(zeile).not.toContain('RequireAal2');
    expect(zeile).toContain('<AppGate>');
  });

  it('der Zahlungsverzugs-Hinweis führt auf den Recovery-Pfad, nicht in die AAL2-Sperre', () => {
    const banner = lies('src/components/governance-os/PaymentGraceBanner.tsx');
    expect(banner).toContain('to="/app/billing/recover"');
    expect(banner).not.toContain('to="/app/billing"');
  });

  it('die Recovery-Fläche fordert ausschließlich den Zahlungsmittel-Vorgang an', () => {
    const view = lies('src/features/billing/BillingRecoverView.tsx');
    expect(view).toContain("flow: 'payment_method_update'");
    // Nichts, was über das Zahlungsmittel hinausginge.
    expect(view).not.toContain('createCheckoutSession');
    expect(view).not.toContain('PlanUpgradeModal');
    expect(view).not.toContain('cancel');
  });

  it('stripe-portal setzt den eingeschränkten Umfang durch und lässt keinen anderen Wert zu', () => {
    const fn = lies('supabase/functions/stripe-portal/index.ts');
    expect(fn).toContain('flow_data');
    expect(fn).toContain("type: 'payment_method_update' as const");
    // Allowlist statt Durchreichen — sonst wäre `flow` ein beliebiger
    // Stripe-Parameter aus dem Browser.
    expect(fn).toMatch(/body\.flow !== 'payment_method_update'/);
    // Die Rollenschranke bleibt unberührt: AAL2 entfällt, owner/admin nicht.
    expect(fn).toContain("only owner/admin may open billing portal");
  });
});
