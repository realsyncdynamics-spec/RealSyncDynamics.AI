import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import {
  HUB_SECTIONS,
  isEntryOpen,
  lockReason,
} from '../../src/features/modules/ModulesHubView';
import { cheapestPlanForKeys } from '../../src/features/market/moduleCatalog';
import { ENTITLEMENT_KEYS, PLAN_ORDER, isPlanSelectable, planGrants } from '../../shared/pricing';
import {
  GOVERNANCE_MODULES,
  TAB_MODULES,
} from '../../src/components/governance-os/governanceModules';

// ── Modul-Hub (/app/modules) ──────────────────────────────────────────────
//
// Rollentrennung (Entscheidung 2026-08-30, docs/product/modular-product-experience.md §8):
// Der Hub ist die operative Navigations- und Zustandsschicht, der
// Marketplace die kommerzielle Wahrheit. Diese Tests halten beide Hälften
// fest: den Zustand aus dem Autorisierungs-Vokabular — und die Grenze, die
// den Hub davon abhält, ein zweiter Marketplace zu werden.

const alleEintraege = HUB_SECTIONS.flatMap((s) => s.entries);
const eintrag = (id: string) => alleEintraege.find((e) => e.id === id)!;
const QUELLE = readFileSync('src/features/modules/ModulesHubView.tsx', 'utf8');

describe('Modul-Hub Navigation', () => {
  const nav = GOVERNANCE_MODULES.find((m) => m.id === 'modules');

  it('ist in GOVERNANCE_MODULES vorhanden und für jeden Plan sichtbar', () => {
    expect(nav).toBeDefined();
    expect(nav?.route).toBe('/app/modules');
    expect(nav?.gate.kind).toBe('all');
  });

  it('erscheint in TAB_MODULES', () => {
    expect(TAB_MODULES.some((m) => m.id === 'modules')).toBe(true);
  });
});

describe('Modul-Hub Struktur', () => {
  it('hat die drei Gruppen der Capability-Skizze', () => {
    expect(HUB_SECTIONS.map((s) => s.id)).toEqual(['ai-automation', 'website', 'governance']);
  });

  it('jeder Eintrag hat eine eindeutige ID und eine Route', () => {
    const ids = alleEintraege.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of alleEintraege) {
      expect(e.route.startsWith('/'), `${e.id}: Route ${e.route}`).toBe(true);
    }
  });

  it('jede Voraussetzung ist ein gültiger Entitlement-Key', () => {
    for (const e of alleEintraege) {
      for (const key of e.requires) {
        expect(ENTITLEMENT_KEYS as readonly string[], `${e.id}: ${key}`).toContain(key);
      }
    }
  });
});

// ── Die Grenze zum Marketplace ────────────────────────────────────────────

describe('Der Hub bleibt operativ, nicht kommerziell', () => {
  it('nennt keine Preise', () => {
    // Weder Beträge noch Preis-Vokabular: Das steht im Marketplace, der es
    // aus BOOKABLE_MODULES bezieht. Zwei Preisquellen wären eine zu viel.
    expect(QUELLE).not.toMatch(/\d+\s*€|priceEur|BOOKABLE_MODULES|€ \/ Monat/);
  });

  it('verspricht keine Aktivierung, die er nicht einlösen kann', () => {
    // `stripe-checkout` nimmt nur einen plan_key; einen Modul-Kauf gibt es
    // noch nicht. Ein Knopf „Aktivieren" wäre damit eine Zusage ins Leere
    // (CLAUDE.md §14) — dieselbe Regel, nach der der Marketplace darauf
    // verzichtet.
    expect(QUELLE).not.toMatch(/>\s*Aktivieren\s*</);
  });

  it('führt für Gesperrtes ausschließlich in den Marketplace, nicht in Billing oder Checkout', () => {
    // Geprüft werden die Link-Ziele, nicht der Dateitext: `@/shared/pricing`
    // ist ein Import, kein Weg zur Preisseite.
    const ziele = [...QUELLE.matchAll(/to="([^"]+)"/g)].map((m) => m[1]);
    expect(ziele).toContain('/app/marketplace');
    expect(ziele.filter((z) => !z.startsWith('/app/'))).toEqual([]);
    for (const kommerziell of ['/app/billing', '/checkout', '/pricing', '/contact-sales']) {
      expect(ziele, `kommerzieller Weg im Hub: ${kommerziell}`).not.toContain(kommerziell);
    }
  });

  it('leitet den Mindestplan aus der Marketplace-Regel ab statt ihn nachzubauen', () => {
    // Ein „ab X", das stillgelegte Pläne mitzählt, schickt Kunden auf einen
    // Weg, den niemand mehr gehen kann. cheapestPlanForKeys() überspringt
    // sie — der Hub ruft genau diese Funktion.
    expect(QUELLE).toContain('cheapestPlanForKeys');
    for (const e of alleEintraege) {
      const plan = cheapestPlanForKeys(e.requires);
      if (plan !== null) {
        expect(isPlanSelectable(plan), `${e.id}: schlägt stillgelegten Plan ${plan} vor`).toBe(true);
      }
    }
  });
});

