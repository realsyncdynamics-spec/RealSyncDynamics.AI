import { useEffect, useState } from 'react';
import { Building2, Contact, Handshake, Plus, RefreshCw } from 'lucide-react';
import { getSupabaseClient } from '../../lib/supabaseClient';
import { useTenant } from '../../core/access/TenantProvider';

type Company = { id: string; name: string; domain: string | null; lifecycle_stage: string };
type ContactRow = { id: string; first_name: string | null; last_name: string | null; email: string | null; company_id: string | null; lifecycle_stage: string };
type Deal = { id: string; name: string; stage: string; value_cents: number; currency: string };

const STAGES = ['new', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];

export function CrmView() {
  const { activeTenantId } = useTenant();
  const supabase = getSupabaseClient();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!activeTenantId) return;
    setLoading(true);
    const [c, p, d] = await Promise.all([
      supabase.from('crm_companies').select('id,name,domain,lifecycle_stage').eq('tenant_id', activeTenantId).order('created_at', { ascending: false }),
      supabase.from('crm_contacts').select('id,first_name,last_name,email,company_id,lifecycle_stage').eq('tenant_id', activeTenantId).order('created_at', { ascending: false }),
      supabase.from('crm_deals').select('id,name,stage,value_cents,currency').eq('tenant_id', activeTenantId).order('created_at', { ascending: false }),
    ]);
    if (!c.error) setCompanies(c.data ?? []);
    if (!p.error) setContacts(p.data ?? []);
    if (!d.error) setDeals(d.data ?? []);
    setLoading(false);
  };

  useEffect(() => { void load(); }, [activeTenantId]);

  const addCompany = async () => {
    if (!activeTenantId) return;
    const name = window.prompt('Firmenname');
    if (!name?.trim()) return;
    await supabase.from('crm_companies').insert({ tenant_id: activeTenantId, name: name.trim() });
    void load();
  };

  const addContact = async () => {
    if (!activeTenantId) return;
    const email = window.prompt('E-Mail des Kontakts');
    if (!email?.trim()) return;
    await supabase.from('crm_contacts').insert({ tenant_id: activeTenantId, email: email.trim().toLowerCase() });
    void load();
  };

  const addDeal = async () => {
    if (!activeTenantId) return;
    const name = window.prompt('Deal-Name');
    if (!name?.trim()) return;
    await supabase.from('crm_deals').insert({ tenant_id: activeTenantId, name: name.trim() });
    void load();
  };

  if (loading) return <div className="p-8 text-sm text-slate-500">CRM wird geladen …</div>;

  return (
    <div className="min-h-full bg-[#f7f8fa] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h1 className="text-2xl font-semibold tracking-tight text-slate-950">CRM</h1><p className="mt-1 text-sm text-slate-500">Kontakte, Unternehmen und Vertrieb im Workspace.</p></div>
          <button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"><RefreshCw className="h-4 w-4" /> Aktualisieren</button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[['Unternehmen', companies.length, Building2, addCompany], ['Kontakte', contacts.length, Contact, addContact], ['Deals', deals.length, Handshake, addDeal]].map(([label, count, Icon, action]) => (
            <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between"><Icon className="h-5 w-5 text-slate-500" /><button onClick={() => (action as () => void)()} className="rounded-lg p-1.5 hover:bg-slate-100" aria-label={`Neu: ${String(label)}`}><Plus className="h-4 w-4" /></button></div>
              <div className="mt-4 text-2xl font-semibold text-slate-950">{String(count)}</div><div className="text-xs text-slate-500">{String(label)}</div>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-5 py-4 font-medium">Kontakte</div><div className="divide-y divide-slate-100">{contacts.slice(0, 12).map(c => <div key={c.id} className="px-5 py-3"><div className="text-sm font-medium text-slate-800">{[c.first_name, c.last_name].filter(Boolean).join(' ') || c.email || 'Unbenannter Kontakt'}</div><div className="text-xs text-slate-500">{c.email ?? 'Keine E-Mail'} · {c.lifecycle_stage}</div></div>)}{contacts.length === 0 && <div className="px-5 py-8 text-sm text-slate-400">Noch keine Kontakte.</div>}</div></section>
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-5 py-4 font-medium">Deals</div><div className="divide-y divide-slate-100">{STAGES.map(stage => { const rows = deals.filter(d => d.stage === stage); return <div key={stage} className="px-5 py-3"><div className="text-xs font-semibold uppercase tracking-wider text-slate-400">{stage}</div>{rows.length > 0 ? rows.map(d => <div key={d.id} className="mt-2 flex items-center justify-between text-sm"><span className="text-slate-700">{d.name}</span><span className="font-medium text-slate-900">{(d.value_cents / 100).toLocaleString('de-DE', { style: 'currency', currency: d.currency })}</span></div>) : <div className="mt-1 text-xs text-slate-400">Keine Deals</div>}</div>; })}</div></section>
        </div>
      </div>
    </div>
  );
}
