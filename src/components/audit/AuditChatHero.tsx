import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AudioLines, Loader2, AlertTriangle, ShieldCheck, ArrowRight, Send, ExternalLink } from 'lucide-react';
import { trackConversion } from '../../lib/pixels';
import { getAffiliateRef } from '../../lib/affiliate';
import { startAuditScanAnon } from '../../features/governance/AgentWidget/agentApi';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^[^\s]+\.[a-z]{2,}/i;

type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info' | 'pass';

interface Issue {
  id: string;
  severity: Exclude<Severity, 'pass'>;
  title: string;
  detail: string;
  paragraph_ref?: string;
}

interface Report {
  audit_id: string;
  domain: string;
  score: number;
  severity: Severity;
  issues: Issue[];
  fetched: boolean;
  fetched_status: number | null;
  fetch_error: string | null;
  coverage?: 'full' | 'limited' | 'failed';
  coverage_notice?: string | null;
}

type Phase = 'ask-url' | 'ask-email' | 'scanning' | 'done' | 'error';

interface Bubble {
  id: string;
  role: 'bot' | 'user';
  text?: string;
  node?: React.ReactNode;
}

const SEV_COLOR: Record<Severity, string> = {
  critical: 'text-red-300',
  high: 'text-orange-300',
  medium: 'text-amber-300',
  low: 'text-yellow-300',
  info: 'text-titanium-300',
  pass: 'text-emerald-300',
};

const SEV_LABEL: Record<Severity, string> = {
  critical: 'Kritisch',
  high: 'Hoch',
  medium: 'Mittel',
  low: 'Niedrig',
  info: 'Hinweis',
  pass: 'OK',
};

