import { describe, it, expect } from 'vitest';
import { HUB_SECTIONS } from '../../src/features/modules/ModulesHubView';
import {
  GOVERNANCE_MODULES,
  canAccessModule,
  minimumPlanForModule,
  TAB_MODULES,
} from '../../src/components/governance-os/governanceModules';

// ── Modul-Hub (/app/modules): Capability-Übersicht des Governance OS ──────
//
// Der Hub führt keine eigene Plan-Liste — jedes Gate muss sich gegen die
// Pricing-SSoT auflösen lassen. Diese Tests fixieren die Aktivierungs-
// Leiter, damit ein Pricing-Refactoring stillschweigende Verschiebungen
// (z. B. Voice plötzlich ab Starter) sichtbar macht.

const allEntries = HUB_SECTIONS.flatMap((s) => s.entries);
const entry = (id: string) => allEntries.find((e) => e.id === id);

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

  it('jeder Eintrag hat eine eindeutige ID und eine /app-Route (oder Top-Level-Route)', () => {
    const ids = allEntries.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of allEntries) {
      expect(e.route.startsWith('/'), `${e.id}: Route ${e.route}`).toBe(true);
    }
  });

  it('jedes Gate löst sich gegen die Pricing-SSoT auf (mindestens ein Plan hat Zugriff)', () => {
    for (const e of allEntries) {
      const anyPlan = (['free', 'starter', 'growth', 'agency', 'enterprise', 'partner'] as const)
        .some((p) => canAccessModule(e, p));
      expect(anyPlan, `${e.id} ist für keinen Plan erreichbar`).toBe(true);
    }
  });
});

describe('Aktivierungs-Leiter (aus der Pricing-SSoT abgeleitet)', () => {
  it('Website Chatbot ab Starter', () => {
    expect(minimumPlanForModule(entry('website-chatbot')!)).toBe('starter');
  });

  it('WhatsApp Bot ab Growth', () => {
    expect(minimumPlanForModule(entry('whatsapp-bot')!)).toBe('growth');
  });

  it('Telefon-Agent ab Agency', () => {
    expect(minimumPlanForModule(entry('telefon-agent')!)).toBe('agency');
  });

  it('Agent Runtime ab Starter', () => {
    expect(minimumPlanForModule(entry('agent-runtime')!)).toBe('starter');
  });

  it('Risk ab Growth, Monitoring ab Starter', () => {
    expect(minimumPlanForModule(entry('risk')!)).toBe('growth');
    expect(minimumPlanForModule(entry('monitoring')!)).toBe('starter');
  });

  it('Evidence, Websites und Landingpage Builder sind für jeden Workspace offen', () => {
    for (const id of ['evidence', 'websites-domains', 'landingpage-builder']) {
      expect(canAccessModule(entry(id)!, 'free'), `${id} muss im Free Audit erreichbar sein`).toBe(true);
    }
  });

  it('Policies (DSGVO) sind bereits im Free Audit enthalten', () => {
    expect(canAccessModule(entry('policies')!, 'free')).toBe(true);
  });
});
