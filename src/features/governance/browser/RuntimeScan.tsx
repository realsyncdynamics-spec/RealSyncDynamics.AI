import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import {
  TenantAuditError,
  addWebsiteForTenant,
  listWebsitesForTenant,
  triggerTenantAudit,
  type TenantWebsite,
} from '../scans/scansApi';

/** Host wie in tenant-audit/pipeline.ts siteHost(): klein, ohne Schema, Port, Pfad, „www.". */
export function scanHost(urlOrDomain: string): string {
  const raw = (urlOrDomain ?? '').trim().toLowerCase();
  if (!raw) return '';
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//.test(raw) ? raw : `https://${raw}`);
    return u.hostname.replace(/^www\./, '').replace(/\.$/, '');
  } catch {
    return '';
  }
}

/** Asset-Bindung vor dem Scan: 0 → definiert ohne Asset/registrieren, 1 → dieses, >1 → Nutzer wählt. */
export function matchWebsites(websites: TenantWebsite[], host: string): TenantWebsite[] {
  return websites.filter((w) => scanHost(w.domain) === host);
}

type Phase =
  | { kind: 'idle' }
  | { kind: 'resolving' }
  | { kind: 'choose'; candidates: Array<{ id: string; domain: string }> }
  | { kind: 'none' }
  | { kind: 'running' }
  | { kind: 'done'; scanRunId: string; findings: number; severity: string | null; binding: 'website' | 'none' }
  | { kind: 'error'; message: string };

/**
 * Website-Scan aus der Browser-Runtime — über den bestehenden Pfad
 * tenant-audit → gdpr-audit (Scan-Lauf, Findings, gekettete Evidence).
 * Keine zweite Scan-Engine.
 */
export function RuntimeScan({ tenantId, targetUrl, disabledReason }: { tenantId: string | null; targetUrl: string | null; disabledReason: string | null }) {
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const host = targetUrl ? scanHost(targetUrl) : '';

  async function run(websiteId?: string) {
    if (!tenantId || !targetUrl) return;
    setPhase({ kind: 'running' });
    try {
      const r = await triggerTenantAudit(tenantId, targetUrl, websiteId ? { website_id: websiteId } : {});
      setPhase({ kind: 'done', scanRunId: r.scan_run_id, findings: r.finding_count, severity: r.severity_max, binding: r.asset_binding });
    } catch (error) {
      if (error instanceof TenantAuditError && error.code === 'WEBSITE_AMBIGUOUS') {
        const candidates = ((error.details as { candidates?: Array<{ id: string; domain: string }> } | undefined)?.candidates) ?? [];
        setPhase({ kind: 'choose', candidates });
        return;
      }
      setPhase({ kind: 'error', message: error instanceof Error ? error.message : 'Scan fehlgeschlagen.' });
    }
  }

  async function start() {
    if (!tenantId || !host) return;
    setPhase({ kind: 'resolving' });
    try {
      const matches = matchWebsites(await listWebsitesForTenant(tenantId), host);
      if (matches.length === 1) return void run(matches[0].id);
      if (matches.length > 1) return setPhase({ kind: 'choose', candidates: matches.map((m) => ({ id: m.id, domain: m.domain })) });
      setPhase({ kind: 'none' });
    } catch (error) {
      setPhase({ kind: 'error', message: error instanceof Error ? error.message : 'Websites konnten nicht geladen werden.' });
    }
  }

  async function registerAndScan() {
    if (!tenantId || !host) return;
    setPhase({ kind: 'running' });
    try {
      const website = await addWebsiteForTenant(tenantId, host);
      await run(website.id);
    } catch (error) {
      setPhase({ kind: 'error', message: error instanceof Error ? error.message : 'Website konnte nicht registriert werden.' });
    }
  }

  const blocked = disabledReason ?? (!tenantId ? 'Kein Mandant ausgewählt.' : !host ? 'Keine Seite geöffnet, deren Domain gescannt werden kann.' : null);

  return (
    <div className="mt-4 border border-titanium-800 bg-obsidian-900 p-3" data-testid="runtime-scan">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-titanium-300">
          <ShieldCheck className="h-3.5 w-3.5 text-cyan-400" /> Website-Scan {host && <span className="font-mono normal-case tracking-normal text-titanium-400">{host}</span>}
        </div>
        <button
          type="button"
          onClick={() => void start()}
          disabled={Boolean(blocked) || phase.kind === 'resolving' || phase.kind === 'running'}
          className="border border-cyan-800 px-3 py-1.5 text-xs text-cyan-200 disabled:cursor-not-allowed disabled:opacity-45"
          title={blocked ?? undefined}
        >
          {phase.kind === 'running' ? 'Scan läuft…' : phase.kind === 'resolving' ? 'Prüfe Websites…' : 'Scan starten'}
        </button>
      </div>
      {blocked && <p className="mt-2 text-[11px] text-titanium-500">{blocked}</p>}

      {phase.kind === 'choose' && (
        <div className="mt-3" role="group" aria-label="Website wählen">
          <p className="text-[11px] text-amber-200">Mehrere registrierte Websites passen zu {host}. Welche ist gemeint? (Es wird nicht geraten.)</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {phase.candidates.map((c) => (
              <button key={c.id} type="button" onClick={() => void run(c.id)} className="border border-titanium-700 px-2 py-1 font-mono text-[11px] text-titanium-200 hover:border-cyan-700">
                {c.domain}
              </button>
            ))}
            <button type="button" onClick={() => setPhase({ kind: 'idle' })} className="px-2 py-1 text-[11px] text-titanium-400">Abbrechen</button>
          </div>
        </div>
      )}

      {phase.kind === 'none' && (
        <div className="mt-3">
          <p className="text-[11px] text-titanium-300">{host} ist in diesem Workspace nicht als Website registriert.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={() => void registerAndScan()} className="border border-cyan-800 px-2 py-1 text-[11px] text-cyan-200">Registrieren und scannen</button>
            <button type="button" onClick={() => void run()} className="border border-titanium-700 px-2 py-1 text-[11px] text-titanium-300">Ohne Website-Zuordnung scannen</button>
            <button type="button" onClick={() => setPhase({ kind: 'idle' })} className="px-2 py-1 text-[11px] text-titanium-400">Abbrechen</button>
          </div>
        </div>
      )}

      {phase.kind === 'done' && (
        <p className="mt-2 text-[11px] text-emerald-300" role="status">
          Scan abgeschlossen: {phase.findings} Befund(e){phase.severity ? `, höchste Schwere ${phase.severity}` : ''}
          {phase.binding === 'none' ? ' · ohne Website-Zuordnung' : ''} ·{' '}
          <Link to={`/app/scans/${phase.scanRunId}`} className="underline">Ergebnis und Evidence öffnen</Link>
        </p>
      )}
      {phase.kind === 'error' && <p className="mt-2 text-[11px] text-red-300" role="alert">{phase.message}</p>}
    </div>
  );
}