export function AuditChatHero({ onScanComplete }: { onScanComplete: (report: Report) => void }) {
  const [phase, setPhase] = useState<Phase>('ask-url');
  const [url, setUrl] = useState('');
  const [bubbles, setBubbles] = useState<Bubble[]>([
    {
      id: 'intro',
      role: 'bot',
      text: 'Hi! Ich bin der DSGVO-Audit-Assistent. Welche Website soll ich für Dich scannen?',
    },
  ]);
  const [input, setInput] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, [bubbles]);

  useEffect(() => {
    if (phase === 'ask-url' || phase === 'ask-email') inputRef.current?.focus();
  }, [phase]);

  function pushBubbles(...next: Bubble[]) {
    setBubbles((prev) => [...prev, ...next]);
  }

  function handleUrlSubmit() {
    const trimmed = input.trim();
    if (!trimmed) return;
    if (!URL_RE.test(trimmed)) {
      setValidationError('Sieht nicht nach einer gültigen Domain aus. Versuch z. B. „kanzlei-mueller.de".');
      return;
    }
    const normalized = trimmed.match(/^https?:\/\//i) ? trimmed : `https://${trimmed}`;
    setUrl(normalized);
    setValidationError(null);
    setInput('');
    pushBubbles(
      { id: crypto.randomUUID(), role: 'user', text: trimmed },
      {
        id: crypto.randomUUID(),
        role: 'bot',
        text: 'Alles klar. An welche E-Mail-Adresse darf ich den vollständigen Report schicken?',
      },
    );
    setPhase('ask-email');
  }

  async function handleEmailSubmit() {
    const trimmed = input.trim().toLowerCase();
    if (!EMAIL_RE.test(trimmed)) {
      setValidationError('Bitte eine gültige E-Mail-Adresse eingeben.');
      return;
    }
    setValidationError(null);
    setInput('');
    pushBubbles(
      { id: crypto.randomUUID(), role: 'user', text: trimmed },
      {
        id: 'scanning',
        role: 'bot',
        node: <ScanningIndicator domain={domainOf(url)} />,
      },
    );
    setPhase('scanning');

    try {
      const params = new URLSearchParams(window.location.search);
      const plan = params.get('plan')?.trim().slice(0, 40) || undefined;
      const source = params.get('source')?.trim().slice(0, 200) || 'audit-chat';

      // Phase-3 governance-anon-audit-log coverage. Fire-and-forget so the
      // user-facing scan flow is not blocked. The governance-agent records
      // this attempt in `anon_chat_runs` (#393) with the same IP/UA rate-
      // limit accounting as `chat_anon`. The actual scan keeps running
      // through `gdpr-audit` below — this call is purely the audit hook.
      void startAuditScanAnon({ url, email: trimmed }).catch(() => {
        /* anon audit-log is best-effort; gdpr-audit still produces the
         * real report. Failures here MUST NOT block the scan. */
      });

      const resp = await fetch(`${SUPABASE_URL}/functions/v1/gdpr-audit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          email: trimmed,
          referral_code: getAffiliateRef() || undefined,
          plan,
          source,
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.ok) throw new Error(data.error?.message ?? `HTTP ${resp.status}`);

      const report = data as Report;
      setBubbles((prev) => [
        ...prev.filter((b) => b.id !== 'scanning'),
        {
          id: crypto.randomUUID(),
          role: 'bot',
          node: <ScanSummary report={report} />,
        },
      ]);
      setPhase('done');

      trackConversion('Lead', { content_name: 'dsgvo_audit' });

      if (report.audit_id) {
        fetch(`${SUPABASE_URL}/functions/v1/audit-report-email?id=${report.audit_id}`, {
          method: 'GET',
          keepalive: true,
        }).catch(() => { /* non-blocking */ });
      }

      onScanComplete(report);
    } catch (e) {
      setBubbles((prev) => [
        ...prev.filter((b) => b.id !== 'scanning'),
        {
          id: crypto.randomUUID(),
          role: 'bot',
          node: (
            <div className="flex items-start gap-2 text-red-300">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <div className="font-semibold">Scan fehlgeschlagen.</div>
                <div className="text-xs opacity-80 mt-0.5">{(e as Error).message}</div>
              </div>
            </div>
          ),
        },
      ]);
      setPhase('error');
    }
  }

  function onSend() {
    if (phase === 'ask-url') return handleUrlSubmit();
    if (phase === 'ask-email') return handleEmailSubmit();
  }

  const inputDisabled = phase === 'scanning' || phase === 'done' || phase === 'error';
  const placeholder =
    phase === 'ask-url' ? 'z. B. kanzlei-mueller.de'
      : phase === 'ask-email' ? 'dein@kanzlei.de'
      : phase === 'scanning' ? 'Scan läuft …'
      : 'Scan abgeschlossen';

  return (
    <div className="bg-obsidian-900 border border-titanium-900 rounded-none">
      <header className="flex items-center gap-2.5 px-4 py-3 border-b border-titanium-900">
        <span className="inline-flex w-7 h-7 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-cyan-400 text-obsidian-950">
          <AudioLines className="h-3.5 w-3.5" />
        </span>
        <div className="leading-tight">
          <div className="text-sm font-semibold text-titanium-50">DSGVO-Audit-Assistent</div>
          <div className="flex items-center gap-1 text-[10px] text-emerald-400 mt-0.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Kostenlos · 30 Sek. · EU-gehostet
          </div>
        </div>
      </header>

      <div className="px-4 py-5 space-y-3 max-h-[380px] overflow-y-auto">
        {bubbles.map((b) => (
          <Bubble key={b.id} role={b.role}>
            {b.text ?? b.node}
          </Bubble>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-titanium-900 p-3 space-y-2">
        {validationError && (
          <div className="flex items-start gap-2 text-[11px] text-red-300">
            <AlertTriangle className="h-3.5 w-3.5 mt-px shrink-0" />
            <span>{validationError}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type={phase === 'ask-email' ? 'email' : 'text'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onSend(); }}
            placeholder={placeholder}
            disabled={inputDisabled}
            autoComplete={phase === 'ask-email' ? 'email' : 'url'}
            className="flex-1 bg-obsidian-950 border border-titanium-900 px-3 py-2.5 text-sm rounded-none outline-none focus:border-titanium-100 disabled:opacity-50 placeholder:text-titanium-600"
          />
          <button
            type="button"
            onClick={onSend}
            disabled={inputDisabled || !input.trim()}
            aria-label="Senden"
            className="flex h-10 w-10 items-center justify-center bg-titanium-50 text-obsidian-950 hover:bg-titanium-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            {phase === 'scanning' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
        <p className="text-[10px] text-titanium-500 leading-relaxed">
          E-Mail landet in unserem CRM. Verarbeitung gemäß <a href="/legal/privacy" className="underline hover:text-titanium-300">Datenschutzerklärung</a>.
        </p>
      </div>
    </div>
  );
}

function Bubble({ role, children }: { role: 'bot' | 'user'; children: React.ReactNode }) {
  const isBot = role === 'bot';
  return (
    <div className={`flex ${isBot ? 'justify-start' : 'justify-end'}`}>
      <div
        className={[
          'max-w-[85%] px-3.5 py-2.5 text-sm leading-relaxed',
          isBot
            ? 'bg-obsidian-950 border border-titanium-800 text-titanium-100'
            : 'bg-titanium-50 text-obsidian-950 font-medium',
        ].join(' ')}
      >
        {children}
      </div>
    </div>
  );
}

function ScanningIndicator({ domain }: { domain: string }) {
  return (
    <div className="flex items-center gap-2.5 text-titanium-200">
      <Loader2 className="h-4 w-4 animate-spin text-violet-300" />
      <span className="text-sm">Scanne <span className="font-mono text-titanium-50">{domain}</span> …</span>
    </div>
  );
}

function ScanSummary({ report }: { report: Report }) {
  const top = report.issues.slice(0, 3);
  return (
    <div className="space-y-3 min-w-[260px]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-[10px] text-titanium-500 font-mono">{report.domain}</div>
          <div className="text-sm font-semibold text-titanium-50 mt-0.5">Audit abgeschlossen</div>
        </div>
        <div className={`text-3xl font-display font-bold tabular-nums ${SEV_COLOR[report.severity]}`}>
          {report.score}
          <span className="text-xs text-titanium-500">/100</span>
        </div>
      </div>
      {report.coverage === 'limited' && (
        <div className="flex items-start gap-2 border border-amber-500/40 bg-amber-500/5 px-2.5 py-2 text-[11px] text-amber-200">
          <AlertTriangle className="h-3.5 w-3.5 mt-px shrink-0" />
          <span>
            {report.coverage_notice ??
              'Diese Seite wird client-seitig gerendert — der statische Scan sieht nur das Grundgerüst. Das Ergebnis ist nicht abschließend.'}
          </span>
        </div>
      )}
      {top.length > 0 ? (
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-titanium-500 mb-1.5">
            Top {top.length} {top.length === 1 ? 'Befund' : 'Befunde'}
          </div>
          <ul className="space-y-1.5">
            {top.map((i) => (
              <li key={i.id} className="flex items-start gap-2 text-xs">
                <span className={`inline-block w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${SEV_COLOR[i.severity]} bg-current`} />
                <span className="text-titanium-200">
                  <span className={`font-semibold ${SEV_COLOR[i.severity]}`}>{SEV_LABEL[i.severity]}</span>
                  {' · '}
                  {i.title}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-xs text-emerald-300">
          <ShieldCheck className="h-4 w-4" />
          <span>Keine der 12 Standard-Checks hat angeschlagen.</span>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <a
          href="#report"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-titanium-50 border-b border-titanium-50/40 hover:border-titanium-50 transition-colors"
        >
          Vollen Report unten ansehen <ArrowRight className="h-3.5 w-3.5" />
        </a>
        {report.audit_id ? (
          <Link
            to={`/audit/result/${report.audit_id}`}
            state={{
              domain:   report.domain,
              score:    report.score,
              findings: report.issues.map((i) => ({
                id:            i.id,
                severity:      i.severity,
                title:         i.title,
                detail:        i.detail,
                paragraph_ref: i.paragraph_ref,
              })),
            }}
            className="inline-flex items-center gap-1.5 text-xs text-titanium-300 hover:text-titanium-50 transition-colors"
          >
            Permalink öffnen <ExternalLink className="h-3 w-3" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function domainOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch { return url; }
}
