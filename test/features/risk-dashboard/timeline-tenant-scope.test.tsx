/**
 * RiskDashboard — get_compliance_timeline muss die MANDANTEN-ID bekommen.
 *
 * BEFUND
 *
 * DomainCard rief die Funktion mit der User-ID auf:
 *
 *     p_tenant_id: (await supabase.auth.getUser()).data.user?.id ?? ''
 *
 * get_compliance_timeline filtert audit_monitor_results aber nach `tenant_id`.
 * Eine User-ID trifft dort nie eine Zeile, die Timeline blieb also immer leer —
 * auch fuer Nutzer, die die Daten sehen duerfen. Sichtbar wurde das nie, weil
 * das Ergebnis der leeren Antwort eines noch nie gescannten Hosts gleicht und
 * der Fehler der RPC verworfen wurde (`const { data } = await …`).
 *
 * Seit 20260901000000_fix_compliance_timeline_idor.sql ist der Parameter
 * zusaetzlich sicherheitsrelevant: die Funktion prueft ihn per
 * is_tenant_member() gegen die Session. Ein falscher Wert liefert damit
 * garantiert leer, ein richtiger die Daten.
 *
 * Dieser Test faehrt die echte Komponente und prueft das Argument, mit dem die
 * RPC tatsaechlich aufgerufen wird. Die User-ID unterscheidet sich hier bewusst
 * von der tenant_id — waere sie gleich, koennte der Test den Fehler nicht sehen.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

const TENANT_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';

const rpcCalls: { fn: string; params: Record<string, unknown> }[] = [];

const DOMAIN_ROW = {
  id: '33333333-3333-4333-8333-333333333333',
  tenant_id: TENANT_ID,
  domain: 'example.com',
  tier: 'growth',
  active: true,
  alert_email: null,
  last_scan_at: '2026-08-30T10:00:00.000Z',
  last_risk_score: 72,
  last_trackers: [],
};

vi.mock('../../../src/lib/supabase', () => ({
  getSupabase: () => ({
    from() {
      return {
        select() {
          return {
            order: () => Promise.resolve({ data: [DOMAIN_ROW], error: null }),
          };
        },
      };
    },
    rpc(fn: string, params: Record<string, unknown>) {
      rpcCalls.push({ fn, params });
      return Promise.resolve({ data: [], error: null });
    },
    auth: {
      // Absichtlich eine ANDERE ID als die tenant_id der Zeile.
      getUser: () => Promise.resolve({ data: { user: { id: USER_ID } } }),
    },
    functions: { invoke: () => Promise.resolve({ data: null, error: null }) },
  }),
}));

import { RiskDashboard } from '../../../src/pages/RiskDashboard';

beforeEach(() => {
  rpcCalls.length = 0;
});

describe('RiskDashboard — Mandantenbindung der Compliance-Timeline', () => {
  it('ruft get_compliance_timeline mit der tenant_id der Domain-Zeile auf', async () => {
    render(<BrowserRouter><RiskDashboard /></BrowserRouter>);

    await waitFor(() => {
      expect(rpcCalls.filter(c => c.fn === 'get_compliance_timeline')).toHaveLength(1);
    });

    const call = rpcCalls.find(c => c.fn === 'get_compliance_timeline');
    expect(call?.params.p_tenant_id).toBe(TENANT_ID);
  });

  it('uebergibt NICHT die User-ID — das war der Fehler', async () => {
    render(<BrowserRouter><RiskDashboard /></BrowserRouter>);

    await waitFor(() => {
      expect(rpcCalls.filter(c => c.fn === 'get_compliance_timeline')).toHaveLength(1);
    });

    const call = rpcCalls.find(c => c.fn === 'get_compliance_timeline');
    expect(call?.params.p_tenant_id).not.toBe(USER_ID);
  });

  it('uebergibt eine nicht-leere UUID — der alte Fallback war der Leerstring', async () => {
    render(<BrowserRouter><RiskDashboard /></BrowserRouter>);

    await waitFor(() => {
      expect(rpcCalls.filter(c => c.fn === 'get_compliance_timeline')).toHaveLength(1);
    });

    const call = rpcCalls.find(c => c.fn === 'get_compliance_timeline');
    // `?? ''` erzeugte fuer einen uuid-Parameter einen Postgres-Fehler
    // (22P02, invalid input syntax) — der wurde damals ebenfalls verschluckt.
    expect(call?.params.p_tenant_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it('reicht Domain und Limit unveraendert durch', async () => {
    render(<BrowserRouter><RiskDashboard /></BrowserRouter>);

    await waitFor(() => {
      expect(rpcCalls.filter(c => c.fn === 'get_compliance_timeline')).toHaveLength(1);
    });

    const call = rpcCalls.find(c => c.fn === 'get_compliance_timeline');
    expect(call?.params.p_domain).toBe('example.com');
    expect(call?.params.p_limit).toBe(30);
  });
});
