import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, ChevronLeft, Eye, Globe, Loader2, Monitor, PencilLine, RefreshCw, Save, Smartphone, Sparkles, Tablet, Wand2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getSupabase } from '../../lib/supabase';
import { useTenant } from '../../core/access/TenantProvider';
import { useSupabaseAuth } from '../../features/supabase/SupabaseAuthContext';
import { buildSite, editSite, errorMessage } from '../../features/siteos/siteOsApi';
import type { EditChange, SiteBlueprint } from '../../../packages/siteos-core/src/index';
import { applyPageEdits, canonicalize } from '../../../packages/siteos-core/src/index';
import { renderSite } from '../../../packages/siteos-core/src/render/renderer';
import { applySiteDesignTemplate, SITE_DESIGN_TEMPLATES, type SiteDesignTemplate } from '../../../packages/siteos-core/src/render/templates';
import { createSiteOsCheckoutSession } from '../../features/billing/checkout';
import { SandboxedPreviewFrame } from '../../components/preview/SandboxedPreviewFrame';
import { toPageEdit, type PuckPageData } from '../../features/siteos/editor/blueprintPuckAdapter';
import {
  EdgeFunctionAvailabilityNotice,
  allEdgeFunctionsAvailable,
} from '../../components/landing/EdgeFunctionAvailabilityNotice';

/**
 * Der Block-Editor (Puck) wird erst geladen, wenn es einen Blueprint gibt:
 * Er bringt Drag-and-drop, Felder und Rich-Text mit und gehört nicht in den
 * kritischen Pfad dieser Seite — die ohne ihn nur nach der Domain fragt.
 */
const SiteOsBlockEditor = lazy(() => import('../../features/siteos/editor/SiteOsBlockEditor'));

/**
 * Die Function, auf der dieser Builder steht.
 *
 * `siteos/discover` liest die Ausgangsseite, `siteos/builder` erzeugt daraus
 * den Blueprint, `siteos/edit` speichert Bearbeitungen aus dem Block-Editor.
 * Alle sind Pfade **eines** Function-Slots `siteos` — geprueft wird deshalb
 * ein Name, nicht drei. Fehlt er, gibt es nichts zu zeigen: Die Oberflaeche
 * zeigte einen leeren Rahmen und eine Fehlermeldung in der Seitenleiste,
 * waehrend die Kopfzeile „Ihre neue Website ist bereits gebaut" behauptet.
 *
 * Geprueft wird **vor** dem Aufbau, nicht danach: Anders als beim
 * Onboarding kostet ein Fehlversuch hier keine Anfrage, sondern eine Minute
 * Ladebalken mit einem Versprechen darueber.
 */
const BUILDER_FUNCTIONS = ['siteos'] as const;

type Discovery = { source_url: string; title: string | null; description: string | null; h1: string | null; services: string[]; visible_text: string };
type Device = 'desktop' | 'tablet' | 'mobile';
type Mode = 'edit' | 'preview';

/** Der zuletzt gespeicherte Stand — Grundlage jeder Bearbeitung und ihres `base_sha256`. */
type Stored = { blueprint: SiteBlueprint; sha256: string; version: number };

const DEVICE_WIDTH: Record<Device, string> = { desktop: '100%', tablet: '820px', mobile: '390px' };
const QUICK_ACTIONS = ['Hero hochwertiger machen', 'Conversion verbessern', 'Mobile optimieren', 'SEO stärken'];
const SECTION_LABEL = 'mb-3 text-[10px] font-bold uppercase tracking-[.16em] text-black/35';

