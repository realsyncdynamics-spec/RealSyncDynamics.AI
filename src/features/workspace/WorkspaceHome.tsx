// WorkspaceHome — kanonisches Status-Home (/app) des Governance OS.
//
// Eingeloggt: echte RLS-gescopte Counts aus Supabase.
// Nicht eingeloggt: statische Demo-Ansicht mit inline Magic-Link-Auth.
// Gesperrte Aktionen lösen kein Navigations-AuthGate aus — stattdessen
// erscheint das Auth-Panel direkt im selben View.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, ClipboardCheck, UserCheck, FileCheck2, Inbox,
  Globe, Bot, Activity, ArrowRight, Loader2, Plus, Search, ShieldCheck,
  Mail, X, CheckCircle2, Lock,
} from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase';
import { getAuthRedirectUrl } from '../../lib/auth-redirect';
import { useTenant } from '../../core/access/TenantProvider';
import { WorkspaceShell } from './WorkspaceShell';
import { countOpenDpias } from '../governance/dpiasApi';
import { countOpenDsrs } from '../governance/dsrApi';
import { countPendingApprovals } from '../governance/approvalsApi';
import { countOpenIncidents } from '../governance/incidentsApi';
import { countVendorsNoDpa } from '../governance/vendorsApi';
import { DsgvoControlPackPanel } from '../governance/dsgvo-control-pack/DsgvoControlPackPanel';
import { DEMO_CONTROL_SIGNALS } from '../governance/dsgvo-control-pack/dsgvoControlPackDemo';

const DEMO_COUNTS = {
  incidents: 1, dpias: 2,
  dsr: { total: 4, overdue: 0 },
  approvals: 3, vendorsNoDpa: 1,
} as const;
const DEMO_SCORE = 87;

export function WorkspaceHome() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    if (!isSupabaseConfigured()) { setSession(null); return; }
    const sb = getSupabase();
    sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = sb.auth.onAuthStateChange((_evt, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return (
      <WorkspaceShell title="Übersicht">
        <div className="flex items-center justify-center h-40 text-titanium-500 text-sm">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Lade…
        </div>
      </WorkspaceShell>
    );
  }

  return (
    <WorkspaceShell title="Übersicht">
      {session ? <Inner /> : <DemoInner />}
    </WorkspaceShell>
  );
}

// ─── Inline Auth-Panel ───────────────────────────────────────────────
// Erscheint im Demo-Modus, wenn der Nutzer eine gesperrte Aktion auslöst.
// Magic Link → redirect zurück zu /app (echte Daten nach Login).

function AuthPanel({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured()) { setError('Supabase nicht konfiguriert.'); return; }
    setSending(true); setError(null);
    try {
      const sb = getSupabase();
      const { error: err } = await sb.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: getAuthRedirectUrl('/app') },
      });
      if (err) throw err;
      setSent(true);
    } catch (err: unknown) {
      setError((err as Error)?.message ?? 'Senden fehlgeschlagen');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="border border-cyan-800 bg-obsidian-900 p-5 relative">
      <button onClick={onClose} className="absolute top-3 right-3 text-titanium-500 hover:text-titanium-100" aria-label="Schließen">
        <X className="h-4 w-4" />
      </button>
      {sent ? (
        <div className="flex items-start gap-3 text-sm text-emerald-300">
          <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold">Magic Link verschickt.</div>
            <div className="text-emerald-400/80 mt-0.5">Schau in dein Postfach ({email}) und klicke auf den Link.</div>
          </div>
        </div>
      ) : (
        <form onSubmit={send} className="flex flex-wrap items-end gap-3">
          <div>
            <div className="text-sm font-semibold text-titanium-50 mb-2">Kostenfrei anmelden — Magic Link</div>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-titanium-500" />
              <input
                type="email" required value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="dein@email.de"
                className="pl-9 pr-3 py-2.5 text-sm bg-obsidian-950 border border-titanium-900 outline-none focus:border-cyan-400 w-72 rounded-none"
                disabled={sending}
              />
            </div>
            {error && <div className="text-xs text-rose-300 mt-1">{error}</div>}
          </div>
          <button
            type="submit" disabled={sending || !email}
            className="px-4 py-2.5 bg-cyan-400 text-obsidian-950 text-sm font-semibold hover:bg-cyan-300 disabled:opacity-50 transition-colors"
          >
            {sending ? 'Sende…' : 'Magic Link senden'}
          </button>
        </form>
      )}
    </div>
  );
}

