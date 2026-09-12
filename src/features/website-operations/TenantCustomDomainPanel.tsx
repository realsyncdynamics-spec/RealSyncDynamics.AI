/**
 * Tenant custom-domain bind panel for /app/websites.
 *
 * Two distinct flows:
 *  a) Public domain check → /audit (header "Domain Checker") — not this panel
 *  b) Tenant custom domain → website_projects + website-domain-manager
 *
 * Honest Preview: if no website_project exists (or Cloudflare provisioning
 * cannot complete), we never fake a connected domain.
 */

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Globe2, Link2, Loader2 } from 'lucide-react';
import { getSupabase } from '../../lib/supabase';
import { DomainManager } from './DomainManager';

interface WebsiteProjectRow {
  id: string;
  name: string;
  status: string;
  deployment_url: string | null;
}

interface TenantCustomDomainPanelProps {
  tenantId: string;
}

export function TenantCustomDomainPanel({ tenantId }: TenantCustomDomainPanelProps) {
  const [projects, setProjects] = useState<WebsiteProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sb = getSupabase();
      const { data, error: qErr } = await sb
        .from('website_projects')
        .select('id, name, status, deployment_url')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });
      if (qErr) throw new Error(qErr.message);
      const rows = (data ?? []) as WebsiteProjectRow[];
      setProjects(rows);
      setSelectedId((prev) => prev ?? rows[0]?.id ?? null);
    } catch (e) {
      setProjects([]);
      setError(e instanceof Error ? e.message : 'website_projects nicht lesbar');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createDraftProject() {
    const name = draftName.trim() || 'Kundenwebsite';
    setCreating(true);
    setError(null);
    try {
      const sb = getSupabase();
      const { data, error: iErr } = await sb
        .from('website_projects')
        .insert({
          tenant_id: tenantId,
          name,
          industry: 'dienstleister',
          status: 'draft',
        })
        .select('id, name, status, deployment_url')
        .single();
      if (iErr) throw new Error(iErr.message);
      const row = data as WebsiteProjectRow;
      setProjects((prev) => [row, ...prev]);
      setSelectedId(row.id);
      setDraftName('');
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Projekt konnte nicht angelegt werden (RLS / Migration).',
      );
    } finally {
      setCreating(false);
    }
  }

  const selected = projects.find((p) => p.id === selectedId) ?? null;

  return (
    <section className="border border-titanium-900 bg-obsidian-900">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-titanium-900 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-titanium-400" />
            <h2 className="font-display text-sm font-bold text-titanium-50">
              Custom Domain binden
            </h2>
            <span className="border border-dashed border-amber-700/60 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-amber-400">
              Preview
            </span>
          </div>
          <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-titanium-500">
            Tenant-Domain an ein Website-Projekt koppeln (website-domain-manager).
            Der öffentliche Domain-Check bleibt unter{' '}
            <a href="/audit" className="text-teal-400 hover:underline">
              /audit
            </a>
            . Ohne Cloudflare-Provisioning wird kein „verbunden“ vorgetäuscht.
          </p>
        </div>
      </div>

      <div className="space-y-4 px-4 py-4">
        {error && (
          <div className="flex items-start gap-2 border border-amber-900/80 bg-amber-950/30 px-3 py-2 text-[11px] font-mono text-amber-300">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <div>
              <div className="font-semibold text-amber-200">Blocker</div>
              <div className="mt-0.5 text-amber-300/90">{error}</div>
              <div className="mt-1 text-amber-400/70">
                Benötigt: website_projects + website_domains + Edge Function
                website-domain-manager mit gültigem Cloudflare-Token.
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 py-6 font-mono text-xs text-titanium-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Projekte werden geladen…
          </div>
        ) : projects.length === 0 ? (
          <div className="border border-dashed border-titanium-800 bg-obsidian-950/60 p-4">
            <div className="flex items-center gap-2 text-titanium-300">
              <Globe2 className="h-4 w-4" />
              <span className="font-mono text-xs">Kein website_project für diesen Mandanten</span>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-titanium-500">
              Scan-Domains oben sind live. Custom-Domain-Bindung startet erst mit einem
              Website-Projekt. Draft anlegen, dann Domain verbinden — Status bleibt
              Preview, bis DNS/SSL validiert sind.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder="Projektname (z. B. Firmenwebsite)"
                className="flex-1 border border-titanium-800 bg-obsidian-950 px-3 py-2 font-mono text-xs text-titanium-200 outline-none placeholder:text-titanium-700 focus:border-teal-700"
              />
              <button
                type="button"
                disabled={creating}
                onClick={() => void createDraftProject()}
                className="inline-flex items-center justify-center gap-1.5 border border-teal-800 px-3 py-2 font-mono text-xs text-teal-400 hover:bg-teal-950/40 disabled:opacity-40"
              >
                {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Draft-Projekt anlegen
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <label className="font-mono text-[10px] uppercase tracking-wider text-titanium-600">
                Projekt
              </label>
              <select
                value={selectedId ?? ''}
                onChange={(e) => setSelectedId(e.target.value)}
                className="border border-titanium-800 bg-obsidian-950 px-2 py-1.5 font-mono text-xs text-titanium-200 outline-none"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.status}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void load()}
                className="font-mono text-[10px] text-titanium-500 hover:text-titanium-300"
              >
                Aktualisieren
              </button>
            </div>
            {selected && (
              <DomainManager
                projectId={selected.id}
                tenantId={tenantId}
                previewMode
              />
            )}
          </>
        )}
      </div>
    </section>
  );
}
