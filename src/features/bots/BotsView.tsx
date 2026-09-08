import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Bot as BotIcon, Inbox, AlertTriangle, Phone, MessageSquare, Calendar, ShoppingBag } from 'lucide-react';
import { AuthGate } from '../kodee/connections/AuthGate';
import { useTenant } from '../../core/access/TenantProvider';
import { Button } from '../../enterprise-os/components/Button';
import { Card, CardHeader, CardBody } from '../../enterprise-os/components/Card';
import { listBots, createBot } from './api';
import { applyBotGoal, BOT_GOAL_TEMPLATES, type BotGoalId } from './templates';
import type { Bot, BotChannel } from './types';

/**
 * /app/bots — Übersicht und Anlage.
 *
 * Die Anlage folgt dem Everlast-Muster: zuerst das Ziel (Telefon, Chat,
 * Termine), nicht ein leeres Namensfeld. Der Kanal ist eine Folge des Ziels.
 */
export function BotsView() {
  return <AuthGate>{() => <BotsInner />}</AuthGate>;
}

const CHANNEL_LABEL: Record<BotChannel, string> = {
  chat: 'Chat', voice: 'Telefonie', telegram: 'Telegram', whatsapp: 'WhatsApp',
};

const GOAL_ICON: Record<BotGoalId, typeof Phone> = {
  phone_reception: Phone,
  web_chat: MessageSquare,
  appointments: Calendar,
  orders: ShoppingBag,
  whatsapp_desk: MessageSquare,
};

function BotsInner() {
  const navigate = useNavigate();
  const { activeTenantId, hasFeature } = useTenant();
  const [bots, setBots] = useState<Bot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState<BotGoalId | null>(null);
  const [displayName, setDisplayName] = useState('');

  const botsEnabled = hasFeature('bots.enabled');
  const voiceEnabled = hasFeature('bots.voice');

  const reload = useCallback(() => {
    if (!activeTenantId) { setBots([]); return; }
    setLoading(true); setError(null);
    listBots(activeTenantId)
      .then(setBots)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [activeTenantId]);

  useEffect(() => { reload(); }, [reload]);

  async function handleCreate(goal: BotGoalId) {
    if (!activeTenantId) return;
    if (goal === 'phone_reception' && !voiceEnabled) {
      navigate('/app/agents/susi');
      return;
    }
    setCreating(goal); setError(null);
    try {
      const created = await createBot(applyBotGoal(goal, {
        tenant_id: activeTenantId,
        displayName: displayName.trim() || BOT_GOAL_TEMPLATES.find((t) => t.id === goal)!.name,
      }));
      navigate(`/app/bots/${created.id}`);
    } catch (e) {
      setError((e as Error).message);
      setCreating(null);
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
                Ziel wählen · Telefon zuerst · Prüfpfad inklusive
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/app/agents/susi">
            <Button variant="secondary" size="sm"><Phone className="h-3.5 w-3.5" /> Telefon-Assistent</Button>
          </Link>
          <Link to="/app/bots/whatsapp">
            <Button variant="secondary" size="sm"><MessageSquare className="h-3.5 w-3.5" /> WhatsApp-Kanäle</Button>
          </Link>
          <Link to="/app/bots/inbox">
            <Button variant="secondary" size="sm"><Inbox className="h-3.5 w-3.5" /> Posteingang</Button>
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6 space-y-6 sm:px-6">
        {!botsEnabled && (
          <div className="flex items-start gap-3 border border-amber-500/40 bg-amber-500/5 px-4 py-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <div className="text-xs text-titanium-300">
              <p className="font-semibold text-amber-300">Bots sind in deinem Plan nicht freigeschaltet.</p>
              <p className="mt-1">
                Das Bots-Feature ist ab <strong>Starter</strong> verfügbar. Du kannst Bots zwar anlegen,
                aber Antworten werden erst nach einem Plan-Upgrade ausgeliefert.
              </p>
            </div>
          </div>
        )}

        <Card>
          <CardHeader
            title="Was soll der Bot tun?"
            eyebrow="Anlegen"
            subtitle="Drei Angaben reichen: Ziel, Name, los. Kanal und Persona entstehen daraus — wie bei Everlast, auf unserem Stack."
          />
          <CardBody className="space-y-4">
            <div>
              <label className="mb-1.5 block font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-titanium-500">
                Anzeigename (optional)
              </label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="z. B. Praxis Dr. Müller"
                className="w-full border border-titanium-700 bg-obsidian-900 px-3 py-2 text-sm text-titanium-100 placeholder:text-titanium-600 focus:border-security-500 focus:outline-none"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {BOT_GOAL_TEMPLATES.map((goal) => {
                const Icon = GOAL_ICON[goal.id];
                const lockedVoice = goal.channel === 'voice' && !voiceEnabled;
                return (
                  <button
                    key={goal.id}
                    type="button"
                    onClick={() => void handleCreate(goal.id)}
                    disabled={creating !== null || !activeTenantId}
                    className={`border px-4 py-4 text-left transition-colors hover:border-titanium-500 disabled:opacity-50 ${
                      goal.featured
                        ? 'border-security-500/50 bg-security-500/5 sm:col-span-2'
                        : 'border-titanium-800 bg-obsidian-900'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center border border-titanium-800 bg-obsidian-950 text-cyan-400">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-display text-sm font-semibold text-titanium-50">
                          {goal.name}
                          {goal.featured && (
                            <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-cyan-400">Leitprodukt</span>
                          )}
                          {lockedVoice && (
                            <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-amber-400">Voice-Add-on</span>
                          )}
                        </p>
                        <p className="mt-1 text-xs text-titanium-400">{goal.promise}</p>
                        <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-titanium-600">
                          {creating === goal.id ? 'Lege an…' : CHANNEL_LABEL[goal.channel]}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-titanium-500">
              Agenturen verdienen über White-Label und das Agency-Bot-Pack an <em>unseren</em> Bots —
              nicht als Wiederverkäufer fremder Plattformen. Jedes Gespräch bleibt im Prüfpfad.
            </p>
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
