// Quick-run panel for Kodee server actions.
// Sits above the chat input and lets the user fire a read-only action against the
// currently selected VPS connection. Results are pushed back to the parent via onResult.

import React, { useState } from 'react';
import Markdown from 'react-markdown';
import {
  Activity, FileText, HardDrive, Globe, Lock, ChevronDown,
  RotateCw, PlayCircle, RefreshCw, AlertTriangle, Wand2, Loader2,
} from 'lucide-react';
import { runAction, type ActionName, type RunActionArgs, type RunActionResult } from './api';
import { adviseAction, type AdviseResult } from './advise';
import { useTenant } from '../../core/access/TenantProvider';

const WRITE_ACTIONS: ActionName[] = ['vps.service.restart', 'vps.compose.up', 'vps.compose.restart'];
const isWrite = (a: ActionName) => WRITE_ACTIONS.includes(a);

interface Props {
  connectionId: string | null;
  onResult: (action: ActionName, args: RunActionArgs, result: RunActionResult) => void;
  onBusyChange?: (busy: boolean) => void;
}

interface ActionDef {
  action: ActionName;
  label: string;
  icon: React.ElementType;
  /** Optional inline form fields to collect before running. */
  fields?: Array<{
    key: keyof RunActionArgs;
    label: string;
    placeholder?: string;
    type?: 'text' | 'number';
    required?: boolean;
  }>;
  /** For write actions: human label of the confirm token a user must type. */
  confirmHint?: string;
  /** For write actions: function returning the expected confirm value. */
  confirmExpected?: (args: RunActionArgs) => string;
}

const ACTIONS: ActionDef[] = [
  { action: 'vps.status', label: 'Status', icon: Activity },
  {
    action: 'vps.logs.tail', label: 'Logs', icon: FileText,
    fields: [
      { key: 'unit', label: 'Unit (systemd)', placeholder: 'nginx' },
      { key: 'container', label: 'Container (Docker)', placeholder: 'app' },
      { key: 'lines', label: 'Zeilen', type: 'number', placeholder: '100' },
    ],
  },
  {
    action: 'vps.disk', label: 'Disk', icon: HardDrive,
    fields: [{ key: 'top_dirs', label: 'Top-N Verzeichnisse', type: 'number', placeholder: '0' }],
  },
  {
    action: 'vps.dns_check', label: 'DNS', icon: Globe,
    fields: [{ key: 'domain', label: 'Domain', placeholder: 'example.com', required: true }],
  },
  {
    action: 'vps.tls_check', label: 'TLS', icon: Lock,
    fields: [{ key: 'domain', label: 'Domain', placeholder: 'example.com' }],
  },
  {
    action: 'vps.service.restart', label: 'Service neu starten', icon: RotateCw,
    fields: [{ key: 'service', label: 'Service', placeholder: 'nginx', required: true }],
    confirmHint: 'Tippe den Service-Namen zur Bestätigung',
    confirmExpected: (a) => a.service ?? '',
  },
  {
    action: 'vps.compose.up', label: 'Compose up', icon: PlayCircle,
    fields: [{ key: 'compose_dir', label: 'Compose-Verzeichnis', placeholder: '/srv/myapp', required: true }],
    confirmHint: 'Tippe UP zur Bestätigung',
    confirmExpected: () => 'UP',
  },
  {
    action: 'vps.compose.restart', label: 'Compose neu starten', icon: RefreshCw,
    fields: [
      { key: 'compose_dir', label: 'Compose-Verzeichnis', placeholder: '/srv/myapp', required: true },
      { key: 'service', label: 'Service (optional)', placeholder: 'web' },
    ],
    confirmHint: 'Tippe RESTART zur Bestätigung',
    confirmExpected: () => 'RESTART',
  },
];

