// AgentRunForm — rendert das Eingabeformular eines Agenten aus seinem Schema
// und baut daraus das `payload` für runAgent. Rein lokal, keine Netzwerkaufrufe.
import React, { useState } from 'react';
import { Play, Loader2 } from 'lucide-react';
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

interface Props {
  fields: AgentInputField[];
  busy: boolean;
  onSubmit: (payload: Record<string, unknown>) => void;
}

export function AgentRunForm({ fields, busy, onSubmit }: Props) {
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

      <div className="pt-1">
        <button
          type="submit"
          disabled={busy}
          className="flex items-center justify-center gap-1.5 w-full py-2 text-xs font-mono text-white bg-teal-600 hover:bg-teal-500 transition-colors disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
          Skill starten
        </button>
      </div>
    </form>
  );
}
