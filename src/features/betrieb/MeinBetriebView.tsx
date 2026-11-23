import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Bot as BotIcon, Globe2, Inbox, Loader2, Store } from 'lucide-react';
import { AuthGate } from '../kodee/connections/AuthGate';
import { useTenant } from '../../core/access/TenantProvider';
import { Button } from '../../enterprise-os/components/Button';
import { Card, CardBody, CardHeader } from '../../enterprise-os/components/Card';
import { listAppointments, listBots, listConversations, listOrders } from '../bots/api';
import { listSites } from '../siteos/siteOsApi';
import type { BotChannel } from '../bots/types';
import {
  countInbox, formatCount, INBOX_FETCH_LIMIT, summarizeBots, summarizeSites,
  type BotItem, type InboxCounts, type SiteItem,
} from './betriebSummary';

/**
 * /app/betrieb — „Mein Betrieb“: Kundenübersicht über Seite, Assistent und Eingänge.
 * Bündelt nur Bestehendes (SiteOS, Bots, Posteingang). Kein eigenes Backend.
 */
export function MeinBetriebView() {
  return <AuthGate>{() => <MeinBetriebInner />}</AuthGate>;
}

const CHANNEL_LABEL: Record<BotChannel, string> = {
  chat: 'Chat', voice: 'Telefon', telegram: 'Telegram', whatsapp: 'WhatsApp',
};

type Section<T> = { loading: boolean; error: string | null; data: T };

function initial<T>(data: T): Section<T> {
  return { loading: true, error: null, data };
}

function errText(reason: unknown): string {
  return reason instanceof Error ? reason.message : 'Unbekannter Fehler';
}

function MeinBetriebInner() {
  const { activeTenantId } = useTenant();
  const [sites, setSites] = useState<Section<SiteItem[]>>(initial([]));
  const [bots, setBots] = useState<Section<BotItem[]>>(initial([]));
  const [inbox, setInbox] = useState<Section<InboxCounts | null>>(initial(null));

  const load = useCallback(async () => {
    if (!activeTenantId) {
      setSites({ loading: false, error: null, data: [] });
      setBots({ loading: false, error: null, data: [] });
      setInbox({ loading: false, error: null, data: null });
      return;
    }
    setSites((s) => ({ ...s, loading: true, error: null }));
    setBots((s) => ({ ...s, loading: true, error: null }));
    setInbox((s) => ({ ...s, loading: true, error: null }));

    const [siteRes, botRes, convRes, apptRes, orderRes] = await Promise.allSettled([
      listSites(activeTenantId),
      listBots(activeTenantId),
      listConversations(activeTenantId, INBOX_FETCH_LIMIT),
      listAppointments(activeTenantId, INBOX_FETCH_LIMIT),
      listOrders(activeTenantId, INBOX_FETCH_LIMIT),
    ]);

    setSites(siteRes.status === 'fulfilled'
      ? { loading: false, error: null, data: summarizeSites(siteRes.value) }
      : { loading: false, error: errText(siteRes.reason), data: [] });
    setBots(botRes.status === 'fulfilled'
      ? { loading: false, error: null, data: summarizeBots(botRes.value) }
      : { loading: false, error: errText(botRes.reason), data: [] });

    const inboxFailed = [convRes, apptRes, orderRes].find((r) => r.status === 'rejected');
    if (inboxFailed && inboxFailed.status === 'rejected') {
      setInbox({ loading: false, error: errText(inboxFailed.reason), data: null });
    } else if (convRes.status === 'fulfilled' && apptRes.status === 'fulfilled' && orderRes.status === 'fulfilled') {
      setInbox({ loading: false, error: null, data: countInbox(convRes.value, apptRes.value, orderRes.value) });
    }
  }, [activeTenantId]);

  useEffect(() => { void load(); }, [load]);
  const retry = useCallback(() => { void load(); }, [load]);

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="flex h-14 items-center gap-3 border-b border-titanium-900 bg-obsidian-900 px-4">
        <div className="flex h-8 w-8 items-center justify-center bg-gradient-to-br from-security-500 to-blue-700">
          <Store className="h-4 w-4 text-white" />
        </div>
        <div>
          <h1 className="font-display text-sm font-semibold tracking-tight text-titanium-50">Mein Betrieb</h1>
          <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-500">
            Seite · Assistent · Eingänge
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6">
        {!activeTenantId && (
          <p className="text-sm text-titanium-400">Kein Arbeitsbereich ausgewählt.</p>
        )}

        <InboxCard section={inbox} onRetry={retry} />

        <div className="grid gap-6 md:grid-cols-2">
          <SitesCard section={sites} onRetry={retry} />
          <BotsCard section={bots} onRetry={retry} />
        </div>
      </div>
    </div>
  );
}

