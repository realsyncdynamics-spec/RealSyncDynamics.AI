import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, MessageCircle, Plus, AlertTriangle, Trash2, Copy, Check } from 'lucide-react';
import { AuthGate } from '../kodee/connections/AuthGate';
import { useTenant } from '../../core/access/TenantProvider';
import { Button } from '../../enterprise-os/components/Button';
import { Card, CardHeader, CardBody } from '../../enterprise-os/components/Card';
import { getSupabaseUrl } from '../../lib/supabaseUrl';
import {
  listBots, listWhatsAppChannels, createWhatsAppChannel,
  setWhatsAppChannelActive, deleteWhatsAppChannel,
} from './api';
import type { Bot, WhatsAppChannel } from './types';

/**
 * /app/bots/whatsapp — WhatsApp-Business-Kanäle eines Tenants.
 *
 * Verknüpft eine Meta-Geschäftsnummer (phone_number_id) mit einem Bot.
 * Eingehende Nachrichten beantwortet die Edge Function `whatsapp-webhook`
 * über dieselbe bot_reply-Pipeline wie der Website-Chat — die Callback-URL
 * unten wird in der Meta-App als Webhook eingetragen.
 *
 * WhatsApp ist ein Growth+-Feature (Entitlement bots.whatsapp); das Gate im
 * Backend greift unabhängig von dieser Anzeige.
 */
export function WhatsAppChannelsView() {
  return <AuthGate>{() => <WhatsAppChannelsInner />}</AuthGate>;
}

