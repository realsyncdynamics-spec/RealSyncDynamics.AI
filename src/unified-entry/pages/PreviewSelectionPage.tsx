// Einstieg in den App Builder — /unified-entry/transformation (und
// /app/siteos/builder, dieselbe Komponente).
//
// Seit dem 2026-09-07 (Zielbild `docs/product/app-builder-zielbild.md` §4)
// ist diese Seite **Einstieg, nicht Editor**: Sie fragt „Was möchtest du
// bauen?", lässt den Server daraus eine Site erzeugen und leitet in den
// Workspace `/builder/:slug`. Bearbeitet wird dort — ein Builder, nicht zwei.
//
// ## Zwei Wege, ein Server
//
//   • **Beschreibung** (primär): Der Text geht unverändert als `prompt` an
//     `siteos/builder`. Der Server leitet daraus deterministisch Branche, Ort,
//     Seitenplan und genannte Bausteine ab (`parseBrief`, `deriveRequests`,
//     `refineBlueprint` — regelbasiert, **ohne Sprachmodell**). Genau diese
//     Ableitung läuft hier im Browser vorab, damit die Seite vor dem Bau
//     sagt, was erkannt wurde — und was nicht. Was der Kern nicht erkennt,
//     wird nicht erfunden; die freie Umsetzung einer Beschreibung durch
//     KI-Actions ist Schritt C und wird hier nicht vorgetäuscht.
//   • **Bestehende Website** (sekundär, bis Schritt C live ist der einzige
//     Weg mit echten Inhalten): `siteos/discover` liest die Ausgangsseite,
//     der Builder baut aus Titel, Leistungen und Beschreibung. Aufrufer mit
//     `?url=` (Audit-Handoff, WowPreview, „Mit KI neu bauen" aus dem
//     Workspace) landen weiterhin direkt in diesem Pfad.
//
// Der Browser schickt in beiden Fällen keinen Blueprint. Was entsteht, prüft
// und versioniert der Server (`persist.ts`); die Kette liegt in der
// Datenbank, der Workspace lädt sie neu.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, ChevronLeft, Globe, Loader2, MessageSquareText, RefreshCw, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getSupabase } from '../../lib/supabase';
import { useTenant } from '../../core/access/TenantProvider';
import { useSupabaseAuth } from '../../features/supabase/SupabaseAuthContext';
import { buildSite, errorMessage } from '../../features/siteos/siteOsApi';
import { deriveRequests, getIndustryPreset, parseBrief } from '../../../packages/siteos-core/src/index';
import {
  EdgeFunctionAvailabilityNotice,
  allEdgeFunctionsAvailable,
} from '../../components/landing/EdgeFunctionAvailabilityNotice';

/**
 * Die Function, auf der dieser Einstieg steht. `siteos/discover` und
 * `siteos/builder` sind Pfade **eines** Function-Slots `siteos` — geprüft wird
 * deshalb ein Name. Geprüft wird **vor** dem Ladebalken: Ein Fehlversuch
 * kostete sonst eine Minute Ladebalken mit einem Versprechen darüber.
 */
const BUILDER_FUNCTIONS = ['siteos'] as const;

type Discovery = { source_url: string; title: string | null; description: string | null; h1: string | null; services: string[]; visible_text: string };
type Mode = 'describe' | 'url';

const EXAMPLE = 'Erstelle mir eine moderne Website für einen Sanitärbetrieb mit Startseite, Leistungen, Über uns, Kontakt und Terminbuchung';
const MIN_DESCRIPTION = 8;
const MAX_DESCRIPTION = 2000;

/**
 * Was der Kern aus der Beschreibung ableiten wird — dieselben Funktionen,
 * die der Server benutzt, also keine Vorhersage, sondern das Ergebnis.
 */
export function recognizeDescription(text: string): {
  industryLabel: string;
  confident: boolean;
  locality: string | null;
  pages: string[];
  requests: string[];
} | null {
  const trimmed = text.trim();
  if (trimmed.length < MIN_DESCRIPTION) return null;
  const brief = parseBrief(trimmed, 'de');
  const preset = getIndustryPreset(brief.industry);
  return {
    industryLabel: preset.label,
    confident: brief.industryConfident,
    locality: brief.locality,
    pages: preset.pagePlan.filter((page) => !page.noindex).map((page) => page.title),
    requests: deriveRequests(trimmed).map((request) => request.replace(/ hinzufügen\.$/, '')),
  };
}