export default function PreviewSelectionPage() {
  const navigate = useNavigate();
  const { activeTenantId, loading: tenantLoading } = useTenant();
  const { isAuthenticated } = useSupabaseAuth();
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  // Die Ausgangs-URL kommt normalerweise als Query-Parameter (WowPreview,
  // Audit-Handoff). Die Landing-CTA verlinkt aber ohne Parameter hierher —
  // dann muss die Domain hier abgefragt werden, statt dass der Aufbau mit
  // leerer URL still scheitert und der Ladebalken nie endet.
  const initialUrl = params.get('url') || params.get('domain') || '';
  const [sourceUrl, setSourceUrl] = useState(initialUrl);
  const [urlInput, setUrlInput] = useState(initialUrl);
  const [urlInputError, setUrlInputError] = useState('');
  const auditId = params.get('auditId') || params.get('auditid') || '';
  const [discovery, setDiscovery] = useState<Discovery | null>(null);
  const [stored, setStored] = useState<Stored | null>(null);
  const [template, setTemplate] = useState<SiteDesignTemplate>((params.get('variant') as SiteDesignTemplate) || 'modern-minimal');
  const [device, setDevice] = useState<Device>('desktop');
  const [mode, setMode] = useState<Mode>('edit');
  const [pagePath, setPagePath] = useState('/');
  // Bearbeitungen je Seite, wie Puck sie liefert. Daraus entsteht sowohl die
  // lokale Vorschau als auch die Anfrage an den Server — dieselben Daten.
  const [pageData, setPageData] = useState<Record<string, PuckPageData>>({});
  // Zählt jeden neuen gespeicherten Stand; setzt den Editor neu auf.
  const [revision, setRevision] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveNote, setSaveNote] = useState('');
  const [lastChanges, setLastChanges] = useState<EditChange[]>([]);
  // Ohne verfuegbares Backend oder ohne Ausgangs-URL gar nicht erst in den
  // Ladezustand starten: Der Vollbild-Ladebalken „Ihre neue Website wird
  // gebaut" waere sonst das Erste, was ein Nutzer sieht, und er stuende dort
  // dauerhaft.
  const [busy, setBusy] = useState(() => Boolean(initialUrl) && allEdgeFunctionsAvailable(BUILDER_FUNCTIONS));
  const [error, setError] = useState('');
  const [instruction, setInstruction] = useState('');

  const edits = useMemo(() => Object.entries(pageData).map(([path, data]) => toPageEdit(path, data)), [pageData]);
  // Die lokale Fassung läuft durch dieselbe Logik wie der Server: Was die
  // Leinwand zeigt, ist, was gespeichert würde — nicht, was der Browser
  // sich wünscht.
  const localBlueprint = useMemo(
    () => stored ? (edits.length > 0 ? applyPageEdits(stored.blueprint, edits).blueprint : stored.blueprint) : null,
    [stored, edits],
  );
  const dirty = useMemo(
    () => Boolean(stored && localBlueprint && canonicalize(localBlueprint) !== canonicalize(stored.blueprint)),
    [stored, localBlueprint],
  );

  const build = useCallback(async (instructionOverride = '') => {
    // Ohne URL fragt die Oberflaeche zuerst nach der Domain — kein Spinner.
    if (!sourceUrl) { setBusy(false); return; }
    // Solange der Tenant noch laedt, den Ladezustand halten: der Effect ruft
    // nach dem Laden erneut auf. Fehlt danach ein Workspace, ist das ein
    // echter Fehler und darf nicht als ewiger Ladebalken enden.
    if (!activeTenantId) {
      if (!tenantLoading) { setBusy(false); setError('Kein aktiver Workspace gefunden. Bitte erneut anmelden oder das Onboarding abschließen.'); }
      return;
    }
    // Vor dem Ladebalken, nicht danach — siehe BUILDER_FUNCTIONS.
    if (!allEdgeFunctionsAvailable(BUILDER_FUNCTIONS)) { setBusy(false); return; }
    setBusy(true); setError('');
    try {
      const sb = getSupabase();
      const { data: found, error: discoveryError } = await sb.functions.invoke('siteos/discover', { body: { tenant_id: activeTenantId, url: sourceUrl } });
      if (discoveryError) throw discoveryError;
      const site = found as Discovery;
      if (!site?.source_url) throw new Error('Die Ausgangswebsite konnte nicht analysiert werden.');
      setDiscovery(site);
      const prompt = [
        'Erstelle ein vollständiges, hochwertiges Redesign als echtes RealSync SiteOS-Projekt.',
        `Ausgangswebsite: ${site.source_url}.`,
        `Titel: ${site.title ?? site.h1 ?? 'Website'}.`,
        `Leistungen: ${site.services.join(', ')}.`,
        'Baue eine echte responsive Startseite mit Hero, Leistungen, Vertrauensbereich, Referenzen, FAQ, Kontakt und Footer.',
        'Premium-B2B-Design, klare Informationsarchitektur, starke Typografie und Conversion-Führung.',
        'SEO-fähig, DSGVO-bewusst, barrierearm, EU-AI-Act-ready und ohne fremde Tracker oder Scripts.',
        instructionOverride ? `Zusätzliche Kundenanweisung: ${instructionOverride}` : '',
      ].filter(Boolean).join('\n');
      const result = await buildSite({ tenant_id: activeTenantId, prompt, locale: 'de', enrichment: { name: site.title ?? site.h1 ?? undefined, summary: site.description ?? site.visible_text.slice(0, 600), services: site.services } });
      if (result.kind !== 'ok' || !result.data.blueprint) throw new Error(result.kind === 'ok' ? 'Blueprint fehlt.' : errorMessage(result));
      setStored({ blueprint: result.data.blueprint, sha256: result.data.content_sha256, version: result.data.version });
      setPageData({}); setLastChanges([]); setSaveNote(''); setPagePath('/');
      setRevision((r) => r + 1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Die neue Website konnte nicht erzeugt werden.'); }
    finally { setBusy(false); }
  }, [activeTenantId, tenantLoading, sourceUrl]);

  useEffect(() => {
    if (!isAuthenticated) { navigate(`/welcome?next=${encodeURIComponent(window.location.pathname + window.location.search)}`); return; }
    void build();
  }, [build, isAuthenticated, navigate]);

  /**
   * Die KI baut die gesamte Site neu — aus der Ausgangsseite, nicht aus dem
   * bearbeiteten Stand. Ungespeicherte Bearbeitungen gingen dabei verloren;
   * das wird gefragt, nicht angenommen.
   */
  const rebuildWithAi = (text: string) => {
    if (dirty && !window.confirm('Die KI baut die Website neu aus der Ausgangsseite. Ungespeicherte Änderungen im Editor gehen dabei verloren. Fortfahren?')) return;
    void build(text);
  };

  // Nutzereingabe der Ausgangsdomain: nachsichtig normalisieren (Protokoll
  // ergaenzen), aber vor dem Start pruefen — eine unbrauchbare URL wuerde
  // sonst erst nach dem Ladebalken als Discovery-Fehler sichtbar.
  const submitUrl = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) { setUrlInputError('Bitte geben Sie die Adresse Ihrer bestehenden Website ein.'); return; }
    const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    let parsed: URL;
    try { parsed = new URL(candidate); } catch { setUrlInputError('Das sieht nicht nach einer gültigen Website-Adresse aus.'); return; }
    if (!parsed.hostname.includes('.')) { setUrlInputError('Bitte eine vollständige Domain angeben, z. B. ihre-firma.de.'); return; }
    setUrlInputError('');
    const normalized = parsed.toString();
    // Query-Parameter mitschreiben, damit Reload und geteilte Links denselben
    // Stand zeigen wie die Eingabe.
    const search = new URLSearchParams(window.location.search);
    search.set('url', normalized);
    navigate({ search: `?${search.toString()}` }, { replace: true });
    setSourceUrl(normalized);
  };

  const previewBlueprint = useMemo(() => localBlueprint ? applySiteDesignTemplate(localBlueprint, template) : null, [localBlueprint, template]);
  // `showcase` haengt die Layoutschicht aus `render/presentation.ts` an.
  // Ohne sie zeigt die Vorlagenauswahl ein rohes HTML-Dokument, und die
  // Auswahl darueber bleibt wirkungslos: Sie tauscht nur Farb-Tokens, auf
  // die ohne Layoutschicht nichts reagiert. Der Renderer-Default bleibt
  // `minimal`, weil er die Grundlage der Artefakt-Hashes ist.
  const previewHtml = useMemo(() => previewBlueprint ? renderSite(previewBlueprint, { baseUrl: sourceUrl, presentation: 'showcase' }).find(page => page.path === pagePath)?.html ?? '' : '', [previewBlueprint, sourceUrl, pagePath]);

  const save = async () => {
    if (!activeTenantId || !stored || edits.length === 0 || saving) return;
    setSaving(true); setError(''); setSaveNote('');
    try {
      const result = await editSite({ tenant_id: activeTenantId, slug: stored.blueprint.slug, base_sha256: stored.sha256, edits });
      if (result.kind !== 'ok') throw new Error(errorMessage(result));
      const saved = result.data;
      setStored({ blueprint: saved.blueprint, sha256: saved.content_sha256, version: saved.version });
      setPageData({}); setRevision((r) => r + 1);
      setLastChanges(saved.changes);
      setSaveNote(saved.unchanged
        ? 'Keine Änderungen zu speichern.'
        : `Version ${saved.version} gespeichert und geprüft.${saved.rejected.length > 0 ? ` ${saved.rejected.length} Teil${saved.rejected.length === 1 ? '' : 'e'} der Anfrage abgewiesen.` : ''}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Die Änderungen konnten nicht gespeichert werden.'); }
    finally { setSaving(false); }
  };

  const checkout = async () => {
    if (!activeTenantId || !discovery) return;
    setBusy(true); setError('');
    try {
      const result = await createSiteOsCheckoutSession({ tenantId: activeTenantId, sourceUrl: discovery.source_url, siteSlug: stored?.blueprint.slug, projectName: discovery.title ?? discovery.h1 ?? undefined });
      if (!result.ok || !result.url) throw new Error(result.error?.message ?? 'Checkout konnte nicht vorbereitet werden.');
      window.location.assign(result.url);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Checkout konnte nicht vorbereitet werden.'); setBusy(false); }
  };

  const pages = localBlueprint?.pages ?? [];

  const designPanel = (
    <div className="mt-7 border-t border-black/[.07] pt-5">
      <div className={SECTION_LABEL}>Design</div>
      {SITE_DESIGN_TEMPLATES.map(item => <button key={item.id} onClick={() => setTemplate(item.id)} className={`mb-2 flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-xs ${template === item.id ? 'border-cyan-400/40 bg-cyan-50 text-cyan-800' : 'border-black/[.07]'}`}>{item.label}{template === item.id && <Check size={14}/>}</button>)}
    </div>
  );

  const canvasHeader = (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-black/[.07] bg-white px-3 py-2 shadow-sm">
      <div className="flex min-w-0 items-center gap-2">
        <div className="min-w-0 truncate text-xs font-semibold">{discovery?.title || sourceUrl || 'Ihre neue Website'}</div>
        {pages.length > 1 && (
          <select value={pagePath} onChange={e => setPagePath(e.target.value)} aria-label="Seite" className="rounded-md border border-black/[.08] bg-white px-2 py-1 text-xs">
            {pages.map(page => <option key={page.path} value={page.path}>{page.path === '/' ? 'Startseite' : page.title}</option>)}
          </select>
        )}
      </div>
      <div className="flex items-center gap-2">
        {stored && (
          <div className="flex items-center gap-1 rounded-lg bg-black/[.04] p-1" role="group" aria-label="Ansicht">
            <button onClick={() => setMode('edit')} className={`inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-[11px] ${mode === 'edit' ? 'bg-white shadow' : ''}`} aria-pressed={mode === 'edit'}><PencilLine size={13}/> Bearbeiten</button>
            <button onClick={() => setMode('preview')} className={`inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-[11px] ${mode === 'preview' ? 'bg-white shadow' : ''}`} aria-pressed={mode === 'preview'}><Eye size={13}/> Vorschau</button>
          </div>
        )}
        <div className="flex items-center gap-1 rounded-lg bg-black/[.04] p-1"><button onClick={() => setDevice('desktop')} className={`rounded-md p-1.5 ${device === 'desktop' ? 'bg-white shadow' : ''}`} aria-label="Desktop"><Monitor size={14}/></button><button onClick={() => setDevice('tablet')} className={`rounded-md p-1.5 ${device === 'tablet' ? 'bg-white shadow' : ''}`} aria-label="Tablet"><Tablet size={14}/></button><button onClick={() => setDevice('mobile')} className={`rounded-md p-1.5 ${device === 'mobile' ? 'bg-white shadow' : ''}`} aria-label="Mobil"><Smartphone size={14}/></button></div>
      </div>
    </div>
  );

  const aiPanel = (
    <>
      <EdgeFunctionAvailabilityNotice functions={BUILDER_FUNCTIONS} title="Der Aufbau ist derzeit nicht verfügbar" detail="Die Dienste, die Ihre Ausgangsseite lesen und daraus einen Entwurf bauen, laufen noch nicht in Produktion. Sobald sie deployt sind, arbeitet diese Oberfläche ohne weitere Änderung." className="mb-5 border-amber-500/40 bg-amber-50 [&_p:first-child]:text-amber-900 [&_p:last-child]:text-amber-800/80" />
      {stored && (
        <div className="mb-5 rounded-xl border border-black/[.07] bg-[#f8fafc] p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] text-black/55">{dirty ? 'Ungespeicherte Änderungen' : `Version ${stored.version} gespeichert`}</div>
            <button onClick={() => void save()} disabled={!dirty || saving || busy} className="inline-flex items-center gap-1.5 rounded-lg bg-[#111827] px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-40">{saving ? <Loader2 size={12} className="animate-spin"/> : <Save size={12}/>} Speichern</button>
          </div>
          {saveNote && <div className="mt-2 text-[11px] leading-5 text-emerald-700">{saveNote}</div>}
          {lastChanges.length > 0 && (
            <ul className="mt-2 space-y-1 text-[11px] leading-5 text-black/60">
              {lastChanges.slice(0, 6).map(change => (
                <li key={`${change.code}:${change.blockId}`}>{change.summary}{change.complianceNote && <span className="block text-amber-800">{change.complianceNote}</span>}</li>
              ))}
              {lastChanges.length > 6 && <li>… und {lastChanges.length - 6} weitere.</li>}
            </ul>
          )}
        </div>
      )}
      <div className="flex items-center gap-2 text-sm font-bold"><Wand2 size={17} className="text-cyan-600"/> AI Website Editor</div>
      <p className="mt-1 text-xs leading-5 text-black/45">Die Website ist bereits generiert. Sag der KI, was geändert werden soll.</p>
      <textarea value={instruction} onChange={e => setInstruction(e.target.value)} placeholder="z. B. Hero hochwertiger, CTA stärker, mehr Vertrauen …" className="mt-4 min-h-28 w-full resize-none rounded-xl border border-black/[.08] p-3 text-xs outline-none"/>
      <button onClick={() => { const text = instruction.trim(); if (text) { setInstruction(''); rebuildWithAi(text); } }} disabled={!instruction.trim() || busy} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#111827] px-3 py-2.5 text-xs font-bold text-white disabled:opacity-40"><Wand2 size={14}/> AI anwenden</button>
      <div className="mt-5 text-[10px] font-bold uppercase tracking-[.16em] text-black/35">Schnellaktionen</div>
      {QUICK_ACTIONS.map(action => <button key={action} onClick={() => rebuildWithAi(action)} disabled={busy} className="mt-2 flex w-full items-center justify-between rounded-lg border border-black/[.07] px-3 py-2.5 text-left text-xs text-black/60 hover:bg-black/[.03] disabled:opacity-40">{action}<ArrowRight size={13}/></button>)}
      <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4"><div className="text-xs font-bold text-emerald-800">Governance Layer</div><div className="mt-1 text-[11px] leading-5 text-emerald-700">SEO · DSGVO · Accessibility · EU AI Act · Evidence</div></div>
      <button onClick={() => void checkout()} disabled={!stored || busy} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-3 text-xs font-bold text-[#06111f] disabled:opacity-40">Website fertig umsetzen <ArrowRight size={14}/></button>
      {dirty && <div className="mt-2 text-[10px] leading-4 text-black/45">Ungespeicherte Änderungen werden nicht übernommen — vorher speichern.</div>}
      {auditId && <div className="mt-3 text-[9px] text-black/30">Audit {auditId.slice(0, 12)}…</div>}
      {error && <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-[11px] leading-5 text-rose-700">{error}</div>}
    </>
  );

  const editorFallback = (
    <div className="grid min-h-[calc(100vh-4rem)] place-items-center text-xs text-black/45"><Loader2 className="mr-2 animate-spin" size={14}/> Editor wird geladen …</div>
  );

  return (
    <main className="min-h-screen bg-[#f3f5f7] text-[#111827]">
      <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-black/[.08] bg-white/95 px-4 backdrop-blur sm:px-6">
        <div className="flex items-center gap-3"><button onClick={() => navigate(-1)} className="rounded-lg p-2 hover:bg-black/[.05]" aria-label="Zurück"><ChevronLeft size={18}/></button><div className="grid h-8 w-8 place-items-center rounded-lg bg-[#07111f] text-cyan-300"><Sparkles size={15}/></div><div><div className="text-sm font-bold">RealSync SiteOS Builder</div><div className="text-[10px] text-black/45">{allEdgeFunctionsAvailable(BUILDER_FUNCTIONS) ? 'Ihre neue Website ist bereits gebaut' : 'Aufbau derzeit nicht verfügbar'}</div></div></div>
        <div className="flex items-center gap-2"><span className="hidden rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-semibold text-emerald-700 sm:inline">Live Preview</span>{stored && <button onClick={() => void save()} disabled={!dirty || saving || busy} className="inline-flex items-center gap-2 rounded-lg border border-black/[.12] bg-white px-3 py-2 text-xs font-bold text-[#111827] disabled:opacity-40"><Save size={14}/> Speichern</button>}<button onClick={() => void checkout()} disabled={!stored || busy} className="inline-flex items-center gap-2 rounded-lg bg-[#111827] px-4 py-2 text-xs font-bold text-white disabled:opacity-40">Fertig umsetzen <ArrowRight size={14}/></button></div>
      </header>

      {stored && localBlueprint && mode === 'edit' ? (
        <Suspense fallback={editorFallback}>
          <SiteOsBlockEditor
            storedBlueprint={stored.blueprint}
            localBlueprint={localBlueprint}
            template={template}
            pagePath={pagePath}
            pageData={pageData[pagePath]}
            onPageDataChange={(path, data) => setPageData(prev => ({ ...prev, [path]: data }))}
            canvasWidth={DEVICE_WIDTH[device]}
            revision={revision}
            asideLeft={designPanel}
            asideRight={aiPanel}
            canvasHeader={canvasHeader}
          />
        </Suspense>
      ) : (
        <div className="grid min-h-[calc(100vh-4rem)] lg:grid-cols-[230px_minmax(0,1fr)_300px]">
          <aside className="hidden border-r border-black/[.07] bg-white p-4 lg:block">
            <div className={SECTION_LABEL}>Seiten</div>
            {pages.map((page, i) => <button key={page.path} onClick={() => setPagePath(page.path)} aria-pressed={page.path === pagePath} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs hover:bg-black/[.04] ${page.path === pagePath ? 'bg-black/[.04] font-semibold' : ''}`}><span className="grid h-6 w-6 place-items-center rounded-md bg-black/[.04] text-[9px] text-black/45">{i + 1}</span>{page.path === '/' ? 'Startseite' : page.title}</button>)}
            {designPanel}
          </aside>
          <section className="min-w-0 p-3 sm:p-5">{canvasHeader}<div className="flex min-h-[calc(100vh-10rem)] items-start justify-center overflow-auto rounded-2xl border border-black/[.08] bg-[#dfe4ea] p-3 sm:p-6"><div style={{ width: DEVICE_WIDTH[device] }} className="overflow-hidden rounded-xl bg-white shadow-2xl"><SandboxedPreviewFrame title="Ihre neu gebaute Website" html={previewHtml} className="h-[760px] w-full border-0 bg-white" /></div></div></section>
          <aside className="border-t border-black/[.07] bg-white p-4 lg:border-l lg:border-t-0 sm:p-5">{aiPanel}</aside>
        </div>
      )}

      {busy && <div className="fixed inset-0 z-[60] grid place-items-center bg-[#07111f]/70 p-5 backdrop-blur-sm"><div className="w-full max-w-md rounded-2xl bg-white p-7 text-center shadow-2xl"><div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-cyan-50 text-cyan-600"><Loader2 className="animate-spin" size={22}/></div><h2 className="mt-4 text-lg font-bold">Ihre neue Website wird gebaut</h2><p className="mt-2 text-sm leading-6 text-black/50">RealSync analysiert die bestehende Website und erzeugt daraus gerade ein vollständiges SiteOS-Redesign.</p><div className="mt-5 flex items-center justify-center gap-2 text-[10px] text-black/35"><RefreshCw size={12} className="animate-spin"/> Analyse · Blueprint · Render</div></div></div>}
      {!sourceUrl && !busy && <div className="fixed inset-0 z-[60] grid place-items-center bg-[#07111f]/70 p-5 backdrop-blur-sm"><form onSubmit={e => { e.preventDefault(); submitUrl(urlInput); }} className="w-full max-w-md rounded-2xl bg-white p-7 shadow-2xl"><div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-cyan-50 text-cyan-600"><Globe size={22}/></div><h2 className="mt-4 text-center text-lg font-bold">Welche Website sollen wir neu bauen?</h2><p className="mt-2 text-center text-sm leading-6 text-black/50">Geben Sie die Adresse Ihrer bestehenden Website ein. RealSync analysiert sie und erzeugt daraus ein vollständiges SiteOS-Redesign.</p><input value={urlInput} onChange={e => setUrlInput(e.target.value)} autoFocus inputMode="url" autoComplete="url" placeholder="ihre-firma.de" aria-label="Adresse Ihrer bestehenden Website" className="mt-5 w-full rounded-xl border border-black/[.08] px-4 py-3 text-sm outline-none focus:border-cyan-400/60" />{urlInputError && <p className="mt-2 text-xs leading-5 text-rose-600">{urlInputError}</p>}<button type="submit" className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#111827] px-4 py-3 text-sm font-bold text-white">Website bauen <ArrowRight size={15}/></button></form></div>}
    </main>
  );
}
