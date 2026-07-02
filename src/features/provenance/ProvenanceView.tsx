import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, AlertTriangle, FileUp, Fingerprint, CheckCircle2, XCircle } from 'lucide-react';
import { AuthGate } from '../kodee/connections/AuthGate';
import { useTenant } from '../../core/access/TenantProvider';
import { Button } from '../../enterprise-os/components/Button';
import { Card, CardHeader, CardBody } from '../../enterprise-os/components/Card';
import { sha256Hex } from '../../lib/provenance';
import { trustBand } from '../../lib/provenance/trustScore';
import { registerProvenance, verifyProvenance, type VerifyResponse, type ProvenanceError } from './provenanceApi';

/**
 * /app/provenance — Herkunftsnachweis für Assets (C2PA-angelehnt).
 * Advanced-Feature ab Agency (Entitlement provenance.advanced).
 *
 * Der Inhalts-Hash wird LOKAL im Browser berechnet (Web Crypto) — die Datei
 * verlässt das Gerät nicht, nur der SHA-256-Digest wird registriert.
 */
export function ProvenanceView() {
  return <AuthGate>{() => <ProvenanceInner />}</AuthGate>;
}

function bandColor(band: 'high' | 'medium' | 'low'): string {
  return band === 'high' ? 'text-emerald-400' : band === 'medium' ? 'text-amber-400' : 'text-risk-critical';
}

function errorMessage(e: ProvenanceError): string {
  switch (e.kind) {
    case 'forbidden': return 'Kein Zugriff auf diesen Mandanten.';
    case 'payment_required': return 'Herkunftsnachweis (Advanced) ist erst ab Agency verfügbar.';
    case 'conflict': return 'Für dieses Asset existiert bereits ein Manifest — nutze Verifizieren.';
    case 'not_found': return 'Kein Manifest für dieses Asset gefunden — bitte zuerst registrieren.';
    default: return e.message;
  }
}