function WhatsAppChannelsInner() {
  const { activeTenantId, hasFeature } = useTenant();
  const [channels, setChannels] = useState<WhatsAppChannel[]>([]);
  const [bots, setBots] = useState<Bot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  const [newBotId, setNewBotId] = useState('');
  const [newPhoneNumberId, setNewPhoneNumberId] = useState('');
  const [newDisplayNumber, setNewDisplayNumber] = useState('');

  const whatsappEnabled = hasFeature('bots.whatsapp');
  const webhookUrl = `${getSupabaseUrl()}/functions/v1/whatsapp-webhook`;

  const reload = useCallback(() => {
    if (!activeTenantId) { setChannels([]); setBots([]); return; }
    setLoading(true); setError(null);
    Promise.all([listWhatsAppChannels(activeTenantId), listBots(activeTenantId)])
      .then(([ch, b]) => { setChannels(ch); setBots(b); })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [activeTenantId]);

  useEffect(() => { reload(); }, [reload]);

  async function handleCreate() {
    if (!activeTenantId || !newBotId || !newPhoneNumberId.trim()) return;
    setCreating(true); setError(null);
    try {
      await createWhatsAppChannel({
        tenant_id: activeTenantId,
        bot_id: newBotId,
        phone_number_id: newPhoneNumberId.trim(),
        display_phone_number: newDisplayNumber.trim() || null,
      });
      setNewPhoneNumberId(''); setNewDisplayNumber('');
      reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function handleToggle(ch: WhatsAppChannel) {
    if (!activeTenantId) return;
    setError(null);
    try {
      await setWhatsAppChannelActive(activeTenantId, ch.id, !ch.is_active);
      reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleDelete(ch: WhatsAppChannel) {
    if (!activeTenantId) return;
    if (!window.confirm(`Kanal ${ch.display_phone_number ?? ch.phone_number_id} wirklich entfernen?`)) return;
    setError(null);
    try {
      await deleteWhatsAppChannel(activeTenantId, ch.id);
      reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function copyWebhookUrl() {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard nicht verfügbar — die URL steht sichtbar daneben.
    }
  }

  const botName = (id: string) => bots.find((b) => b.id === id)?.name ?? '—';

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="flex h-14 items-center justify-between border-b border-titanium-900 bg-obsidian-900 px-4">
        <div className="flex items-center gap-3">
          <Link to="/app/bots" className="p-1.5 text-titanium-400 hover:bg-obsidian-800 hover:text-titanium-200">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center bg-gradient-to-br from-security-500 to-blue-700">
              <MessageCircle className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="font-display text-sm font-semibold tracking-tight text-titanium-50">WhatsApp-Kanäle</h1>
              <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-500">
                Geschäftsnummer → Bot
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6 space-y-6 sm:px-6">
        {!whatsappEnabled && (
          <div className="flex items-start gap-3 border border-amber-500/40 bg-amber-500/5 px-4 py-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <div className="text-xs text-titanium-300">
              <p className="font-semibold text-amber-300">WhatsApp ist in deinem Plan nicht freigeschaltet.</p>
              <p className="mt-1">
                Der WhatsApp-Kanal ist ab <strong>Growth</strong> verfügbar. Du kannst Kanäle zwar anlegen,
                aber eingehende Nachrichten werden erst nach einem Plan-Upgrade beantwortet.
              </p>
            </div>
          </div>
        )}

        <Card>
          <CardHeader
            title="Webhook für die Meta-App"
            eyebrow="Einrichtung"
            subtitle="Diese Callback-URL trägst du in deiner Meta-App unter WhatsApp → Konfiguration ein. Verify-Token und App-Secret verwaltet der Betreiber als Function-Secrets."
          />
          <CardBody>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <code className="flex-1 overflow-x-auto border border-titanium-800 bg-obsidian-900 px-3 py-2 font-mono text-xs text-titanium-300">
                {webhookUrl}
              </code>
              <Button variant="secondary" size="sm" onClick={copyWebhookUrl}>
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Kopiert' : 'Kopieren'}
              </Button>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Neuer Kanal"
            eyebrow="Anlegen"
            subtitle="Die Phone-Number-ID findest du in der Meta-App unter WhatsApp → API-Setup. Der Kanal startet inaktiv und wird nach dem Verbindungstest aktiviert."
          />
          <CardBody>
            <div className="grid gap-3 sm:grid-cols-2">
              <select
                value={newBotId}
                onChange={(e) => setNewBotId(e.target.value)}
                className="border border-titanium-700 bg-obsidian-900 px-3 py-2 text-sm text-titanium-100 focus:border-security-500 focus:outline-none"
              >
                <option value="">Bot wählen…</option>
                {bots.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
              <input
                value={newPhoneNumberId}
                onChange={(e) => setNewPhoneNumberId(e.target.value)}
                placeholder="Phone-Number-ID (Meta)"
                className="border border-titanium-700 bg-obsidian-900 px-3 py-2 font-mono text-sm text-titanium-100 placeholder:text-titanium-600 focus:border-security-500 focus:outline-none"
              />
              <input
                value={newDisplayNumber}
                onChange={(e) => setNewDisplayNumber(e.target.value)}
                placeholder="Anzeigenummer, z.B. +49 30 123456 (optional)"
                className="border border-titanium-700 bg-obsidian-900 px-3 py-2 text-sm text-titanium-100 placeholder:text-titanium-600 focus:border-security-500 focus:outline-none"
              />
              <Button onClick={handleCreate} disabled={creating || !newBotId || !newPhoneNumberId.trim() || !activeTenantId}>
                <Plus className="h-3.5 w-3.5" /> {creating ? 'Lege an…' : 'Kanal anlegen'}
              </Button>
            </div>
            {bots.length === 0 && !loading && (
              <p className="mt-3 font-mono text-xs text-titanium-500">
                Noch kein Bot vorhanden — <Link to="/app/bots" className="text-security-400 hover:underline">zuerst einen Bot anlegen</Link>.
              </p>
            )}
          </CardBody>
        </Card>

        {error && (
          <div className="border border-risk-critical/40 bg-risk-critical/5 px-4 py-3 text-xs text-risk-critical">
            {error}
          </div>
        )}

        {loading ? (
          <p className="font-mono text-xs text-titanium-500">Lade Kanäle…</p>
        ) : channels.length === 0 ? (
          <p className="font-mono text-xs text-titanium-500">Noch keine WhatsApp-Kanäle verknüpft.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {channels.map((ch) => (
              <Card key={ch.id}>
                <CardBody>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-display text-sm font-semibold text-titanium-50">
                        {ch.display_phone_number ?? ch.phone_number_id}
                      </h3>
                      <p className="mt-1 text-xs text-titanium-400">Bot: {botName(ch.bot_id)}</p>
                      <p className="mt-1 font-mono text-[10px] text-titanium-600">phone_number_id: {ch.phone_number_id}</p>
                    </div>
                    <span className={`font-mono text-[10px] uppercase tracking-wider ${ch.is_active ? 'text-emerald-400' : 'text-titanium-600'}`}>
                      {ch.is_active ? 'aktiv' : 'inaktiv'}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <Button variant="secondary" size="sm" onClick={() => handleToggle(ch)}>
                      {ch.is_active ? 'Deaktivieren' : 'Aktivieren'}
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => handleDelete(ch)}>
                      <Trash2 className="h-3.5 w-3.5" /> Entfernen
                    </Button>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
