import { Navbar } from '../components/Navbar';
import { usePageMeta } from '../lib/usePageMeta';
import { ShieldCheck, Hash, FileText, Cpu, Server } from 'lucide-react';

// EvidencePage — full evidence-vault surface (public). Long-form list with
// kind filters. Mock entries only; the real vault lives behind auth.

interface VaultEntry {
  id: string;
  hash: string;
  kind: 'anchor' | 'audit-bundle' | 'policy-snapshot' | 'agent-action' | 'consent-receipt';
  target: string;
  ts: string;
  bytes: number;
  status: 'sealed' | 'pending';
  icon: React.ReactNode;
}

const ENTRIES: readonly VaultEntry[] = [
  { id: 'v01', hash: 'sha256:9f2c8a72d4f1e3b81e3a55c0a82ba991', kind: 'anchor',           target: 'audit-bundle 04-26',                ts: '3 s ago',  bytes:   612, status: 'sealed', icon: <Hash className="h-3.5 w-3.5 text-emerald-400" /> },
  { id: 'v02', hash: 'sha256:b81f4129a8e2dd11c9c0e7f24b8d1aa3', kind: 'agent-action',     target: 'drift-agent · open incident',       ts: '12 s ago', bytes: 1_138, status: 'sealed', icon: <Cpu className="h-3.5 w-3.5 text-violet-300" /> },
  { id: 'v03', hash: 'sha256:d31a9c12b3f1e8a72c9c0e7f24b8d1aa3', kind: 'policy-snapshot', target: 'consent-v2 · enforced on 12 sites', ts: '47 s ago', bytes: 4_217, status: 'sealed', icon: <FileText className="h-3.5 w-3.5 text-cyan-300" /> },
  { id: 'v04', hash: 'sha256:a72d4f1e3b81e3a55c0a82ba9914d51c', kind: 'audit-bundle',     target: 'sealed bundle · 1,248 events',      ts: '2 m ago',  bytes: 124_812, status: 'sealed', icon: <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> },
  { id: 'v05', hash: 'sha256:0b3c47e1aa39ff21d3ec2b9d8a14e7c3', kind: 'anchor',           target: 'eu-ai-act-pack · 17 systems',       ts: '4 m ago',  bytes:   814, status: 'sealed', icon: <Hash className="h-3.5 w-3.5 text-emerald-400" /> },
  { id: 'v06', hash: 'sha256:f3e1b81c47e9a72d3a55c0a82ba991ab', kind: 'consent-receipt',  target: 'kunde-1.de · session ab12…',        ts: '6 m ago',  bytes:   312, status: 'sealed', icon: <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> },
  { id: 'v07', hash: 'sha256:11e3a55c0a82ba9914d51c0b3c47e1aa', kind: 'agent-action',     target: 'policy-agent · §13 draft v3',       ts: '8 m ago',  bytes: 2_044, status: 'sealed', icon: <Cpu className="h-3.5 w-3.5 text-violet-300" /> },
  { id: 'v08', hash: 'sha256:7c3a55c0a82ba9914d51c0b3c47e1f3e', kind: 'policy-snapshot', target: 'pii-redaction · enforced',          ts: '11 m ago', bytes:   908, status: 'sealed', icon: <FileText className="h-3.5 w-3.5 text-cyan-300" /> },
  { id: 'v09', hash: 'sha256:e2dd11c9c0e7f24b8d1aa3d31a9c12b3', kind: 'anchor',           target: 'rolling-backup · supabase-eu-west', ts: '13 m ago', bytes: 24_000_000, status: 'sealed', icon: <Hash className="h-3.5 w-3.5 text-emerald-400" /> },
  { id: 'v10', hash: 'sha256:55c0a82ba9914d51c0b3c47e1aa39ff2', kind: 'consent-receipt',  target: 'kunde-3.com · session 8f1c…',       ts: '17 m ago', bytes:   312, status: 'sealed', icon: <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> },
];

