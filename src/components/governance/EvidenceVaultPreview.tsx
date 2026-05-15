import { ShieldCheck, Hash, FileText, Cpu } from 'lucide-react';
import { Link } from 'react-router-dom';

// EvidenceVaultPreview — compact list of the most recent evidence-chain
// entries. Used on /runtime and /governance as a sealed-audit-trail proof
// point. Static mock data — the real vault lives behind auth.

interface EvidenceEntry {
  id: string;
  hash: string;
  kind: 'anchor' | 'audit-bundle' | 'policy-snapshot' | 'agent-action';
  target: string;
  ts: string;
  icon: React.ReactNode;
}

const ENTRIES: readonly EvidenceEntry[] = [
  {
    id: 'e1',
    hash: 'sha256:9f2c8a72d4f1e3b81e3a55c0a82ba991',
    kind: 'anchor',
    target: 'audit-bundle 04-26',
    ts: '3 s ago',
    icon: <Hash className="h-3.5 w-3.5 text-emerald-400" />,
  },
  {
    id: 'e2',
    hash: 'sha256:b81f4129a8e2dd11c9c0e7f24b8d1aa3',
    kind: 'agent-action',
    target: 'drift-agent · open incident',
    ts: '12 s ago',
    icon: <Cpu className="h-3.5 w-3.5 text-violet-300" />,
  },
  {
    id: 'e3',
    hash: 'sha256:d31a9c12b3f1e8a72c9c0e7f24b8d1aa3',
    kind: 'policy-snapshot',
    target: 'consent-v2 · enforced on 12 sites',
    ts: '47 s ago',
    icon: <FileText className="h-3.5 w-3.5 text-cyan-300" />,
  },
  {
    id: 'e4',
    hash: 'sha256:a72d4f1e3b81e3a55c0a82ba9914d51c',
    kind: 'audit-bundle',
    target: 'sealed bundle · 1,248 events',
    ts: '2 m ago',
    icon: <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />,
  },
  {
    id: 'e5',
    hash: 'sha256:0b3c47e1aa39ff21d3ec2b9d8a14e7c3',
    kind: 'anchor',
    target: 'eu-ai-act-pack · 17 systems',
    ts: '4 m ago',
    icon: <Hash className="h-3.5 w-3.5 text-emerald-400" />,
  },
];

const KIND_LABEL: Record<EvidenceEntry['kind'], string> = {
  anchor:           'anchor',
  'audit-bundle':   'audit-bundle',
  'policy-snapshot': 'policy-snapshot',
  'agent-action':    'agent-action',
};

function truncateHash(h: string): string {
  return `${h.slice(0, 16)}…${h.slice(-6)}`;
}

export function EvidenceVaultPreview({ compact = false }: { compact?: boolean }) {
  return (
    <div className="bg-obsidian-950 border border-titanium-900">
      <header className="flex items-center justify-between px-3 py-2 border-b border-titanium-900 bg-obsidian-900 font-mono text-[10px] uppercase tracking-wider text-titanium-500">
        <span className="inline-flex items-center gap-2">
          <span className="inline-flex gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500/70" />
            <span className="w-2 h-2 rounded-full bg-amber-500/70" />
            <span className="w-2 h-2 rounded-full bg-emerald-500/70" />
          </span>
          evidence.chain · recent
        </span>
        <span className="inline-flex items-center gap-1.5 text-emerald-400">
          <span className="relative inline-flex h-1.5 w-1.5">
            <span className="absolute inset-0 rounded-full bg-emerald-400 opacity-75 motion-safe:animate-ping" />
            <span className="relative inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </span>
          chain sealed
        </span>
      </header>

      <ul role="list" className="divide-y divide-titanium-900">
        {(compact ? ENTRIES.slice(0, 3) : ENTRIES).map((e) => (
          <li key={e.id} className="flex items-center gap-3 px-3 py-3 hover:bg-obsidian-900/40 transition-colors">
            <span className="inline-flex w-7 h-7 items-center justify-center bg-obsidian-900 border border-titanium-800 shrink-0">
              {e.icon}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-titanium-500">
                <span className="text-emerald-300">{KIND_LABEL[e.kind]}</span>
                <span className="text-titanium-600">· {e.target}</span>
              </div>
              <div className="font-mono text-[12px] text-titanium-100 truncate" title={e.hash}>
                {truncateHash(e.hash)}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="font-mono text-[10px] text-titanium-500 tabular-nums">{e.ts}</div>
              <div className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-emerald-400 mt-0.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
                sealed
              </div>
            </div>
          </li>
        ))}
      </ul>

      <footer className="px-3 py-2 border-t border-titanium-900 bg-obsidian-900 flex items-center justify-between font-mono text-[10px] text-titanium-500">
        <span>{compact ? '3' : ENTRIES.length} / 4,128 entries</span>
        <Link to="/evidence" className="text-cyan-300 hover:text-cyan-200 uppercase tracking-wider">
          view evidence vault →
        </Link>
      </footer>
    </div>
  );
}
