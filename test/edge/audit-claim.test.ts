/**
 * Entscheidungslogik der Audit-Übernahme.
 *
 * Der Lesepfad war fertig und wartete auf einen Schreiber: Die Policy
 * `gdpr_audits tenant_read` verlangt `tenant_id IS NOT NULL`, und gemessen am
 * 2026-08-30 hatte **0 von 159** Zeilen ein `claimed_at`. Diese Datei nagelt
 * die Regeln fest, nach denen jetzt geschrieben wird.
 *
 * Warum das mehr Sorgfalt verdient als eine Zuweisung: Eine falsche Übernahme
 * ist über die Oberfläche **nicht korrigierbar**. Landet ein Audit im falschen
 * Mandanten, verbirgt dieselbe Lese-Policy es dem richtigen dauerhaft.
 */
import { describe, it, expect } from 'vitest';
import {
  decideClaim,
  resolveTenant,
  isUuid,
  emailMismatch,
  type AuditClaimRow,
} from '../../supabase/functions/_shared/audit-claim';

const T1 = '11111111-1111-4111-8111-111111111111';
const T2 = '22222222-2222-4222-8222-222222222222';

const row = (over: Partial<AuditClaimRow> = {}): AuditClaimRow => ({
  id: '33333333-3333-4333-8333-333333333333',
  tenant_id: null, user_id: null, claimed_at: null, email: null,
  ...over,
});

describe('decideClaim', () => {
  it('gibt ein unuebernommenes Audit frei', () => {
    expect(decideClaim(row(), T1)).toEqual({ status: 'claimable' });
  });

  it('behandelt die zweite Uebernahme durch denselben Mandanten nicht als Fehler', () => {
    // Ein Reload oder ein zweiter Tab darf nicht in einem Konflikt enden.
    const r = row({ tenant_id: T1, claimed_at: '2026-08-30T10:00:00Z' });
    expect(decideClaim(r, T1)).toEqual({ status: 'already_mine' });
  });

  it('weist die Uebernahme durch einen fremden Mandanten ab', () => {
    const r = row({ tenant_id: T2, claimed_at: '2026-08-30T10:00:00Z' });
    expect(decideClaim(r, T1)).toEqual({ status: 'taken', conflictTenantId: T2 });
  });

  it('richtet sich nach claimed_at, nicht nach tenant_id allein', () => {
    // Eine tenant_id ohne Zeitstempel ist keine stattgefundene Uebernahme.
    const r = row({ tenant_id: T2, claimed_at: null });
    expect(decideClaim(r, T1)).toEqual({ status: 'claimable' });
  });
});

describe('resolveTenant', () => {
  it('leitet den Mandanten ab, wenn es genau einen gibt', () => {
    expect(resolveTenant([{ tenant_id: T1 }], null)).toEqual({ ok: true, tenantId: T1 });
  });

  it('raet nicht, wenn es mehrere gibt', () => {
    // Raten hiesse, ein Audit unwiederbringlich im falschen Arbeitsbereich
    // abzulegen.
    expect(resolveTenant([{ tenant_id: T1 }, { tenant_id: T2 }], null))
      .toEqual({ ok: false, code: 'TENANT_AMBIGUOUS' });
  });

  it('meldet, wenn der Zugang zu keinem Mandanten gehoert', () => {
    expect(resolveTenant([], null)).toEqual({ ok: false, code: 'TENANT_NOT_FOUND' });
  });

  it('akzeptiert einen angeforderten Mandanten nur bei Mitgliedschaft', () => {
    expect(resolveTenant([{ tenant_id: T1 }], T1)).toEqual({ ok: true, tenantId: T1 });
    expect(resolveTenant([{ tenant_id: T1 }], T2)).toEqual({ ok: false, code: 'FORBIDDEN' });
  });

  it('verlaesst sich bei angefordertem Mandanten nicht auf die Anzahl', () => {
    // Auch mit genau einer Mitgliedschaft darf ein fremder Wunsch nicht
    // stillschweigend auf den eigenen Mandanten umgebogen werden.
    expect(resolveTenant([{ tenant_id: T1 }], T2)).toEqual({ ok: false, code: 'FORBIDDEN' });
  });
});

describe('isUuid', () => {
  it('nimmt echte UUIDs an', () => {
    expect(isUuid(T1)).toBe(true);
  });

  it('weist alles andere ab, bevor es in eine Abfrage geht', () => {
    for (const bad of ['', 'abc', 12, null, undefined, {}, `${T1} or 1=1`, `${T1}\n`]) {
      expect(isUuid(bad), String(bad)).toBe(false);
    }
  });
});

describe('emailMismatch', () => {
  it('meldet eine Abweichung', () => {
    expect(emailMismatch('a@firma.de', 'b@privat.de')).toBe(true);
  });

  it('ignoriert Gross-/Kleinschreibung und Leerraum', () => {
    expect(emailMismatch(' A@Firma.de ', 'a@firma.de')).toBe(false);
  });

  it('wertet ein Audit ohne E-Mail nicht als Abweichung', () => {
    // Der Optimizer-Pfad erhebt gar keine Adresse.
    expect(emailMismatch(null, 'a@firma.de')).toBe(false);
    expect(emailMismatch('a@firma.de', null)).toBe(false);
  });
});
