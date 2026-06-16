import React, { useState } from 'react';
import { Search, FileCheck2, Download } from 'lucide-react';
import { Button } from '../components/Button';
import { EvidenceCard } from '../components/EvidenceCard';
import { EmptyState } from '../components/States';
import { EVIDENCE } from '../mock/data';

export function EvidencePage() {
  const [query, setQuery] = useState('');

  const items = EVIDENCE.filter((e) =>
    `${e.title} ${e.type} ${e.source}`.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-titanium-500">
            Prüfpfad
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold text-titanium-50 sm:text-3xl">Evidence Vault</h1>
          <p className="mt-1 text-sm text-titanium-400">
            {EVIDENCE.length} signierte Nachweise · C2PA-Herkunftsnachweis für Scans, Reports & Freigaben
          </p>
        </div>
        <Button variant="secondary" size="sm">
          <Download className="mr-2 h-3.5 w-3.5" /> Bundle exportieren
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-titanium-500" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Nachweise durchsuchen…"
          className="w-full border border-titanium-800 bg-obsidian-900 py-2.5 pl-10 pr-3 text-sm text-titanium-100 placeholder-titanium-600 outline-none transition-colors focus:border-security-500"
        />
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={<FileCheck2 className="h-5 w-5" />}
          title="Keine Nachweise gefunden"
          description="Passen Sie Ihre Suche an, um Einträge im Evidence Vault zu finden."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((evidence) => (
            <EvidenceCard key={evidence.id} evidence={evidence} />
          ))}
        </div>
      )}
    </div>
  );
}
