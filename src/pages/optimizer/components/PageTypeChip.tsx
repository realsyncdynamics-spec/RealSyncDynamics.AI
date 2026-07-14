/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Page-Type-Chip: klassifiziert jede Optimizer-Seite als
 * INFO / ACTION / FEEDBACK. Hard-Edge (rounded-none), Monospace für
 * Metadaten — konsistent mit dem Obsidian/Titanium-Design-System.
 */

export type PageType = 'info' | 'action' | 'feedback';

const CONFIG: Record<PageType, { label: string; className: string }> = {
  // Kein Neon: Security-Blue (INFO), Petrol (FEEDBACK), Brass (ACTION)
  // sind die im System vorhandenen Akzentfarben.
  info: { label: 'INFO', className: 'text-security-300 border-security-700 bg-security-900/30' },
  action: { label: 'ACTION', className: 'text-brass-300 border-brass-600 bg-obsidian-900' },
  feedback: { label: 'FEEDBACK', className: 'text-petrol border-petrol/50 bg-petrol/10' },
};

export function PageTypeChip({ type }: { type: PageType }) {
  const { label, className } = CONFIG[type];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 border rounded-none font-mono text-[11px] font-bold uppercase tracking-wider ${className}`}
    >
      <span aria-hidden className="w-1.5 h-1.5 bg-current" />
      {label}
    </span>
  );
}
