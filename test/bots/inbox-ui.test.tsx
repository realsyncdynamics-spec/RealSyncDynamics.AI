/**
 * PR C, Schritt 4: Posteingang-UI und Binding-Panel.
 *
 * Geprüft
 *   U1  Filter „Neu" lädt status=open; Liste zeigt Status- und Kanal-Label (Formular)
 *   U2  Detail zeigt Intake (Anliegen, Kontakt, Terminwunsch als Wunsch) und Nachricht
 *   U3  „Übernehmen" ruft RPC inbox_take_over; 'conflict' → Hinweis, Liste neu geladen
 *   U4  „Erledigt" nur bei in_bearbeitung → RPC inbox_resolve; Editor ohne Aktionen
 *   U5  Panel: Projekt ohne Binding → „Verbinden" legt Binding an (ohne site_ref vom Client);
 *       Binding vorhanden → Ein/Aus; Editor sieht deaktivierte Bedienelemente
 *   U6  Barrierefreiheit (axe) ohne Verstöße; Filter mobil erreichbar (role=tab)
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import axe from 'axe-core';
import { BotInboxView } from '../../src/features/bots/BotInboxView';
import { SiteInboxBindingPanel } from '../../src/features/website-operations/SiteInboxBindingPanel';

// ── Supabase-Mock: Tabellen mit Filter-Protokoll, RPC-Mock ─────────────────
type Row = Record<string, unknown>;
const tables: Record<string, Row[]> = {};
const filters: Array<{ table: string; eq: Record<string, unknown> }> = [];
const inserts: Array<{ table: string; row: Row }> = [];
const updates: Array<{ table: string; patch: Row; eq: Record<string, unknown> }> = [];
const rpcMock = vi.fn(async (_fn: string, _args: Record<string, unknown>) => ({ data: 'ok', error: null as null | { message: string } }));

function chain(table: string) {
  const eq: Record<string, unknown> = {};
  let pendingInsert: Row | null = null;
  let pendingUpdate: Row | null = null;
  const rows = () => (tables[table] ?? []).filter((r) => Object.entries(eq).every(([k, v]) => r[k] === v));
  const resolve = (): { data: unknown; error: null } => {
    if (pendingInsert) {
      const row = { id: `new-${inserts.length + 1}`, site_ref: 'SERVERSIDEREF0000000000X', enabled: false, created_at: 'x', updated_at: 'x', disabled_at: null, created_by: null, ...pendingInsert };
      inserts.push({ table, row: pendingInsert });
      (tables[table] ??= []).push(row);
      return { data: row, error: null };
    }
    if (pendingUpdate) {
      updates.push({ table, patch: pendingUpdate, eq: { ...eq } });
      const target = rows()[0] ?? null;
      if (target) Object.assign(target, pendingUpdate);
      return { data: target, error: null };
    }
    filters.push({ table, eq: { ...eq } });
    return { data: rows(), error: null };
  };
  const c: Record<string, unknown> = {};
  c.select = () => c;
  c.order = () => c;
  c.eq = (k: string, v: unknown) => { eq[k] = v; return c; };
  c.insert = (row: Row) => { pendingInsert = row; return c; };
  c.update = (patch: Row) => { pendingUpdate = patch; return c; };
  c.limit = () => Promise.resolve(resolve());
  c.single = () => Promise.resolve(resolve());
  c.maybeSingle = () => { const r = resolve(); return Promise.resolve({ data: Array.isArray(r.data) ? (r.data[0] ?? null) : r.data, error: null }); };
  c.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(resolve()).then(ok, ko);
  return c;
}

vi.mock('../../src/lib/supabase', () => ({
  isSupabaseConfigured: () => true,
  getSupabase: () => ({ from: (t: string) => chain(t), rpc: (fn: string, args: Record<string, unknown>) => rpcMock(fn, args) }),
}));
vi.mock('../../src/features/kodee/connections/AuthGate', () => ({
  AuthGate: ({ children }: { children: (s: unknown) => React.ReactNode }) => <>{children({ user: { id: 'u1', email: 'op@example.test' } })}</>,
}));
let tenantRole = 'owner';
vi.mock('../../src/core/access/TenantProvider', () => ({
  useTenant: () => ({
    activeTenantId: 'tenant-1', loading: false, hasFeature: () => true,
    tenants: [{ tenantId: 'tenant-1', name: 'Test', role: tenantRole }],
  }),
}));

const T = 'tenant-1';
const conv = (id: string, p: Row = {}): Row => ({
  id, tenant_id: T, bot_id: 'bot-1', channel: 'form', external_ref: `form:ref:${id}`, contact_label: `Kunde ${id}`,
  status: 'open', metadata: {}, last_message_at: '2026-11-03T10:00:00Z', assigned_to: null, handed_off_at: null,
  resolved_at: null, created_at: '2026-11-03T10:00:00Z', updated_at: '2026-11-03T10:00:00Z', ...p,
});

beforeEach(() => {
  for (const k of Object.keys(tables)) delete tables[k];
  filters.length = 0; inserts.length = 0; updates.length = 0;
  rpcMock.mockReset();
  rpcMock.mockResolvedValue({ data: 'ok', error: null });
  tenantRole = 'owner';
});

const renderInbox = () => render(<MemoryRouter><BotInboxView /></MemoryRouter>);

describe('BotInboxView – Posteingang', () => {
  it('U1: Filter „Neu" lädt status=open; Labels Formular/Neu', async () => {
    tables.bot_conversations = [conv('a'), conv('b', { status: 'erledigt' })];
    renderInbox();
    await waitFor(() => expect(screen.getByText('Kunde a')).toBeTruthy());
    expect(screen.queryByText('Kunde b')).toBeNull();
    const q = filters.find((f) => f.table === 'bot_conversations');
    expect(q?.eq).toEqual({ tenant_id: T, status: 'open' });
    expect(screen.getAllByText('Formular').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Neu').length).toBeGreaterThan(0);
    expect(screen.getByRole('tab', { name: 'Alle' })).toBeTruthy();
  });

  it('U2: Detail zeigt Intake und Nachricht; Terminwunsch ist kein Termin', async () => {
    tables.bot_conversations = [conv('a')];
    tables.bot_conversation_intake = [{
      conversation_id: 'a', tenant_id: T, anliegen: 'Heizung tropft', kontakt_name: 'Max', kontakt_telefon: '0171',
      kontakt_email: null, terminwunsch: 'Dienstag', terminwunsch_zeit: null, einwilligung_at: '2026-11-03T10:00:00Z',
      quelle: 'form', created_at: 'x', updated_at: 'x',
    }];
    tables.bot_messages = [{ id: 'm1', tenant_id: T, conversation_id: 'a', bot_id: 'bot-1', role: 'user', content: 'Heizung tropft', created_at: '2026-11-03T10:00:00Z' }];
    renderInbox();
    fireEvent.click(await screen.findByText('Kunde a'));
    await waitFor(() => expect(screen.getByText('Max · 0171')).toBeTruthy());
    expect(screen.getByText('Dienstag')).toBeTruthy();
    expect(screen.getByText(/kein bestätigter Termin/)).toBeTruthy();
    expect(screen.getAllByText('Heizung tropft').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole('button', { name: 'Übernehmen' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Erledigt' })).toBeNull();
  });

  it('U3: Übernehmen → RPC; conflict → Hinweis und Neuladen', async () => {
    tables.bot_conversations = [conv('a')];
    rpcMock.mockResolvedValueOnce({ data: 'conflict', error: null });
    renderInbox();
    fireEvent.click(await screen.findByText('Kunde a'));
    fireEvent.click(await screen.findByRole('button', { name: 'Übernehmen' }));
    await waitFor(() => expect(rpcMock).toHaveBeenCalledWith('inbox_take_over', { p_conversation_id: 'a' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/jemand anderes übernommen/));
    expect(filters.filter((f) => f.table === 'bot_conversations').length).toBeGreaterThanOrEqual(2);
  });

  it('U4: Erledigt nur bei in_bearbeitung → RPC inbox_resolve', async () => {
    tables.bot_conversations = [conv('a', { status: 'in_bearbeitung', assigned_to: 'u1', handed_off_at: '2026-11-03T11:00:00Z' })];
    renderInbox();
    fireEvent.click(screen.getByRole('tab', { name: 'In Bearbeitung' }));
    fireEvent.click(await screen.findByText('Kunde a'));
    expect(screen.queryByRole('button', { name: 'Übernehmen' })).toBeNull();
    fireEvent.click(await screen.findByRole('button', { name: 'Erledigt' }));
    await waitFor(() => expect(rpcMock).toHaveBeenCalledWith('inbox_resolve', { p_conversation_id: 'a' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/erledigt/i));
  });

  it('U4b: Editor sieht Anfragen, aber keine Aktionen (RPCs nur Owner/Admin)', async () => {
    tenantRole = 'editor';
    tables.bot_conversations = [conv('a')];
    renderInbox();
    fireEvent.click(await screen.findByText('Kunde a'));
    await screen.findByText(/nur Owner und Admins/);
    expect(screen.queryByRole('button', { name: 'Übernehmen' })).toBeNull();
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('U6: axe ohne Verstöße', async () => {
    tables.bot_conversations = [conv('a')];
    const { container } = renderInbox();
    await screen.findByText('Kunde a');
    const res = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(res.violations.map((v) => v.id)).toEqual([]);
  });
});

describe('SiteInboxBindingPanel', () => {
  const projects = [{ id: 'p1', tenant_id: T, name: 'Heizung Erfurt', status: 'live' }];
  const bots = [{ id: 'bot-1', tenant_id: T, name: 'Empfang', enabled: true, channel: 'chat', created_at: 'x' }];

  const renderPanel = (role: string) => render(<MemoryRouter><SiteInboxBindingPanel tenantId={T} role={role} /></MemoryRouter>);

  it('U5a: ohne Binding → Verbinden legt Binding ohne site_ref an; Standard aus', async () => {
    tables.website_projects = projects; tables.bots = bots; tables.site_inbox_bindings = [];
    renderPanel('owner');
    const btn = await screen.findByRole('button', { name: 'Verbinden' });
    expect((btn as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(btn);
    await waitFor(() => expect(inserts).toHaveLength(1));
    expect(inserts[0]).toEqual({ table: 'site_inbox_bindings', row: { tenant_id: T, website_project_id: 'p1', bot_id: 'bot-1', enabled: false } });
    expect(Object.keys(inserts[0]!.row)).not.toContain('site_ref');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Einschalten' })).toBeTruthy());
    expect(screen.getByText('SERVERSIDEREF0000000000X')).toBeTruthy();
  });

  it('U5b: Binding vorhanden → Ausschalten setzt enabled=false über UPDATE', async () => {
    tables.website_projects = projects; tables.bots = bots;
    tables.site_inbox_bindings = [{ id: 'b1', tenant_id: T, website_project_id: 'p1', bot_id: 'bot-1', site_ref: 'AbCdEfGhIjKlMnOpQrStUvWx', enabled: true, created_at: 'x', updated_at: 'x', disabled_at: null, created_by: null }];
    renderPanel('admin');
    fireEvent.click(await screen.findByRole('button', { name: 'Ausschalten' }));
    await waitFor(() => expect(updates).toHaveLength(1));
    expect(updates[0]).toEqual({ table: 'site_inbox_bindings', patch: { enabled: false }, eq: { tenant_id: T, id: 'b1' } });
  });

  it('U5c: Editor sieht alles, kann aber nichts ändern', async () => {
    tables.website_projects = projects; tables.bots = bots; tables.site_inbox_bindings = [];
    const { container } = renderPanel('editor');
    const btn = await screen.findByRole('button', { name: 'Verbinden' });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
    expect((within(container).getByRole('combobox') as HTMLSelectElement).disabled).toBe(true);
    expect(screen.getByText(/nur Owner und Admins/)).toBeTruthy();
    const res = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(res.violations.map((v) => v.id)).toEqual([]);
  });
});
