// Telegram Integration Page — Workspace mit Telegram verbinden.
// Route: /app/settings/integrations/telegram
//
// Ablauf:
//  1. Nutzer klickt /connect im Telegram Bot
//  2. Bot erzeugt Token und sendet Link hierher
//  3. Nutzer öffnet Link (token als Query-Param)
//  4. Diese Seite validiert den Token und aktiviert die Verbindung

import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, CheckCircle2, AlertTriangle, Loader2,
  MessageCircle, Shield, Unlink, ExternalLink,
} from 'lucide-react';
import { AuthGate } from '../../features/kodee/connections/AuthGate';
import type { Session } from '@supabase/supabase-js';
import { getSupabase } from '../../lib/supabase';

const SUPABASE_FUNCTIONS_URL =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, '') ??
  'https://ebljyceifhnlzhjfyxup.supabase.co';

interface ConnectionStatus {
  connected:         boolean;
  status?:           string;
  telegram_username?: string;
  connected_at?:     string;
  tenant_name?:      string;
}

export function TelegramIntegrationPage() {
  return (
    <AuthGate>
      {(session) => <Inner session={session} />}
    </AuthGate>
  );
}

function Inner({ session }: { session: Session }) {
  const [searchParams] = useSearchParams();
  const token          = searchParams.get('token');
  // telegram_user_id aus dem Connect-Link — vom Bot als ?uid= gesetzt
  const telegramUserId = searchParams.get('uid');

  const [status, setStatus]     = useState<ConnectionStatus | null>(null);
  const [loading, setLoading]   = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [success, setSuccess]   = useState<string | null>(null);

  const supabase = getSupabase();

  async function callChannels(body: Record<string, unknown>) {
    const { data: { session: s } } = await supabase.auth.getSession();
    const jwt = s?.access_token;
    if (!jwt) throw new Error('Nicht eingeloggt');
    const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/functions/v1/telegram-channels`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${jwt}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message ?? `HTTP ${res.status}`);
    }
    return res.json();
  }

  // Aktuellen Status laden
  async function loadStatus() {
    setLoading(true);
    setError(null);
    try {
      const data = await callChannels({ op: 'status' });
      setStatus(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  // Token-basierte Verbindung abschließen
  async function completeConnection(t: string, uid: string) {
    setConnecting(true);
    setError(null);
    setSuccess(null);
    try {
      // tenant_id aus Membership ableiten — maybeSingle() statt single() damit
      // der Fehler bei 0 Memberships klar kommuniziert wird.
      const { data: membership, error: memberErr } = await supabase
        .from('memberships')
        .select('tenant_id')
        .in('role', ['owner', 'admin', 'editor', 'dpo'])
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (memberErr) throw new Error(memberErr.message);
      if (!membership?.tenant_id) {
        throw new Error('Kein Workspace gefunden. Bitte zuerst einen Workspace erstellen.');
      }

      await callChannels({
        op:               'connect_complete',
        token:            t,
        tenant_id:        membership.tenant_id,
        telegram_user_id: uid,
      });
      setSuccess('Verbindung hergestellt! Du kannst jetzt den Telegram Bot nutzen.');
      await loadStatus();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setConnecting(false);
    }
  }

  // Verbindung widerrufen
  async function handleRevoke() {
    if (!window.confirm('Telegram-Verbindung wirklich trennen?')) return;
    setRevoking(true);
    setError(null);
    setSuccess(null);
    try {
      await callChannels({ op: 'revoke' });
      setSuccess('Verbindung getrennt.');
      setStatus({ connected: false });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRevoking(false);
    }
  }

  useEffect(() => {
    loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (token && telegramUserId && !loading && !status?.connected && !connecting) {
      completeConnection(token, telegramUserId);
    } else if (token && !telegramUserId && !loading) {
      setError('Ungültiger Verbindungslink — fehlende Nutzer-ID. Bitte /connect im Telegram-Bot erneut ausführen.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, telegramUserId, loading]);

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center justify-between px-4">
        <Link
          to="/app/settings"
          className="flex items-center gap-2 text-titanium-300 hover:text-titanium-100 text-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          Einstellungen
        </Link>
        <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-titanium-100">
          Telegram Integration
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10 space-y-8">

        {/* Header */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-security-blue flex items-center justify-center">
              <MessageCircle className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="font-display font-bold text-xl text-titanium-50">Telegram Agent Gateway</div>
              <div className="text-sm text-titanium-400">Governance · Audit · Risk · Evidence via Telegram</div>
            </div>
          </div>
          <p className="text-titanium-300 text-sm leading-relaxed">
            Verbinde diesen Workspace mit deinem Telegram-Account, um Governance-Status, Audits, Risiken
            und Evidence-Vault-Informationen direkt über den Telegram-Bot abzufragen.
          </p>
        </section>

        {/* Fehlermeldung */}
        {error && (
          <div className="flex items-start gap-3 bg-red-950 border border-red-800 p-4 text-red-200 text-sm">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Erfolgsmeldung */}
        {success && (
          <div className="flex items-start gap-3 bg-emerald-950 border border-emerald-800 p-4 text-emerald-200 text-sm">
            <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-emerald-400" />
            <span>{success}</span>
          </div>
        )}

        {/* Status-Karte */}
        <section className="border border-titanium-800 bg-obsidian-900">
          <div className="px-5 py-4 border-b border-titanium-800">
            <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-titanium-400">Status</div>
          </div>
          <div className="px-5 py-5">
            {loading || connecting ? (
              <div className="flex items-center gap-2 text-titanium-400 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                {connecting ? 'Verbindung wird hergestellt…' : 'Lade Status…'}
              </div>
            ) : status?.connected ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
                  <CheckCircle2 className="h-4 w-4" />
                  Verbunden
                </div>
                <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                  {status.telegram_username && (
                    <>
                      <dt className="text-titanium-400">Telegram</dt>
                      <dd className="font-mono text-titanium-100">@{status.telegram_username}</dd>
                    </>
                  )}
                  {status.tenant_name && (
                    <>
                      <dt className="text-titanium-400">Workspace</dt>
                      <dd className="text-titanium-100">{status.tenant_name}</dd>
                    </>
                  )}
                  {status.connected_at && (
                    <>
                      <dt className="text-titanium-400">Verbunden seit</dt>
                      <dd className="font-mono text-titanium-100 text-xs">
                        {new Date(status.connected_at).toLocaleString('de-DE')}
                      </dd>
                    </>
                  )}
                </dl>
                <button
                  onClick={handleRevoke}
                  disabled={revoking}
                  className="flex items-center gap-2 px-4 py-2 border border-red-700 text-red-400 hover:bg-red-950 text-sm disabled:opacity-50 transition-colors"
                >
                  {revoking ? <Loader2 className="h-3 w-3 animate-spin" /> : <Unlink className="h-3 w-3" />}
                  Verbindung trennen
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-titanium-400 text-sm">
                  <div className="w-2 h-2 rounded-full bg-titanium-600" />
                  Nicht verbunden
                </div>
                <p className="text-titanium-400 text-sm">
                  Starte den Telegram Bot und sende <code className="bg-obsidian-800 px-1">/connect</code>,
                  um einen Verbindungslink zu erhalten.
                </p>
                <a
                  href="https://t.me/RealSyncDynamicsBot"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-security-blue text-white text-sm hover:opacity-90 transition-opacity"
                >
                  <MessageCircle className="h-3 w-3" />
                  Bot öffnen
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </div>
        </section>

        {/* Verfügbare Commands */}
        <section className="border border-titanium-800 bg-obsidian-900">
          <div className="px-5 py-4 border-b border-titanium-800">
            <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-titanium-400">Commands</div>
          </div>
          <div className="px-5 py-4">
            <dl className="space-y-2 text-sm">
              {[
                ['/start',      'Bot starten und Willkommensnachricht erhalten'],
                ['/help',       'Hilfe und alle verfügbaren Commands'],
                ['/connect',    'Telegram mit diesem Workspace verbinden'],
                ['/status',     'Governance-OS Status anzeigen'],
                ['/audit',      'Audit starten oder Auditbereich öffnen'],
                ['/risks',      'Aktuelle Risiken anzeigen'],
                ['/evidence',   'Evidence Vault Status anzeigen'],
                ['/compliance', 'Compliance-Übersicht anzeigen'],
                ['/assistant',  'Frage an den RealSync-Agenten stellen'],
                ['/settings',   'Verbindungseinstellungen anzeigen'],
              ].map(([cmd, desc]) => (
                <div key={cmd} className="flex items-start gap-3">
                  <code className="shrink-0 font-mono text-security-blue text-xs bg-obsidian-800 px-1.5 py-0.5 w-28">
                    {cmd}
                  </code>
                  <span className="text-titanium-300">{desc}</span>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Sicherheitshinweis */}
        <section className="flex items-start gap-3 border border-titanium-800 bg-obsidian-900 px-5 py-4">
          <Shield className="h-4 w-4 text-security-blue shrink-0 mt-0.5" />
          <div className="text-sm text-titanium-400 leading-relaxed">
            <strong className="text-titanium-200">Datenschutz:</strong> Bot-Token und Verbindungsdaten werden
            ausschließlich als gehashte Werte gespeichert. Destruktive Aktionen erfordern immer eine explizite
            Bestätigung. Alle Interaktionen werden im Governance-Audit-Log protokolliert.
          </div>
        </section>

      </main>
    </div>
  );
}
