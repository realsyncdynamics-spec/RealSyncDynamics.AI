import { Search, Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    const input = value.trim();
    if (!input) return;

    const url = normalizeUrl(input);
    if (url && onLoadUrl) {
      // Echte URL → Embedded Browser
      onLoadUrl(url);
      setValue('');
    } else {
      // Suche / Audit-Query → bestehende Route
      navigate(`/audit?target=${encodeURIComponent(input)}`);
      setValue('');
    }
  };

  const isUrl = value.trim() ? Boolean(normalizeUrl(value)) : false;

  return (
    <div className={`flex-1 flex items-center gap-2 bg-obsidian-950 border px-3 py-1.5 max-w-xl transition-colors ${
      focused ? 'border-cyan-600' : 'border-titanium-800'
    }`}>
      {isUrl
        ? <Globe className="h-3.5 w-3.5 text-cyan-500 shrink-0" />
        : <Search className="h-3.5 w-3.5 text-titanium-600 shrink-0" />
      }
      <input
        type="text"
        value={displayValue}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => { setFocused(true); if (activeUrl && !value) setValue(activeUrl); }}
        onBlur={() => { setFocused(false); }}
        onKeyDown={handleKeyDown}
        placeholder="Website, KI-System, Vendor oder Risiko prüfen…"
        className="flex-1 bg-transparent text-xs text-titanium-200 placeholder-titanium-600 outline-none min-w-0"
      />
      {value && (
        <span className="font-mono text-[9px] text-titanium-700 shrink-0 hidden sm:block">
          {isUrl ? '↵ Vorschau' : '↵ Audit'}
        </span>
      )}
    </div>
  );
}
