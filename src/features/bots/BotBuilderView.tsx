import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Trash2, Bot as BotIcon } from 'lucide-react';
import { AuthGate } from '../kodee/connections/AuthGate';
import { useTenant } from '../../core/access/TenantProvider';
import { Button } from '../../enterprise-os/components/Button';
import { Card, CardHeader, CardBody } from '../../enterprise-os/components/Card';
import { getBot, updateBot, deleteBot } from './api';
import type { Bot, BotChannel } from './types';

/** /app/bots/:botId — Bot-Builder: Persona, Kanal, Fähigkeiten, Integration. */
export function BotBuilderView() {
  return <AuthGate>{() => <BotBuilderInner />}</AuthGate>;
}

const FUNCTIONS_BASE = (() => {
  const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '';
  return url ? `${url.replace(/\/$/, '')}/functions/v1` : 'https://<projekt>.supabase.co/functions/v1';
})();

const CHANNELS: BotChannel[] = ['chat', 'voice', 'telegram', 'whatsapp'];

function BotBuilderInner() {
  const { botId } = useParams<{ botId: string }>();
  const navigate = useNavigate();
  const { activeTenantId } = useTenant();

  const [bot, setBot] = useState<Bot | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!activeTenantId || !botId) return;
    setLoading(true); setError(null);
    getBot(activeTenantId, botId)
      .then((b) => { if (!b) setError('Bot nicht gefunden.'); else setBot(b); })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [activeTenantId, botId]);

  function patch<K extends keyof Bot>(key: K, value: Bot[K]) {
    setBot((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function handleSave() {
    if (!activeTenantId || !bot) return;
    setSaving(true); setError(null);
    try {
      const updated = await updateBot(activeTenantId, bot.id, {
        name: bot.name,
        description: bot.description,
        channel: bot.channel,
        persona: bot.persona,
        greeting: bot.greeting,
        capabilities: bot.capabilities,
        enabled: bot.enabled,
      });
      setBot(updated);
      setSavedAt(Date.now());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!activeTenantId || !bot) return;
    if (!confirm(`Bot „${bot.name}" wirklich löschen? Konversationen bleiben erhalten.`)) return;
    try {
      await deleteBot(activeTenantId, bot.id);
      navigate('/app/bots');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const input = 'w-full border border-titanium-700 bg-obsidian-900 px-3 py-2 text-sm text-titanium-100 placeholder:text-titanium-600 focus:border-security-500 focus:outline-none';
  const label = 'mb-1.5 block font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-titanium-500';

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="flex h-14 items-center justify-between border-b border-titanium-900 bg-obsidian-900 px-4">
        <div className="flex items-center gap-3">
          <Link to="/app/bots" className="p-1.5 text-titanium-400 hover:bg-obsidian-800 hover:text-titanium-200">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center bg-gradient-to-br from-security-500 to-blue-700">
              <BotIcon className="h-4 w-4 text-white" />
            </div>
            <h1 className="font-display text-sm font-semibold tracking-tight text-titanium-50">
              {bot?.name ?? 'Bot'}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {savedAt && <span className="font-mono text-[10px] uppercase tracking-wider text-emerald-400">gespeichert</span>}
          <Button onClick={handleSave} disabled={saving || !bot}><Save className="h-3.5 w-3.5" /> {saving ? 'Speichere…' : 'Speichern'}</Button>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-6 space-y-5 sm:px-6">
        {error && (
          <div className="border border-risk-critical/40 bg-risk-critical/5 px-4 py-3 text-xs text-risk-critical">{error}</div>
        )}
        {loading || !bot ? (
          <p className="font-mono text-xs text-titanium-500">Lade Bot…</p>
        ) : (
          <>
            <Card>
              <CardHeader title="Grunddaten" eyebrow="Konfiguration" />
              <CardBody className="space-y-4">
                <div>
                  <label className={label}>Name</label>
                  <input className={input} value={bot.name} onChange={(e) => patch('name', e.target.value)} />
                </div>
                <div>
                  <label className={label}>Beschreibung (intern)</label>
                  <input className={input} value={bot.description ?? ''} onChange={(e) => patch('description', e.target.value || null)} />
                </div>
                <div>
                  <label className={label}>Kanal</label>
                  <select className={input} value={bot.channel} onChange={(e) => patch('channel', e.target.value as BotChannel)}>
                    {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <label className="flex items-center gap-2 text-sm text-titanium-200">
                  <input type="checkbox" checked={bot.enabled} onChange={(e) => patch('enabled', e.target.checked)} />
                  Bot aktiv (liefert Antworten aus)
                </label>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Persona &amp; Begrüßung" eyebrow="Verhalten" subtitle="Persona fließt als zusätzlicher Kontext in jede Antwort ein." />
              <CardBody className="space-y-4">
                <div>
                  <label className={label}>Persona / Unternehmens-Kontext</label>
                  <textarea
                    className={`${input} min-h-[120px] resize-y font-sans`}
                    value={bot.persona ?? ''}
                    onChange={(e) => patch('persona', e.target.value || null)}
                    placeholder="z.B. Du bist der Empfangs-Bot der Zahnarztpraxis Dr. Müller. Öffnungszeiten Mo–Fr 8–18 Uhr. Antworte freundlich und siezen."
                  />
                </div>
                <div>
                  <label className={label}>Begrüßung (erste Nachricht / Voice-Greeting)</label>
                  <input className={input} value={bot.greeting ?? ''} onChange={(e) => patch('greeting', e.target.value || null)} placeholder="Hallo! Wie kann ich Ihnen helfen?" />
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Fähigkeiten" eyebrow="Aktionen" />
              <CardBody className="space-y-3">
                <label className="flex items-center gap-2 text-sm text-titanium-200">
                  <input
                    type="checkbox"
                    checked={!!bot.capabilities?.appointments}
                    onChange={(e) => patch('capabilities', { ...bot.capabilities, appointments: e.target.checked })}
                  />
                  Terminbuchung (appointment-book)
                </label>
                <label className="flex items-center gap-2 text-sm text-titanium-200">
                  <input
                    type="checkbox"
                    checked={!!bot.capabilities?.orders}
                    onChange={(e) => patch('capabilities', { ...bot.capabilities, orders: e.target.checked })}
                  />
                  Bestellannahme (order-intake)
                </label>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Integration" eyebrow="Endpoints" subtitle="Identifiziere den Bot über tenant_id + bot_id." />
              <CardBody className="space-y-3">
                <CodeBlock label="Chat-Endpoint" value={`POST ${FUNCTIONS_BASE}/bot-chat`} />
                <CodeBlock label="tenant_id" value={bot.tenant_id} />
                <CodeBlock label="bot_id" value={bot.id} />
                {bot.channel === 'voice' && (
                  <CodeBlock label="Voice-Webhook (Twilio)" value={`${FUNCTIONS_BASE}/bot-voice-webhook?tenant_id=${bot.tenant_id}&bot_id=${bot.id}`} />
                )}
                <CodeBlock
                  label="Beispiel-Request"
                  value={`curl -X POST ${FUNCTIONS_BASE}/bot-chat \\\n  -H 'content-type: application/json' \\\n  -d '{"tenant_id":"${bot.tenant_id}","bot_id":"${bot.id}","message":"Hallo"}'`}
                />
              </CardBody>
            </Card>

            <div className="flex justify-end pt-2">
              <Button variant="danger" onClick={handleDelete}><Trash2 className="h-3.5 w-3.5" /> Bot löschen</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function CodeBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-1 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-titanium-500">{label}</p>
      <pre className="overflow-x-auto whitespace-pre-wrap break-all border border-titanium-800 bg-obsidian-900 px-3 py-2 font-mono text-[11px] text-titanium-300">{value}</pre>
    </div>
  );
}
