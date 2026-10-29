// AgentRunForm — rendert das Eingabeformular eines Agenten aus seinem Schema,
// prüft vor dem Start, ob ein genehmigter Eintrag in governance_approvals
// existiert (über approvalsApi.ts), und baut daraus das `payload` für runAgent.
import React, { useEffect, useState } from 'react';
import { Play, Loader2, ShieldAlert } from 'lucide-react';
import { listApprovals, type Approval } from '../approvalsApi';
import { useOptionalTenant } from '../../../core/access/TenantProvider';
import type { AgentInputField } from './agentInputSchemas';

type FieldValue = string | boolean | string[];

function initialValue(field: AgentInputField): FieldValue {
  switch (field.kind) {
    case 'boolean':
      return Boolean(field.defaultChecked);
    case 'tags':
      return [];
    case 'select':
      return field.options?.[0]?.value ?? '';
    default:
      return '';
  }
}

/** Zerlegt Freitext (Zeilen oder Kommas) in getrimmte, nicht-leere Tags. */
export function parseTags(raw: string): string[] {
  return raw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Baut aus Feldwerten das payload — leere Felder werden weggelassen. */
export function buildPayload(
  fields: AgentInputField[],
  values: Record<string, FieldValue>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const field of fields) {
    const v = values[field.key];
    if (v === undefined) continue;
    if (field.kind === 'tags') {
      if (Array.isArray(v) && v.length > 0) payload[field.key] = v;
    } else if (field.kind === 'boolean') {
      payload[field.key] = Boolean(v);
    } else if (typeof v === 'string') {
      const trimmed = v.trim();
      if (trimmed.length > 0) payload[field.key] = trimmed;
    }
  }
  return payload;
}

/**
 * Prüft, ob in `governance_approvals` mindestens ein genehmigter Eintrag
 * (`status === 'approved'`) für den Agenten bzw. Mandanten vorliegt.
 */
export function hasApprovedAgentEntry(
  approvals: readonly Approval[] | undefined,
  agentId?: string,
): boolean {
  if (!approvals || approvals.length === 0) return false;
  return approvals.some((a) => {
    if (a.status !== 'approved') return false;
    if (!agentId) return true;
    if (!a.asset_id) return true;
    return (
      a.asset_id === agentId ||
      a.asset?.id === agentId ||
      a.asset?.name === agentId ||
      a.requested_action.includes(agentId)
    );
  });
}

interface Props {
  fields: AgentInputField[];
  busy: boolean;
  onSubmit: (payload: Record<string, unknown>) => void;
  tenantId?: string | null;
  agentId?: string;
  onRequestApproval?: () => void;
}

