import { useState } from 'react';
import { Send } from 'lucide-react';
import type { RuntimeEvent } from './api';

type Severity = 'low' | 'medium' | 'high' | 'critical';

const EVENT_TYPE_PRESETS: Array<{ value: string; label: string; group: string }> = [
  { group: 'High virality', value: 'tracker.detected',          label: 'tracker.detected' },
  { group: 'High virality', value: 'ai.endpoint.detected',      label: 'ai.endpoint.detected' },
  { group: 'High virality', value: 'consent.missing',           label: 'consent.missing' },
  { group: 'High virality', value: 'high_risk.classified',      label: 'high_risk.classified' },
  { group: 'High virality', value: 'evidence.anchor.created',   label: 'evidence.anchor.created' },
  { group: 'High virality', value: 'policy.violation.detected', label: 'policy.violation.detected' },
  { group: 'Medium',        value: 'audit.bundle.generated',    label: 'audit.bundle.generated' },
  { group: 'Medium',        value: 'privacy.delta.generated',   label: 'privacy.delta.generated' },
  { group: 'Medium',        value: 'runtime.replay.completed',  label: 'runtime.replay.completed' },
  { group: 'Blocked (test)', value: 'tenant.internal.config',   label: 'tenant.internal.config (BLOCKED)' },
  { group: 'Blocked (test)', value: 'pii.email_changed',        label: 'pii.email_changed (BLOCKED)' },
  { group: 'Blocked (test)', value: 'financial.invoice_paid',   label: 'financial.invoice_paid (BLOCKED)' },
];

interface Props {
  onSubmit: (event: RuntimeEvent) => Promise<void> | void;
  busy?: boolean;
}

export function RuntimeEventForm({ onSubmit, busy }: Props) {
  const [type, setType] = useState('tracker.detected');
  const [severity, setSeverity] = useState<Severity>('high');
  const [summary, setSummary] = useState('');
  const [publicApproved, setPublicApproved] = useState(false);

  const submit = async () => {
    const event: RuntimeEvent = {
      id: `evt_admin_${Date.now()}`,
      type,
      occurred_at: new Date().toISOString(),
      severity,
      region: 'eu-central-1',
      publicApproved,
      payload: summary.trim() ? { summary: summary.trim() } : {},
    };
    await onSubmit(event);
  };

  return (
    <div className="border border-titanium-800 bg-obsidian-950 p-4">
      <h3 className="mb-3 font-display text-sm font-semibold uppercase tracking-wider text-titanium-300">
        Runtime-Event simulieren
      </h3>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="block text-[10px] uppercase tracking-wider text-titanium-400">Event-Typ</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="mt-1 w-full border border-titanium-800 bg-obsidian-900 px-2 py-1.5 text-sm text-titanium-100 focus:outline-none"
          >
            {Array.from(new Set(EVENT_TYPE_PRESETS.map(p => p.group))).map(group => (
              <optgroup key={group} label={group}>
                {EVENT_TYPE_PRESETS.filter(p => p.group === group).map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="block text-[10px] uppercase tracking-wider text-titanium-400">Severity</span>
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value as Severity)}
            className="mt-1 w-full border border-titanium-800 bg-obsidian-900 px-2 py-1.5 text-sm text-titanium-100 focus:outline-none"
          >
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
            <option value="critical">critical</option>
          </select>
        </label>
      </div>

      <label className="mt-3 block">
        <span className="block text-[10px] uppercase tracking-wider text-titanium-400">Summary (optional)</span>
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={2}
          placeholder="Optionaler Text. Wird vom Normalizer anonymisiert (Domains, Emails, IBAN, Firmennamen)."
          className="mt-1 w-full border border-titanium-800 bg-obsidian-900 px-2 py-1.5 text-sm text-titanium-100 focus:outline-none"
        />
      </label>

      <label className="mt-3 inline-flex items-center gap-2 text-xs text-titanium-300">
        <input
          type="checkbox"
          checked={publicApproved}
          onChange={(e) => setPublicApproved(e.target.checked)}
          className="h-3.5 w-3.5"
        />
        <span>publicApproved=true (Kundendomains werden NICHT anonymisiert)</span>
      </label>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="inline-flex items-center gap-2 border border-security-500/40 bg-security-500/10 px-3 py-1.5 text-sm text-security-200 hover:bg-security-500/20 disabled:opacity-50"
        >
          <Send className="h-3.5 w-3.5" /> Event durch Orchestrator schicken
        </button>
      </div>
    </div>
  );
}
