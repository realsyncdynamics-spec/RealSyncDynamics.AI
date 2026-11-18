import type { ReaReceipt, ReaStatus } from './runtimeEvidenceAgent';
import { REA_STATUS_LABEL } from './runtimeEvidenceAgent';

const TONE: Record<ReaStatus, string> = {
  belegt: 'border-emerald-500/60 text-emerald-300',
  protokolliert: 'border-sky-500/60 text-sky-300',
  ausstehend: 'border-amber-500/60 text-amber-300',
  abweichung: 'border-rose-500/70 text-rose-300',
  nicht_verfuegbar: 'border-titanium-600 text-titanium-400',
};

function short(hex: string | null | undefined, n = 12): string {
  if (!hex) return '—';
  return hex.length > n ? `${hex.slice(0, n)}…` : hex;
}

/**
 * Kompakter REA-Prüfpfad unter einer Assistenten-Antwort. Zeigt nur, was
 * der Runtime Evidence Agent tatsächlich gefunden und geprüft hat.
 */
export function ReaBadge({ receipt, pending }: { receipt?: ReaReceipt; pending?: boolean }) {
  if (!receipt && !pending) return null;
  if (!receipt) {
    return (
      <span className="mt-1.5 inline-block border border-titanium-700 px-1.5 font-mono text-[9px] text-titanium-400" data-testid="rea-badge">
        REA prüft …
      </span>
    );
  }
  return (
    <details className="mt-1.5 font-mono text-[9px]" data-testid="rea-badge" data-rea-status={receipt.status}>
      <summary className="cursor-pointer list-none">
        <span className={`inline-block border px-1.5 ${TONE[receipt.status]}`}>
          REA · {REA_STATUS_LABEL[receipt.status]}
        </span>
      </summary>
      <dl className="mt-1 grid grid-cols-[72px_1fr] gap-x-2 gap-y-0.5 text-titanium-500">
        <dt>Grund</dt>
        <dd className="font-sans text-titanium-300">{receipt.reason}</dd>
        <dt>sha256</dt>
        <dd className="text-titanium-300">{short(receipt.localInputSha256)}</dd>
        {receipt.eventId && (<><dt>Eintrag</dt><dd className="text-titanium-300">{short(receipt.eventId, 8)}</dd></>)}
        {receipt.model && (<><dt>Modell</dt><dd className="text-titanium-300">{receipt.provider ? `${receipt.provider} · ` : ''}{receipt.model}</dd></>)}
        {receipt.chainIndex !== undefined && (<><dt>Kette</dt><dd className="text-titanium-300">#{receipt.chainIndex}</dd></>)}
      </dl>
    </details>
  );
}
