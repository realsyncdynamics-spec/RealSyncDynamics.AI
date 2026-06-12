import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { StatusBadge, type RiskLevel } from './Badge';

export interface RiskItem {
  id: string;
  title: string;
  description: string;
  level: RiskLevel;
  asset: string;
  framework: string;
  detectedAt: string;
}

export function RiskCard({ risk, onOpen }: { risk: RiskItem; onOpen?: (id: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen?.(risk.id)}
      className="group flex w-full flex-col gap-3 border border-titanium-800 bg-obsidian-800/60 p-4 text-left transition-colors hover:border-titanium-600 hover:bg-obsidian-800"
    >
      <div className="flex items-start justify-between gap-3">
        <StatusBadge level={risk.level} />
        <ArrowUpRight className="h-4 w-4 shrink-0 text-titanium-600 transition-colors group-hover:text-security-400" />
      </div>
      <div>
        <h4 className="font-display text-sm font-semibold text-titanium-50">{risk.title}</h4>
        <p className="mt-1 text-xs leading-relaxed text-titanium-400">{risk.description}</p>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-titanium-800 pt-3 font-mono text-[10px] uppercase tracking-wider text-titanium-500">
        <span>{risk.asset}</span>
        <span className="text-titanium-700">·</span>
        <span>{risk.framework}</span>
        <span className="text-titanium-700">·</span>
        <span className="tabular">{risk.detectedAt}</span>
      </div>
    </button>
  );
}