// ─── Demo-Ansicht (nicht eingeloggt) ────────────────────────────────

function DemoInner() {
  const [authOpen, setAuthOpen] = useState(false);
  const gate = () => setAuthOpen(true);

  const counts = DEMO_COUNTS;
  const score = DEMO_SCORE;
  const inboxTotal = counts.approvals + counts.dsr.overdue + counts.incidents;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-8">
      {/* Inline Auth-Panel */}
      {authOpen && <AuthPanel onClose={() => setAuthOpen(false)} />}

      {/* Demo-Banner */}
      {!authOpen && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-obsidian-900 border border-titanium-800 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-[10px] uppercase tracking-wider text-cyan-400 border border-cyan-800 px-1.5 py-0.5">Demo-Modus</span>
            <span className="text-sm text-titanium-300">Vorschau mit Demo-Daten. Melde dich an, um eigene Objekte zu verwalten.</span>
          </div>
          <button
            onClick={gate}
            className="inline-flex items-center gap-1.5 bg-cyan-400 text-obsidian-950 px-3 py-1.5 text-sm font-semibold hover:bg-cyan-300 transition-colors shrink-0"
          >
            Kostenlos anmelden
          </button>
        </div>
      )}

      {/* Begrüßung + Schnellaktionen */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display font-bold text-2xl text-titanium-50 tracking-tight">Governance-Übersicht</h2>
          <p className="text-sm text-titanium-400 mt-1">Status, offene Aufgaben und Objekte auf einen Blick.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Website hinzufügen → öffentlicher Audit-Flow, kein Auth nötig */}
          <Link
            to="/audit?source=workspace"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold bg-cyan-400 text-obsidian-950 hover:bg-cyan-300 transition-colors"
          >
            <Plus className="h-4 w-4" /> Website hinzufügen
          </Link>
          <DemoAction icon={Bot} label="KI-System erfassen" onGate={gate} />
          <DemoAction icon={FileCheck2} label="Report exportieren" onGate={gate} />
        </div>
      </div>

      <ScoreCard score={score} loading={false} onAction={gate} />

      {/* Aktions-Inbox */}
      <section className="border border-titanium-800 bg-obsidian-900">
        <div className="flex items-center justify-between px-4 py-3 border-b border-titanium-900">
          <div className="flex items-center gap-2">
            <Inbox className="h-4 w-4 text-cyan-300" />
            <span className="font-display font-semibold text-titanium-50 text-sm">Aktions-Inbox</span>
            {inboxTotal > 0 && (
              <span className="font-mono text-[11px] text-obsidian-950 bg-cyan-400 px-1.5 py-0.5">{inboxTotal}</span>
            )}
          </div>
        </div>
        <div className="divide-y divide-titanium-900">
          <InboxRow label="Offene Freigaben"                      count={counts.approvals}   icon={UserCheck}      onGate={gate} />
          <InboxRow label="Überfällige Betroffenenanfragen (DSR)" count={counts.dsr.overdue} icon={ClipboardCheck} onGate={gate} severity={!!counts.dsr.overdue} />
          <InboxRow label="Offene Vorfälle / Meldefristen"        count={counts.incidents}   icon={AlertTriangle}  onGate={gate} severity={!!counts.incidents} />
        </div>
      </section>

      {/* Status-Kacheln */}
      <section>
        <h3 className="font-display font-semibold text-titanium-50 text-sm mb-3">Status</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-titanium-900">
          <Tile icon={AlertTriangle}  label="Offene Risiken"    value={counts.incidents}     accent="rose"  onGate={gate} />
          <Tile icon={ClipboardCheck} label="Offene DSFA"       value={counts.dpias}         accent="cyan"  onGate={gate} />
          <Tile icon={ClipboardCheck} label="DSR offen"         value={counts.dsr.total}     accent="amber" onGate={gate} />
          <Tile icon={UserCheck}      label="Vendoren ohne DPA" value={counts.vendorsNoDpa}  accent="amber" onGate={gate} />
        </div>
      </section>

      {/* Objekte & Bereiche */}
      <section>
        <h3 className="font-display font-semibold text-titanium-50 text-sm mb-3">Objekte & Bereiche</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-titanium-900">
          <NavCard icon={Globe}          title="Websites"   body="Domains, Cookies, Vendoren, Monitoring, Evidence."    onGate={gate} />
          <NavCard icon={Bot}            title="KI-Systeme" body="Inventar, Klassifizierung, Dokumentation, Drift."      onGate={gate} />
          <NavCard icon={FileCheck2}     title="Evidence"   body="Nachweise, Reports, Audit-Trail, Exporte."             onGate={gate} />
          <NavCard icon={ClipboardCheck} title="Compliance" body="DSGVO, AI Act, VVT, TOM, DSFA, DSR."                  onGate={gate} />
          <NavCard icon={Activity}       title="Monitoring" body="Live-Scans, Drift, Alerts."                            onGate={gate} />
          <NavCard icon={Search}         title="Risiken"    body="Findings, Vorfälle, Vendor-Risiken priorisiert."       onGate={gate} />
        </div>
      </section>
    </div>
  );
}