const KIND_LABEL: Record<VaultEntry['kind'], string> = {
  anchor:            'anchor',
  'audit-bundle':    'audit-bundle',
  'policy-snapshot': 'policy-snapshot',
  'agent-action':    'agent-action',
  'consent-receipt': 'consent-receipt',
};

function truncate(h: string): string {
  return `${h.slice(0, 18)}…${h.slice(-8)}`;
}

function fmtBytes(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} MB`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)} KB`;
  return `${n} B`;
}

export function EvidencePage() {
  usePageMeta({
    title: 'Evidence — Sealed Audit Chain | RealSync',
    description: 'Sealed evidence vault: every finding, every agent action, every policy snapshot hashed and anchored. Replay-ready.',
    url: 'https://RealSyncDynamicsAI.de/evidence',
  });

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <Navbar />
      <main className="pt-14">
        <header className="border-b border-titanium-900 px-4 sm:px-6 py-16">
          <div className="max-w-7xl mx-auto">
            <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-titanium-500 mb-3">
              evidence · sealed audit chain
            </div>
            <h1 className="text-4xl sm:text-5xl font-display font-semibold tracking-tight text-titanium-50 mb-3">
              Every finding sealed. Every action anchored.
            </h1>
            <p className="text-titanium-300 text-base sm:text-lg leading-relaxed max-w-2xl">
              The evidence vault is the audit-grade memory of the runtime. Every detection, classification,
              policy snapshot and agent action gets a sha256 hash and a chain position — replay-ready for
              procurement, BaFin/BAIT review and DSGVO accountability obligations.
            </p>
          </div>
        </header>

        <section className="px-4 sm:px-6 py-12 bg-obsidian-950 border-b border-titanium-900">
          <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-px bg-titanium-900">
            <StatTile label="entries / 24h" value="4,128" tone="text-emerald-300" />
            <StatTile label="anchored chains" value="92" tone="text-cyan-300" />
            <StatTile label="audit bundles" value="34" tone="text-violet-300" />
            <StatTile label="chain depth" value="42,914" tone="text-amber-300" />
          </div>
        </section>

        <section className="px-4 sm:px-6 pb-20">
          <div className="max-w-7xl mx-auto">
            <div className="bg-obsidian-950 border border-titanium-900">
              <header className="flex items-center justify-between px-3 py-2 border-b border-titanium-900 bg-obsidian-900 font-mono text-[10px] uppercase tracking-wider text-titanium-500">
                <span className="inline-flex items-center gap-2">
                  <Server className="h-3 w-3" />
                  evidence.vault · recent
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
                {ENTRIES.map((e) => (
                  <li key={e.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-3 py-3 hover:bg-obsidian-900/40 transition-colors">
                    <span className="inline-flex w-8 h-8 items-center justify-center bg-obsidian-900 border border-titanium-800 shrink-0">
                      {e.icon}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-titanium-500">
                        <span className="text-emerald-300">{KIND_LABEL[e.kind]}</span>
                        <span className="text-titanium-600">· {e.target}</span>
                      </div>
                      <div className="font-mono text-[12px] text-titanium-100 truncate" title={e.hash}>
                        {truncate(e.hash)}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono text-[10px] text-titanium-500 tabular-nums">{e.ts}</div>
                      <div className="font-mono text-[10px] text-titanium-600 tabular-nums">{fmtBytes(e.bytes)}</div>
                    </div>
                  </li>
                ))}
              </ul>

              <footer className="px-3 py-2 border-t border-titanium-900 bg-obsidian-900 flex items-center justify-between font-mono text-[10px] text-titanium-500">
                <span>{ENTRIES.length} / 4,128 entries</span>
                <span className="text-emerald-400">chain integrity · verified</span>
              </footer>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function StatTile({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="bg-obsidian-950 p-5">
      <div className="font-mono text-[10px] uppercase tracking-wider text-titanium-500 mb-2">{label}</div>
      <div className={`font-display font-semibold text-3xl tabular-nums ${tone}`}>{value}</div>
    </div>
  );
}
