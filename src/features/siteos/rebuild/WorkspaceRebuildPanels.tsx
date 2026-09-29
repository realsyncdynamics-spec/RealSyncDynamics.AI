// Workspace-Erweiterungen des Rebuild-Workflows (/builder/:slug):
//
//   REFINE    — Überarbeiten in Klartext: benannte Regeln + Freitext.
//   PUBLISH   — Zieldomain, Checkliste, Backend-Vergleich (mit bewusstem
//               Verzicht), Freigabebewertung, explizites GO → geprüftes ZIP.
//   AUTOMATE / GOVERN — nächste Schritte mit dem echten Verbindungsstand.
//
// Alles, was entscheidet (Rolle, Vergleich, Bewertung, Verbindungen), stellt
// der Server fest. Diese Oberfläche zeigt es und schickt Absichten.

import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, ArrowRight, CheckCircle2, CircleDashed, Download, ExternalLink, Info, Loader2, Plug, RefreshCw, ShieldCheck, Wand2, XCircle,
} from 'lucide-react';
import {
  REVISION_INTENTS,
  createZip,
  verifyArtifactFiles,
  type BackendItem,
  type ChecklistItem,
  type RevisionIntentKey,
  type SiteBlueprint,
} from '../../../../packages/siteos-core/src/index';
import { approvePublish, errorMessage, evaluatePublish, type StoredBlueprintRow } from '../siteOsApi';
import { exportPublish, rebuildStatus, refineRebuild, waiveBackend, type RefineResponse, type StatusResponse } from './rebuildApi';
import { Pill } from './RebuildParts';

const SECTION = 'mb-2 mt-5 text-[10px] font-bold uppercase tracking-[.16em] text-black/35 first:mt-0';

// ─────────────────────────────────────────────────────────────────────
// REFINE
// ─────────────────────────────────────────────────────────────────────