export function AgentRunForm({
  fields,
  busy,
  onSubmit,
  tenantId,
  agentId,
  onRequestApproval,
}: Props) {
  const tenantCtx = useOptionalTenant();
  const effectiveTenantId = tenantId !== undefined ? tenantId : (tenantCtx?.activeTenantId ?? '');
  const [approvalState, setApprovalState] = useState<'checking' | 'approved' | 'missing'>('checking');

  useEffect(() => {
    let cancelled = false;
    setApprovalState('checking');
    Promise.resolve(listApprovals(effectiveTenantId ?? '', 'approved'))
      .then((res) => {
        if (cancelled) return;
        if (res?.ok && hasApprovedAgentEntry(res.approvals, agentId)) {
          setApprovalState('approved');
        } else {
          setApprovalState('missing');
        }
      })
      .catch(() => {
        if (!cancelled) setApprovalState('missing');
      });
    return () => {
      cancelled = true;
    };
  }, [effectiveTenantId, agentId]);

  const isApproved = approvalState === 'approved';

  const [values, setValues] = useState<Record<string, FieldValue>>(() => {
    const init: Record<string, FieldValue> = {};
    for (const f of fields) init[f.key] = initialValue(f);
    return init;
  });
  // Freitext-Puffer für Tag-Felder (kommagetrennt / zeilenweise).
  const [tagText, setTagText] = useState<Record<string, string>>({});

  function setValue(key: string, v: FieldValue) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !isApproved) return;
    onSubmit(buildPayload(fields, values));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {fields.map((field) => (
        <div key={field.key}>
          <label htmlFor={`agent-field-${field.key}`} className="block font-mono text-[10px] text-titanium-500 uppercase tracking-wider mb-1">
            {field.label}
          </label>

          {field.kind === 'text' && (
            <input
              id={`agent-field-${field.key}`}
              type="text"
              value={values[field.key] as string}
              placeholder={field.placeholder}
              onChange={(e) => setValue(field.key, e.target.value)}
              className="w-full bg-obsidian-950 border border-titanium-800 px-2.5 py-1.5 text-xs text-titanium-100 placeholder:text-titanium-700 focus:border-teal-600 focus:outline-none"
            />
          )}

          {field.kind === 'textarea' && (
            <textarea
              id={`agent-field-${field.key}`}
              value={values[field.key] as string}
              placeholder={field.placeholder}
              rows={3}
              onChange={(e) => setValue(field.key, e.target.value)}
              className="w-full bg-obsidian-950 border border-titanium-800 px-2.5 py-1.5 text-xs text-titanium-100 placeholder:text-titanium-700 focus:border-teal-600 focus:outline-none resize-y"
            />
          )}

          {field.kind === 'tags' && (
            <input
              id={`agent-field-${field.key}`}
              type="text"
              value={tagText[field.key] ?? ''}
              placeholder={field.placeholder}
              onChange={(e) => {
                setTagText((prev) => ({ ...prev, [field.key]: e.target.value }));
                setValue(field.key, parseTags(e.target.value));
              }}
              className="w-full bg-obsidian-950 border border-titanium-800 px-2.5 py-1.5 text-xs text-titanium-100 placeholder:text-titanium-700 focus:border-teal-600 focus:outline-none"
            />
          )}

          {field.kind === 'select' && (
            <select
              id={`agent-field-${field.key}`}
              value={values[field.key] as string}
              onChange={(e) => setValue(field.key, e.target.value)}
              className="w-full bg-obsidian-950 border border-titanium-800 px-2.5 py-1.5 text-xs text-titanium-100 focus:border-teal-600 focus:outline-none"
            >
              {field.options?.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          )}

          {field.kind === 'boolean' && (
            <label className="flex items-center gap-2 text-xs text-titanium-200 cursor-pointer">
              <input
                id={`agent-field-${field.key}`}
                type="checkbox"
                checked={values[field.key] as boolean}
                onChange={(e) => setValue(field.key, e.target.checked)}
                className="h-3.5 w-3.5 accent-teal-600"
              />
              {field.placeholder ?? 'aktiviert'}
            </label>
          )}

          {field.help && <p className="mt-1 text-[10px] text-titanium-600">{field.help}</p>}
        </div>
      ))}

      {!isApproved && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200"
        >
          <span className="flex items-center gap-1.5">
            <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-amber-300" />
            Ohne genehmigten Eintrag in <code className="font-mono">governance_approvals</code> ist der Start gesperrt.
          </span>
          {onRequestApproval ? (
            <button
              type="button"
              onClick={onRequestApproval}
              className="shrink-0 border border-amber-400/60 bg-amber-500/20 px-2.5 py-1 font-mono text-[11px] text-amber-100 hover:bg-amber-500/30"
            >
              Freigabe anfordern
            </button>
          ) : (
            <a
              href="/governance/approvals"
              className="shrink-0 border border-amber-400/60 bg-amber-500/20 px-2.5 py-1 font-mono text-[11px] text-amber-100 hover:bg-amber-500/30"
            >
              Freigabe anfordern
            </a>
          )}
        </div>
      )}

      <div className="pt-1">
        <button
          type="submit"
          disabled={busy || !isApproved}
          className="flex items-center justify-center gap-1.5 w-full py-2 text-xs font-mono text-white bg-teal-600 hover:bg-teal-500 transition-colors disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
          Skill starten
        </button>
      </div>
    </form>
  );
}
