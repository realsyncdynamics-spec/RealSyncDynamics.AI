import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Phone, Loader2 } from 'lucide-react';
import { AuthGate } from '../kodee/connections/AuthGate';
import { useTenant } from '../../core/access/TenantProvider';
import { Button } from '../../enterprise-os/components/Button';
import { Card, CardHeader, CardBody } from '../../enterprise-os/components/Card';
import { createBot } from '../bots/api';
import { applyBotGoal } from '../bots/templates';

/**
 * /app/agents/susi — Telefon-Assistent.
 *
 * Früher eine leere Fläche mit Verweis auf eine spätere Stimmen-Anbindung.
 * Der productive Pfad ist `bot-voice-webhook` + Zielvorlage `phone_reception`.
 * Diese Seite ist der einfache Einstieg: drei Felder, ein Bot, weiter in den Builder.
 */
export function CallAgentSusiPage() {
  return <AuthGate>{() => <SusiInner />}</AuthGate>;
}

function SusiInner() {
  const navigate = useNavigate();
  const { activeTenantId, hasFeature } = useTenant();
  const voiceEnabled = hasFeature('bots.voice');

  const [name, setName] = useState('');
  const [hours, setHours] = useState('');
  const [handoffPhone, setHandoffPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const input = 'w-full border border-titanium-700 bg-obsidian-900 px-3 py-2 text-sm text-titanium-100 placeholder:text-titanium-600 focus:border-security-500 focus:outline-none';
  const label = 'mb-1.5 block font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-titanium-500';

  async function handleCreate() {
    if (!activeTenantId) return;
    setBusy(true); setError(null);
    try {
      const created = await createBot(applyBotGoal('phone_reception', {
        tenant_id: activeTenantId,
        displayName: name.trim() || 'Telefon-Empfang',
        hours: hours.trim() || undefined,
        handoffPhone: handoffPhone.trim() || undefined,
      }));
      navigate(`/app/bots/${created.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <Link to="/app/bots" className="inline-flex items-center gap-1.5 text-xs text-titanium-400 hover:text-titanium-100">
          <ArrowLeft className="h-3.5 w-3.5" /> Zu den Bots
        </Link>

        <div className="mt-6 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center border border-titanium-800 bg-obsidian-950 text-cyan-400">
            <Phone className="h-4 w-4" />
          </div>
          <div>
            <h1 className="font-display text-lg font-semibold text-titanium-50">Telefon-Assistent</h1>
            <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-500">
              Drei Felder · Twilio-Webhook · Prüfpfad
            </p>
          </div>
        </div>

        <p className="mt-4 max-w-xl text-sm text-titanium-400">
          Wir bauen den Telefon-Bot selbst — nicht als White-Label von Everlast oder EverBots.
          Was dort gewinnt, ist die Einfachheit: Empfang, Termine, Weiterleitung. Die Stimme
          kommt vom EU-Telefonie-Anbieter, jedes Gespräch landet im Prüfpfad.
        </p>

        {!voiceEnabled && (
          <div className="mt-4 border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-xs text-titanium-300">
            Voice ist in diesem Plan nicht enthalten. Der Bot lässt sich anlegen; Anrufe werden
            erst nach Freischaltung von <span className="font-mono">bots.voice</span> angenommen.
          </div>
        )}

        <Card className="mt-6">
          <CardHeader
            title="Empfang einrichten"
            eyebrow="Loslegen"
            subtitle="Name, Zeiten, Rückrufnummer. Den Rest konfigurieren Sie im Builder."
          />
          <CardBody className="space-y-4">
            <div>
              <label className={label} htmlFor="susi-name">Wen begrüßt der Anruf?</label>
              <input id="susi-name" className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Praxis Dr. Müller" />
            </div>
            <div>
              <label className={label} htmlFor="susi-hours">Öffnungszeiten</label>
              <input id="susi-hours" className={input} value={hours} onChange={(e) => setHours(e.target.value)} placeholder="Mo–Fr 8–18 Uhr" />
            </div>
            <div>
              <label className={label} htmlFor="susi-handoff">Weiterleitung an einen Menschen</label>
              <input id="susi-handoff" className={input} value={handoffPhone} onChange={(e) => setHandoffPhone(e.target.value)} placeholder="+49 …" />
            </div>
            {error && (
              <div className="border border-risk-critical/40 bg-risk-critical/5 px-3 py-2 text-xs text-risk-critical">{error}</div>
            )}
            <Button onClick={() => void handleCreate()} disabled={busy || !activeTenantId}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Phone className="h-3.5 w-3.5" />}
              <span className="ml-2">{busy ? 'Lege an…' : 'Telefon-Bot anlegen'}</span>
            </Button>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
