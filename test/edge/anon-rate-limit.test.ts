// Gemeinsamer Rate-Limiter für anonyme Pfade.
//
// Herausgelöst aus `governance-agent`, damit der SiteOS-Build-Pfad dieselbe
// Schranke benutzt. Geprüft wird deshalb vor allem das, was beim Herauslösen
// kaputtgehen kann: dass sich die beiden Pfade **nicht** dasselbe Kontingent
// teilen, und dass die `auditedDeny`-Regel erhalten bleibt.

import { describe, it, expect, beforeEach } from 'vitest';
import { checkAnonRateLimit, resetAnonRateLimits } from '../../supabase/functions/_shared/anonRateLimit';

beforeEach(() => resetAnonRateLimits());

describe('checkAnonRateLimit', () => {
  it('lässt bis zur Obergrenze durch und sperrt danach', () => {
    for (let i = 0; i < 5; i += 1) {
      expect(checkAnonRateLimit('ip-a').allowed).toBe(true);
    }
    expect(checkAnonRateLimit('ip-a').allowed).toBe(false);
  });

  it('meldet nur die erste Ablehnung im Fenster zum Protokollieren', () => {
    for (let i = 0; i < 5; i += 1) checkAnonRateLimit('ip-b');

    expect(checkAnonRateLimit('ip-b')).toEqual({ allowed: false, shouldAuditDeny: true });
    // Ohne diese Unterscheidung schriebe eine abgelehnte Quelle bei jedem
    // Folgeaufruf eine weitere Zeile — die Ablehnung würde selbst zur Last.
    expect(checkAnonRateLimit('ip-b')).toEqual({ allowed: false, shouldAuditDeny: false });
  });

  it('zählt getrennt je Quelle', () => {
    for (let i = 0; i < 5; i += 1) checkAnonRateLimit('ip-c');
    expect(checkAnonRateLimit('ip-c').allowed).toBe(false);
    expect(checkAnonRateLimit('ip-d').allowed).toBe(true);
  });

  it('trennt Zählerräume — ein Website-Entwurf sperrt nicht den Assistenten', () => {
    for (let i = 0; i < 5; i += 1) checkAnonRateLimit('ip-e', { bucket: 'siteos-build' });
    expect(checkAnonRateLimit('ip-e', { bucket: 'siteos-build' }).allowed).toBe(false);
    expect(checkAnonRateLimit('ip-e', { bucket: 'governance-agent' }).allowed).toBe(true);
  });

  it('öffnet nach Ablauf des Fensters wieder', async () => {
    for (let i = 0; i < 2; i += 1) checkAnonRateLimit('ip-f', { max: 2, windowMs: 20 });
    expect(checkAnonRateLimit('ip-f', { max: 2, windowMs: 20 }).allowed).toBe(false);

    await new Promise((r) => setTimeout(r, 30));
    expect(checkAnonRateLimit('ip-f', { max: 2, windowMs: 20 }).allowed).toBe(true);
  });

  it('respektiert eine eigene Obergrenze', () => {
    expect(checkAnonRateLimit('ip-g', { max: 1 }).allowed).toBe(true);
    expect(checkAnonRateLimit('ip-g', { max: 1 }).allowed).toBe(false);
  });
});
