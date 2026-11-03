import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../enterprise-os/components/Button';
import {
  listBots, listSiteInboxBindings, listWebsiteProjectSummaries,
  createSiteInboxBinding, updateSiteInboxBinding,
} from './api';
import { bindingBlockers, canManageBindings, isMissingSchemaError } from './inbox';
import type { Bot, SiteInboxBinding, WebsiteProjectSummary } from './types';

/**
 * Seite ↔ Posteingang (PR C, Schritt 4, E9 = A).
 *
 * Ordnet einer SiteOS-Seite (`website_projects`) einen Assistenten (`bots`)
 * zu. Das Kontaktformular der veröffentlichten Seite legt Anfragen dann im
 * Posteingang dieses Assistenten an (Edge Function inbox-form-submit).
 *
 * Grenzen, die der Server ohnehin durchsetzt und die hier nur sichtbar werden:
 *   * Anlegen und Ändern nur Owner/Admin (RLS + Guard-Trigger).
 *   * Neue Verbindungen starten ausgeschaltet.
 *   * `site_ref` erzeugt der Server; der Client schickt sie nie.
 *   * Anfragen kommen nur an, wenn Verbindung aktiv, Seite live und
 *     Assistent aktiv sind (`resolve_site_inbox`, fail-closed).
 */
