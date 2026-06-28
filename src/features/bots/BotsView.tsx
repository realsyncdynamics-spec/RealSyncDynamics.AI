import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Bot as BotIcon, Plus, Inbox, AlertTriangle, Phone, MessageSquare } from 'lucide-react';
import { AuthGate } from '../kodee/connections/AuthGate';
import { useTenant } from '../../core/access/TenantProvider';
import { Button } from '../../enterprise-os/components/Button';
import { Card, CardHeader, CardBody } from '../../enterprise-os/components/Card';
import { listBots, createBot } from './api';
import type { Bot, BotChannel } from './types';

/**
 * /app/bots — Übersicht aller Konversations-Bots eines Tenants + Anlage.
 * Bots sind ein Growth+-Feature (Entitlement bots.enabled).
 */
export function BotsView() {
  return <AuthGate>{() => <BotsInner />}</AuthGate>;
}

const CHANNEL_LABEL: Record<BotChannel, string> = {
  chat: 'Chat', voice: 'Telefonie', telegram: 'Telegram', whatsapp: 'WhatsApp',
};

function BotsInner() {
  const { activeTenantId, hasFeature } = useTenant();
  const [bots, setBots] = useState<Bot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const botsEnabled = hasFeature('bots.enabled');

  const reload = useCallback(() => {
    if (!activeTenantId) { setBots([]); return; }
    setLoading(true); setError(null);
    listBots(activeTenantId)
      .then(setBots)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [activeTenantId]);

  useEffect(() => { reload(); }, [reload]);

  async function handleCreate() {
    if (!activeTenantId || !newName.trim()) return;
    setCreating(true); setError(null);
    try {
      await createBot({ tenant_id: activeTenantId, name: newName.trim() });
      setNewName('');
      reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="flex h-14 items-center justify-between border-b border-titanium-900 bg-obsidian-900 px-4">
        <div className="flex items-center gap-3">
          <Link to="/app" className="p-1.5 text-titanium-400 hover:bg-obsidian-800 hover:text-titanium-200">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center bg-gradient-to-br from-security-500 to-blue-700">
              <BotIcon className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="font-display text-sm font-semibold tracking-tight text-titanium-50">Bots</h1>
              <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-500">
                Chat · Telefonie · Termin &amp; Bestellung
              </p>
            </div>
          </div>
        </div>
        <Link to="/app/bots/inbox">
          <Button variant="secondary" size="sm"><Inbox className="h-3.5 w-3.5" /> Posteingang</Button>
        </Link>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6 space-y-6 sm:px-6">
        {!botsEnabled && (
          <div className="flex items-start gap-3 border border-amber-500/40 bg-amber-500/5 px-4 py-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <div className="text-xs text-titanium-300">
              <p className="font-semibold text-amber-300">Bots sind in deinem Plan nicht freigeschaltet.</p>
              <p className="mt-1">
                Das Bots-Feature ist ab <strong>Growth</strong> verfügbar. Du kannst Bots zwar anlegen,
                aber Antworten werden erst nach einem Plan-Upgrade ausgeliefert.
              </p>
            </div>
          </div>
        )}

        <Card>
          <CardHeader
            title="Neuer Bot"
            eyebrow="Anlegen"
            subtitle="Vergib einen Namen — Persona, Begrüßung und Fähigkeiten konfigurierst du danach."
          />
          <CardBody>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
                placeholder="z.B. Empfangs-Assistent"
                className="flex-1 border border-titanium-700 bg-obsidian-900 px-3 py-2 text-sm text-titanium-100 placeholder:text-titanium-600 focus:border-security-500 focus:outline-none"
              />
              <Button onClick={handleCreate} disabled={creating || !newName.trim() || !activeTenantId}>
                <Plus className="h-3.5 w-3.5" /> {creating ? 'Lege an…' : 'Bot anlegen'}
              </Button>
            </div>
          </CardBody>
        </Card>

        {error && (
          <div className="border border-risk-critical/40 bg-risk-critical/5 px-4 py-3 text-xs text-risk-critical">
            {error}
          </div>
        )}

        {loading ? (
          <p className="font-mono text-xs text-titanium-500">Lade Bots…</p>
        ) : bots.length === 0 ? (
          <p className="font-mono text-xs text-titanium-500">Noch keine Bots angelegt.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {bots.map((bot) => (
              <Link key={bot.id} to={`/app/bots/${bot.id}`} className="block">
                <Card className="transition-colors hover:border-titanium-600">
                  <CardBody>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-display text-sm font-semibold text-titanium-50">{bot.name}</h3>
                        {bot.description && (
                          <p className="mt-1 line-clamp-2 text-xs text-titanium-400">{bot.description}</p>
                        )}
                      </div>
                      <span className={`font-mono text-[10px] uppercase tracking-wider ${bot.enabled ? 'text-emerald-400' : 'text-titanium-600'}`}>
                        {bot.enabled ? 'aktiv' : 'aus'}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-titanium-500">
                      <span className="inline-flex items-center gap-1 border border-titanium-800 px-2 py-1">
                        {bot.channel === 'voice'
                          ? <Phone className="h-3 w-3" />
                          : <MessageSquare className="h-3 w-3" />}
                        {CHANNEL_LABEL[bot.channel]}
                      </span>
                      {bot.capabilities?.appointments && (
                        <span className="border border-titanium-800 px-2 py-1">Termine</span>
                      )}
                      {bot.capabilities?.orders && (
                        <span className="border border-titanium-800 px-2 py-1">Bestellungen</span>
                      )}
                    </div>
                  </CardBody>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