// ─── Echte Ansicht (eingeloggt) ──────────────────────────────────────

interface Counts {
  incidents: number;
  dpias: number;
  dsr: { total: number; overdue: number };
  approvals: number;
  vendorsNoDpa: number;
}

function Inner() {
  const { activeTenantId, tenants } = useTenant();
  const tenantName = tenants.find((t) => t.tenantId === activeTenantId)?.name ?? null;
  const [counts, setCounts] = useState<Counts | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!activeTenantId) { setCounts(null); return; }
    setCounts(null); setError(null);
    (async () => {
      try {
        const [incidents, dpias, dsr, approvals, vendorsNoDpa] = await Promise.all([
          countOpenIncidents(activeTenantId),
          countOpenDpias(activeTenantId),
          countOpenDsrs(activeTenantId),
          countPendingApprovals(activeTenantId),
          countVendorsNoDpa(activeTenantId),
        ]);
        if (!cancelled) setCounts({ incidents, dpias, dsr, approvals, vendorsNoDpa });
      } catch (e) {
        if (!cancelled) setError((e as Error)?.message ?? String(e));
      }
    })();
    return () => { cancelled = true; };
  }, [activeTenantId]);

  const inboxTotal = counts ? counts.approvals + counts.dsr.overdue + counts.incidents : 0;
  const score = computeComplianceScore(counts);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display font-bold text-2xl text-titanium-50 tracking-tight">
            {tenantName ? `Governance · ${tenantName}` : 'Governance-Übersicht'}
          </h2>
          <p className="text-sm text-titanium-400 mt-1">Status, offene Aufgaben und Objekte auf einen Blick.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <QuickAction to="/audit?source=workspace"  icon={Plus}      label="Website hinzufügen" primary />
          <QuickAction to="/governance/agents"        icon={Bot}       label="KI-System erfassen" />
          <QuickAction to="/governance/reports"       icon={FileCheck2} label="Report exportieren" />
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-sm text-rose-300 bg-rose-950/40 border border-rose-900 p-3">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> {error}
        </div>
      )}

      <ScoreCard score={score} loading={!counts} />

      <section className="border border-titanium-800 bg-obsidian-900">
        <div className="flex items-center justify-between px-4 py-3 border-b border-titanium-900">
          <div className="flex items-center gap-2">
            <Inbox className="h-4 w-4 text-cyan-300" />
            <span className="font-display font-semibold text-titanium-50 text-sm">Aktions-Inbox</span>
            {counts && inboxTotal > 0 && (
              <span className="font-mono text-[11px] text-obsidian-950 bg-cyan-400 px-1.5 py-0.5">{inboxTotal}</span>
            )}
          </div>
        </div>
        <div className="divide-y divide-titanium-900">
          <InboxLink to="/governance/approvals" label="Offene Freigaben"                      count={counts?.approvals}   loading={!counts} icon={UserCheck} />
          <InboxLink to="/governance/dsr"       label="Überfällige Betroffenenanfragen (DSR)" count={counts?.dsr.overdue} loading={!counts} icon={ClipboardCheck} severity={!!counts?.dsr.overdue} />
          <InboxLink to="/governance/incidents" label="Offene Vorfälle / Meldefristen"        count={counts?.incidents}   loading={!counts} icon={AlertTriangle}  severity={!!counts?.incidents} />
        </div>
      </section>

      {/* Post-Market Monitoring */}
      <DsgvoControlPackPanel signals={DEMO_CONTROL_SIGNALS} />

      {/* Status-Kacheln */}
      <section>
        <h3 className="font-display font-semibold text-titanium-50 text-sm mb-3">Status</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-titanium-900">
          <TileLink to="/governance/incidents" icon={AlertTriangle}  label="Offene Risiken"    value={counts?.incidents}    loading={!counts} accent="rose" />
          <TileLink to="/governance/dpias"     icon={ClipboardCheck} label="Offene DSFA"       value={counts?.dpias}        loading={!counts} accent="cyan" />
          <TileLink to="/governance/dsr"       icon={ClipboardCheck} label="DSR offen"         value={counts?.dsr.total}    sub={counts?.dsr.overdue ? `${counts.dsr.overdue} überfällig` : undefined} loading={!counts} accent="amber" />
          <TileLink to="/governance/vendors"   icon={UserCheck}      label="Vendoren ohne DPA" value={counts?.vendorsNoDpa} loading={!counts} accent="amber" />
        </div>
      </section>

      {/* DSGVO Control Pack — Post-Market Monitoring */}
      <DsgvoControlPackPanel signals={DEMO_CONTROL_SIGNALS} />

      {/* Control Pack Produktfamilie */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="h-4 w-4 text-cyan-400" />
          <h3 className="font-display font-semibold text-titanium-50 text-sm">Control Packs</h3>
        </div>
        <div className="border border-titanium-900 divide-y divide-titanium-900">
          <div className="flex items-center gap-3 px-4 py-3 bg-obsidian-900">
            <span className="font-mono text-[9px] uppercase tracking-widest text-emerald-400 border border-emerald-800 bg-emerald-950 px-1.5 py-0.5">Aktiv</span>
            <span className="text-sm font-semibold text-titanium-50">DSGVO Control Pack</span>
            <span className="ml-auto text-[10px] text-titanium-500 font-mono">Tracking · Consent · Cookies · Evidence</span>
          </div>
          {[
            { label: 'EU AI Act Control Pack', desc: 'Hochrisiko-Klassifikation · Transparenz · Dokumentationspflichten' },
            { label: 'Vendor Control Pack',     desc: 'DPA-Status · Sub-Prozessoren · Drittlandtransfer' },
            { label: 'Security Control Pack',   desc: 'TOM-Prüfung · HTTPS · Header · Schwachstellen' },
          ].map(({ label, desc }) => (
            <div key={label} className="flex items-center gap-3 px-4 py-3 opacity-60">
              <span className="font-mono text-[9px] uppercase tracking-widest text-titanium-500 border border-titanium-800 bg-obsidian-950 px-1.5 py-0.5">Coming Next</span>
              <span className="text-sm text-titanium-300">{label}</span>
              <span className="ml-auto text-[10px] text-titanium-600 font-mono hidden sm:block">{desc}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Upgrade CTA — dezent */}
      <section className="mb-8 border border-titanium-900 bg-obsidian-900">
        <div className="px-4 py-3 border-b border-titanium-900">
          <p className="font-mono text-[9px] uppercase tracking-widest text-titanium-600">Verfügbare Pakete</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-x divide-titanium-900">
          <div className="px-4 py-4">
            <p className="font-mono text-[9px] uppercase tracking-widest text-titanium-500 mb-1">Starter</p>
            <p className="font-display font-bold text-titanium-50 text-sm mb-2">Monitoring</p>
            <p className="text-[11px] text-titanium-500">Kontinuierliches Website-Monitoring, Alerts, Evidence-Snapshots.</p>
          </div>
          <div className="px-4 py-4 border-t sm:border-t-0 border-titanium-900">
            <p className="font-mono text-[9px] uppercase tracking-widest text-cyan-500 mb-1">Professional</p>
            <p className="font-display font-bold text-titanium-50 text-sm mb-2">Monitoring + Control Packs</p>
            <p className="text-[11px] text-titanium-500">DSGVO, EU AI Act und Vendor Control Packs inklusive.</p>
          </div>
          <div className="px-4 py-4 border-t sm:border-t-0 border-titanium-900">
            <p className="font-mono text-[9px] uppercase tracking-widest text-amber-400 mb-1">Enterprise</p>
            <p className="font-display font-bold text-titanium-50 text-sm mb-2">+ Governance Gates</p>
            <p className="text-[11px] text-titanium-500">Control Packs · Governance Gates · Custom DPA · SSO.</p>
          </div>
        </div>
        <div className="px-4 py-3 border-t border-titanium-900 flex items-center gap-3">
          <Link to="/pricing" className="text-xs font-semibold text-cyan-300 hover:text-cyan-200 transition-colors">
            Pakete vergleichen →
          </Link>
          <span className="text-titanium-800">·</span>
          <Link to="/audit" className="text-xs text-titanium-500 hover:text-titanium-300 transition-colors">
            Kostenlosen Audit starten
          </Link>
        </div>
      </section>

      {/* Founding Access — optional, sekundär */}
      <section className="mb-8 border border-titanium-900 bg-obsidian-950">
        <div className="px-4 py-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-widest text-titanium-600 mb-1">
              Founding Access Programm · Erste 100 Unternehmen
            </p>
            <p className="font-display font-semibold text-titanium-100 text-sm mb-1">
              Founding Access Programm
            </p>
            <p className="text-[11px] text-titanium-500 max-w-xl leading-relaxed">
              Die ersten 100 Unternehmen können RealSyncDynamicsAI aktiv mitgestalten.
              Melden Sie Fehler, senden Sie Screenshots und schlagen Sie Funktionen vor.
              Ihre Rückmeldungen fließen direkt in die Weiterentwicklung der Plattform ein.
            </p>
          </div>
          <Link
            to="/welcome?source=workspace_founding&intent=founding"
            className="shrink-0 inline-flex items-center gap-2 border border-titanium-700 text-titanium-200 hover:border-titanium-400 px-4 py-2 text-xs font-semibold transition-colors"
          >
            Founding Access aktivieren
          </Link>
        </div>
      </section>

      {/* Objekte */}
      <section>
        <h3 className="font-display font-semibold text-titanium-50 text-sm mb-3">Objekte & Bereiche</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-titanium-900">
          <NavCardLink to="/app/websites"   icon={Globe}          title="Websites"   body="Domains, Cookies, Vendoren, Monitoring, Evidence." />
          <NavCardLink to="/app/ai-systems" icon={Bot}            title="KI-Systeme" body="Inventar, Klassifizierung, Dokumentation, Drift." />
          <NavCardLink to="/app/evidence"   icon={FileCheck2}     title="Evidence"   body="Nachweise, Reports, Audit-Trail, Exporte." />
          <NavCardLink to="/app/compliance" icon={ClipboardCheck} title="Compliance" body="DSGVO, AI Act, VVT, TOM, DSFA, DSR." />
          <NavCardLink to="/app/monitoring" icon={Activity}       title="Monitoring" body="Live-Scans, Drift, Alerts." />
          <NavCardLink to="/app/risks"      icon={Search}         title="Risiken"    body="Findings, Vorfälle, Vendor-Risiken priorisiert." />
        </div>
      </section>
    </div>
  );
}

// ─── Compliance-Score ────────────────────────────────────────────────

function computeComplianceScore(counts: Counts | null): number | null {
  if (!counts) return null;
  const penalty =
    counts.dsr.overdue * 12 + counts.incidents * 10 +
    counts.dpias * 5 + counts.vendorsNoDpa * 4 + counts.approvals * 3;
  return Math.max(0, Math.min(100, 100 - penalty));
}

function scoreLabel(score: number): string {
  if (score >= 90) return 'Sehr gut';
  if (score >= 75) return 'Gut';
  if (score >= 50) return 'Verbesserungsbedarf';
  return 'Handlungsbedarf';
}

function ScoreCard({ score, loading, onAction }: { score: number | null; loading: boolean; onAction?: () => void }) {
  const accent = score === null ? 'text-titanium-600'
    : score >= 75 ? 'text-emerald-300'
    : score >= 50 ? 'text-amber-300' : 'text-rose-300';
  return (
    <section className="border border-titanium-800 bg-obsidian-900 p-5 flex flex-wrap items-center gap-x-8 gap-y-3">
      <div className="flex items-center gap-3">
        <ShieldCheck className={`h-7 w-7 ${accent}`} />
        <div>
          <div className="flex items-center gap-2">
            <span className="font-display font-semibold text-titanium-50 text-sm">Compliance-Status</span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-titanium-500 border border-titanium-800 px-1.5 py-0.5">Self-Assessment</span>
          </div>
          <p className="text-xs text-titanium-400 mt-0.5">Aus offenen Vorfällen, Fristen, DSFA, DPAs und Freigaben abgeleitet.</p>
        </div>
      </div>
      <div className="flex items-baseline gap-2">
        {loading || score === null
          ? <Loader2 className="h-7 w-7 animate-spin text-titanium-600" />
          : <>
              <span className={`font-display font-bold text-4xl tabular-nums ${accent}`}>{score}</span>
              <span className="text-sm text-titanium-500">/ 100</span>
              <span className="text-xs text-titanium-400 ml-2">{scoreLabel(score)}</span>
            </>}
      </div>
      {onAction ? (
        <button onClick={onAction} className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-300 ml-auto hover:text-cyan-200">
          Compliance öffnen <ArrowRight className="h-3.5 w-3.5" />
        </button>
      ) : (
        <Link to="/app/compliance" className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-300 ml-auto hover:text-cyan-200">
          Compliance öffnen <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </section>
  );
}

// ─── Demo-Bausteine (kein href, zeigen Auth-Panel) ───────────────────

function DemoAction({ icon: Icon, label, onGate }: { icon: typeof Plus; label: string; onGate: () => void }) {
  return (
    <button
      onClick={onGate}
      className="inline-flex items-center gap-1.5 border border-titanium-700 text-titanium-400 px-3 py-1.5 text-sm font-semibold hover:border-cyan-700 hover:text-titanium-100 transition-colors"
    >
      <Icon className="h-4 w-4" /> {label} <Lock className="h-3 w-3 opacity-50" />
    </button>
  );
}

function InboxRow({ label, count, icon: Icon, onGate, severity }: { label: string; count: number; icon: typeof Inbox; onGate: () => void; severity?: boolean }) {
  return (
    <button onClick={onGate} className="w-full flex items-center justify-between px-4 py-3 hover:bg-obsidian-800 transition-colors text-left">
      <span className="flex items-center gap-2.5 text-sm text-titanium-200">
        <Icon className={`h-4 w-4 ${severity ? 'text-rose-300' : 'text-titanium-500'}`} /> {label}
      </span>
      <span className="flex items-center gap-2">
        <span className={`font-mono text-sm tabular-nums ${count ? (severity ? 'text-rose-300' : 'text-titanium-100') : 'text-titanium-600'}`}>{count}</span>
        <ArrowRight className="h-3.5 w-3.5 text-titanium-600" />
      </span>
    </button>
  );
}

const ACCENT: Record<string, string> = {
  rose: 'text-rose-300', cyan: 'text-cyan-300', amber: 'text-amber-300',
};

function Tile({ icon: Icon, label, value, accent, onGate }: { icon: typeof AlertTriangle; label: string; value: number; accent: keyof typeof ACCENT; onGate: () => void }) {
  return (
    <button onClick={onGate} className="w-full bg-obsidian-900 p-5 hover:bg-obsidian-800 transition-colors text-left">
      <Icon className={`h-5 w-5 mb-3 ${ACCENT[accent]}`} />
      <div className="font-display font-bold text-3xl tabular-nums text-titanium-50">{value}</div>
      <div className="text-xs text-titanium-400 mt-1">{label}</div>
    </button>
  );
}

function NavCard({ icon: Icon, title, body, onGate }: { icon: typeof Globe; title: string; body: string; onGate: () => void }) {
  return (
    <button onClick={onGate} className="w-full bg-obsidian-900 p-5 hover:bg-obsidian-800 transition-colors flex flex-col text-left">
      <Icon className="h-5 w-5 text-cyan-300 mb-3" />
      <div className="font-display font-semibold text-titanium-50">{title}</div>
      <p className="text-sm text-titanium-400 mt-1 flex-1">{body}</p>
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-300 mt-3">
        Öffnen <Lock className="h-3 w-3 opacity-60" />
      </span>
    </button>
  );
}

// ─── Auth-Bausteine (echte Navigation, eingeloggt) ───────────────────

function QuickAction({ to, icon: Icon, label, primary }: { to: string; icon: typeof Plus; label: string; primary?: boolean }) {
  return (
    <Link
      to={to}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold transition-colors ${
        primary ? 'bg-cyan-400 text-obsidian-950 hover:bg-cyan-300'
                : 'border border-titanium-700 text-titanium-200 hover:border-titanium-500'
      }`}
    >
      <Icon className="h-4 w-4" /> {label}
    </Link>
  );
}

function InboxLink({ to, label, count, loading, icon: Icon, severity }: { to: string; label: string; count?: number; loading: boolean; icon: typeof Inbox; severity?: boolean }) {
  return (
    <Link to={to} className="flex items-center justify-between px-4 py-3 hover:bg-obsidian-800 transition-colors">
      <span className="flex items-center gap-2.5 text-sm text-titanium-200">
        <Icon className={`h-4 w-4 ${severity ? 'text-rose-300' : 'text-titanium-500'}`} /> {label}
      </span>
      <span className="flex items-center gap-2">
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-titanium-600" />
          : <span className={`font-mono text-sm tabular-nums ${count ? (severity ? 'text-rose-300' : 'text-titanium-100') : 'text-titanium-600'}`}>{count ?? 0}</span>}
        <ArrowRight className="h-3.5 w-3.5 text-titanium-600" />
      </span>
    </Link>
  );
}

function TileLink({ to, icon: Icon, label, value, sub, loading, accent }: { to: string; icon: typeof AlertTriangle; label: string; value?: number; sub?: string; loading: boolean; accent: keyof typeof ACCENT }) {
  return (
    <Link to={to} className="bg-obsidian-900 p-5 hover:bg-obsidian-800 transition-colors">
      <Icon className={`h-5 w-5 mb-3 ${ACCENT[accent]}`} />
      <div className="font-display font-bold text-3xl tabular-nums text-titanium-50">
        {loading ? <Loader2 className="h-6 w-6 animate-spin text-titanium-600" /> : (value ?? 0)}
      </div>
      <div className="text-xs text-titanium-400 mt-1">{label}</div>
      {sub && <div className="text-[11px] text-rose-300 mt-0.5">{sub}</div>}
    </Link>
  );
}

function NavCardLink({ to, icon: Icon, title, body }: { to: string; icon: typeof Globe; title: string; body: string }) {
  return (
    <Link to={to} className="bg-obsidian-900 p-5 hover:bg-obsidian-800 transition-colors flex flex-col">
      <Icon className="h-5 w-5 text-cyan-300 mb-3" />
      <div className="font-display font-semibold text-titanium-50">{title}</div>
      <p className="text-sm text-titanium-400 mt-1 flex-1">{body}</p>
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-300 mt-3">Öffnen <ArrowRight className="h-3.5 w-3.5" /></span>
    </Link>
  );
}
