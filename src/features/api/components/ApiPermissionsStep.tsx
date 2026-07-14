import { ChevronDown, Shield, Eye, Zap, Database } from 'lucide-react';
import { useState } from 'react';

export type ApiPermissionLevel = 'read' | 'write' | 'full';

interface ApiPermissionsStepProps {
  selected: ApiPermissionLevel | null;
  onChange: (level: ApiPermissionLevel) => void;
}

const permissions: Array<{
  id: ApiPermissionLevel;
  icon: React.ReactNode;
  label: string;
  description: string;
  examples: string[];
  recommended?: boolean;
}> = [
  {
    id: 'read',
    icon: <Eye className="h-5 w-5" />,
    label: 'Nur Ergebnisse lesen',
    description: 'Dein System kann Scan-Ergebnisse und Reports abrufen.',
    examples: ['Ergebnisse in Dashboard anzeigen', 'Berichte herunterladen', 'Status abfragen'],
    recommended: true,
  },
  {
    id: 'write',
    icon: <Zap className="h-5 w-5" />,
    label: 'Scans starten & Ergebnisse lesen',
    description: 'Dein System kann neue Scans auslösen und deren Ergebnisse abrufen.',
    examples: ['Scan von externem System aus starten', 'Automatische Prüfungen', 'CI/CD-Integration'],
  },
  {
    id: 'full',
    icon: <Database className="h-5 w-5" />,
    label: 'Vollständiger Zugriff',
    description: 'Dein System kann Konfiguration ändern, Keys verwalten und alles verwalten.',
    examples: ['Administration', 'Eigene Integrationen bauen', 'Vollständige Automation'],
  },
];

export function ApiPermissionsStep({ selected, onChange }: ApiPermissionsStepProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-display font-bold text-titanium-50 mb-2">
          Was darf die Verbindung dürfen?
        </h3>
        <p className="text-sm text-titanium-400">
          Je restriktiver, desto sicherer. Wähle die Mindestberechtigungen.
        </p>
      </div>

      <div className="space-y-3">
        {permissions.map((p) => (
          <button
            key={p.id}
            onClick={() => onChange(p.id)}
            className={`w-full p-4 text-left border rounded-none transition-all ${
              selected === p.id
                ? 'bg-security-600 border-security-500 text-white'
                : 'bg-obsidian-900 border-titanium-800 text-titanium-100 hover:border-security-500'
            }`}
            data-testid={`api-permission-${p.id}`}
          >
            <div className="flex items-start gap-3">
              <div className="shrink-0 mt-0.5">{p.icon}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{p.label}</span>
                  {p.recommended && (
                    <span className="text-xs px-2 py-1 bg-emerald-900 text-emerald-200 rounded-none">
                      Empfohlen
                    </span>
                  )}
                </div>
                <p className="text-xs mt-1 opacity-80">{p.description}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {p.examples.map((ex, i) => (
                    <span key={i} className="text-xs px-1.5 py-0.5 bg-black/30 rounded-none">
                      {ex}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="w-full flex items-center gap-2 text-sm text-security-400 hover:text-security-300 py-2 px-3 hover:bg-obsidian-900 rounded-none transition-colors"
        data-testid="api-advanced-toggle"
      >
        <ChevronDown className={`h-4 w-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
        Erweiterte Berechtigungen anzeigen
      </button>

      {showAdvanced && (
        <div className="bg-obsidian-900 border border-titanium-800 rounded-none p-4">
          <p className="text-xs font-mono text-titanium-400 mb-3">Scopes (für Entwickler):</p>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-titanium-300">
              <input
                type="checkbox"
                checked={selected === 'read' || selected === 'write' || selected === 'full'}
                disabled
                className="rounded-none"
              />
              <code>read:scans</code>
            </div>
            <div className="flex items-center gap-2 text-xs text-titanium-300">
              <input
                type="checkbox"
                checked={selected === 'write' || selected === 'full'}
                disabled
                className="rounded-none"
              />
              <code>write:scans</code>
            </div>
            <div className="flex items-center gap-2 text-xs text-titanium-300">
              <input
                type="checkbox"
                checked={selected === 'full'}
                disabled
                className="rounded-none"
              />
              <code>admin:*</code>
            </div>
          </div>
          <p className="text-[11px] text-titanium-500 mt-3">
            Die genauen Scopes werden in der Dokumentation erklärt.
          </p>
        </div>
      )}
    </div>
  );
}
