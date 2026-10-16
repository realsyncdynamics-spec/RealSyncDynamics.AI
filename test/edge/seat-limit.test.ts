/**
 * Nutzerplätze (`limit.team_seats`): beworben je Plan, bis 2026-10-16 nirgends
 * durchgesetzt. `tenant-invite` nahm beliebig viele Mitglieder auf.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { decideSeat, seatDecisionMessage } from '../../supabase/functions/_shared/seat-limit';

describe('decideSeat — Einladen', () => {
  it('zählt Mitglieder und offene Einladungen', () => {
    expect(decideSeat({ phase: 'invite', limit: 5, members: 3, pendingInvites: 1 })).toEqual({ ok: true });
    expect(decideSeat({ phase: 'invite', limit: 5, members: 3, pendingInvites: 2 }))
      .toEqual({ ok: false, code: 'SEAT_LIMIT_REACHED', limit: 5, used: 5 });
  });

  it('ein Platz für den Inhaber: Free/Starter laden niemanden ein', () => {
    expect(decideSeat({ phase: 'invite', limit: 1, members: 1, pendingInvites: 0 }))
      .toEqual({ ok: false, code: 'SEAT_LIMIT_REACHED', limit: 1, used: 1 });
  });

  it('unbegrenzt (-1) lässt alles zu', () => {
    expect(decideSeat({ phase: 'invite', limit: -1, members: 400, pendingInvites: 99 })).toEqual({ ok: true });
  });

  it('fehlt der Schlüssel im Plan, wird abgelehnt (fail closed)', () => {
    expect(decideSeat({ phase: 'invite', limit: undefined, members: 0, pendingInvites: 0 }))
      .toEqual({ ok: false, code: 'SEATS_NOT_IN_PLAN' });
    expect(decideSeat({ phase: 'invite', limit: Number.NaN, members: 0, pendingInvites: 0 }))
      .toEqual({ ok: false, code: 'SEATS_NOT_IN_PLAN' });
  });
});

describe('decideSeat — Annehmen', () => {
  it('zählt nur Mitglieder — die eigene Einladung ist ja der offene Platz', () => {
    expect(decideSeat({ phase: 'accept', limit: 5, members: 4, pendingInvites: 3 })).toEqual({ ok: true });
  });

  it('greift nach einem Downgrade: alte Einladung, kein Platz mehr', () => {
    expect(decideSeat({ phase: 'accept', limit: 1, members: 1, pendingInvites: 0 }))
      .toEqual({ ok: false, code: 'SEAT_LIMIT_REACHED', limit: 1, used: 1 });
  });

  it('wer schon Mitglied ist, wird nicht abgewiesen (Reload, Doppelklick)', () => {
    expect(decideSeat({ phase: 'accept', limit: 1, members: 1, pendingInvites: 0, alreadyMember: true })).toEqual({ ok: true });
  });
});

describe('seatDecisionMessage', () => {
  it('nennt belegte und verfügbare Plätze und den nächsten Schritt', () => {
    const d = { ok: false as const, code: 'SEAT_LIMIT_REACHED' as const, limit: 5, used: 5 };
    expect(seatDecisionMessage(d, 'invite')).toMatch(/5 von 5/);
    expect(seatDecisionMessage(d, 'invite')).toMatch(/Einladung widerrufen|offene Einladung/);
    expect(seatDecisionMessage(d, 'accept')).toMatch(/einladende Person/);
  });
});

describe('tenant-invite (Quelltext)', () => {
  const s = readFileSync('supabase/functions/tenant-invite/index.ts', 'utf8');

  it('prüft Plätze vor dem Ausstellen und vor dem Aufnehmen', () => {
    const create = s.slice(s.indexOf('async function handleCreate('));
    expect(create.indexOf("await seats(tenant_id, 'invite')")).toBeGreaterThan(-1);
    expect(create.indexOf("await seats(tenant_id, 'invite')"))
      .toBeLessThan(create.indexOf("from('tenant_invites').insert("));

    const accept = s.slice(s.indexOf('async function handleAccept('));
    expect(accept.indexOf("await seats(invite.tenant_id, 'accept', userId)")).toBeGreaterThan(-1);
    expect(accept.indexOf("await seats(invite.tenant_id, 'accept', userId)"))
      .toBeLessThan(accept.indexOf("from('memberships').insert("));
  });

  it('liest die Grenze aus den Entitlements des Mandanten', () => {
    expect(s).toContain("ent.byKey['limit.team_seats']?.value");
    expect(s).toMatch(/\.is\('accepted_at', null\)\.is\('revoked_at', null\)/);
  });
});

// ── Browser: Begründung der Function erreicht die Oberfläche ──────────────
const invoke = vi.fn();
vi.mock('../../src/lib/supabase', () => ({
  getSupabase: () => ({ functions: { invoke } }),
}));
import { createInvite } from '../../src/features/tenants/api';

describe('tenants/api — Fehler aus dem Body statt „non-2xx“', () => {
  beforeEach(() => invoke.mockReset());

  it('reicht Code und Meldung der Function durch', async () => {
    const context = new Response(JSON.stringify({ ok: false, error: { code: 'SEAT_LIMIT_REACHED', message: 'Alle Nutzerplätze Ihres Plans sind belegt' } }), { status: 402 });
    invoke.mockResolvedValueOnce({ data: null, error: Object.assign(new Error('Edge Function returned a non-2xx status code'), { context }) });
    const r = await createInvite('t', 'a@b.de', 'editor');
    expect(r).toEqual({ ok: false, error: { code: 'SEAT_LIMIT_REACHED', message: 'Alle Nutzerplätze Ihres Plans sind belegt' } });
  });

  it('fällt ohne lesbaren Body auf den Netzfehler zurück', async () => {
    invoke.mockResolvedValueOnce({ data: null, error: new Error('Failed to fetch') });
    const r = await createInvite('t', 'a@b.de', 'editor');
    expect(r).toEqual({ ok: false, error: { code: 'NETWORK', message: 'Failed to fetch' } });
  });
});