export function RefinePanel(props: {
  tenantId: string;
  stored: StoredBlueprintRow;
  dirty: boolean;
  initialInstruction?: string;
  onRevised: (next: { blueprint_id: string | null; version: number; content_sha256: string; blueprint: SiteBlueprint }) => void;
  log: (level: 'info' | 'ok' | 'error', text: string) => void;
}): ReactElement {
  const { tenantId, stored, dirty, onRevised, log } = props;
  const [selected, setSelected] = useState<RevisionIntentKey[]>([]);
  const [instruction, setInstruction] = useState(props.initialInstruction ?? '');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RefineResponse | null>(null);
  const [error, setError] = useState('');

  const toggle = (key: RevisionIntentKey) => setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const apply = async () => {
    if (busy || dirty || (selected.length === 0 && instruction.trim() === '')) return;
    setBusy(true); setError(''); setResult(null);
    const response = await refineRebuild({
      tenant_id: tenantId,
      slug: stored.blueprint.slug,
      base_sha256: stored.content_sha256,
      intents: selected,
      instruction: instruction.trim() || undefined,
    });
    setBusy(false);
    if (response.kind !== 'ok') { setError(response.message); log('error', `Überarbeitung fehlgeschlagen: ${response.message}`); return; }
    const data = response.data;
    setResult(data);
    if (data.understood && !data.unchanged && data.blueprint && data.version && data.content_sha256) {
      onRevised({ blueprint_id: data.blueprint_id ?? null, version: data.version, content_sha256: data.content_sha256, blueprint: data.blueprint });
      log('ok', `Version ${data.version}: ${data.changes.length} gezielte Änderung${data.changes.length === 1 ? '' : 'en'}.`);
      setSelected([]);
      setInstruction('');
    }
  };

  const groups: [string, string][] = [['wirkung', 'Wirkung'], ['struktur', 'Struktur'], ['zielgruppe', 'Zielgruppe']];

  return (
    <div>
      <div className="flex items-center gap-2 text-sm font-bold"><Wand2 size={16} className="text-cyan-600" /> Überarbeiten</div>
      <p className="mt-1 text-[11px] leading-5 text-black/50">Jede Anweisung ist eine feste Regel mit benanntem Umfang. Sie ordnet, gewichtet und gestaltet — sie erfindet keine Inhalte. Jede Änderung wird als neue Version geprüft und gespeichert.</p>

      {groups.map(([group, label]) => (
        <div key={group}>
          <div className={SECTION}>{label}</div>
          <div className="flex flex-wrap gap-1.5">
            {REVISION_INTENTS.filter((i) => i.group === group).map((intent) => (
              <button
                key={intent.key}
                type="button"
                onClick={() => toggle(intent.key)}
                aria-pressed={selected.includes(intent.key)}
                title={intent.effect}
                className={`rounded-full border px-2.5 py-1 text-[11px] ${selected.includes(intent.key) ? 'border-cyan-500 bg-cyan-50 font-semibold text-cyan-800' : 'border-black/[.1] text-black/65 hover:bg-black/[.03]'}`}
              >
                {intent.label}
              </button>
            ))}
          </div>
        </div>
      ))}

      {selected.length > 0 && (
        <ul className="mt-3 space-y-1 rounded-xl bg-[#f5f6f8] p-3">
          {selected.map((key) => {
            const intent = REVISION_INTENTS.find((i) => i.key === key);
            return <li key={key} className="text-[11px] leading-5 text-black/60"><span className="font-semibold text-black/75">{intent?.label}:</span> {intent?.effect}</li>;
          })}
        </ul>
      )}

      <label htmlFor="refine-instruction" className={`${SECTION} block`}>Oder in eigenen Worten</label>
      <textarea
        id="refine-instruction"
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        maxLength={600}
        placeholder={'z. B. „mehr Vertrauen und CTA stärker“ oder „Akzentfarbe #0f766e“'}
        className="min-h-20 w-full resize-y rounded-xl border border-black/[.08] p-3 text-xs outline-none focus:border-cyan-500"
      />
      <button
        type="button"
        onClick={() => void apply()}
        disabled={busy || dirty || (selected.length === 0 && instruction.trim() === '')}
        className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#111827] px-3 py-2.5 text-xs font-bold text-white disabled:opacity-40"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />} Anwenden
      </button>
      {dirty && <p className="mt-2 text-[10px] leading-4 text-amber-800">Erst speichern — überarbeitet wird die gespeicherte Version.</p>}
      {error && <p role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-[11px] leading-5 text-rose-700">{error}</p>}

      {result && (
        <div className="mt-4 space-y-2" aria-live="polite">
          {!result.understood && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-[11px] leading-5 text-amber-900">Nicht verstanden — nichts geändert. Beispiele: „seriöser", „CTA stärker", „für Steuerberater", „Akzentfarbe #0f766e", „Füge eine Referenzseite hinzu".</p>
          )}
          {result.understood && result.unchanged && <p className="rounded-lg bg-black/[.04] p-3 text-[11px] text-black/60">Bereits umgesetzt — keine neue Version.</p>}
          {result.changes.length > 0 && (
            <ul className="space-y-1.5">
              {result.changes.map((change, index) => (
                <li key={`${change.code}-${index}`} className="flex gap-2 text-[11px] leading-5">
                  <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-emerald-600" />
                  <span>{change.summary}{change.complianceNote && <span className="block text-black/50">{change.complianceNote}</span>}</span>
                </li>
              ))}
            </ul>
          )}
          {result.notes.map((note) => <p key={note} className="flex gap-2 text-[11px] leading-5 text-black/55"><Info size={13} className="mt-0.5 shrink-0" />{note}</p>)}
          {result.refusals.map((refusal) => <p key={refusal} className="flex gap-2 text-[11px] leading-5 text-rose-700"><XCircle size={13} className="mt-0.5 shrink-0" />{refusal}</p>)}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Status (gemeinsam für PUBLISH und AUTOMATE)
// ─────────────────────────────────────────────────────────────────────

export function useRebuildStatus(tenantId: string | null, slug: string, contentSha256: string, baseUrl: string) {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const reload = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true); setError('');
    const result = await rebuildStatus({ tenant_id: tenantId, slug, base_url: baseUrl || undefined });
    setLoading(false);
    if (result.kind !== 'ok') { setError(result.message); return; }
    setStatus(result.data);
  }, [tenantId, slug, baseUrl]);
  useEffect(() => { void reload(); }, [reload, contentSha256]);
  return { status, loading, error, reload };
}

// ─────────────────────────────────────────────────────────────────────
// PUBLISH
// ─────────────────────────────────────────────────────────────────────

const STATUS_ICON: Record<ChecklistItem['status'], ReactElement> = {
  ok: <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-600" aria-label="erledigt" />,
  todo: <CircleDashed size={14} className="mt-0.5 shrink-0 text-amber-600" aria-label="offen" />,
  blocker: <XCircle size={14} className="mt-0.5 shrink-0 text-rose-600" aria-label="sperrt" />,
  info: <Info size={14} className="mt-0.5 shrink-0 text-black/40" aria-label="Hinweis" />,
};

const BACKEND_TONE: Record<BackendItem['status'], 'ok' | 'bad' | 'warn' | 'muted'> = { preserved: 'ok', lost: 'bad', waived: 'warn', info: 'muted' };
const BACKEND_LABEL: Record<BackendItem['status'], string> = { preserved: 'erhalten', lost: 'fehlt', waived: 'bewusst entfallen', info: 'entfällt' };

export function PublishPanel(props: {
  tenantId: string;
  stored: StoredBlueprintRow;
  dirty: boolean;
  runId: string | null;
  baseUrl: string;
  onBaseUrl: (value: string) => void;
  status: ReturnType<typeof useRebuildStatus>;
  log: (level: 'info' | 'ok' | 'error', text: string) => void;
}): ReactElement {
  const { tenantId, stored, dirty, baseUrl, onBaseUrl, log } = props;
  const { status, loading, error, reload } = props.status;
  const [domain, setDomain] = useState(baseUrl);
  const [busy, setBusy] = useState<'evaluate' | 'approve' | 'export' | 'waive' | null>(null);
  const [actionError, setActionError] = useState('');
  const [approveReason, setApproveReason] = useState('');
  const [waiving, setWaiving] = useState<{ key: string; reason: string } | null>(null);
  const [previewConfirmed, setPreviewConfirmed] = useState(false);
  const [exported, setExported] = useState<{ file: string; artifact: string; evidence: string } | null>(null);

  useEffect(() => setDomain(baseUrl), [baseUrl]);
  useEffect(() => { setPreviewConfirmed(false); setExported(null); }, [stored.content_sha256]);

  const evaluation = status?.evaluation ?? null;
  // Die Zeile, auf die sich Bewertung, Freigabe und GO beziehen: die des
  // Servers, sobald er denselben Stand meldet (auch nach einer Überarbeitung
  // aus einem anderen Tab) — sonst die gespeicherte Version.
  const sameVersion = status?.content_sha256 === stored.content_sha256.trim();
  const blueprintId = sameVersion && status ? status.blueprint_id : stored.id;
  const current = Boolean(evaluation?.current);
  const publishable = Boolean(current && evaluation?.publishable);
  const blockers = status?.checklist.blockers ?? 0;
  const canGo = publishable && blockers === 0 && previewConfirmed && !dirty && sameVersion;

  const applyDomain = () => {
    const value = domain.trim();
    if (value === '') { onBaseUrl(''); return; }
    try {
      const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
      if (url.protocol !== 'https:') { setActionError('Nur https-Adressen.'); return; }
      setActionError('');
      onBaseUrl(`https://${url.host}`);
    } catch {
      setActionError('Das ist keine gültige Domain.');
    }
  };

  const evaluate = async () => {
    setBusy('evaluate'); setActionError('');
    const result = await evaluatePublish({ tenant_id: tenantId, blueprint_id: blueprintId, base_url: baseUrl || undefined });
    setBusy(null);
    if (result.kind !== 'ok') { setActionError(errorMessage(result)); return; }
    log(result.data.evaluation.publishable ? 'ok' : 'info', `Publish Gate: ${result.data.evaluation.status} (${result.data.evaluation.blockers.length} Blocker).`);
    await reload();
  };

  const approve = async () => {
    if (!evaluation || approveReason.trim().length < 10) return;
    setBusy('approve'); setActionError('');
    const result = await approvePublish({ tenant_id: tenantId, evaluation_id: evaluation.id, reason: approveReason.trim(), base_url: baseUrl || undefined });
    setBusy(null);
    if (result.kind !== 'ok') { setActionError(result.kind === 'forbidden' ? 'Freigeben dürfen Inhaber, Admins und Datenschutzbeauftragte.' : errorMessage(result)); return; }
    setApproveReason('');
    log('ok', 'Freigabe erteilt und neu bewertet.');
    await reload();
  };

  const waive = async (revoke: boolean, key: string, reason = '') => {
    if (!props.runId) return;
    setBusy('waive'); setActionError('');
    const result = await waiveBackend({ tenant_id: tenantId, run_id: props.runId, key, reason, revoke });
    setBusy(null);
    if (result.kind !== 'ok') { setActionError(result.message); return; }
    setWaiving(null);
    log('info', revoke ? 'Verzicht zurückgenommen.' : 'Bewusster Verzicht belegt.');
    await reload();
  };

  const go = async () => {
    if (!canGo) return;
    setBusy('export'); setActionError('');
    const result = await exportPublish({ tenant_id: tenantId, blueprint_id: blueprintId, base_url: baseUrl || undefined, confirm_go: true, confirm_preview: true });
    if (result.kind !== 'ok') { setBusy(null); setActionError(result.message); await reload(); return; }
    const { manifest, files } = result.data;
    // Nur was nachweislich das bewertete Bündel ist, geht ins ZIP: jede
    // Datei gegen ihren Hash, die Liste gegen das Manifest, das Ganze
    // gegen den Bündel-Hash (derselbe Rechenweg wie auf dem Server).
    const verified = await verifyArtifactFiles(files, { artifactSha256: manifest.artifact_sha256, files: manifest.files });
    setBusy(null);
    if (!verified.ok) {
      setActionError(`Das empfangene Bündel stimmt nicht mit dem geprüften überein (${verified.problem}) — nichts exportiert. Bitte erneut versuchen.`);
      log('error', `Export verworfen: ${verified.problem}.`);
      return;
    }
    const encoder = new TextEncoder();
    const zip = createZip([
      ...files.map((f) => ({ path: f.path, data: encoder.encode(f.content) })),
      // Beschreibt das Bündel; selbst nicht Teil des bewerteten Hashes.
      { path: '/realsync-manifest.json', data: encoder.encode(`${JSON.stringify(manifest, null, 2)}\n`) },
    ]);
    const name = `${manifest.slug}-v${manifest.version}.zip`;
    const url = URL.createObjectURL(new Blob([zip], { type: 'application/zip' }));
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = name; anchor.rel = 'noopener';
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    setExported({ file: name, artifact: manifest.artifact_sha256, evidence: manifest.evidence_id });
    log('ok', `GO erteilt und belegt · Bündel ${manifest.artifact_sha256.slice(0, 12)}… als ${name} exportiert.`);
  };

  const grouped = useMemo(() => {
    const order: ChecklistItem['group'][] = ['formular', 'recht', 'seo', 'leistung', 'umzug'];
    const titles: Record<ChecklistItem['group'], string> = { formular: 'Formular', recht: 'Recht', seo: 'SEO', leistung: 'Leistung', umzug: 'Umzug' };
    return order.map((group) => ({ group, title: titles[group], items: status?.checklist.items.filter((i) => i.group === group) ?? [] })).filter((g) => g.items.length > 0);
  }, [status]);

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-bold"><ShieldCheck size={16} className="text-emerald-600" /> Veröffentlichen</div>
        <button type="button" onClick={() => void reload()} className="rounded-md p-1.5 text-black/45 hover:bg-black/[.04]" aria-label="Neu laden">{loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}</button>
      </div>
      <p className="mt-1 text-[11px] leading-5 text-black/50">Veröffentlicht wird nur ein Bündel, das der Publish Gate bestanden hat — und erst nach Ihrem ausdrücklichen GO. Das GO wird belegt, bevor eine Datei das Haus verlässt.</p>

      <label htmlFor="publish-domain" className={`${SECTION} block`}>Zieldomain</label>
      <div className="flex gap-1.5">
        <input id="publish-domain" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="www.ihre-firma.de" inputMode="url" className="min-w-0 flex-1 rounded-lg border border-black/[.1] px-2.5 py-2 text-xs outline-none focus:border-cyan-500" />
        <button type="button" onClick={applyDomain} className="rounded-lg border border-black/[.12] px-2.5 text-[11px] font-semibold">Setzen</button>
      </div>
      <p className="mt-1 text-[10px] leading-4 text-black/40">Für Canonical-Links und Sitemap. Ändert sich die Domain, ist es ein anderes Bündel — und braucht eine neue Bewertung.</p>

      {(error || actionError) && <p role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-[11px] leading-5 text-rose-700">{actionError || error}</p>}
      {!status && loading && <div className="mt-4 flex items-center gap-2 text-[11px] text-black/45"><Loader2 size={13} className="animate-spin" /> Checkliste wird erstellt …</div>}

      {status && (
        <>
          <div className={SECTION}>Checkliste</div>
          {grouped.map(({ group, title, items }) => (
            <div key={group} className="mb-2">
              <div className="text-[10px] font-semibold text-black/45">{title}</div>
              <ul className="mt-1 space-y-1.5">
                {items.map((item) => (
                  <li key={item.key} className="flex gap-2 text-[11px] leading-5">
                    {STATUS_ICON[item.status]}
                    <span><span className="font-semibold">{item.title}</span><span className="block text-black/55">{item.detail}</span></span>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {status.binding_problem && (
            <>
              <div className={SECTION}>Backend der Ausgangsseite</div>
              <p className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[11px] leading-5 text-amber-900">
                <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                <span>{status.binding_problem} Ohne Vergleich sperrt der Publish Gate — die Ausgangsseite neu analysieren und eine Richtung übernehmen.</span>
              </p>
            </>
          )}

          {status.backend && (
            <>
              <div className={SECTION}>Backend der Ausgangsseite</div>
              <ul className="space-y-2">
                {status.backend.items.map((item) => (
                  <li key={item.key} className="rounded-lg border border-black/[.06] p-2.5 text-[11px] leading-5">
                    <div className="flex flex-wrap items-center gap-2"><Pill tone={BACKEND_TONE[item.status]}>{BACKEND_LABEL[item.status]}</Pill><span className="font-semibold">{item.label}</span></div>
                    <div className="mt-1 break-all font-mono text-[10px] text-black/40">{item.source}</div>
                    <p className="mt-1 text-black/55">{item.detail}</p>
                    {item.status === 'lost' && item.waivable && props.runId && (
                      waiving?.key === item.key ? (
                        <div className="mt-2">
                          <label htmlFor={`waive-${item.key}`} className="text-[10px] font-semibold text-black/55">Begründung (wird mit Ihrem Namen belegt)</label>
                          <textarea id={`waive-${item.key}`} value={waiving.reason} onChange={(e) => setWaiving({ key: item.key, reason: e.target.value })} className="mt-1 min-h-16 w-full rounded-lg border border-black/[.1] p-2 text-[11px] outline-none focus:border-cyan-500" />
                          <div className="mt-1 flex gap-1.5">
                            <button type="button" disabled={busy !== null || waiving.reason.trim().length < 10} onClick={() => void waive(false, item.key, waiving.reason.trim())} className="rounded-md bg-[#111827] px-2.5 py-1.5 text-[10px] font-bold text-white disabled:opacity-40">Verzicht belegen</button>
                            <button type="button" onClick={() => setWaiving(null)} className="rounded-md px-2.5 py-1.5 text-[10px] text-black/55">Abbrechen</button>
                          </div>
                        </div>
                      ) : (
                        <button type="button" onClick={() => setWaiving({ key: item.key, reason: '' })} className="mt-1 text-[10px] font-semibold text-black/55 underline-offset-2 hover:underline">Bewusst verzichten …</button>
                      )
                    )}
                    {item.status === 'waived' && props.runId && (
                      <button type="button" disabled={busy !== null} onClick={() => void waive(true, item.key)} className="mt-1 text-[10px] font-semibold text-black/55 underline-offset-2 hover:underline">Verzicht zurücknehmen</button>
                    )}
                  </li>
                ))}
              </ul>
              {status.backend.coverage.map((line) => <p key={line} className="mt-2 flex gap-1.5 text-[10px] leading-4 text-black/45"><Info size={12} className="mt-0.5 shrink-0" />{line}</p>)}
            </>
          )}

          <div className={SECTION}>Freigabebewertung</div>
          {evaluation ? (
            <div className="rounded-lg border border-black/[.06] p-2.5 text-[11px] leading-5">
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone={publishable ? 'ok' : evaluation.status === 'pending' ? 'warn' : 'bad'}>{publishable ? 'veröffentlichbar' : evaluation.status === 'pending' ? 'wartet auf Freigabe' : 'gesperrt'}</Pill>
                {!current && <Pill tone="muted">bezieht sich auf einen früheren Stand</Pill>}
              </div>
              {current && evaluation.blockers.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-4 text-black/60">{evaluation.blockers.map((b) => <li key={b}>{b}</li>)}</ul>}
              {current && evaluation.warnings.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-4 text-amber-800">{evaluation.warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
            </div>
          ) : <p className="text-[11px] text-black/50">Noch keine Bewertung dieses Stands.</p>}
          <button type="button" onClick={() => void evaluate()} disabled={busy !== null || dirty} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-black/[.12] bg-white px-3 py-2 text-[11px] font-bold disabled:opacity-40">
            {busy === 'evaluate' ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />} {current ? 'Neu bewerten' : 'Jetzt bewerten'}
          </button>
          {current && evaluation?.status === 'pending' && evaluation.human_approval_required && (
            <div className="mt-2">
              <label htmlFor="approve-reason" className="text-[10px] font-semibold text-black/55">Freigabe mit Begründung (Inhaber, Admin, DSB)</label>
              <textarea id="approve-reason" value={approveReason} onChange={(e) => setApproveReason(e.target.value)} className="mt-1 min-h-16 w-full rounded-lg border border-black/[.1] p-2 text-[11px] outline-none focus:border-cyan-500" />
              <button type="button" onClick={() => void approve()} disabled={busy !== null || approveReason.trim().length < 10} className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#111827] px-3 py-2 text-[11px] font-bold text-white disabled:opacity-40">
                {busy === 'approve' ? <Loader2 size={13} className="animate-spin" /> : null} Für diesen Stand freigeben
              </button>
            </div>
          )}

          <div className={SECTION}>GO</div>
          <label className="flex items-start gap-2 text-[11px] leading-5">
            <input type="checkbox" checked={previewConfirmed} onChange={(e) => setPreviewConfirmed(e.target.checked)} className="mt-1" />
            Ich habe die Vorschau auf Desktop und Mobil geprüft.
          </label>
          <button type="button" onClick={() => void go()} disabled={!canGo || busy !== null} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-3 text-xs font-bold text-white disabled:opacity-40">
            {busy === 'export' ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} GO — veröffentlichen und exportieren
          </button>
          {!canGo && (
            <p className="mt-1 text-[10px] leading-4 text-black/45">
              {dirty ? 'Erst speichern.' : !current ? 'Erst diesen Stand bewerten.' : !publishable ? 'Der Publish Gate hat diesen Stand nicht bestanden.' : blockers > 0 ? 'Die Checkliste hat sperrende Punkte.' : !previewConfirmed ? 'Vorschau bestätigen.' : ''}
            </p>
          )}
          {exported && (
            <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-[11px] leading-5 text-emerald-900">
              <div className="font-semibold">{exported.file} exportiert.</div>
              <div className="font-mono text-[10px]">Bündel {exported.artifact.slice(0, 16)}… · Nachweis {exported.evidence.slice(0, 8)}</div>
            </div>
          )}
          <details className="mt-3 text-[11px] leading-5 text-black/55">
            <summary className="cursor-pointer font-semibold text-black/65">Wie kommt das Bündel online?</summary>
            <p className="mt-1">RealSync lädt nichts hoch. Das ZIP enthält genau die geprüften Dateien — Seiten, robots.txt, Sitemap, <code>_redirects</code> (Weiterleitungen alter Adressen) und <code>_headers</code> (Sicherheits-Header).</p>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              <li>Cloudflare Pages: Projekt mit „Direct Upload" anlegen, entpackten Ordner hochladen, Domain verbinden.</li>
              <li>Netlify: entpackten Ordner in „Deploys" ziehen, Domain verbinden.</li>
              <li>Anderer Hoster: Dateien hochladen; Weiterleitungen und Header dort entsprechend einrichten.</li>
            </ul>
          </details>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// AUTOMATE / GOVERN
// ─────────────────────────────────────────────────────────────────────

const CONNECTION_LABEL = { connected: 'verbunden', pending: 'Verbindung ausstehend', error: 'Verbindung fehlerhaft', 'not-connected': 'nicht verbunden', included: 'in RealSync enthalten' } as const;
const CONNECTION_TONE = { connected: 'ok', pending: 'warn', error: 'bad', 'not-connected': 'muted', included: 'info' } as const;

export function NextStepsPanel({ status }: { status: ReturnType<typeof useRebuildStatus> }): ReactElement {
  const steps = status.status?.next_steps ?? [];
  return (
    <div>
      <div className="flex items-center gap-2 text-sm font-bold"><Plug size={16} className="text-cyan-600" /> Nächste Schritte</div>
      <p className="mt-1 text-[11px] leading-5 text-black/50">Empfehlungen aus dem, was Ihre Website belegt. Hier wird nichts automatisch eingerichtet — jede Automation braucht Ihre ausdrückliche Freigabe. Der Verbindungsstand kommt aus Ihrer Connector-Registratur.</p>
      {status.error && <p role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-[11px] text-rose-700">{status.error}</p>}
      {!status.status && status.loading && <div className="mt-4 flex items-center gap-2 text-[11px] text-black/45"><Loader2 size={13} className="animate-spin" /> Wird geladen …</div>}
      <ul className="mt-3 space-y-2">
        {steps.map((step) => (
          <li key={step.key} className={`rounded-xl border p-3 ${step.relevance === 'high' ? 'border-cyan-200 bg-cyan-50/40' : 'border-black/[.06]'}`}>
            <div className="flex flex-wrap items-center gap-1.5">
              {step.relevance === 'high' && <Pill tone="info">empfohlen</Pill>}
              <Pill tone={CONNECTION_TONE[step.connection]}>{CONNECTION_LABEL[step.connection]}{step.connectedSystem ? `: ${step.connectedSystem}` : ''}</Pill>
              <Pill tone="muted">Freigabe erforderlich</Pill>
            </div>
            <div className="mt-1.5 text-xs font-semibold leading-5">{step.title}</div>
            <p className="mt-0.5 text-[11px] leading-5 text-black/55">{step.reason}</p>
            {step.needs && <p className="mt-0.5 text-[10px] text-black/45">Benötigt: {step.needs}</p>}
            <Link to={step.route} className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-700 hover:underline">
              {step.connection === 'not-connected' || step.connection === 'error' ? 'Verbindung einrichten' : 'Öffnen'} <ArrowRight size={12} />
            </Link>
          </li>
        ))}
      </ul>
      {steps.length > 0 && (
        <p className="mt-3 flex gap-1.5 text-[10px] leading-4 text-black/45"><AlertTriangle size={12} className="mt-0.5 shrink-0" />Keine Verbindung wird hier behauptet: „verbunden" steht nur da, wo die Registratur einen verbundenen Eintrag führt.</p>
      )}
      <Link to="/app/evidence" className="mt-4 inline-flex items-center gap-1 text-[11px] font-semibold text-black/60 hover:underline">Nachweise ansehen <ExternalLink size={11} /></Link>
    </div>
  );
}
