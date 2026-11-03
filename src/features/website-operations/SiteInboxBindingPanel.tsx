/**
 * Kontaktformular ↔ Empfangsassistent (PR C, site_inbox_bindings) für /app/websites.
 *
 * Eine veröffentlichte Website (website_projects) bekommt genau einen Eingang:
 * Anfragen aus dem Kontaktformular landen im Posteingang des gewählten Bots.
 * Der öffentliche Schlüssel ist die serverseitig erzeugte `site_ref`; sie wird
 * hier nur angezeigt, nie erzeugt oder geändert.
 *
 * Rechte spiegeln RLS (20261102220000): Lesen jedes Mitglied, Anlegen/Ändern
 * Owner/Admin. Ohne diese Rolle sind die Bedienelemente deaktiviert; der
 * Server entscheidet trotzdem (fail-closed).
 *
 * Eine Verbindung ist standardmäßig AUS. Anfragen werden erst angenommen,
 * wenn sie eingeschaltet ist UND die Seite live UND der Bot aktiv ist.
 */

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Inbox, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getSupabase } from '../../lib/supabase';
import { Button } from '../../enterprise-os/components/Button';
import {
  createSiteInboxBinding, listBots, listSiteInboxBindings, updateSiteInboxBinding,
} from '../bots/api';
import type { Bot, SiteInboxBinding } from '../bots/types';

interface WebsiteProjectRow {
  id: string;
  name: string;
  status: string;
}

export const SITE_INBOX_ADMIN_ROLES: ReadonlySet<string> = new Set(['owner', 'admin']);

interface Props {
  tenantId: string;
  /** Rolle des angemeldeten Mitglieds im Mandanten (TenantSummary.role). */
  role: string | undefined;
}

export function SiteInboxBindingPanel({ tenantId, role }: Props) {
  const canEdit = role !== undefined && SITE_INBOX_ADMIN_ROLES.has(role);
  const [projects, setProjects] = useState<WebsiteProjectRow[]>([]);
  const [bots, setBots] = useState<Bot[]>([]);
  const [bindings, setBindings] = useState<SiteInboxBinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [choice, setChoice] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sb = getSupabase();
      const [{ data, error: qErr }, botRows, bindingRows] = await Promise.all([
        sb.from('website_projects').select('id, name, status').eq('tenant_id', tenantId).order('created_at', { ascending: false }),
        listBots(tenantId),
        listSiteInboxBindings(tenantId),
      ]);
      if (qErr) throw new Error(qErr.message);
      setProjects((data ?? []) as WebsiteProjectRow[]);
      setBots(botRows);
      setBindings(bindingRows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verbindungen nicht lesbar');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { void load(); }, [load]);

  async function run(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    setError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Aktion fehlgeschlagen');
    } finally {
      setBusy(null);
    }
  }

  const bindingFor = (projectId: string) => bindings.find((b) => b.website_project_id === projectId) ?? null;
  const botName = (botId: string) => bots.find((b) => b.id === botId)?.name ?? 'Unbekannter Assistent';

  return (
    <section className="border border-titanium-900 bg-obsidian-900" aria-labelledby="site-inbox-heading">
      <div className="border-b border-titanium-900 px-4 py-3">
        <div className="flex items-center gap-2">
          <Inbox className="h-4 w-4 text-titanium-400" />
          <h2 id="site-inbox-heading" className="font-display text-sm font-bold text-titanium-50">
            Kontaktformular mit Empfangsassistent verbinden
          </h2>
        </div>
        <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-titanium-500">
          Anfragen aus dem Kontaktformular einer veröffentlichten Seite landen im{' '}
          <Link to="/app/bots/inbox" className="text-teal-400 hover:underline">Posteingang</Link>{' '}
          des gewählten Assistenten. Eine Verbindung ist zunächst aus; sie nimmt Anfragen erst an,
          wenn sie eingeschaltet ist, die Seite live und der Assistent aktiv ist.
          {!canEdit && ' Ändern können nur Owner und Admins.'}
        </p>
      </div>

      <div className="space-y-3 px-4 py-4">
        {error && (
          <div role="alert" className="flex items-start gap-2 border border-amber-900/80 bg-amber-950/30 px-3 py-2 font-mono text-[11px] text-amber-300">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 py-4 font-mono text-xs text-titanium-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Verbindungen werden geladen…
          </div>
        ) : projects.length === 0 ? (
          <p className="font-mono text-xs text-titanium-500">Noch kein Website-Projekt vorhanden.</p>
        ) : bots.length === 0 ? (
          <p className="font-mono text-xs text-titanium-500">
            Noch kein Assistent angelegt – zuerst unter{' '}
            <Link to="/app/bots" className="text-teal-400 hover:underline">KI-Mitarbeiter</Link> einen Empfangsassistenten anlegen.
          </p>
        ) : (
          <ul className="space-y-2">
            {projects.map((p) => {
              const b = bindingFor(p.id);
              const selectedBot = choice[p.id] ?? b?.bot_id ?? bots[0]?.id ?? '';
              const live = p.status === 'live';
              return (
                <li key={p.id} className="border border-titanium-800 px-3 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-titanium-100">{p.name}</p>
                      <p className="font-mono text-[10px] text-titanium-500">
                        Seite {live ? 'live' : p.status}
                        {b ? ` · Assistent: ${botName(b.bot_id)}` : ' · nicht verbunden'}
                      </p>
                      {b && (
                        <p className="mt-1 font-mono text-[10px] text-titanium-600">
                          Formular-Kennung <code className="text-titanium-400">{b.site_ref}</code>
                          {!live && b.enabled && ' · nimmt erst nach Veröffentlichung an'}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="sr-only" htmlFor={`site-inbox-bot-${p.id}`}>Assistent für {p.name}</label>
                      <select
                        id={`site-inbox-bot-${p.id}`}
                        value={selectedBot}
                        disabled={!canEdit || busy !== null}
                        onChange={(e) => setChoice((prev) => ({ ...prev, [p.id]: e.target.value }))}
                        className="border border-titanium-800 bg-obsidian-950 px-2 py-1.5 font-mono text-[11px] text-titanium-200 disabled:opacity-50"
                      >
                        {bots.map((bot) => (
                          <option key={bot.id} value={bot.id}>{bot.name}{bot.enabled ? '' : ' (inaktiv)'}</option>
                        ))}
                      </select>
                      {!b ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={!canEdit || busy !== null || !selectedBot}
                          onClick={() => run(p.id, () => createSiteInboxBinding({ tenant_id: tenantId, website_project_id: p.id, bot_id: selectedBot }))}
                        >
                          Verbinden
                        </Button>
                      ) : (
                        <>
                          {selectedBot !== b.bot_id && (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={!canEdit || busy !== null}
                              onClick={() => run(p.id, () => updateSiteInboxBinding(tenantId, b.id, { bot_id: selectedBot }))}
                            >
                              Assistent wechseln
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant={b.enabled ? 'ghost' : 'secondary'}
                            disabled={!canEdit || busy !== null}
                            onClick={() => run(p.id, () => updateSiteInboxBinding(tenantId, b.id, { enabled: !b.enabled }))}
                          >
                            {b.enabled ? 'Ausschalten' : 'Einschalten'}
                          </Button>
                          <span
                            className={`border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider ${
                              b.enabled ? 'border-emerald-500/40 text-emerald-400' : 'border-titanium-800 text-titanium-500'
                            }`}
                          >
                            {b.enabled ? 'Ein' : 'Aus'}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