export default function PreviewSelectionPage() {
  const navigate = useNavigate();
  const { activeTenantId, loading: tenantLoading } = useTenant();
  const { isAuthenticated } = useSupabaseAuth();
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  // `?url=` kommt von Aufrufern, die eine bestehende Website meinen
  // (Audit-Handoff, WowPreview, Workspace-Neubau). Dann läuft der URL-Pfad
  // sofort an — wie bisher. Ohne Parameter beginnt die Seite mit der Frage.
  const initialUrl = params.get('url') || params.get('domain') || '';
  const auditId = params.get('auditId') || params.get('auditid') || '';
  const variant = params.get('variant') || '';
  const available = allEdgeFunctionsAvailable(BUILDER_FUNCTIONS);

  const [mode, setMode] = useState<Mode>(initialUrl ? 'url' : 'describe');
  const [description, setDescription] = useState('');
  const [sourceUrl, setSourceUrl] = useState(initialUrl);
  const [urlInput, setUrlInput] = useState(initialUrl);
  const [urlInputError, setUrlInputError] = useState('');
  const [busy, setBusy] = useState<false | Mode>(() => (initialUrl && available ? 'url' : false));
  const [error, setError] = useState('');

  const recognition = useMemo(() => recognizeDescription(description), [description]);

  const toWorkspace = useCallback((slug: string, source: string | null) => {
    const search = new URLSearchParams();
    if (source) search.set('source', source);
    if (variant) search.set('variant', variant);
    const query = search.toString();
    navigate(`/builder/${encodeURIComponent(slug)}${query ? `?${query}` : ''}`, { replace: true });
  }, [navigate, variant]);

  const requireTenant = useCallback((): string | null => {
    if (!activeTenantId) {
      if (!tenantLoading) { setBusy(false); setError('Kein aktiver Workspace gefunden. Bitte erneut anmelden oder das Onboarding abschließen.'); }
      return null;
    }
    if (!available) { setBusy(false); return null; }
    return activeTenantId;
  }, [activeTenantId, tenantLoading, available]);

  // ── Weg 1: Beschreibung → Builder ─────────────────────────────────────
  const buildFromDescription = useCallback(async () => {
    const text = description.trim().slice(0, MAX_DESCRIPTION);
    if (text.length < MIN_DESCRIPTION) return;
    const tenantId = requireTenant();
    if (!tenantId) return;
    setBusy('describe'); setError('');
    try {
      // Unverändert als Prompt: Der Server leitet ab, der Browser schickt
      // weder Brief noch Blueprint. Was der Prüfpfad festhält, ist genau
      // dieser Text (als Hash) — nicht eine hier zusammengesetzte Fassung.
      const result = await buildSite({ tenant_id: tenantId, prompt: text, locale: 'de' });
      if (result.kind !== 'ok' || !result.data.blueprint) throw new Error(result.kind === 'ok' ? 'Blueprint fehlt.' : errorMessage(result));
      toWorkspace(result.data.slug, null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Die App konnte nicht erzeugt werden.');
      setBusy(false);
    }
  }, [description, requireTenant, toWorkspace]);

  // ── Weg 2: bestehende Website → Discover → Builder ─────────────────────
  const buildFromUrl = useCallback(async (instructionOverride = '') => {
    if (!sourceUrl) { setBusy(false); return; }
    const tenantId = requireTenant();
    if (!tenantId) return;
    setBusy('url'); setError('');
    try {
      const sb = getSupabase();
      const { data: found, error: discoveryError } = await sb.functions.invoke('siteos/discover', { body: { tenant_id: tenantId, url: sourceUrl } });
      if (discoveryError) throw discoveryError;
      const site = found as Discovery;
      if (!site?.source_url) throw new Error('Die Ausgangswebsite konnte nicht analysiert werden.');
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
      const result = await buildSite({ tenant_id: tenantId, prompt, locale: 'de', enrichment: { name: site.title ?? site.h1 ?? undefined, summary: site.description ?? site.visible_text.slice(0, 600), services: site.services } });
      if (result.kind !== 'ok' || !result.data.blueprint) throw new Error(result.kind === 'ok' ? 'Blueprint fehlt.' : errorMessage(result));
      // Die Ausgangs-URL wandert mit, damit der Workspace für „Mit KI neu
      // bauen" und den Checkout dieselbe Quelle kennt.
      toWorkspace(result.data.slug, site.source_url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Die neue Website konnte nicht erzeugt werden.');
      setBusy(false);
    }
  }, [sourceUrl, requireTenant, toWorkspace]);

  useEffect(() => {
    if (!isAuthenticated) { navigate(`/welcome?next=${encodeURIComponent(window.location.pathname + window.location.search)}`); return; }
    // Der Workspace schickt Anweisungen für einen KI-Neubau als Parameter
    // hierher; Aufrufer mit `?url=` erwarten den sofortigen Aufbau.
    if (sourceUrl) void buildFromUrl(params.get('instruction') ?? '');
  }, [buildFromUrl, isAuthenticated, navigate, params, sourceUrl]);

  // Nutzereingabe der Ausgangsdomain: nachsichtig normalisieren (Protokoll
  // ergänzen), aber vor dem Start prüfen — eine unbrauchbare URL würde
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
    const search = new URLSearchParams(window.location.search);
    search.set('url', normalized);
    navigate({ search: `?${search.toString()}` }, { replace: true });
    setSourceUrl(normalized);
  };

  const canDescribe = available && description.trim().length >= MIN_DESCRIPTION && !busy;

  return (
    <main className="min-h-screen bg-[#f3f5f7] text-[#111827]">
      <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-black/[.08] bg-white/95 px-4 backdrop-blur sm:px-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="rounded-lg p-2 hover:bg-black/[.05]" aria-label="Zurück"><ChevronLeft size={18} /></button>
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#07111f] text-cyan-300"><Sparkles size={15} /></div>
          <div>
            <div className="text-sm font-bold">RealSync SiteOS Builder</div>
            <div className="text-[10px] text-black/45">{available ? 'Beschreiben · bauen lassen · im Workspace bearbeiten' : 'Aufbau derzeit nicht verfügbar'}</div>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
        <EdgeFunctionAvailabilityNotice
          functions={BUILDER_FUNCTIONS}
          title="Der Aufbau ist derzeit nicht verfügbar"
          detail="Die Dienste, die aus einer Beschreibung oder einer Ausgangsseite einen Entwurf bauen, laufen noch nicht in Produktion. Sobald sie deployt sind, arbeitet diese Seite ohne weitere Änderung."
          className="mb-5 border-amber-500/40 bg-amber-50 [&_p:first-child]:text-amber-900 [&_p:last-child]:text-amber-800/80"
        />

        {mode === 'describe' ? (
          <form onSubmit={(e) => { e.preventDefault(); void buildFromDescription(); }} className="rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-cyan-50 text-cyan-600"><MessageSquareText size={22} /></div>
            <h1 className="mt-4 text-xl font-bold sm:text-2xl">Was möchtest du bauen?</h1>
            <p className="mt-2 text-sm leading-6 text-black/55">Beschreiben Sie die Anwendung in eigenen Worten — Branche, Ort, gewünschte Seiten und Funktionen. RealSync baut daraus eine strukturierte Site, die Sie im Workspace visuell bearbeiten.</p>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, MAX_DESCRIPTION))}
              autoFocus
              rows={4}
              maxLength={MAX_DESCRIPTION}
              placeholder={`z. B. ${EXAMPLE}`}
              aria-label="Was möchtest du bauen?"
              className="mt-5 w-full resize-none rounded-xl border border-black/[.08] px-4 py-3 text-sm leading-6 outline-none focus:border-cyan-400/60"
            />

            {/* Was der Server daraus macht — vor dem Bau, aus denselben Funktionen. */}
            <div data-testid="recognition" className="mt-4 rounded-xl border border-black/[.07] bg-[#f8fafc] p-4 text-xs leading-5">
              <div className="text-[10px] font-bold uppercase tracking-[.16em] text-black/35">Erkannt aus Ihrer Beschreibung</div>
              {!recognition ? (
                <p className="mt-2 text-black/45">Sobald Sie schreiben, steht hier, was RealSync daraus ableitet — Branche, Ort, Seitenplan und genannte Bausteine.</p>
              ) : (
                <dl className="mt-2 grid grid-cols-[92px_minmax(0,1fr)] gap-x-3 gap-y-1">
                  <dt className="text-black/45">Branche</dt>
                  <dd>{recognition.confident ? recognition.industryLabel : <span className="text-amber-800">Nicht sicher erkannt — es wird die allgemeine Vorlage („{recognition.industryLabel}") verwendet.</span>}</dd>
                  <dt className="text-black/45">Ort</dt>
                  <dd>{recognition.locality ?? <span className="text-black/45">nicht genannt</span>}</dd>
                  <dt className="text-black/45">Seiten</dt>
                  <dd>{recognition.pages.join(' · ')} <span className="text-black/45">(Seitenplan der Branche)</span></dd>
                  <dt className="text-black/45">Zusätzlich</dt>
                  <dd>{recognition.requests.length > 0 ? recognition.requests.join(' · ') : <span className="text-black/45">keine weiteren Bausteine erkannt</span>}</dd>
                </dl>
              )}
              <p className="mt-3 border-t border-black/[.06] pt-3 text-[11px] leading-5 text-black/50">
                Regelbasiert, ohne Sprachmodell: Erkannt werden Branche, Ort und genannte Bausteine; die Seiten kommen aus dem Seitenplan der Branche. Was nicht erkannt wird, wird nicht erfunden. Seiten und Inhalte bearbeiten Sie anschließend im Workspace; die freie Umsetzung Ihrer Beschreibung durch KI-Actions folgt in einem späteren Schritt.
              </p>
            </div>

            {error && <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-[11px] leading-5 text-rose-700">{error}</div>}

            <button type="submit" disabled={!canDescribe} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#111827] px-4 py-3 text-sm font-bold text-white disabled:opacity-40">
              App bauen <ArrowRight size={15} />
            </button>
            <button type="button" onClick={() => { setMode('url'); setError(''); }} className="mt-4 inline-flex w-full items-center justify-center gap-2 text-xs font-semibold text-black/55 hover:text-black">
              <Globe size={13} /> Sie haben schon eine Website? Bestehende Website neu bauen
            </button>
          </form>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); submitUrl(urlInput); }} className="rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-cyan-50 text-cyan-600"><Globe size={22} /></div>
            <h1 className="mt-4 text-xl font-bold sm:text-2xl">Welche Website sollen wir neu bauen?</h1>
            <p className="mt-2 text-sm leading-6 text-black/55">Geben Sie die Adresse Ihrer bestehenden Website ein. RealSync liest Titel, Leistungen und Beschreibung aus und baut daraus ein SiteOS-Redesign, das Sie im Workspace bearbeiten.</p>
            <input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              autoFocus
              inputMode="url"
              autoComplete="url"
              placeholder="ihre-firma.de"
              aria-label="Adresse Ihrer bestehenden Website"
              className="mt-5 w-full rounded-xl border border-black/[.08] px-4 py-3 text-sm outline-none focus:border-cyan-400/60"
            />
            {urlInputError && <p className="mt-2 text-xs leading-5 text-rose-600">{urlInputError}</p>}
            {error && <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-[11px] leading-5 text-rose-700">{error}</div>}
            <button type="submit" disabled={!available || Boolean(busy)} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#111827] px-4 py-3 text-sm font-bold text-white disabled:opacity-40">
              Website neu bauen <ArrowRight size={15} />
            </button>
            <button type="button" onClick={() => { setMode('describe'); setError(''); }} className="mt-4 inline-flex w-full items-center justify-center gap-2 text-xs font-semibold text-black/55 hover:text-black">
              <MessageSquareText size={13} /> Stattdessen beschreiben, was gebaut werden soll
            </button>
            {auditId && <div className="mt-3 text-center text-[9px] text-black/30">Audit {auditId.slice(0, 12)}…</div>}
          </form>
        )}
      </div>

      {busy && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-[#07111f]/70 p-5 backdrop-blur-sm" role="status" aria-live="polite">
          <div className="w-full max-w-md rounded-2xl bg-white p-7 text-center shadow-2xl">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-cyan-50 text-cyan-600"><Loader2 className="animate-spin" size={22} /></div>
            <h2 className="mt-4 text-lg font-bold">{busy === 'describe' ? 'Ihre App wird gebaut' : 'Ihre neue Website wird gebaut'}</h2>
            <p className="mt-2 text-sm leading-6 text-black/50">
              {busy === 'describe'
                ? 'RealSync leitet aus Ihrer Beschreibung Branche, Seitenplan und Bausteine ab, prüft das Ergebnis und legt die erste Version an.'
                : 'RealSync liest die bestehende Website aus, baut daraus ein SiteOS-Redesign, prüft es und legt die erste Version an.'}
            </p>
            <div className="mt-5 flex items-center justify-center gap-2 text-[10px] text-black/35"><RefreshCw size={12} className="animate-spin" /> {busy === 'describe' ? 'Beschreibung · Blueprint · Prüfung' : 'Analyse · Blueprint · Prüfung'}</div>
          </div>
        </div>
      )}
    </main>
  );
}
