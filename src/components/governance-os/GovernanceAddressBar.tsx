import { Search, Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { auditPathFor } from '../../features/audit/auditPrefill';

interface GovernanceAddressBarProps {
  onLoadUrl?: (url: string) => void;
  activeUrl?: string;
}

function normalizeUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Bereits eine vollständige URL
  try {
    const u = new URL(trimmed);
    if (u.protocol === 'https:' || u.protocol === 'http:') return u.href;
  } catch { /* weiter */ }

  // Domain-artiger Input ohne Protokoll (z.B. "example.com")
  if (/^[\w-]+\.[\w.-]+(\/.*)?$/.test(trimmed)) {
    try {
      return new URL('https://' + trimmed).href;
    } catch { /* weiter */ }
  }

  return null;
}

export function GovernanceAddressBar({ onLoadUrl, activeUrl }: GovernanceAddressBarProps) {
  const navigate = useNavigate();
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);

  // Zeige die aktive URL wenn nicht im Fokus und eine geladen ist
  const displayValue = focused ? value : (activeUrl && !value ? activeUrl : value);

  // Enter startet immer den Audit mit vorbelegtem Domain-Feld (`?domain=`).
  // Früher: URL → eingebettete Vorschau, sonst ein Audit-Link mit target-Parameter — den
  // Parameter las /audit nicht, die Eingabe ging verloren; und der Platzhalter
  // versprach eine Suche über KI-Systeme, Vendoren und Risiken, die es hier
  // nicht gibt. Die Vorschau bleibt als eigener, beschrifteter Knopf.
  const startAudit = () => {
    const input = value.trim();
    if (!input) return;
    navigate(auditPathFor(input, 'app-search'));
    setValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    startAudit();
  };

  const previewUrl = value.trim() ? normalizeUrl(value) : null;
  const openPreview = () => {
    if (!previewUrl || !onLoadUrl) return;
    onLoadUrl(previewUrl);
    setValue('');
  };

  return (
    <div className={`flex-1 flex items-center gap-2 bg-obsidian-950 border px-3 py-1.5 max-w-xl transition-colors ${
      focused ? 'border-[#00B8D4]/60' : 'border-titanium-800'
    }`}>
      {previewUrl
        ? <Globe className="h-3.5 w-3.5 text-[#00B8D4] shrink-0" aria-hidden="true" />
        : <Search className="h-3.5 w-3.5 text-titanium-600 shrink-0" aria-hidden="true" />
      }
      <input
        type="text"
        value={displayValue}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => { setFocused(true); if (activeUrl && !value) setValue(activeUrl); }}
        onBlur={() => { setFocused(false); }}
        onKeyDown={handleKeyDown}
        placeholder="Domain prüfen (startet Audit)"
        aria-label="Domain prüfen (startet Audit)"
        className="flex-1 bg-transparent text-xs text-titanium-200 placeholder-titanium-600 outline-none min-w-0"
      />
      {value && (
        <span className="font-mono text-[9px] text-titanium-700 shrink-0 hidden sm:block">
          ↵ Audit
        </span>
      )}
      {previewUrl && onLoadUrl && (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={openPreview}
          className="font-mono text-[9px] uppercase tracking-wider text-titanium-500 hover:text-[#00B8D4] shrink-0"
          title="Seite eingebettet anzeigen (viele Seiten blockieren das)"
        >
          Vorschau
        </button>
      )}
    </div>
  );
}
