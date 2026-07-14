/**
 * Contract-Tests für die zentrale Flow-Logik (src/flow/flowRoutes).
 *
 * Sichert zu, dass:
 *  - jede Flow-ID einen eindeutigen Slug hat,
 *  - alle internen `/flow/...`-Ziele auf existierende Steps zeigen (keine Sackgassen),
 *  - die in der Aufgabe geforderten Beispiel-Mappings stimmen,
 *  - jeder Step die drei Pflicht-Fragen (Titel, Erklärung, nächste Aktion) bedient.
 */
import { describe, it, expect } from 'vitest';
import {
  FLOW_STEPS,
  FLOW_STEP_LIST,
  getFlowStepBySlug,
  getFlowStepById,
  flowPath,
  FLOW_STAGES,
  stageIndex,
} from '../../src/flow/flowRoutes';

const flowTargets = (to: string) => to.startsWith('/flow/');
const slugFromFlowPath = (to: string) => to.replace(/^\/flow\//, '').replace(/\?.*$/, '');

describe('flowRoutes — Struktur', () => {
  it('jede Flow-ID hat einen eindeutigen Slug', () => {
    const slugs = FLOW_STEP_LIST.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('id entspricht dem Key in FLOW_STEPS', () => {
    for (const [key, step] of Object.entries(FLOW_STEPS)) {
      expect(step.id).toBe(key);
    }
  });

  it('jeder Step beantwortet die drei Pflicht-Fragen', () => {
    for (const step of FLOW_STEP_LIST) {
      expect(step.title, `${step.id}.title`).toBeTruthy();
      expect(step.clicked, `${step.id}.clicked`).toBeTruthy();
      expect(step.explanation.length, `${step.id}.explanation`).toBeGreaterThan(30);
      // „Was kann ich als Nächstes tun?“ — mindestens eine Aktion.
      const actions = [step.primary, step.secondary, ...(step.extraActions ?? [])].filter(Boolean);
      expect(actions.length, `${step.id} braucht Aktionen`).toBeGreaterThan(0);
    }
  });

  it('jeder Step hat eine gültige Prozess-Stufe', () => {
    for (const step of FLOW_STEP_LIST) {
      expect(stageIndex(step.stage), `${step.id}.stage`).toBeGreaterThanOrEqual(0);
    }
    expect(FLOW_STAGES.length).toBeGreaterThan(0);
  });
});

describe('flowRoutes — keine Sackgassen', () => {
  it('alle internen Flow-Ziele zeigen auf existierende Steps', () => {
    for (const step of FLOW_STEP_LIST) {
      const actions = [step.primary, step.secondary, ...(step.extraActions ?? [])].filter(
        Boolean,
      );
      for (const action of actions) {
        if (action && flowTargets(action.to)) {
          const target = getFlowStepBySlug(slugFromFlowPath(action.to));
          expect(target, `${step.id} → ${action!.to} muss existieren`).toBeDefined();
        }
      }
    }
  });

  it('jeder Step hat mindestens eine Weiter-Möglichkeit (primary oder Fallback möglich)', () => {
    for (const step of FLOW_STEP_LIST) {
      // primary ODER extraActions verhindern eine echte Sackgasse.
      const hasForward = Boolean(step.primary) || (step.extraActions?.length ?? 0) > 0;
      expect(hasForward, `${step.id} darf keine Sackgasse sein`).toBe(true);
    }
  });
});

describe('flowRoutes — geforderte Beispiel-Mappings', () => {
  const cases: [string, string][] = [
    ['landing.startScan', '/flow/start-scan'],
    ['landing.login', '/flow/login'],
    ['pricing.checkoutStarter', '/flow/checkout/starter'],
    ['scan.finished', '/flow/report'],
  ];

  it.each(cases)('%s → %s', (id, expectedPath) => {
    expect(flowPath(id)).toBe(expectedPath);
  });

  it('checkout.success übergibt final ins Dashboard', () => {
    const success = getFlowStepById('checkout.success');
    expect(success).toBeDefined();
    // Vom Erfolgsschritt aus muss das Dashboard erreichbar sein.
    const reachable = [success!.primary?.to, ...(success!.extraActions ?? []).map((a) => a.to)];
    expect(reachable).toContain('/flow/dashboard');
  });

  it('das Dashboard übergibt an die echte App-Route /app', () => {
    const dash = getFlowStepById('app.dashboard');
    expect(dash?.primary?.to).toBe('/app');
    expect(dash?.primary?.external).toBe(true);
  });
});

describe('flowRoutes — Lookups', () => {
  it('getFlowStepBySlug findet verschachtelte Slugs', () => {
    expect(getFlowStepBySlug('checkout/starter')?.id).toBe('pricing.checkoutStarter');
    expect(getFlowStepBySlug('/checkout/starter/')?.id).toBe('pricing.checkoutStarter');
  });

  it('getFlowStepBySlug liefert undefined für Unbekanntes', () => {
    expect(getFlowStepBySlug('gibtsnicht')).toBeUndefined();
    expect(getFlowStepBySlug(undefined)).toBeUndefined();
  });

  it('flowPath fällt bei unbekannter ID nicht auf einen Flow-Pfad zurück', () => {
    expect(flowPath('unbekannt.id')).toBe('/');
  });
});
