import React from 'react';
import { FileCheck2, Download, ShieldCheck } from 'lucide-react';

export interface EvidenceItem {
  id: string;
  title: string;
  type: string;
  hash: string;
  capturedAt: string;
  source: string;
}

export function EvidenceCard({ evidence }: { evidence: EvidenceItem }) {
  return (
    <div className="flex flex-col gap-3 border border-titanium-800 bg-obsidian-800/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center border border-titanium-700 bg-obsidian-900 text-security-400">
            <FileCheck2 className="h-4 w-4" />
          </span>
          <div>
            <h4 className="font-display text-sm font-semibold text-titanium-50">{evidence.title}</h4>
            <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-500">{evidence.type}</p>
          </div>
        </div>
        <button
          type="button"
          className="flex h-8 w-8 shrink-0 items-center justify-center border border-titanium-700 text-titanium-400 transition-colors hover:border-security-400 hover:text-security-400"
          aria-label="Herunterladen"
        >
          <Download className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex items-center gap-1.5 border border-titanium-800 bg-obsidian-900 px-2 py-1.5">
        <ShieldCheck className="h-3 w-3 shrink-0 text-risk-passed" />
        <code className="truncate font-mono text-[10px] tabular text-titanium-400">{evidence.hash}</code>
      </div>
      <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-titanium-500">
        <span>{evidence.source}</span>
        <span className="tabular">{evidence.capturedAt}</span>
      </div>
    </div>
  );
}