function StateBlock({ loading, error, onRetry, label }: {
  loading: boolean; error: string | null; onRetry: () => void; label: string;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-titanium-400" aria-label={`${label} werden geladen`}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Wird geladen …
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex flex-wrap items-center gap-3 border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-titanium-300" role="alert">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
        <span className="min-w-0 flex-1">{label} konnten nicht geladen werden.</span>
        <Button variant="secondary" size="sm" onClick={onRetry}>Erneut versuchen</Button>
      </div>
    );
  }
  return null;
}

function InboxCard({ section, onRetry }: { section: Section<InboxCounts | null>; onRetry: () => void }) {
  const c = section.data;
  const tiles: { label: string; value: number; hint?: string }[] = c ? [
    { label: 'Offene Gespräche', value: c.openConversations },
    { label: 'Terminwünsche', value: c.requestedAppointments, hint: 'Wunsch, nicht bestätigt' },
    { label: 'Neue Bestellungen', value: c.newOrders },
  ] : [];
  return (
    <Card>
      <CardHeader
        eyebrow="Eingänge"
        title="Was ist reingekommen?"
        subtitle="Anfragen, Terminwünsche und Bestellungen über Ihren Assistenten."
        action={<Link to="/app/bots/inbox"><Button variant="secondary" size="sm"><Inbox className="h-3.5 w-3.5" /> Posteingang öffnen</Button></Link>}
      />
      <CardBody>
        <StateBlock loading={section.loading} error={section.error} onRetry={onRetry} label="Eingänge" />
        {!section.loading && !section.error && c && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {tiles.map((t) => (
              <div key={t.label} className="border border-titanium-800 bg-obsidian-900 px-4 py-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-titanium-500">{t.label}</p>
                <p className="mt-1 font-display text-2xl font-semibold text-titanium-50">{formatCount(t.value, c.truncated)}</p>
                {t.hint && <p className="mt-0.5 text-[11px] text-amber-300">{t.hint}</p>}
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function SitesCard({ section, onRetry }: { section: Section<SiteItem[]>; onRetry: () => void }) {
  return (
    <Card>
      <CardHeader eyebrow="Meine Seite" title="Webseite & Landingpage" subtitle="Bearbeiten, Vorschau ansehen, veröffentlichen." />
      <CardBody>
        <StateBlock loading={section.loading} error={section.error} onRetry={onRetry} label="Seiten" />
        {!section.loading && !section.error && section.data.length === 0 && (
          <div className="space-y-3 text-sm text-titanium-300">
            <p>Sie haben noch keine Seite.</p>
            <Link to="/build?kind=landing"><Button size="sm"><Globe2 className="h-3.5 w-3.5" /> Seite erstellen</Button></Link>
          </div>
        )}
        {!section.loading && !section.error && section.data.length > 0 && (
          <ul className="divide-y divide-titanium-800">
            {section.data.map((s) => (
              <li key={s.slug} className="flex flex-wrap items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-titanium-100">{s.name}</p>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-500">{s.statusLabel}</p>
                </div>
                <Link to={s.editPath}><Button variant="secondary" size="sm">Bearbeiten</Button></Link>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function BotsCard({ section, onRetry }: { section: Section<BotItem[]>; onRetry: () => void }) {
  return (
    <Card>
      <CardHeader eyebrow="Mein Assistent" title="Chat- und Telefonassistent" subtitle="Begrüßung, Angaben und Verhalten anpassen." />
      <CardBody>
        <StateBlock loading={section.loading} error={section.error} onRetry={onRetry} label="Assistenten" />
        {!section.loading && !section.error && section.data.length === 0 && (
          <div className="space-y-3 text-sm text-titanium-300">
            <p>Sie haben noch keinen Assistenten.</p>
            <Link to="/app/bots"><Button size="sm"><BotIcon className="h-3.5 w-3.5" /> Assistent anlegen</Button></Link>
          </div>
        )}
        {!section.loading && !section.error && section.data.length > 0 && (
          <ul className="divide-y divide-titanium-800">
            {section.data.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-titanium-100">{b.name}</p>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-500">
                    {CHANNEL_LABEL[b.channel] ?? b.channel} · {b.enabled ? 'aktiv' : 'pausiert'}
                  </p>
                </div>
                <Link to={b.editPath}><Button variant="secondary" size="sm">Bearbeiten</Button></Link>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