// ── Zustand: dieselbe Antwort wie die Laufzeit ────────────────────────────

describe('Zustand kommt aus dem Autorisierungs-Vokabular', () => {
  it('deckt sich für jeden Eintrag und jeden Plan mit planGrants()', () => {
    for (const e of alleEintraege) {
      for (const plan of PLAN_ORDER) {
        const erwartet = e.requires.every((k) => planGrants(plan, k));
        expect(isEntryOpen(plan, e), `${e.id} @ ${plan}`).toBe(erwartet);
      }
    }
  });

  it('Policies sind im Free Audit gesperrt — policy.packs gilt erst ab Starter', () => {
    // Regressionstest zum Befund vom 2026-08-30: Die erste Fassung fragte
    // gegen `plan.modules` und zeigte „Policies · Öffnen" im Free Audit,
    // obwohl die Laufzeit den Zugriff verweigert.
    expect(isEntryOpen('free', eintrag('policies'))).toBe(false);
    expect(isEntryOpen('starter', eintrag('policies'))).toBe(true);
    expect(lockReason(eintrag('policies'))).toBe('Enthalten ab Starter');
  });

  it('Evidence und Websites sind im Free Audit offen', () => {
    expect(isEntryOpen('free', eintrag('evidence'))).toBe(true);
    expect(isEntryOpen('free', eintrag('websites-domains'))).toBe(true);
  });

  it('der Landingpage Builder setzt nichts voraus und ist überall offen', () => {
    expect(eintrag('landingpage-builder').requires).toEqual([]);
    for (const plan of PLAN_ORDER) {
      expect(isEntryOpen(plan, eintrag('landingpage-builder'))).toBe(true);
    }
  });
});

describe('Aktivierungs-Leiter (aus den Entitlement-Keys abgeleitet)', () => {
  it('Website Chatbot ab Starter', () => {
    expect(lockReason(eintrag('website-chatbot'))).toBe('Enthalten ab Starter');
  });

  it('WhatsApp Bot ab Growth', () => {
    expect(lockReason(eintrag('whatsapp-bot'))).toBe('Enthalten ab Growth');
  });

  it('Telefon-Agent ab Enterprise — nicht ab dem stillgelegten Agency', () => {
    // bots.voice liegt auch in Agency und Partner; beide sind seit AP2 nicht
    // mehr wählbar. Die frühere Fassung nannte „Ab Agency".
    expect(lockReason(eintrag('telefon-agent'))).toBe('Enthalten ab Enterprise');
  });

  it('Risk ab Growth, Monitoring ab Starter', () => {
    expect(lockReason(eintrag('risk'))).toBe('Enthalten ab Growth');
    expect(lockReason(eintrag('monitoring'))).toBe('Enthalten ab Starter');
  });
});