export function ActionRunner({ connectionId, onResult, onBusyChange }: Props) {
  const { activeTenantId, hasFeature } = useTenant();
  const canAdvise = !!activeTenantId && hasFeature('ai.tool.vps_action_advisor');
  const [openAction, setOpenAction] = useState<ActionName | null>(null);
  const [args, setArgs] = useState<RunActionArgs>({});
  const [busy, setBusy] = useState(false);
  const [advice, setAdvice] = useState<AdviseResult | null>(null);
  const [adviseBusy, setAdviseBusy] = useState(false);

  const disabled = !connectionId || busy;

  const fire = async (def: ActionDef) => {
    if (!connectionId) return;
    if (def.fields?.some((f) => f.required && !args[f.key])) {
      setOpenAction(def.action);
      return;
    }
    if (isWrite(def.action)) {
      const expected = def.confirmExpected?.(args) ?? '';
      if (!args.confirm || args.confirm !== expected) {
        setOpenAction(def.action);
        return; // user still needs to type the confirm token
      }
    }
    setBusy(true); onBusyChange?.(true);
    try {
      const result = await runAction(connectionId, def.action, args);
      onResult(def.action, args, result);
      setOpenAction(null);
      setArgs({});
      setAdvice(null);
    } finally {
      setBusy(false); onBusyChange?.(false);
    }
  };

  const fetchAdvice = async (action: ActionName) => {
    if (!connectionId || !activeTenantId) return;
    setAdviseBusy(true);
    setAdvice(null);
    try {
      const r = await adviseAction(activeTenantId, connectionId, action, args);
      setAdvice(r);
    } finally {
      setAdviseBusy(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto w-full mb-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {ACTIONS.map((def) => {
          const Icon = def.icon;
          const isOpen = openAction === def.action;
          const hasFields = !!def.fields?.length;
          return (
            <div key={def.action} className="relative">
              <button
                type="button"
                disabled={disabled}
                onClick={() => (hasFields ? setOpenAction(isOpen ? null : def.action) : fire(def))}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-none border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  isOpen
                    ? 'bg-emerald-950/40 text-emerald-300 border-emerald-200'
                    : 'bg-obsidian-900 text-titanium-200 border-titanium-900 hover:bg-obsidian-950'
                }`}
                title={!connectionId ? 'Erst eine Verbindung wählen' : def.action}
              >
                <Icon className="h-3.5 w-3.5" />
                {def.label}
                {hasFields && <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />}
              </button>

              {isOpen && hasFields && (
                <div className="absolute bottom-full mb-2 left-0 z-20 bg-obsidian-900 border border-titanium-900 rounded-none shadow-lg p-3 w-72 space-y-2.5">
                  {isWrite(def.action) && (
                    <div className="flex items-start gap-2 text-[11px] text-amber-300 bg-amber-950/40 border border-amber-800 rounded-none p-2">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <span>Diese Aktion verändert den VPS-Zustand.</span>
                    </div>
                  )}
                  {isWrite(def.action) && canAdvise && (
                    <div className="space-y-2">
                      <button
                        type="button"
                        disabled={adviseBusy}
                        onClick={() => fetchAdvice(def.action)}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold text-security-300 bg-security-950/40 hover:bg-security-900/40 border border-security-700 rounded-none disabled:opacity-50"
                      >
                        {adviseBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
                        {adviseBusy ? 'AI denkt nach…' : advice ? 'Erneut prüfen' : 'AI prüfen lassen'}
                      </button>
                      {advice && (
                        advice.ok && advice.advice ? (
                          <div className="text-[11px] bg-security-950/40 border border-security-800 rounded-none p-2 max-h-48 overflow-y-auto prose prose-sm prose-slate max-w-none prose-headings:font-display prose-headings:tracking-tight prose-pre:text-[10px] prose-code:text-security-300 prose-code:bg-security-900/40 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none">
                            <Markdown>{advice.advice}</Markdown>
                            <div className="mt-1 text-[10px] text-titanium-500 not-prose">
                              ${advice.cost_usd?.toFixed(4)} · {advice.duration_ms} ms
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start gap-1.5 text-[11px] text-red-300 bg-red-950/50 border border-red-900 rounded-none p-2">
                            <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                            <span>{advice.error?.message ?? 'Konnte keine Bewertung abrufen'}</span>
                          </div>
                        )
                      )}
                    </div>
                  )}
                  {def.fields!.map((f) => (
                    <label key={String(f.key)} className="block">
                      <span className="block text-[11px] font-bold uppercase tracking-wider text-titanium-400 mb-1">
                        {f.label}
                        {f.required && <span className="text-red-500"> *</span>}
                      </span>
                      <input
                        type={f.type === 'number' ? 'number' : 'text'}
                        placeholder={f.placeholder}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        value={(args[f.key] as any) ?? ''}
                        onChange={(e) => {
                          const v = f.type === 'number'
                            ? (e.target.value ? parseInt(e.target.value, 10) : undefined)
                            : (e.target.value || undefined);
                          setArgs({ ...args, [f.key]: v });
                        }}
                        className="w-full px-2.5 py-1.5 text-xs bg-obsidian-950 border border-titanium-900 rounded-none outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
                      />
                    </label>
                  ))}
                  {isWrite(def.action) && (
                    <label className="block">
                      <span className="block text-[11px] font-bold uppercase tracking-wider text-amber-300 mb-1">
                        Bestätigung <span className="text-red-500">*</span>
                      </span>
                      <input
                        type="text"
                        placeholder={def.confirmHint}
                        value={args.confirm ?? ''}
                        onChange={(e) => setArgs({ ...args, confirm: e.target.value || undefined })}
                        className="w-full px-2.5 py-1.5 text-xs bg-amber-950/40 border border-amber-300 rounded-none outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-500 font-mono"
                      />
                      {def.confirmExpected && (
                        <span className="block mt-1 text-[10px] text-titanium-500">
                          erwartet: <code className="font-mono">{def.confirmExpected(args) || '…'}</code>
                        </span>
                      )}
                    </label>
                  )}
                  <button
                    type="button"
                    disabled={busy || (isWrite(def.action) && args.confirm !== def.confirmExpected?.(args))}
                    onClick={() => fire(def)}
                    className={`w-full py-1.5 text-xs font-bold text-white rounded-none disabled:opacity-50 ${
                      isWrite(def.action) ? 'bg-amber-600 hover:bg-amber-700' : 'bg-security-500 hover:bg-security-600'
                    }`}
                  >
                    {busy ? 'Läuft…' : isWrite(def.action) ? 'Bestätigen & Ausführen' : 'Ausführen'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function formatActionResult(action: ActionName, result: RunActionResult): string {
  if (!result.ok) {
    return `**❌ ${action}** — \`${result.error?.code ?? 'ERROR'}\`: ${result.error?.message ?? 'unbekannter Fehler'}`;
  }
  const data = result.data as Record<string, unknown>;
  const ms = result.duration_ms;

  switch (action) {
    case 'vps.status': {
      // deno-lint-ignore no-explicit-any
      const s = data as any;
      const u = s.uptime;
      return [
        `**⚡ Status** _(${ms} ms)_`,
        `- Uptime: ${u.days}d ${u.hours}h ${u.minutes}m`,
        `- Load: ${u.load.join(', ')}`,
        `- Memory: ${s.memory_mb.used} / ${s.memory_mb.total} MB`,
        s.failed_units.length
          ? `- ⚠️ Failed units: ${s.failed_units.join(', ')}`
          : '- ✅ Keine failed units',
      ].join('\n');
    }
    case 'vps.logs.tail': {
      // deno-lint-ignore no-explicit-any
      const l = data as any;
      const lines = (l.lines as string[]).slice(-200).join('\n');
      return `**📜 Logs** _(${l.source}${l.target ? ': ' + l.target : ''}, ${ms} ms)_\n\n\`\`\`\n${lines}\n\`\`\``;
    }
    case 'vps.disk': {
      // deno-lint-ignore no-explicit-any
      const d = data as any;
      const fs = (d.filesystems as Array<Record<string, string>>).map((r) =>
        `${r.mount.padEnd(16)} ${r.use_pct.padStart(5)}  ${r.used} / ${r.size}`,
      ).join('\n');
      const top = d.top_dirs?.length
        ? '\n\nTop-Verzeichnisse:\n' + (d.top_dirs as Array<Record<string, string>>)
            .map((r) => `${r.size.padStart(7)}  ${r.path}`).join('\n')
        : '';
      return `**💾 Disk** _(${ms} ms)_\n\n\`\`\`\n${fs}${top}\n\`\`\``;
    }
    case 'vps.dns_check': {
      // deno-lint-ignore no-explicit-any
      const d = data as any;
      const recs = Object.entries(d.records as Record<string, string[]>)
        .map(([t, v]) => `${t}: ${(v as string[]).join(', ') || '∅'}`).join('\n');
      const match = d.matches_vps === null
        ? 'unklar'
        : d.matches_vps ? '✅ zeigt auf den VPS' : '❌ zeigt NICHT auf den VPS';
      return `**🌐 DNS** ${d.domain} _(${ms} ms)_\n\n\`\`\`\n${recs}\n\`\`\`\n\n${match} (\`${d.vps_host}\`)`;
    }
    case 'vps.tls_check': {
      // deno-lint-ignore no-explicit-any
      const t = data as any;
      const days = t.days_remaining;
      const verdict = days === null ? '?' : days < 14 ? `⚠️ läuft in ${days} Tagen ab` : `✅ ${days} Tage gültig`;
      return [
        `**🔒 TLS** ${t.domain}:${t.port} _(${ms} ms)_`,
        `- Issuer: \`${t.issuer ?? '–'}\``,
        `- Subject: \`${t.subject ?? '–'}\``,
        `- Gültig bis: ${t.valid_to ?? '–'}`,
        `- ${verdict}`,
        t.matches_domain ? '- ✅ SAN matched die Domain' : '- ❌ SAN matched die Domain NICHT',
      ].join('\n');
    }
    case 'vps.service.restart':
    case 'vps.compose.up':
    case 'vps.compose.restart': {
      // deno-lint-ignore no-explicit-any
      const w = data as any;
      const status = w.exit_code === 0 ? '✅ exit 0' : `❌ exit ${w.exit_code ?? '?'}`;
      const out = (w.stdout || w.stderr || '').slice(-1500);
      return [
        `**🛠 ${action}** _(${ms} ms)_ ${status}`,
        '',
        '```',
        out || '(kein Output)',
        '```',
      ].join('\n');
    }
    default:
      return `**${action}** _(${ms} ms)_\n\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``;
  }
}
