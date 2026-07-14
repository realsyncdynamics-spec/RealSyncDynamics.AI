import { Download, Copy, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useState } from 'react';

export interface EvidenceSnapshot {
  id: string;
  asset_ref: string;
  snapshot_ts: Date;
  content_sha256: string;
  trust_score: number;
  tamper_state: 'intact' | 'tampered' | 'unverifiable';
  signature: string | null;
  signature_alg: 'ed25519' | 'hmac-sha256' | null;
  custody_seq: number;
  metadata: {
    source?: string;
    tags?: string[];
    description?: string;
  };
}

interface EvidenceSnapshotCardProps {
  snapshot: EvidenceSnapshot;
  onDownload?: (snapshot: EvidenceSnapshot) => void;
}

export function EvidenceSnapshotCard({ snapshot, onDownload }: EvidenceSnapshotCardProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(snapshot.content_sha256);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const trustColor =
    snapshot.trust_score >= 80
      ? 'text-emerald-400'
      : snapshot.trust_score >= 50
        ? 'text-amber-400'
        : 'text-risk-critical';

  const tamperIcon = snapshot.tamper_state === 'intact' ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />;
  const tamperColor = snapshot.tamper_state === 'intact' ? 'text-emerald-400' : 'text-risk-critical';

  return (
    <div className="border border-titanium-800 bg-obsidian-900 p-4">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-titanium-100">{snapshot.asset_ref}</h4>
            <span className="font-mono text-[10px] text-titanium-500 bg-obsidian-800 px-2 py-1">
              Seq {snapshot.custody_seq}
            </span>
          </div>
          <p className="font-mono text-[10px] text-titanium-500 mt-1">
            {new Date(snapshot.snapshot_ts).toLocaleString('de-DE')}
          </p>
        </div>

        <div className="text-right">
          <div className={`text-3xl font-bold font-display ${trustColor}`}>{snapshot.trust_score}</div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-500">Score</p>
        </div>
      </div>

      {/* Integrity status */}
      <div className="flex items-center gap-2 mb-4 pb-4 border-b border-titanium-800">
        <span className={tamperColor}>{tamperIcon}</span>
        <span className={`text-sm font-semibold ${tamperColor}`}>
          {snapshot.tamper_state === 'intact'
            ? 'Unverändert'
            : snapshot.tamper_state === 'tampered'
              ? 'Manipuliert'
              : 'Nicht verifizierbar'}
        </span>
      </div>

      {/* Content hash */}
      <div className="mb-4">
        <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-500 mb-1.5">Content-Hash</p>
        <div className="flex items-center gap-2">
          <code className="font-mono text-[11px] text-titanium-300 break-all flex-1 bg-obsidian-800 px-2 py-1">
            {snapshot.content_sha256.slice(0, 32)}…
          </code>
          <button
            onClick={copyToClipboard}
            className="p-1.5 text-titanium-500 hover:text-titanium-300 hover:bg-obsidian-800"
            title="In die Zwischenablage kopieren"
          >
            {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Signature */}
      {snapshot.signature && (
        <div className="mb-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-500 mb-1.5">Signatur</p>
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] px-2 py-1 border rounded ${
                snapshot.signature_alg === 'ed25519'
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/40'
                  : 'bg-titanium-700/10 text-titanium-400 border-titanium-700/40'
              }`}
            >
              {snapshot.signature_alg === 'ed25519' ? 'Ed25519 · Extern prüfbar' : 'HMAC · Intern'}
            </span>
          </div>
          <code className="font-mono text-[10px] text-titanium-500 break-all mt-1 block">
            {snapshot.signature.slice(0, 40)}…
          </code>
        </div>
      )}

      {/* Metadata */}
      {snapshot.metadata && (
        <div className="mb-4 pb-4 border-b border-titanium-800">
          {snapshot.metadata.tags && snapshot.metadata.tags.length > 0 && (
            <div className="mb-2">
              <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-500 mb-1">Tags</p>
              <div className="flex flex-wrap gap-1">
                {snapshot.metadata.tags.map((tag) => (
                  <span key={tag} className="text-[10px] bg-titanium-800 text-titanium-300 px-2 py-0.5 rounded">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
          {snapshot.metadata.description && (
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-500 mb-1">Notiz</p>
              <p className="text-xs text-titanium-300">{snapshot.metadata.description}</p>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {onDownload && (
          <button
            onClick={() => onDownload(snapshot)}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-security-600 hover:bg-security-700 text-white text-sm font-semibold transition-colors"
          >
            <Download className="h-4 w-4" />
            C2PA Exportieren
          </button>
        )}
        <button className="flex-1 px-3 py-2 bg-obsidian-800 hover:bg-obsidian-700 text-titanium-200 text-sm font-semibold transition-colors border border-titanium-700">
          Details
        </button>
      </div>
    </div>
  );
}