export function SiteInboxBindingsPanel({ tenantId, role }: { tenantId: string; role: string | null }) {
  const canManage = canManageBindings(role);
  const [projects, setProjects] = useState<WebsiteProjectSummary[]>([]);
  const [bots, setBots] = useState<Bot[]>([]);
  const [bindings, setBindings] = useState<SiteInboxBinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [draftBot, setDraftBot] = useState<Record<string, string>>({});

  const reload = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [p, b] = await Promise.all([listWebsiteProjectSummaries(tenantId), listBots(tenantId)]);
      setProjects(p); setBots(b);
      try {
        setBindings(await listSiteInboxBindings(tenantId));
        setUnavailable(false);
      } catch (e) {
        if (!isMissingSchemaError((e as Error).message)) throw e;
        setBindings([]); setUnavailable(true);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { void reload(); }, [reload]);

  async function mutate(key: string, fn: () => Promise<unknown>) {
    setPending(key); setError(null);
    try {
      await fn();
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(null);
    }
  }

  if (loading) return <p className="font-mono text-xs text-titanium-500">Lade…</p>;

  if (unavailable) {
    return (
      <p className="border border-titanium-800 bg-obsidian-900 px-4 py-3 text-xs text-titanium-400">
        Seiten-Formulare sind in diesem Arbeitsbereich noch nicht freigeschaltet.
      </p>
    );
  }

  const bindingFor = (projectId: string) => bindings.find((b) => b.website_project_id === projectId);
  const botById = (id: string) => bots.find((b) => b.id === id);

  return (
    <div className="space-y-4">
      <div className="border border-titanium-800 bg-obsidian-900 px-4 py-3 text-xs text-titanium-400">
        <p>
          Verbinde eine Seite mit einem Assistenten. Das Kontaktformular der veröffentlichten Seite legt
          Anfragen dann hier unter <span className="text-titanium-200">Anfragen</span> an — mit Anliegen,
          Kontakt und Terminwunsch. Es wird kein Termin gebucht und keine KI aufgerufen.
        </p>
        <p className="mt-2">
          Anfragen kommen nur an, wenn die Annahme eingeschaltet ist, die Seite veröffentlicht ist und der
          Assistent aktiv ist. Neue Verbindungen starten ausgeschaltet.
        </p>
        <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-amber-400">
          Vorschau · Formular-Annahme noch nicht produktiv freigeschaltet
        </p>
      </div>

      {!canManage && (
        <p className="font-mono text-[11px] text-titanium-500">
          Nur Inhaber und Admins können Verbindungen anlegen oder ändern.
        </p>
      )}

      {error && (
        <div role="alert" className="border border-risk-critical/40 bg-risk-critical/5 px-4 py-3 text-xs text-risk-critical">{error}</div>
      )}

      {projects.length === 0 ? (
        <p className="font-mono text-xs text-titanium-500">
          Noch keine Seite vorhanden — <Link to="/app/siteos" className="text-security-400 hover:underline">Seite anlegen</Link>.
        </p>
      ) : bots.length === 0 ? (
        <p className="font-mono text-xs text-titanium-500">
          Noch kein Assistent vorhanden — <Link to="/app/bots" className="text-security-400 hover:underline">zuerst einen Assistenten anlegen</Link>.
        </p>
      ) : (
        <ul className="space-y-2">
          {projects.map((p) => {
            const binding = bindingFor(p.id);
            const selectId = `site-inbox-bot-${p.id}`;
            if (!binding) {
              const chosen = draftBot[p.id] ?? '';
              return (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 border border-titanium-800 px-4 py-3">
                  <ProjectHeading project={p} />
                  {canManage ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <label htmlFor={selectId} className="sr-only">Assistent für {p.name}</label>
                      <select
                        id={selectId}
                        value={chosen}
                        onChange={(e) => setDraftBot((d) => ({ ...d, [p.id]: e.target.value }))}
                        className="border border-titanium-700 bg-obsidian-900 px-2 py-1.5 text-xs text-titanium-100 focus:border-security-500 focus:outline-none"
                      >
                        <option value="">Assistent wählen…</option>
                        {bots.map((b) => <option key={b.id} value={b.id}>{b.name}{b.enabled ? '' : ' (deaktiviert)'}</option>)}
                      </select>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={!chosen || pending !== null}
                        onClick={() => mutate(`create:${p.id}`, () => createSiteInboxBinding(tenantId, p.id, chosen))}
                      >
                        {pending === `create:${p.id}` ? 'Verbinde…' : 'Verbinden'}
                      </Button>
                    </div>
                  ) : (
                    <span className="font-mono text-[10px] uppercase tracking-wider text-titanium-600">nicht verbunden</span>
                  )}
                </li>
              );
            }

            const bot = botById(binding.bot_id);
            const blockers = bindingBlockers(binding, p, bot);
            const receiving = blockers.length === 0;
            return (
              <li key={p.id} className="border border-titanium-800 px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <ProjectHeading project={p} />
                  <span className={`border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider ${
                    receiving ? 'border-emerald-500/40 text-emerald-400' : 'border-titanium-800 text-titanium-500'
                  }`}>
                    {receiving ? 'nimmt Anfragen an' : 'nimmt keine Anfragen an'}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <label htmlFor={selectId} className="font-mono text-[10px] uppercase tracking-wider text-titanium-600">Assistent</label>
                  <select
                    id={selectId}
                    value={binding.bot_id}
                    disabled={!canManage || pending !== null}
                    onChange={(e) => mutate(`bot:${binding.id}`, () => updateSiteInboxBinding(tenantId, binding.id, { bot_id: e.target.value }))}
                    className="border border-titanium-700 bg-obsidian-900 px-2 py-1.5 text-xs text-titanium-100 focus:border-security-500 focus:outline-none disabled:opacity-60"
                  >
                    {!bot && <option value={binding.bot_id}>Unbekannter Assistent</option>}
                    {bots.map((b) => <option key={b.id} value={b.id}>{b.name}{b.enabled ? '' : ' (deaktiviert)'}</option>)}
                  </select>
                  {canManage && (
                    <Button
                      size="sm"
                      variant={binding.enabled ? 'ghost' : 'secondary'}
                      disabled={pending !== null}
                      onClick={() => mutate(`toggle:${binding.id}`, () => updateSiteInboxBinding(tenantId, binding.id, { enabled: !binding.enabled }))}
                    >
                      {pending === `toggle:${binding.id}` ? 'Speichere…' : binding.enabled ? 'Annahme ausschalten' : 'Annahme einschalten'}
                    </Button>
                  )}
                </div>

                {!receiving && (
                  <ul className="mt-3 space-y-0.5 text-[11px] text-amber-300">
                    {blockers.map((b) => <li key={b}>· {b}</li>)}
                  </ul>
                )}

                <p className="mt-3 font-mono text-[10px] text-titanium-600">
                  Formular-Schlüssel: <span className="text-titanium-400">{binding.site_ref}</span>
                  {binding.disabled_at ? ` · ausgeschaltet seit ${new Date(binding.disabled_at).toLocaleString('de-DE')}` : ''}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ProjectHeading({ project }: { project: WebsiteProjectSummary }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-sm text-titanium-100">{project.name}</p>
      <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-600">Seite · {project.status}</p>
    </div>
  );
}