function ProvenanceInner() {
  const { activeTenantId, hasFeature } = useTenant();
  const advanced = hasFeature('provenance.advanced');

  const [assetRef, setAssetRef] = useState('');
  const [digest, setDigest] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [result, setResult] = useState<VerifyResponse | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null); setNotice(null);
    const bytes = new Uint8Array(await file.arrayBuffer());
    setDigest(await sha256Hex(bytes));
    setFileName(file.name);
  }

  async function onRegister() {
    if (!activeTenantId || !assetRef.trim() || !digest) return;
    setBusy(true); setError(null); setNotice(null);
    const r = await registerProvenance({ tenant_id: activeTenantId, asset_ref: assetRef.trim(), content_sha256: digest });
    if (r.kind === 'ok') {
      setNotice(`Registriert (seq ${r.data.seq}${r.data.signed ? ', signiert' : ''}). Event-Hash ${r.data.event_hash.slice(0, 16)}…`);
    } else {
      setError(errorMessage(r));
    }
    setBusy(false);
  }

  async function onVerify() {
    if (!activeTenantId || !assetRef.trim()) return;
    setBusy(true); setError(null); setNotice(null); setResult(null);
    const r = await verifyProvenance({ tenant_id: activeTenantId, asset_ref: assetRef.trim(), content_sha256: digest ?? undefined });
    if (r.kind === 'ok') setResult(r.data);
    else setError(errorMessage(r));
    setBusy(false);
  }

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="flex h-14 items-center justify-between border-b border-titanium-900 bg-obsidian-900 px-4">
        <div className="flex items-center gap-3">
          <Link to="/app" className="p-1.5 text-titanium-400 hover:bg-obsidian-800 hover:text-titanium-200">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center bg-gradient-to-br from-emerald-500 to-teal-700">
              <ShieldCheck className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="font-display text-sm font-semibold tracking-tight text-titanium-50">Herkunftsnachweis</h1>
              <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-500">
                Content Credentials · Chain-of-Custody · Trust-Score
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6 space-y-6 sm:px-6">
        {!advanced && (
          <div className="flex items-start gap-3 border border-amber-500/40 bg-amber-500/5 px-4 py-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <div className="text-xs text-titanium-300">
              <p className="font-semibold text-amber-300">Herkunftsnachweis (Advanced) ist in deinem Plan nicht freigeschaltet.</p>
              <p className="mt-1">Verfügbar ab <strong>Agency</strong>. Signatur, Chain-of-Custody und Trust-Score werden erst nach Upgrade ausgeführt.</p>
            </div>
          </div>
        )}

        <Card>
          <CardHeader
            title="Asset registrieren oder verifizieren"
            eyebrow="Content Credentials"
            subtitle="Der Inhalts-Hash wird lokal im Browser berechnet — die Datei verlässt dein Gerät nicht."
          />
          <CardBody>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-titanium-500">Asset-Referenz</label>
                <input
                  value={assetRef}
                  onChange={(e) => setAssetRef(e.target.value)}
                  placeholder="z.B. AST-2026-0007"
                  className="w-full border border-titanium-700 bg-obsidian-900 px-3 py-2 text-sm text-titanium-100 placeholder:text-titanium-600 focus:border-security-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-titanium-500">Inhalt (lokaler SHA-256)</label>
                <label className="inline-flex cursor-pointer items-center gap-2 border border-titanium-700 bg-obsidian-900 px-3 py-2 text-sm text-titanium-200 hover:border-security-500">
                  <FileUp className="h-3.5 w-3.5" /> Datei wählen
                  <input type="file" className="hidden" onChange={onFile} />
                </label>
                {digest && (
                  <p className="mt-2 flex items-center gap-2 break-all font-mono text-[11px] text-titanium-400">
                    <Fingerprint className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                    <span>{fileName}: {digest}</span>
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-3">
                <Button onClick={onRegister} disabled={busy || !advanced || !activeTenantId || !assetRef.trim() || !digest}>
                  {busy ? 'Arbeite…' : 'Registrieren'}
                </Button>
                <Button variant="secondary" onClick={onVerify} disabled={busy || !advanced || !activeTenantId || !assetRef.trim()}>
                  Verifizieren
                </Button>
              </div>

              {notice && <div className="border border-emerald-500/40 bg-emerald-500/5 px-4 py-3 text-xs text-emerald-300">{notice}</div>}
              {error && <div className="border border-risk-critical/40 bg-risk-critical/5 px-4 py-3 text-xs text-risk-critical">{error}</div>}
            </div>
          </CardBody>
        </Card>

        {result && (
          <Card>
            <CardHeader title="Verifikationsergebnis" eyebrow={`Asset ${result.asset_ref}`} />
            <CardBody>
              <div className="grid gap-6 sm:grid-cols-[auto,1fr]">
                <div className="text-center">
                  <div className={`font-display text-4xl font-bold ${bandColor(trustBand(result.trust.trustScore))}`}>
                    {result.trust.trustScore}
                  </div>
                  <div className="font-mono text-[10px] uppercase tracking-wider text-titanium-500">Trust-Score</div>
                  <div className={`mt-2 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider ${result.tamper_state === 'intact' ? 'text-emerald-400' : 'text-risk-critical'}`}>
                    {result.tamper_state === 'intact' ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                    {result.tamper_state === 'intact' ? 'unverändert' : result.tamper_state === 'tampered' ? `manipuliert (seq ${result.broken_at_seq})` : 'nicht verifizierbar'}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2 font-mono text-[10px] uppercase tracking-wider">
                    <EvidenceChip ok={result.evidence_components.metadataIntegrity} label="Metadaten-Integrität" />
                    <EvidenceChip ok={result.evidence_components.ownershipConsistency} label="Eigentümer-Konsistenz" />
                    <EvidenceChip ok={result.evidence_components.provenanceContinuity} label="Ketten-Kontinuität" />
                    {result.signature?.algorithm && (
                      <span
                        title={result.signature.externally_verifiable
                          ? 'Ed25519-Signatur — mit dem öffentlichen Schlüssel unabhängig prüfbar'
                          : 'HMAC-Signatur (Legacy) — nur intern prüfbar'}
                        className={`border px-2 py-1 ${result.signature.externally_verifiable
                          ? 'border-emerald-500/40 bg-emerald-500/5 text-emerald-300'
                          : 'border-titanium-700 text-titanium-400'}`}
                      >
                        {result.signature.externally_verifiable ? 'Ed25519 · extern prüfbar' : `${result.signature.algorithm} · intern`}
                      </span>
                    )}
                  </div>
                  {result.trust.riskLabels.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {result.trust.riskLabels.map((l) => (
                        <span key={l} className="border border-amber-500/40 bg-amber-500/5 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-amber-300">{l}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6">
                <div className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-titanium-500">Chain-of-Custody</div>
                <ol className="space-y-2">
                  {result.custody.map((c) => (
                    <li key={c.seq} className="flex items-center justify-between border border-titanium-800 px-3 py-2 text-xs">
                      <span className="flex items-center gap-3">
                        <span className="font-mono text-titanium-500">#{c.seq}</span>
                        <span className="text-titanium-200">{c.action}</span>
                        <span className="font-mono text-[10px] text-titanium-500">{c.actor}</span>
                      </span>
                      <span className="flex items-center gap-3 font-mono text-[10px] text-titanium-500">
                        <span className="break-all">{c.event_hash.slice(0, 16)}…</span>
                        {c.signed && <span className="text-emerald-400">signiert</span>}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}

function EvidenceChip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 border px-2 py-1 ${ok ? 'border-emerald-500/40 bg-emerald-500/5 text-emerald-300' : 'border-risk-critical/40 bg-risk-critical/5 text-risk-critical'}`}>
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {label}
    </span>
  );
}
